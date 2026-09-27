// Approvals for gated tools, with a trust ladder.
//
// A gated tool (permission "approval") called by the agent is not executed: it becomes a PENDING
// Approval carrying the exact call. The operator approves or denies it (GitHub issue comment,
// workflow button or CLI); on approval the call runs with the agent's context. Every approval adds
// to that tool's streak; a denial resets it. When the streak reaches TRUST_AUTO_AFTER, the tool runs
// without asking — the operator has seen enough good calls of that kind. 0 disables auto-trust.

import type { Config } from "./config.js";
import type { Approval, State } from "./types.js";
import type { ToolContext, ToolDef } from "./tools/types.js";

/** Tools that move money OUT of the operator's accounts: never auto-trusted, whatever the streak. */
export const NEVER_AUTO = new Set<string>(["spend_real_money"]);

export function isTrusted(state: State, cfg: Config, tool: string): boolean {
  if (NEVER_AUTO.has(tool) || cfg.trustAutoAfter <= 0) return false;
  return (state.global.trust?.[tool]?.streak ?? 0) >= cfg.trustAutoAfter;
}

export function recordDecision(state: State, tool: string, approved: boolean): void {
  const t = ((state.global.trust ??= {})[tool] ??= { approved: 0, denied: 0, streak: 0 });
  if (approved) {
    t.approved++;
    t.streak++;
  } else {
    t.denied++;
    t.streak = 0;
  }
}

/** Queue a gated call, or return the identical call already waiting. */
export function queueApproval(ctx: ToolContext, tool: ToolDef, input: Record<string, unknown>): Approval {
  const key = JSON.stringify(input);
  const existing = Object.values(ctx.state.approvals).find(
    (a) => a.status === "PENDING" && a.agent_id === ctx.agent.id && a.payload?.tool === tool.name && JSON.stringify(a.payload.input) === key,
  );
  if (existing) return existing;
  const n = Object.keys(ctx.state.approvals).length + 1;
  const approval: Approval = {
    id: `apr-${tool.name.replace(/_/g, "-")}-${n}`,
    created_at: ctx.now,
    agent_id: ctx.agent.id,
    kind: "tool",
    ref_id: typeof input.product_id === "string" ? input.product_id : tool.name,
    summary: `${ctx.agent.name}: ${tool.summarize ? tool.summarize(ctx, input) : tool.name}`,
    status: "PENDING",
    decided_at: null,
    payload: { tool: tool.name, input },
  };
  ctx.state.approvals[approval.id] = approval;
  ctx.log("approval_requested", approval.summary, { approval_id: approval.id });
  return approval;
}
