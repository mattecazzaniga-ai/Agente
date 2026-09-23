import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { JsonStore } from "../src/store/jsonStore.js";
import { runTick } from "../src/agent/loop.js";
import { HeuristicBrain } from "../src/agent/brain.js";
import { ClaudeBrain } from "../src/llm/claude.js";
import { testConfig } from "./helpers.js";

const hour = (i: number) => new Date(Date.UTC(2026, 8, 23, 0, 0, 0) + i * 3_600_000).toISOString();

test("heuristic agent runs 120 ticks with consistent books and never breaks limits", async () => {
  const cfg = testConfig();
  const store = new JsonStore(cfg.dataDir);
  for (let i = 0; i < 120; i++) await runTick(store, cfg, { brain: new HeuristicBrain(), now: hour(i) });
  const s = await store.load();
  const a = Object.values(s.agents)[0]!;
  assert.equal(a.tick_count, 120);
  assert.ok(Math.abs(a.capital - (a.initial_capital + a.revenue - a.expenses)) < 0.05, "capital = initial + revenue - expenses");
  const exps = Object.values(s.experiments);
  assert.ok(exps.length > 0, "the agent acted");
  assert.ok(exps.every((e) => e.budget <= cfg.limits.maxBudgetPerExperiment));
  assert.ok(a.success_count + a.failure_count === exps.filter((e) => e.status === "COMPLETED").length);
  assert.ok(a.memory.lessons.length > 0, "the agent learned");
  assert.ok((await store.readLog(10)).length > 0);
});

test("rate limit skips a second tick too soon after the first", async () => {
  const cfg = testConfig();
  const store = new JsonStore(cfg.dataDir);
  await runTick(store, cfg, { now: "2026-09-23T10:00:00.000Z" });
  const [r] = await runTick(store, cfg, { now: "2026-09-23T10:05:00.000Z" });
  assert.match(r!.skipped ?? "", /rate limit/);
});

test("Claude brain drives tools through the safety layer and its cost is booked", async () => {
  const cfg = testConfig();
  cfg.llm.enabled = true;
  const store = new JsonStore(cfg.dataDir);
  const usage = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const scripted = [
    [{ type: "tool_use", id: "t1", name: "research_market", input: { business_model: "micro_service", niche: "dentisti" } }],
    [{ type: "tool_use", id: "t2", name: "launch_experiment", input: { business_model: "micro_service", niche: "dentisti", offer: "Email blast a 5000 dentisti", channel: "paid_ads", price: 50, budget: 5, duration_ticks: 24, hypothesis: "x", p_success: 0.9, expected_revenue: 100, risk: "low" } }],
    [{ type: "tool_use", id: "t3", name: "end_cycle", input: { summary: "ricerca fatta, proposta rifiutata per policy", next_action: "RESEARCH" } }],
  ];
  const requests: unknown[] = [];
  const fake = {
    beta: {
      messages: {
        create: async (req: unknown) => {
          requests.push(req);
          return { content: scripted.shift(), stop_reason: "tool_use", stop_details: null, usage };
        },
      },
    },
  } as unknown as Anthropic;
  const [r] = await runTick(store, cfg, { brain: new ClaudeBrain(cfg, fake), now: hour(0) });
  assert.equal(requests.length, 3);
  assert.equal(r!.summary, "ricerca fatta, proposta rifiutata per policy");
  const s = await store.load();
  assert.equal(Object.keys(s.experiments).length, 0, "spam proposal must be rejected");
  const expectedUsd = 3 * (1000 * 5 + 500 * 25) / 1e6;
  assert.ok(Math.abs(r!.llm_usd - expectedUsd) < 1e-9);
  assert.ok(Object.values(s.agents)[0]!.expenses > 0);
});

test("the paid brain is only woken when there is something to decide", async () => {
  const { thinkReason } = await import("../src/agent/loop.js");
  const { stateWithAgent } = await import("./helpers.js");
  const cfg = testConfig();
  const { state, agent } = stateWithAgent();
  assert.equal(thinkReason(state, agent, cfg, hour(0), 0), "first cycle");
  agent.last_think_at = hour(0);
  assert.equal(thinkReason(state, agent, cfg, hour(1), 0), null, "free slot but thought 1h ago");
  assert.match(thinkReason(state, agent, cfg, hour(2), 0) ?? "", /free experiment slot/);
  assert.match(thinkReason(state, agent, cfg, hour(1), 1) ?? "", /completed/);
});
