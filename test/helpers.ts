import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, type Config } from "../src/config.js";
import { emptyState } from "../src/store/store.js";
import { createAgent } from "../src/economy/lifecycle.js";
import type { Agent, State } from "../src/types.js";
import type { Proposal } from "../src/decision/engine.js";

export const NOW = "2026-09-23T12:00:00.000Z";

export function testConfig(overrides: Partial<{ reproductionEnabled: boolean; maxPopulation: number }> = {}): Config {
  const cfg = loadConfig();
  cfg.dataDir = mkdtempSync(path.join(tmpdir(), "agente-test-"));
  cfg.llm.enabled = false;
  Object.assign(cfg.economy, overrides);
  return cfg;
}

export function stateWithAgent(capital = 50): { state: State; agent: Agent } {
  const state = emptyState(42);
  const agent = createAgent(state, { capital, initialCapital: 50, parent: null, now: NOW });
  return { state, agent };
}

export function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    business_model: "digital_product",
    niche: "palestre",
    offer: "Template di piani di allenamento personalizzabili per palestre",
    channel: "marketplace",
    price: 19,
    budget: 5,
    duration_ticks: 24,
    hypothesis: "Le palestre piccole non hanno tempo di creare materiali",
    estimates: { p_success: 0.4, expected_revenue: 40, risk: "low" },
    ...over,
  };
}
