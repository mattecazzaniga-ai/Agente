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
  counters: { toolCalls: number; researchCalls: number; llmUsd: number; webSearches: number; webFetches: number };
  /** Which brain is driving the cycle: simulated research tools are hidden from the LLM from Phase 2. */
  brain: "llm" | "heuristic";
  /** URLs actually returned by web search / fetch in this cycle (used to validate cited sources). */
  webSources: Set<string>;
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
  /** Research backed by the simulator: from Phase 2 only the offline heuristic brain may use it. */
  simulatedResearch?: boolean;
  /** Human-readable description of a gated call, shown in the approval request. */
  summarize?: (ctx: ToolContext, input: Record<string, unknown>) => string;
  run(ctx: ToolContext, input: Record<string, unknown>): Promise<unknown> | unknown;
}

export type Logger = (e: LogEvent) => void;
