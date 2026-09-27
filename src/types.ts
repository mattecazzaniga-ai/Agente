// Core domain types. All money amounts are in EUR (virtual in Phase 1).

export type AgentStatus = "ACTIVE" | "PAUSED" | "DEAD";

export const BUSINESS_MODELS = [
  "micro_service",
  "digital_product",
  "lead_generation",
  "automation_service",
  "micro_saas",
  "research_service",
  "landing_page_service",
] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

export const CHANNELS = [
  "paid_ads", // small paid campaigns
  "marketplace", // freelance / digital marketplaces (platform fee)
  "content_seo", // free, slow organic content
  "community", // participation in relevant communities (no spam)
  "direct_outreach", // low-volume, personalised, opt-out respecting outreach
] as const;
export type Channel = (typeof CHANNELS)[number];

/** The strategy an agent is currently pursuing. Inherited (and mutated) by children. */
export interface Strategy {
  focus_model: BusinessModel | null;
  focus_niche: string | null;
  thesis: string; // natural-language description of the current approach
  /** Fraction of capital the agent is willing to put at risk at once (clamped by safety limits). */
  risk_appetite: number;
  /** Probability of trying something new instead of exploiting the best known strategy. */
  exploration_rate: number;
  version: number;
}

export interface Lesson {
  at: string;
  experiment_id: string | null;
  text: string;
  tags: string[];
}

/** Aggregated performance stats, keyed by "model" or "model|niche". */
export interface StrategyStats {
  key: string;
  experiments: number;
  successes: number;
  invested: number;
  revenue: number;
  costs: number;
  profit: number;
  ticks: number;
  visitors: number;
  conversions: number;
}

export interface AgentMemory {
  lessons: Lesson[];
  stats: Record<string, StrategyStats>;
  /** Research observations the agent has gathered (latest per key). */
  observations: Record<string, MarketObservation>;
  /** Compressed summary inherited from ancestors. */
  inherited_summary: string | null;
}

export interface Agent {
  id: string;
  name: string;
  parent_id: string | null;
  generation: number;
  capital: number;
  initial_capital: number;
  revenue: number;
  expenses: number;
  profit: number;
  llm_cost_usd: number;
  strategy: Strategy;
  memory: AgentMemory;
  status: AgentStatus;
  status_reason: string | null;
  created_at: string;
  last_tick_at: string | null;
  /** Last cycle in which the brain was invoked (LLM cycles are skipped when there is nothing to decide). */
  last_think_at: string | null;
  /** Consecutive brain wake-ups that launched nothing: the free-slot wake-up interval doubles each time. */
  idle_thinks?: number;
  tick_count: number;
  last_action: string | null;
  next_action: string | null;
  success_count: number;
  failure_count: number;
  children: string[];
}

export interface MarketObservation {
  key: string; // "model|niche"
  business_model: BusinessModel;
  niche: string;
  observed_at: string;
  demand_index: number; // 0..1, noisy
  competition_index: number; // 0..1, noisy
  typical_price: number; // EUR
  notes: string;
  source: "simulated" | "web";
  /** Phase 2+: URLs actually retrieved by web search/fetch that support this observation. */
  sources?: string[];
}

/**
 * First real-world (web) observation of a market. The simulator anchors that market's hidden
 * parameters to it, so outcomes stay consistent with what the web says (see sim/market.ts).
 */
export interface MarketAnchor {
  demand_index: number;
  competition_index: number;
  typical_price: number;
  recorded_at: string;
  agent_id: string;
}

export interface ExperimentEstimates {
  p_success: number; // 0..1
  expected_revenue: number; // EUR over the whole experiment
  risk: "low" | "medium" | "high";
}

export type ExperimentStatus = "PENDING_APPROVAL" | "RUNNING" | "COMPLETED" | "CANCELLED" | "REJECTED";

export interface Experiment {
  id: string;
  agent_id: string;
  business_model: BusinessModel;
  niche: string;
  offer: string;
  channel: Channel;
  price: number;
  budget: number; // total planned spend
  duration_ticks: number;
  hypothesis: string;
  estimates: ExperimentEstimates;
  status: ExperimentStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  ticks_elapsed: number;
  spent: number;
  revenue: number;
  fulfillment_costs: number;
  visitors: number;
  conversions: number;
  decision: DecisionReport;
  outcome_note: string | null;
}

export interface DecisionReport {
  approved: boolean;
  requires_human_approval: boolean;
  expected_value: number;
  adjusted_p_success: number;
  worst_case_loss: number;
  capital_after_worst_case: number;
  reasons: string[];
}

export interface Approval {
  id: string;
  created_at: string;
  agent_id: string;
  kind: "experiment" | "tool";
  ref_id: string;
  summary: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  decided_at: string | null;
  /** kind "tool": the call to execute once a human approves it. */
  payload?: { tool: string; input: Record<string, unknown> };
  /** Result or error of the executed call. */
  result?: string;
  /** Already announced to the operator (GitHub issue). */
  notified?: boolean;
}

/** Phase 3+: a real digital product the agent created, from draft to live sale. */
export type ProductStatus = "DRAFT" | "PAGE_READY" | "PAYMENT_READY" | "LIVE" | "RETIRED";

export interface Product {
  id: string;
  agent_id: string;
  slug: string;
  title: string;
  niche: string;
  format: string;
  audience: string;
  language: string;
  price_eur: number;
  status: ProductStatus;
  created_at: string;
  /** Workspace files, relative to <dataDir>/workspace/<id>/ */
  files: string[];
  /** Unguessable path segment of the download page (delivered after payment). */
  delivery_token: string;
  landing_copy?: LandingCopy;
  stripe?: { product_id: string; price_id: string; payment_link_id: string; payment_link_url: string };
  page_url?: string;
  published_at?: string;
  sales: number;
  revenue_eur: number;
  last_sales_check?: number;
}

export interface LandingCopy {
  headline: string;
  subheadline: string;
  bullets: string[];
  for_who: string;
  whats_inside: string[];
  faq: Array<{ q: string; a: string }>;
  cta: string;
}

export interface LogEvent {
  at: string;
  agent_id: string | null;
  type: string;
  message: string;
  data?: unknown;
}

export interface GlobalState {
  kill_switch: boolean;
  kill_reason: string | null;
  /** UTC date (YYYY-MM-DD) -> USD spent on LLM calls that day, across all agents. */
  llm_spend_by_day: Record<string, number>;
  /** UTC date -> number of experiments launched that day, across all agents. */
  launches_by_day: Record<string, number>;
  next_agent_seq: number;
  next_experiment_seq: number;
  world_seed: number;
  /** key "model|niche" -> anchor from the first web observation (Phase 2+). */
  market_anchors?: Record<string, MarketAnchor>;
  /** UTC date -> number of web searches, across all agents. */
  web_searches_by_day?: Record<string, number>;
  /** Trust ladder: consecutive human approvals per approval-gated tool. */
  trust?: Record<string, { approved: number; denied: number; streak: number }>;
  next_product_seq?: number;
  /** Real money received through Stripe, in EUR, net of estimated fees. */
  real_revenue_eur?: number;
}

export interface State {
  schema_version: 1;
  global: GlobalState;
  agents: Record<string, Agent>;
  experiments: Record<string, Experiment>;
  approvals: Record<string, Approval>;
  products?: Record<string, Product>;
}
