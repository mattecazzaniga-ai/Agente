// Worker: the cheaper model that does the execution work (writing products and page copy).
// The brain (Opus) decides WHAT to make; the worker (Sonnet by default) MAKES it. Every call is
// priced and added to the cycle's LLM spend, so the same budget caps apply.

import Anthropic from "@anthropic-ai/sdk";
import type { ToolContext } from "../tools/types.js";

let client: Anthropic | null = null;

/** Tests inject a fake client; production creates one lazily. */
export function setWorkerClient(c: Anthropic | null): void {
  client = c;
}

function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 300_000, maxRetries: 2 });
  return client;
}

/** Refuse work that would push the cycle over its LLM budget (keeps a margin for the brain to finish). */
function assertBudget(ctx: ToolContext, estimateUsd: number): void {
  const left = ctx.cfg.limits.maxLlmUsdPerTick * 1.5 - ctx.counters.llmUsd;
  if (left < estimateUsd) throw new Error(`not enough LLM budget left in this cycle for this job (~$${estimateUsd.toFixed(2)} needed): do it next cycle`);
}

interface WorkerRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** When set, the answer is constrained to this JSON schema (structured outputs). */
  schema?: Record<string, unknown>;
  estimateUsd: number;
}

export async function runWorker(ctx: ToolContext, req: WorkerRequest): Promise<string> {
  assertBudget(ctx, req.estimateUsd);
  const cfg = ctx.cfg;
  const stream = getClient().messages.stream({
    model: cfg.llm.workerModel,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", ...(req.schema ? { format: { type: "json_schema" as const, schema: req.schema } } : {}) },
  });
  const msg = await stream.finalMessage();
  const u = msg.usage;
  const usd =
    (u.input_tokens * cfg.llm.workerInputPricePerM +
      (u.cache_creation_input_tokens ?? 0) * cfg.llm.workerInputPricePerM * 1.25 +
      (u.cache_read_input_tokens ?? 0) * cfg.llm.workerInputPricePerM * 0.1 +
      u.output_tokens * cfg.llm.workerOutputPricePerM) /
    1e6;
  ctx.counters.llmUsd += usd;
  ctx.log("worker", `${cfg.llm.workerModel}: ${u.input_tokens} in / ${u.output_tokens} out, $${usd.toFixed(4)}`);
  if (msg.stop_reason === "refusal") throw new Error("the worker model declined this job");
  if (msg.stop_reason === "max_tokens") throw new Error("the worker ran out of tokens: ask for a shorter product");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  if (!text) throw new Error("the worker returned no content");
  return text;
}
