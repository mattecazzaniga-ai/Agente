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
  };
}

export function loadConfig(): Config {
  const model = process.env.AGENT_MODEL || "claude-opus-5";
  const prices = MODEL_PRICES[model] ?? { input: num("LLM_INPUT_PRICE_PER_M", 5), output: num("LLM_OUTPUT_PRICE_PER_M", 25) };
  return {
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
      maxLlmUsdPerTick: num("MAX_LLM_USD_PER_TICK", 0.25),
      thinkEveryHours: num("THINK_EVERY_HOURS", 6),
      thinkWhenIdleSlotHours: num("THINK_WHEN_IDLE_SLOT_HOURS", 2),
    },
    llm: {
      enabled: bool("LLM_ENABLED", true) && Boolean(process.env.ANTHROPIC_API_KEY),
      model,
      effort: (process.env.AGENT_EFFORT || "medium") as Config["llm"]["effort"],
      maxTokens: num("LLM_MAX_TOKENS", 8000),
      budgetFallback: process.env.LLM_BUDGET_FALLBACK === "heuristic" ? "heuristic" : "measure_only",
      inputPricePerM: prices.input,
      outputPricePerM: prices.output,
    },
  };
}

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
