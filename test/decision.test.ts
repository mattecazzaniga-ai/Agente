import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, adjustedProbability } from "../src/decision/engine.js";
import { NOW, proposal, stateWithAgent, testConfig } from "./helpers.js";

const cfg = testConfig();

test("approves a sensible small experiment", () => {
  const { state, agent } = stateWithAgent();
  const d = evaluate(state, agent, proposal(), cfg, NOW);
  assert.equal(d.approved, true, d.reasons.join("\n"));
  assert.equal(d.requires_human_approval, false);
  assert.ok(d.expected_value > 0);
});

test("rejects budgets above the per-experiment and capital-fraction limits", () => {
  const { state, agent } = stateWithAgent();
  assert.equal(evaluate(state, agent, proposal({ budget: 40 }), cfg, NOW).approved, false);
  const poor = stateWithAgent(20);
  assert.equal(evaluate(poor.state, poor.agent, proposal({ budget: 8 }), cfg, NOW).approved, false); // 40% of capital
});

test("protects the reserve", () => {
  const { state, agent } = stateWithAgent(12);
  const d = evaluate(state, agent, proposal({ budget: 3 }), cfg, NOW);
  assert.equal(d.approved, false);
  assert.ok(d.reasons.some((r) => r.includes("reserve")));
});

test("rejects negative expected value unless it is a cheap probe of an untested market", () => {
  const { state, agent } = stateWithAgent();
  const bad = proposal({ budget: 10, estimates: { p_success: 0.1, expected_revenue: 20, risk: "low" } });
  assert.equal(evaluate(state, agent, bad, cfg, NOW).approved, false);
  const probe = proposal({ budget: 2, estimates: { p_success: 0.1, expected_revenue: 5, risk: "low" } });
  assert.equal(evaluate(state, agent, probe, cfg, NOW).approved, true);
});

test("blocks forbidden activities regardless of EV", () => {
  const { state, agent } = stateWithAgent();
  for (const offer of ["Campagna di email blast a 10.000 indirizzi", "Pacchetto recensioni false su Google", "Bot di crypto trading automatico"]) {
    const d = evaluate(state, agent, proposal({ offer, estimates: { p_success: 0.8, expected_revenue: 500, risk: "low" } }), cfg, NOW);
    assert.equal(d.approved, false, offer);
    assert.ok(d.reasons.some((r) => r.includes("policy")), offer);
  }
});

test("budgets above the approval threshold need a human", () => {
  const { state, agent } = stateWithAgent(100);
  const d = evaluate(state, agent, proposal({ budget: 14, estimates: { p_success: 0.5, expected_revenue: 80, risk: "low" } }), cfg, NOW);
  assert.equal(d.approved, true, d.reasons.join("\n"));
  assert.equal(d.requires_human_approval, true);
});

test("history pulls over-optimistic probabilities down", () => {
  const { agent } = stateWithAgent();
  agent.memory.stats["digital_product"] = { key: "digital_product", experiments: 6, successes: 0, invested: 20, revenue: 0, costs: 20, profit: -20, ticks: 100, visitors: 50, conversions: 0 };
  assert.ok(adjustedProbability(agent, 0.7, "digital_product", "palestre") < 0.35);
});
