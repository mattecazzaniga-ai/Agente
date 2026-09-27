// Central configuration. Every safety-relevant number lives here so it can be reviewed in one place.
// Values can be overridden through environment variables (see .env.example).

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric env var ${name}=${raw}`);
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export interface Config {
  /** Roadmap phase: 1 = simulated research, 2 = real web research (default). */
  phase: number;
  /** Deterministic zero-cost routine decisions (renew winners, stop losers) before the brain runs. */
  autopilot: boolean;
  dataDir: string;
  economy: {
    initialCapital: number;
    /** Reproduction triggers at capital >= initialCapital * reproductionMultiple. */
    reproductionMultiple: number;
    /** Phase 5 feature: off until explicitly enabled. */
    reproductionEnabled: boolean;
    maxPopulation: number;
    /** Deduct real LLM costs (converted to EUR) from the agent's virtual capital. Makes the sim honest. */
    chargeLlmCostToCapital: boolean;
    usdToEur: number;
  };
  limits: {
    /** Hard cap on the budget of a single experiment (EUR). */
    maxBudgetPerExperiment: number;
    /** Max fraction of current capital committed to a single experiment. */
    maxCapitalFractionPerExperiment: number;
    /** Max fraction of capital committed across all running experiments. */
    maxCapitalFractionCommitted: number;
    /** Capital that must remain even if every running experiment loses everything. */
    reserveFraction: number;
    maxConcurrentExperiments: number;
    maxLaunchesPerDay: number;
    /** Experiments above this budget need human approval. */
    approvalThreshold: number;
    maxDurationTicks: number;
    maxToolCallsPerTick: number;
    maxResearchCallsPerTick: number;
    /** Minimum minutes between ticks of the same agent (protects against duplicate scheduler runs). */
    minMinutesBetweenTicks: number;
    tickTimeoutMs: number;
    /** Global daily cap on real Claude API spend (USD). When hit, the agent falls back to the offline brain. */
    maxLlmUsdPerDay: number;
    /** Per-tick cap on Claude API spend (USD). */
    maxLlmUsdPerTick: number;
    /** LLM brain runs at least this often (hours) even when nothing happened. */
    thinkEveryHours: number;
    /** With a free experiment slot, re-think at most this often (hours). */
    thinkWhenIdleSlotHours: number;
    /** Phase 2: server-side web searches allowed per request (Claude web_search max_uses). */
    maxWebSearchesPerTick: number;
    /** Phase 2: web page fetches allowed per request. */
    maxWebFetchesPerTick: number;
    /** Phase 2: cap on tokens of a fetched page that enter the context. */
    webFetchMaxContentTokens: number;
  };
  llm: {
    enabled: boolean;
    model: string;
    effort: "low" | "medium" | "high" | "xhigh" | "max";
    maxTokens: number;
    /**
     * What to do when the daily LLM budget is exhausted:
     * measure_only – keep measuring running experiments, take no new decisions until tomorrow (default)
     * heuristic    – let the offline rule-based brain keep acting
     */
    budgetFallback: "measure_only" | "heuristic";
    /** USD per 1M tokens, used for cost accounting. Update if you change the model. */
    inputPricePerM: number;
    outputPricePerM: number;
    /** USD per web search request (billed separately from tokens). */
    webSearchUsd: number;
    /** Cheaper model that does the execution work (writing products and pages). */
    workerModel: string;
    workerInputPricePerM: number;
    workerOutputPricePerM: number;
  };
  /** Phase 3+: real selling. Nothing here works until the operator provides keys and identity. */
  real: {
    /** Master switch, OFF by default: real-money selling needs an explicit operator decision. */
    enabled: boolean;
    /** Public base URL of the GitHub Pages site, e.g. https://user.github.io/Agente */
    siteBaseUrl: string | null;
    /** Seller identity shown on every page (required by consumer law before publishing). */
    sellerName: string | null;
    sellerEmail: string | null;
    sellerVat: string | null;
    stripeKey: string | null;
    currency: string;
    /** Estimated Stripe fee to compute net revenue: percent + fixed EUR. */
    stripeFeePct: number;
    stripeFeeFixed: number;
  };
  /** Trust ladder: after this many consecutive approvals a gated tool runs without asking (0 = never). */
  trustAutoAfter: number;
}

export function loadConfig(): Config {
  const model = process.env.AGENT_MODEL || "claude-opus-5";
  const workerModel = process.env.WORKER_MODEL || "claude-sonnet-5";
  const prices = MODEL_PRICES[model] ?? { input: num("LLM_INPUT_PRICE_PER_M", 5), output: num("LLM_OUTPUT_PRICE_PER_M", 25) };
  return {
    phase: num("AGENT_PHASE", 2),
    autopilot: bool("AUTOPILOT", true),
    dataDir: process.env.DATA_DIR || "data",
    economy: {
      initialCapital: num("INITIAL_CAPITAL", 50),
      reproductionMultiple: num("REPRODUCTION_MULTIPLE", 2),
      reproductionEnabled: bool("REPRODUCTION_ENABLED", false),
      maxPopulation: num("MAX_POPULATION", 1),
      chargeLlmCostToCapital: bool("CHARGE_LLM_COST_TO_CAPITAL", true),
      usdToEur: num("USD_TO_EUR", 0.92),
    },
    limits: {
      maxBudgetPerExperiment: num("MAX_BUDGET_PER_EXPERIMENT", 15),
      maxCapitalFractionPerExperiment: num("MAX_CAPITAL_FRACTION_PER_EXPERIMENT", 0.3),
      maxCapitalFractionCommitted: num("MAX_CAPITAL_FRACTION_COMMITTED", 0.5),
      reserveFraction: num("RESERVE_FRACTION", 0.2),
      maxConcurrentExperiments: num("MAX_CONCURRENT_EXPERIMENTS", 2),
      maxLaunchesPerDay: num("MAX_LAUNCHES_PER_DAY", 3),
      approvalThreshold: num("APPROVAL_THRESHOLD", 12),
      maxDurationTicks: num("MAX_DURATION_TICKS", 72),
      maxToolCallsPerTick: num("MAX_TOOL_CALLS_PER_TICK", 16),
      maxResearchCallsPerTick: num("MAX_RESEARCH_CALLS_PER_TICK", 6),
      minMinutesBetweenTicks: num("MIN_MINUTES_BETWEEN_TICKS", 20),
      tickTimeoutMs: num("TICK_TIMEOUT_MS", 8 * 60_000),
      maxLlmUsdPerDay: num("MAX_LLM_USD_PER_DAY", 1.0),
      maxLlmUsdPerTick: num("MAX_LLM_USD_PER_TICK", 0.4),
      thinkEveryHours: num("THINK_EVERY_HOURS", 24),
      thinkWhenIdleSlotHours: num("THINK_WHEN_IDLE_SLOT_HOURS", 2),
      maxWebSearchesPerTick: num("MAX_WEB_SEARCHES_PER_TICK", 5),
      maxWebFetchesPerTick: num("MAX_WEB_FETCHES_PER_TICK", 3),
      webFetchMaxContentTokens: num("WEB_FETCH_MAX_CONTENT_TOKENS", 6000),
    },
    llm: {
      enabled: bool("LLM_ENABLED", true) && Boolean(process.env.ANTHROPIC_API_KEY),
      model,
      effort: (process.env.AGENT_EFFORT || "medium") as Config["llm"]["effort"],
      maxTokens: num("LLM_MAX_TOKENS", 8000),
      budgetFallback: process.env.LLM_BUDGET_FALLBACK === "heuristic" ? "heuristic" : "measure_only",
      inputPricePerM: prices.input,
      outputPricePerM: prices.output,
      webSearchUsd: num("WEB_SEARCH_USD", 0.01),
      workerModel,
      workerInputPricePerM: (MODEL_PRICES[workerModel] ?? { input: 2 }).input,
      workerOutputPricePerM: (MODEL_PRICES[workerModel] ?? { output: 10 }).output,
    },
    real: {
      enabled: bool("REAL_SELLING_ENABLED", false),
      siteBaseUrl: (process.env.SITE_BASE_URL || "").replace(/\/+$/, "") || null,
      sellerName: process.env.SELLER_NAME || null,
      sellerEmail: process.env.SELLER_EMAIL || null,
      sellerVat: process.env.SELLER_VAT || null,
      stripeKey: process.env.STRIPE_SECRET_KEY || null,
      currency: process.env.CURRENCY || "eur",
      stripeFeePct: num("STRIPE_FEE_PCT", 0.015),
      stripeFeeFixed: num("STRIPE_FEE_FIXED", 0.25),
    },
    trustAutoAfter: num("TRUST_AUTO_AFTER", 5),
  };
}

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
