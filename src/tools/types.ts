import type { Config } from "../config.js";
import type { Agent, LogEvent, State } from "../types.js";

/**
 * auto      – the agent may call it freely (within rate limits)
 * approval  – each call creates an Approval that a human must accept before it executes
 * disabled  – not exposed to the agent at all (future phase or switched off)
 */
export type Permission = "auto" | "approval" | "disabled";

export interface ToolContext {
  state: State;
  agent: Agent;
  cfg: Config;
  now: string;
  rand: () => number;
  counters: { toolCalls: number; researchCalls: number; llmUsd: number };
  log: (type: string, message: string, data?: unknown) => void;
  /** Set when the cycle timed out: every further tool call is refused. */
  aborted: boolean;
  /** Set by the end_cycle tool. */
  cycleEnd: { summary: string; next_action: string } | null;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  permission: Permission;
  /** Phase in which the tool becomes available. */
  phase: number;
  /** Counts against the per-tick research budget. */
  research?: boolean;
  run(ctx: ToolContext, input: Record<string, unknown>): Promise<unknown> | unknown;
}

export type Logger = (e: LogEvent) => void;
