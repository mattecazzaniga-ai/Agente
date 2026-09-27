// Claude-driven brain: a manual tool-use loop so every call goes through our permission layer,
// per-tick cost cap, tool-call limits and logging. From Phase 2 it also carries Anthropic's
// server-side web_search / web_fetch tools for real market research.

import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";
import type { ToolContext } from "../tools/types.js";
import { availableTools, executeTool, toAnthropicTools, webServerTools } from "../tools/registry.js";
import { collectUrls } from "../tools/phase2.js";
import { systemPrompt } from "../agent/prompt.js";
import type { Brain, BrainResult } from "../agent/brain.js";

type Usage = Pick<Anthropic.Beta.BetaUsage, "input_tokens" | "output_tokens" | "cache_creation_input_tokens" | "cache_read_input_tokens"> & {
  server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number } | null;
};

export function usageCostUsd(u: Usage, cfg: Config): number {
  const inP = cfg.llm.inputPricePerM / 1e6;
  const outP = cfg.llm.outputPricePerM / 1e6;
  return (
    u.input_tokens * inP +
    (u.cache_creation_input_tokens ?? 0) * inP * 1.25 +
    (u.cache_read_input_tokens ?? 0) * inP * 0.1 +
    u.output_tokens * outP +
    (u.server_tool_use?.web_search_requests ?? 0) * cfg.llm.webSearchUsd
  );
}

/** Models where server-side refusal fallbacks are recommended. */
const FALLBACK_MODELS = new Set(["claude-opus-5", "claude-fable-5-1", "claude-opus-5-5"]);
/** Haiku 4.5 does not accept `effort` / adaptive thinking, nor the dynamic-filtering web tools. */
const NO_EFFORT_MODELS = new Set(["claude-haiku-4-5"]);
/** Share of the cycle budget after which the agent is told to wrap up. */
const WRAP_UP_AT = 0.75;

export class ClaudeBrain implements Brain {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(
    private readonly cfg: Config,
    client?: Anthropic,
  ) {
    this.name = `claude:${cfg.llm.model}`;
    this.client = client ?? new Anthropic({ timeout: 180_000, maxRetries: 2 });
  }

  async think(ctx: ToolContext, briefing: string, remainingUsd: number): Promise<BrainResult> {
    const cfg = this.cfg;
    // Fixed tool list for the whole cycle so the cached prefix (tools → system) stays valid.
    const tools: Anthropic.Beta.BetaToolUnion[] = [
      ...(toAnthropicTools(availableTools(cfg.phase, "llm", cfg.real.enabled)) as Anthropic.Beta.BetaToolUnion[]),
      ...(NO_EFFORT_MODELS.has(cfg.llm.model) ? [] : webServerTools(cfg)),
    ];
    const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: systemPrompt(cfg), cache_control: { type: "ephemeral" } }];
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: briefing }];
    const budget = Math.min(remainingUsd, cfg.limits.maxLlmUsdPerTick);
    let usd = 0;
    let turns = 0;
    let warned = false;
    const maxTurns = cfg.limits.maxToolCallsPerTick + 4;

    while (turns++ < maxTurns && !ctx.aborted) {
      if (usd >= budget) {
        ctx.log("llm_budget", `cycle LLM budget reached ($${usd.toFixed(4)} ≥ $${budget.toFixed(4)})`);
        break;
      }
      const useFallbacks = FALLBACK_MODELS.has(cfg.llm.model);
      const response = await this.client.beta.messages.create({
        model: cfg.llm.model,
        max_tokens: cfg.llm.maxTokens,
        system,
        tools,
        messages,
        // Automatic caching of the growing conversation: each turn re-reads the previous ones at 10% price.
        cache_control: { type: "ephemeral" },
        ...(NO_EFFORT_MODELS.has(cfg.llm.model) ? {} : { thinking: { type: "adaptive" as const }, output_config: { effort: cfg.llm.effort } }),
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      const cost = usageCostUsd(response.usage, cfg);
      usd += cost;
      ctx.counters.llmUsd += cost; // recorded immediately so it is accounted even if a later turn throws
      ctx.counters.webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;
      ctx.counters.webFetches += response.usage.server_tool_use?.web_fetch_requests ?? 0;

      for (const block of response.content) {
        if (block.type === "server_tool_use") {
          ctx.log("web_research", `${block.name}: ${JSON.stringify(block.input).slice(0, 300)}`);
        } else if (block.type === "web_search_tool_result" || block.type === "web_fetch_tool_result") {
          collectUrls(block.content, ctx.webSources); // what the agent is allowed to cite
        } else if (block.type === "text") {
          if (block.citations) collectUrls(block.citations, ctx.webSources);
          if (block.text.trim()) ctx.log("agent_thought", block.text.trim().slice(0, 2000));
        }
      }

      if (response.stop_reason === "refusal") {
        ctx.log("llm_refusal", "model declined the request", { stop_details: response.stop_details });
        break;
      }
      messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
      if (response.stop_reason === "pause_turn") continue; // server-side web loop paused: resend as is
      if (response.stop_reason === "max_tokens") {
        ctx.log("llm_truncated", "response hit max_tokens");
        break;
      }
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break; // end_turn without client tools

      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      for (const call of toolUses) {
        const out = await executeTool(ctx, call.name, call.input);
        content.push({ type: "tool_result", tool_use_id: call.id, content: out.content, is_error: !out.ok });
      }
      if (ctx.cycleEnd) break;
      if (!warned && usd >= budget * WRAP_UP_AT) {
        warned = true;
        content.push({ type: "text", text: "Il budget di questo ciclo è quasi esaurito: niente altre ricerche, prendi le decisioni finali e chiudi con end_cycle." });
      }
      messages.push({ role: "user", content });
    }
    return { usd, turns };
  }
}
