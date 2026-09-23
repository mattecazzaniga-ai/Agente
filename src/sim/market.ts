// Phase 1 market simulator.
//
// The simulator is the "world" the agent acts in while no real channel is connected. Every
// (business model, niche) pair has hidden parameters derived deterministically from the world
// seed, so ANY niche string the agent invents has a consistent, discoverable market. The agent
// never sees these parameters directly: it only gets noisy research observations and the
// measured results of the experiments it runs. That is what makes learning meaningful.
//
// Phase 2+ replaces research with real web tools and Phase 4 replaces `simulateTick` with
// real measurements (analytics, payments) — the agent loop does not change.

import type { BusinessModel, Channel, Experiment, MarketObservation } from "../types.js";
import { binomial, clamp, hash, rng } from "../util.js";

interface ModelProfile {
  priceRange: [number, number];
  /** Share of each sale consumed by delivery (time, tools, fees). */
  fulfillment: [number, number];
  /** Recurring operating cost per tick while running (hosting, tools). */
  opCostPerTick: number;
  /** Max sales the agent can deliver per 24 ticks (services need work per order). Infinity = digital goods. */
  capacityPerDay: number;
  channelFit: Record<Channel, number>;
}

const PROFILES: Record<BusinessModel, ModelProfile> = {
  micro_service: {
    capacityPerDay: 3,
    priceRange: [25, 120],
    fulfillment: [0.15, 0.4],
    opCostPerTick: 0,
    channelFit: { paid_ads: 0.6, marketplace: 1.3, content_seo: 0.6, community: 1.0, direct_outreach: 1.2 },
  },
  digital_product: {
    capacityPerDay: Infinity,
    priceRange: [7, 39],
    fulfillment: [0.03, 0.08],
    opCostPerTick: 0.01,
    channelFit: { paid_ads: 1.0, marketplace: 1.2, content_seo: 1.2, community: 1.0, direct_outreach: 0.3 },
  },
  lead_generation: {
    capacityPerDay: 2,
    priceRange: [20, 90],
    fulfillment: [0.2, 0.45],
    opCostPerTick: 0.02,
    channelFit: { paid_ads: 0.8, marketplace: 0.6, content_seo: 0.7, community: 0.7, direct_outreach: 1.4 },
  },
  automation_service: {
    capacityPerDay: 0.5,
    priceRange: [80, 300],
    fulfillment: [0.25, 0.5],
    opCostPerTick: 0,
    channelFit: { paid_ads: 0.5, marketplace: 1.1, content_seo: 0.6, community: 0.9, direct_outreach: 1.3 },
  },
  micro_saas: {
    capacityPerDay: Infinity,
    priceRange: [9, 35],
    fulfillment: [0.05, 0.12],
    opCostPerTick: 0.06,
    channelFit: { paid_ads: 1.0, marketplace: 0.5, content_seo: 1.3, community: 1.1, direct_outreach: 0.6 },
  },
  research_service: {
    capacityPerDay: 1,
    priceRange: [40, 160],
    fulfillment: [0.2, 0.45],
    opCostPerTick: 0,
    channelFit: { paid_ads: 0.5, marketplace: 1.3, content_seo: 0.7, community: 0.9, direct_outreach: 1.1 },
  },
  landing_page_service: {
    capacityPerDay: 0.5,
    priceRange: [80, 260],
    fulfillment: [0.2, 0.4],
    opCostPerTick: 0.01,
    channelFit: { paid_ads: 0.6, marketplace: 1.2, content_seo: 0.6, community: 0.8, direct_outreach: 1.3 },
  },
};

/** Niches the research scanner surfaces. The agent may also propose its own. */
export const KNOWN_NICHES = [
  "palestre",
  "centri sportivi",
  "ristoranti",
  "dentisti",
  "agenzie immobiliari",
  "e-commerce shopify",
  "commercialisti",
  "freelance creativi",
  "parrucchieri e centri estetici",
  "b&b e case vacanza",
  "scuole di lingue",
  "officine auto",
  "studi legali",
  "fotografi",
  "coach e consulenti",
] as const;

export interface HiddenMarket {
  demand: number; // 0..1
  competition: number; // 0..1
  refPrice: number;
  fulfillment: number;
  baseConversion: number;
  elasticity: number;
  opCostPerTick: number;
  capacityPerDay: number;
  channelFit: Record<Channel, number>;
}

export function normalizeNiche(niche: string): string {
  return niche.trim().toLowerCase().replace(/\s+/g, " ");
}

export function marketKey(model: BusinessModel, niche: string): string {
  return `${model}|${normalizeNiche(niche)}`;
}

