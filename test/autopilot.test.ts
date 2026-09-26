import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutopilot } from "../src/agent/autopilot.js";
import { completeExperiment, createExperiment } from "../src/agent/experiments.js";
import { evaluate, runningExperiments } from "../src/decision/engine.js";
import { thinkReason } from "../src/agent/loop.js";
import { NOW, proposal, stateWithAgent, testConfig } from "./helpers.js";

function finishedWinner(sales: number) {
  const cfg = testConfig();
  const { state, agent } = stateWithAgent();
  const p = proposal();
  const e = createExperiment(state, agent, p, evaluate(state, agent, p, cfg, NOW), NOW);
  Object.assign(e, { ticks_elapsed: e.duration_ticks, spent: 5, revenue: 19 * sales * 0.97, conversions: sales, visitors: 200 });
  completeExperiment(agent, e, NOW, "test");
  return { cfg, state, agent, e };
}

test("a profitable experiment with enough sales is renewed automatically", () => {
  const { cfg, state, agent, e } = finishedWinner(3);
  const r = runAutopilot(state, agent, cfg, [e], NOW);
  assert.equal(r.renewed.length, 1);
  const next = runningExperiments(state, agent.id)[0]!;
  assert.equal(next.niche, e.niche);
  assert.equal(next.channel, e.channel);
  assert.ok(next.budget >= e.budget);
});

test("one lucky sale is not enough evidence to renew", () => {
  const { cfg, state, agent, e } = finishedWinner(1);
  Object.assign(e, { revenue: 60 }); // still profitable
  assert.equal(runAutopilot(state, agent, cfg, [e], NOW).renewed.length, 0);
});

test("autopilot stops a running experiment at half time with no sales", () => {
  const cfg = testConfig();
  const { state, agent } = stateWithAgent();
  const e = createExperiment(state, agent, proposal(), evaluate(state, agent, proposal(), cfg, NOW), NOW);
  Object.assign(e, { ticks_elapsed: 12, spent: 2.5, conversions: 0 });
  assert.equal(runAutopilot(state, agent, cfg, [], NOW).stopped.length, 1);
  assert.equal(e.status, "COMPLETED");
});

test("free-slot wake-ups back off after wake-ups that launched nothing", () => {
  const cfg = testConfig();
  const { state, agent } = stateWithAgent();
  agent.last_think_at = "2026-09-23T00:00:00.000Z";
  const at = (h: number) => new Date(Date.parse(agent.last_think_at!) + h * 3_600_000).toISOString();
  assert.match(thinkReason(state, agent, cfg, at(2), 0) ?? "", /free experiment slot/);
  agent.idle_thinks = 2; // two useless wake-ups: wait 8h
  assert.equal(thinkReason(state, agent, cfg, at(4), 0), null);
  assert.match(thinkReason(state, agent, cfg, at(8), 0) ?? "", /free experiment slot/);
});
