import type { LogEvent, State } from "../types.js";

/**
 * Persistence boundary. Phase 1 ships a JSON-file implementation (works on GitHub Actions
 * by committing the data directory to a dedicated branch). A Postgres implementation can be
 * dropped in later without touching the agent code — see db/schema.sql.
 */
export interface Store {
  load(): Promise<State>;
  save(state: State): Promise<void>;
  log(event: LogEvent): Promise<void>;
  readLog(limit: number): Promise<LogEvent[]>;
}

export function emptyState(worldSeed: number): State {
  return {
    schema_version: 1,
    global: {
      kill_switch: false,
      kill_reason: null,
      llm_spend_by_day: {},
      launches_by_day: {},
      next_agent_seq: 1,
      next_experiment_seq: 1,
      world_seed: worldSeed,
    },
    agents: {},
    experiments: {},
    approvals: {},
  };
}
