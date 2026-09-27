// Tool registry: the single place that decides which tools exist, their permission level and
// the phase in which they unlock. Only `auto`/`approval` tools whose phase <= CURRENT_PHASE are
// exposed to the model.

import type Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";
import type { Permission, ToolContext, ToolDef } from "./types.js";
import { phase1Tools } from "./phase1.js";
import { phase2Tools } from "./phase2.js";
import { phase3Tools } from "./phase3.js";
import { isTrusted, queueApproval } from "../approvals.js";

/**
 * Tools planned for later phases. Declared here so the permission model is explicit and
 * reviewable today; they are never exposed until their phase is reached AND they are implemented.
 */
export const PLANNED_TOOLS: Array<{ name: string; phase: number; permission: Permission; purpose: string }> = [
  { name: "create_visual_canva", phase: 3, permission: "approval", purpose: "Create social posts, banners and product mockups in Canva (requires the Canva connector)" },
  { name: "list_on_marketplace", phase: 3, permission: "approval", purpose: "Publish an offer on a marketplace account owned by the operator" },
  { name: "send_outreach_message", phase: 3, permission: "approval", purpose: "Send ONE personalised message to an opted-in/business contact (hard daily cap)" },
  { name: "read_analytics", phase: 4, permission: "auto", purpose: "Read real traffic/conversion data for the agent's own pages" },
  { name: "spend_real_money", phase: 4, permission: "approval", purpose: "Any real-money spend (ads, tools) — always human-approved in early phases" },
];

const ALL_TOOLS: ToolDef[] = [...phase1Tools, ...phase2Tools, ...phase3Tools];

export function findTool(name: string): ToolDef | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/**
 * Tools exposed for a given phase and brain. From Phase 2 the LLM researches the real web, so the
 * simulated research tools are hidden from it; the offline heuristic brain keeps them (it cannot browse).
 */
export function availableTools(phase: number, brain: "llm" | "heuristic", realSelling = false): ToolDef[] {
  return ALL_TOOLS.filter(
    (t) =>
      t.permission !== "disabled" &&
      // Phase 3 tools touch real money and the public web: only with the explicit master switch.
      (t.phase < 3 || realSelling) &&
      t.phase <= phase &&
      !(t.simulatedResearch && brain === "llm" && phase >= 2) &&
      !(t.phase >= 2 && t.research && brain === "heuristic"),
  );
}

/** Server-side Anthropic tools for real web research (Phase 2+). */
export function webServerTools(cfg: Config): Anthropic.Beta.BetaToolUnion[] {
  if (cfg.phase < 2) return [];
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: cfg.limits.maxWebSearchesPerTick },
    {
      type: "web_fetch_20260209",
      name: "web_fetch",
      max_uses: cfg.limits.maxWebFetchesPerTick,
      max_content_tokens: cfg.limits.webFetchMaxContentTokens,
    },
  ];
}

export function toAnthropicTools(tools: ToolDef[]): Anthropic.Tool[] {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}

export interface ToolOutcome {
  ok: boolean;
  content: string;
}

/** Execute a tool call on behalf of the agent, enforcing permissions and per-tick limits. */
export async function executeTool(ctx: ToolContext, name: string, input: unknown): Promise<ToolOutcome> {
  if (ctx.aborted) return fail(ctx, name, "cycle aborted (timeout)");
  if (ctx.cycleEnd) return fail(ctx, name, "cycle already ended");
  const tool = availableTools(ctx.cfg.phase, ctx.brain, ctx.cfg.real.enabled).find((t) => t.name === name);
  if (!tool) return fail(ctx, name, `tool "${name}" is not available in phase ${ctx.cfg.phase} for the ${ctx.brain} brain`);
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail(ctx, name, "input must be an object");
  if (tool.permission === "approval" && !isTrusted(ctx.state, ctx.cfg, name)) {
    const a = queueApproval(ctx, tool, input as Record<string, unknown>);
    return {
      ok: true,
      content: JSON.stringify({ queued_for_approval: a.id, summary: a.summary, note: "the operator will decide; you will see the outcome in a later cycle" }),
    };
  }
  if (++ctx.counters.toolCalls > ctx.cfg.limits.maxToolCallsPerTick) return fail(ctx, name, "tool call limit for this cycle reached — call end_cycle");
  if (tool.research && ++ctx.counters.researchCalls > ctx.cfg.limits.maxResearchCallsPerTick)
    return fail(ctx, name, "research limit for this cycle reached — decide with the data you have");
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail(ctx, name, "input must be an object");
  try {
    const result = await tool.run(ctx, input as Record<string, unknown>);
    const content = typeof result === "string" ? result : JSON.stringify(result);
    ctx.log("tool_call", `${name}`, { input, result: content.length > 4000 ? content.slice(0, 4000) + "…" : result });
    return { ok: true, content };
  } catch (err) {
    return fail(ctx, name, (err as Error).message);
  }
}

function fail(ctx: ToolContext, name: string, message: string): ToolOutcome {
  ctx.log("tool_error", `${name}: ${message}`);
  return { ok: false, content: `ERROR: ${message}` };
}
