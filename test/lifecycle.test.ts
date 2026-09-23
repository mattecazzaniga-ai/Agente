import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDeath, reproduce } from "../src/economy/lifecycle.js";
import { canTick } from "../src/safety/guard.js";
import { createExperiment } from "../src/agent/experiments.js";
import { evaluate } from "../src/decision/engine.js";
import { NOW, proposal, stateWithAgent, testConfig } from "./helpers.js";

test("an agent with no capital dies, stops experiments and cannot act", () => {
  const cfg = testConfig();
  const { state, agent } = stateWithAgent();
  const exp = createExperiment(state, agent, proposal(), evaluate(state, agent, proposal(), cfg, NOW), NOW);
  agent.capital = 0;
  assert.equal(checkDeath(state, agent, NOW), true);
  assert.equal(agent.status, "DEAD");
  assert.equal(state.experiments[exp.id]!.status, "CANCELLED");
  assert.equal(canTick(state, agent, cfg, NOW).ok, false);
});

test("reproduction is off by default", () => {
  const cfg = testConfig();
  const { state, agent } = stateWithAgent(100);
  assert.equal(reproduce(state, agent, cfg, NOW), null);
  assert.equal(agent.capital, 100);
});

test("at 2x capital the agent splits: parent keeps €50, child gets €50 and inherits knowledge", () => {
  const cfg = testConfig({ reproductionEnabled: true, maxPopulation: 10 });
  const { state, agent } = stateWithAgent(100);
  agent.strategy.focus_model = "lead_generation";
  agent.strategy.focus_niche = "palestre";
  agent.memory.lessons.push({ at: NOW, experiment_id: null, text: "le palestre rispondono al direct outreach", tags: [] });
  const child = reproduce(state, agent, cfg, NOW)!;
  assert.ok(child);
  assert.equal(agent.capital, 50);
  assert.equal(child.capital, 50);
  assert.equal(child.parent_id, agent.id);
  assert.equal(child.generation, 1);
  assert.equal(child.strategy.focus_model, "lead_generation");
  assert.notEqual(child.strategy.focus_niche, "palestre");
  assert.equal(child.memory.lessons.length, 1);
  assert.ok(child.memory.inherited_summary?.includes(agent.name));
  assert.deepEqual(agent.children, [child.id]);
});

test("kill switch and pause stop the agent", () => {
  const cfg = testConfig();
  const { state, agent } = stateWithAgent();
  assert.equal(canTick(state, agent, cfg, NOW).ok, true);
  state.global.kill_switch = true;
  assert.equal(canTick(state, agent, cfg, NOW).ok, false);
  state.global.kill_switch = false;
  agent.status = "PAUSED";
  assert.equal(canTick(state, agent, cfg, NOW).ok, false);
});
