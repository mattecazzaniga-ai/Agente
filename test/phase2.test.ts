import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/decision/engine.js";
import { hiddenMarket } from "../src/sim/market.js";
import { normalizeUrl } from "../src/tools/phase2.js";
import { executeTool } from "../src/tools/registry.js";
import type { ToolContext } from "../src/tools/types.js";
import { NOW, proposal, stateWithAgent, testConfig } from "./helpers.js";

function ctxFor(brain: "llm" | "heuristic", sources: string[] = []): ToolContext {
  const { state, agent } = stateWithAgent();
  return {
    state,
    agent,
    cfg: testConfig(),
    now: NOW,
    rand: () => 0.5,
    counters: { toolCalls: 0, researchCalls: 0, llmUsd: 0, webSearches: 0, webFetches: 0 },
    brain,
    webSources: new Set(sources.map((u) => normalizeUrl(u)!)),
    log: () => {},
    aborted: false,
    cycleEnd: null,
  };
}

const observation = {
  business_model: "digital_product",
  niche: "palestre",
  demand_index: 0.7,
  competition_index: 0.3,
  typical_price: 25,
  evidence: "Molti titolari di palestre cercano template per schede di allenamento, pochi venditori italiani.",
  sources: ["https://shop.example.it/template-palestre"],
};

test("URLs are normalised so trivial variations still match", () => {
  assert.equal(normalizeUrl("https://www.Example.it/a/?utm_source=x#top"), normalizeUrl("https://example.it/a"));
  assert.equal(normalizeUrl("ftp://example.it"), null);
});

test("a web observation needs sources actually returned by the web tools", async () => {
  const bad = await executeTool(ctxFor("llm"), "record_market_observation", observation);
  assert.equal(bad.ok, false);
  const ctx = ctxFor("llm", ["https://shop.example.it/template-palestre"]);
  const good = await executeTool(ctx, "record_market_observation", observation);
  assert.equal(good.ok, true, good.content);
  assert.equal(ctx.agent.memory.observations["digital_product|palestre"]?.source, "web");
});

test("the heuristic brain cannot fake web observations and keeps simulated research", async () => {
  const ctx = ctxFor("heuristic", ["https://shop.example.it/template-palestre"]);
  assert.equal((await executeTool(ctx, "record_market_observation", observation)).ok, false);
  assert.equal((await executeTool(ctx, "research_market", { business_model: "digital_product", niche: "palestre" })).ok, true);
});

test("in phase 2 the LLM must research a market on the web before launching", async () => {
  const ctx = ctxFor("llm", ["https://shop.example.it/template-palestre"]);
  const d1 = evaluate(ctx.state, ctx.agent, proposal(), ctx.cfg, NOW, { requireWebObservation: true });
  assert.equal(d1.approved, false);
  await executeTool(ctx, "record_market_observation", observation);
  const d2 = evaluate(ctx.state, ctx.agent, proposal(), ctx.cfg, NOW, { requireWebObservation: true });
  assert.equal(d2.approved, true, d2.reasons.join("\n"));
});

test("a web anchor pulls the simulated market towards what the web says", () => {
  const base = hiddenMarket(42, "digital_product", "palestre");
  const anchors = { "digital_product|palestre": { demand_index: 1, competition_index: 0, typical_price: 30, recorded_at: NOW, agent_id: "agent-001" } };
  const anchored = hiddenMarket(42, "digital_product", "palestre", anchors);
  assert.ok(anchored.demand >= base.demand);
  assert.ok(anchored.competition <= base.competition);
  assert.equal(anchored.refPrice, 30);
});
