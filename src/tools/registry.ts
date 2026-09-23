// Tool registry: the single place that decides which tools exist, their permission level and
// the phase in which they unlock. Only `auto`/`approval` tools whose phase <= CURRENT_PHASE are
// exposed to the model.

import type Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";
import type { Permission, ToolContext, ToolDef } from "./types.js";
import { phase1Tools } from "./phase1.js";
import { phase2Tools } from "./phase2.js";

/**
 * Tools planned for later phases. Declared here so the permission model is explicit and
 * reviewable today; they are never exposed until their phase is reached AND they are implemented.
 */
export const PLANNED_TOOLS: Array<{ name: string; phase: number; permission: Permission; purpose: string }> = [
  { name: "generate_content", phase: 3, permission: "auto", purpose: "Write copy, reports, digital products to the agent workspace (files only)" },
  { name: "create_visual_canva", phase: 3, permission: "approval", purpose: "Create social posts, banners and product mockups in Canva (requires the Canva connector)" },
  { name: "generate_code", phase: 3, permission: "auto", purpose: "Generate code/landing pages in the agent workspace (not deployed)" },
  { name: "publish_landing_page", phase: 3, permission: "approval", purpose: "Deploy a page publicly (Vercel preview → production)" },
  { name: "list_on_marketplace", phase: 3, permission: "approval", purpose: "Publish an offer on a marketplace account owned by the operator" },
  { name: "send_outreach_message", phase: 3, permission: "approval", purpose: "Send ONE personalised message to an opted-in/business contact (hard daily cap)" },
  { name: "read_analytics", phase: 4, permission: "auto", purpose: "Read real traffic/conversion data for the agent's own pages" },
  { name: "read_payments", phase: 4, permission: "auto", purpose: "Read Stripe payments for the agent's own products (read-only key)" },
  { name: "create_payment_link", phase: 4, permission: "approval", purpose: "Create a Stripe payment link for an approved product" },
  { name: "spend_real_money", phase: 4, permission: "approval", purpose: "Any real-money spend (ads, tools) — always human-approved in early phases" },
];

const ALL_TOOLS: ToolDef[] = [...phase1Tools, ...phase2Tools];

/**
 * Tools exposed for a given phase and brain. From Phase 2 the LLM researches the real web, so the
 * simulated research tools are hidden from it; the offline heuristic brain keeps them (it cannot browse).
 */
export function availableTools(phase: number, brain: "llm" | "heuristic"): ToolDef[] {
  return ALL_TOOLS.filter(
    (t) =>
      t.permission !== "disabled" &&
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
  const tool = availableTools(ctx.cfg.phase, ctx.brain).find((t) => t.name === name);
  if (!tool) return fail(ctx, name, `tool "${name}" is not available in phase ${ctx.cfg.phase} for the ${ctx.brain} brain`);
  if (tool.permission === "approval") return fail(ctx, name, `tool "${name}" requires human approval; not executable autonomously`);
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