export function hiddenMarket(worldSeed: number, model: BusinessModel, niche: string): HiddenMarket {
  const r = rng(hash(`${worldSeed}:${marketKey(model, niche)}`));
  const p = PROFILES[model];
  // Skewed so that most markets are mediocre and a few are genuinely good.
  const demand = clamp(Math.pow(r(), 1.6) * 1.05, 0.03, 1);
  const competition = clamp(r() * 0.9 + 0.1 * demand, 0, 1);
  const refPrice = p.priceRange[0] + r() * (p.priceRange[1] - p.priceRange[0]);
  const fulfillment = p.fulfillment[0] + r() * (p.fulfillment[1] - p.fulfillment[0]);
  // Expensive offers convert far less than cheap ones.
  const baseConversion = (0.002 + r() * 0.012) * (0.4 + demand) * (1 - 0.6 * competition) * Math.pow(30 / refPrice, 0.7);
  const elasticity = 1.1 + r() * 1.2;
  return { demand, competition, refPrice, fulfillment, baseConversion, elasticity, opCostPerTick: p.opCostPerTick, capacityPerDay: p.capacityPerDay, channelFit: p.channelFit };
}

/** Noisy research observation. `precision` 0..1: higher = less noise (costs more). */
export function observe(
  worldSeed: number,
  model: BusinessModel,
  niche: string,
  precision: number,
  rand: () => number,
  now: string,
): MarketObservation {
  const m = hiddenMarket(worldSeed, model, niche);
  const noise = 0.25 * (1 - precision) + 0.03;
  const n = () => (rand() * 2 - 1) * noise;
  const demand = clamp(m.demand + n(), 0, 1);
  const competition = clamp(m.competition + n(), 0, 1);
  const typical_price = Math.round(m.refPrice * (1 + n()));
  const notes = [
    demand > 0.6 ? "segnali di domanda forti" : demand > 0.3 ? "domanda moderata" : "domanda debole",
    competition > 0.6 ? "mercato affollato" : competition > 0.3 ? "concorrenza media" : "pochi concorrenti",
  ].join(", ");
  return {
    key: marketKey(model, niche),
    business_model: model,
    niche: normalizeNiche(niche),
    observed_at: now,
    demand_index: round2(demand),
    competition_index: round2(competition),
    typical_price,
    notes,
    source: "simulated",
  };
}

export interface TickResult {
  spent: number;
  visitors: number;
  conversions: number;
  revenue: number;
  fulfillment_costs: number;
}

const PLATFORM_FEE: Record<Channel, number> = {
  paid_ads: 0.03, // payment processing
  marketplace: 0.2,
  content_seo: 0.03,
  community: 0.03,
  direct_outreach: 0.03,
};

/** Advance one running experiment by one tick in the simulated world. */
export function simulateTick(worldSeed: number, exp: Experiment, rand: () => number): TickResult {
  const m = hiddenMarket(worldSeed, exp.business_model, exp.niche);
  const fit = m.channelFit[exp.channel];
  const t = exp.ticks_elapsed + 1;

  const perTickBudget = exp.budget / exp.duration_ticks;
  let spent = m.opCostPerTick + perTickBudget;
  // Organic channels still need some investment (listing boosts, tools, content production):
  // visibility grows with the square root of the budget, so near-zero budgets get near-zero reach.
  const effort = Math.sqrt(Math.max(0, exp.budget) / 10);
  let visitors = 0;
  let convBoost = 1;
  switch (exp.channel) {
    case "paid_ads":
      visitors = perTickBudget * (1 + 5 * m.demand) * fit * (1 - 0.5 * m.competition);
      break;
    case "marketplace":
      visitors = (0.3 + 3 * m.demand) * fit * (1 - 0.6 * m.competition) * Math.min(1, t / 24) * Math.min(1.5, effort);
      break;
    case "content_seo":
      visitors = 4 * m.demand * fit * Math.min(1, t / 72) * Math.min(1.5, effort);
      break;
    case "community":
      visitors = (0.2 + 1.5 * m.demand) * fit * Math.min(1.5, effort);
      break;
    case "direct_outreach":
      visitors = 1.5 * fit * (0.5 + m.demand) * Math.min(1.5, effort); // hard-capped, personalised contacts
      convBoost = 2.5;
      break;
  }
  const noisyVisitors = Math.max(0, Math.round(visitors * (0.7 + 0.6 * rand())));
  const priceFactor = Math.pow(m.refPrice / Math.max(1, exp.price), m.elasticity);
  const cr = clamp(m.baseConversion * priceFactor * convBoost, 0, 0.15);
  const capacityLeft = Math.floor((m.capacityPerDay * t) / 24 + 1) - exp.conversions;
  const conversions = Math.min(binomial(noisyVisitors, cr, rand), Math.max(0, capacityLeft));
  const gross = conversions * exp.price;
  return {
    spent,
    visitors: noisyVisitors,
    conversions,
    revenue: gross * (1 - PLATFORM_FEE[exp.channel]),
    fulfillment_costs: gross * m.fulfillment,
  };
}

/** Publicly known running cost of a model (hosting, tools) — used for worst-case exposure. */
export function operatingCostPerTick(model: BusinessModel): number {
  return PROFILES[model].opCostPerTick;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
