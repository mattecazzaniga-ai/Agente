// Tool registry: the single place that decides which tools exist, their permission level and
// the phase in which they unlock. Only `auto`/`approval` tools whose phase <= CURRENT_PHASE are
// exposed to the model.

import type Anthropic from "@anthropic-ai/sdk";
import type { Permission, ToolContext, ToolDef } from "./types.js";
import { phase1Tools } from "./phase1.js";

export const CURRENT_PHASE = Number(process.env.AGENT_PHASE || 1);

/**
 * Tools planned for later phases. Declared here so the permission model is explicit and
 * reviewable today; they are never exposed until their phase is reached AND they are implemented.
 */
export const PLANNED_TOOLS: Array<{ name: string; phase: number; permission: Permission; purpose: string }> = [
  { name: "web_search", phase: 2, permission: "auto", purpose: "Real web search (Anthropic server tool, domain allow/block lists, max_uses)" },
  { name: "web_fetch", phase: 2, permission: "auto", purpose: "Read a public web page returned by search (robots.txt respected, no logins)" },
  { name: "generate_content", phase: 3, permission: "auto", purpose: "Write copy, reports, digital products to the agent workspace (files only)" },
  { name: "generate_code", phase: 3, permission: "auto", purpose: "Generate code/landing pages in the agent workspace (not deployed)" },
  { name: "publish_landing_page", phase: 3, permission: "approval", purpose: "Deploy a page publicly (Vercel preview → production)" },
  { name: "list_on_marketplace", phase: 3, permission: "approval", purpose: "Publish an offer on a marketplace account owned by the operator" },
  { name: "send_outreach_message", phase: 3, permission: "approval", purpose: "Send ONE personalised message to an opted-in/business contact (hard daily cap)" },
  { name: "read_analytics", phase: 4, permission: "auto", purpose: "Read real traffic/conversion data for the agent's own pages" },
  { name: "read_payments", phase: 4, permission: "auto", purpose: "Read Stripe payments for the agent's own products (read-only key)" },
  { name: "create_payment_link", phase: 4, permission: "approval", purpose: "Create a Stripe payment link for an approved product" },
  { name: "spend_real_money", phase: 4, permission: "approval", purpose: "Any real-money spend (ads, tools) — always human-approved in early phases" },
];

const ALL_TOOLS: ToolDef[] = [...phase1Tools];

export function availableTools(): ToolDef[] {
  return ALL_TOOLS.filter((t) => t.permission !== "disabled" && t.phase <= CURRENT_PHASE);
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
  const tool = availableTools().find((t) => t.name === name);
  if (!tool) return fail(ctx, name, `tool "${name}" is not available in phase ${CURRENT_PHASE}`);
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
