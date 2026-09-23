// Claude-driven brain: a manual tool-use loop so every call goes through our permission layer,
// per-tick cost cap, tool-call limits and logging.

import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";
import type { ToolContext } from "../tools/types.js";
import { availableTools, executeTool, toAnthropicTools } from "../tools/registry.js";
import { systemPrompt } from "../agent/prompt.js";
import type { Brain, BrainResult } from "../agent/brain.js";

type Usage = Pick<Anthropic.Beta.BetaUsage, "input_tokens" | "output_tokens" | "cache_creation_input_tokens" | "cache_read_input_tokens">;

export function usageCostUsd(u: Usage, cfg: Config): number {
  const inP = cfg.llm.inputPricePerM / 1e6;
  const outP = cfg.llm.outputPricePerM / 1e6;
  return (
    u.input_tokens * inP +
    (u.cache_creation_input_tokens ?? 0) * inP * 1.25 +
    (u.cache_read_input_tokens ?? 0) * inP * 0.1 +
    u.output_tokens * outP
  );
}

/** Models where server-side refusal fallbacks are recommended. */
const FALLBACK_MODELS = new Set(["claude-opus-5", "claude-fable-5-1", "claude-opus-5-5"]);
/** Haiku 4.5 does not accept `effort` / adaptive thinking. */
const NO_EFFORT_MODELS = new Set(["claude-haiku-4-5"]);

export class ClaudeBrain implements Brain {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(
    private readonly cfg: Config,
    client?: Anthropic,
  ) {
    this.name = `claude:${cfg.llm.model}`;
    this.client = client ?? new Anthropic({ timeout: 120_000, maxRetries: 2 });
  }

  async think(ctx: ToolContext, briefing: string, remainingUsd: number): Promise<BrainResult> {
    const cfg = this.cfg;
    const tools = toAnthropicTools(availableTools());
    // Cache the stable prefix (tools + system prompt): only the briefing changes between ticks.
    const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: systemPrompt(cfg), cache_control: { type: "ephemeral" } }];
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: briefing }];
    const budget = Math.min(remainingUsd, cfg.limits.maxLlmUsdPerTick);
    let usd = 0;
    let turns = 0;
    const maxTurns = cfg.limits.maxToolCallsPerTick + 2;

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

      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      if (text) ctx.log("agent_thought", text.slice(0, 2000));

      if (response.stop_reason === "refusal") {
        ctx.log("llm_refusal", "model declined the request", { stop_details: response.stop_details });
        break;
      }
      messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
      if (response.stop_reason === "max_tokens") {
        ctx.log("llm_truncated", "response hit max_tokens");
        break;
      }
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break; // end_turn without tools

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of toolUses) {
        const out = await executeTool(ctx, call.name, call.input);
        results.push({ type: "tool_result", tool_use_id: call.id, content: out.content, is_error: !out.ok });
      }
      messages.push({ role: "user", content: results });
      if (ctx.cycleEnd) break;
    }
    return { usd, turns };
  }
}
