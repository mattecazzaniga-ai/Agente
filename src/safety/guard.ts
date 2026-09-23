// Safety layer. Everything the agent does passes through here; nothing here is decided by the LLM.

import type { Config } from "../config.js";
import type { Agent, State } from "../types.js";
import { day } from "../util.js";

export interface GuardVerdict {
  ok: boolean;
  reason: string | null;
}

/** Can this agent run a tick right now? */
export function canTick(state: State, agent: Agent, cfg: Config, now: string): GuardVerdict {
  if (state.global.kill_switch) return { ok: false, reason: `global kill switch: ${state.global.kill_reason ?? "no reason"}` };
  if (process.env.AGENT_KILL_SWITCH === "1") return { ok: false, reason: "AGENT_KILL_SWITCH env is set" };
  if (agent.status !== "ACTIVE") return { ok: false, reason: `agent is ${agent.status}` };
  if (agent.last_tick_at) {
    const minutes = (Date.parse(now) - Date.parse(agent.last_tick_at)) / 60_000;
    if (minutes < cfg.limits.minMinutesBetweenTicks) {
      return { ok: false, reason: `rate limit: last tick ${minutes.toFixed(1)} min ago (< ${cfg.limits.minMinutesBetweenTicks})` };
    }
  }
  return { ok: true, reason: null };
}

export function llmSpentToday(state: State, now: string): number {
  return state.global.llm_spend_by_day[day(now)] ?? 0;
}

export function llmBudgetAvailable(state: State, cfg: Config, now: string): boolean {
  return llmSpentToday(state, now) < cfg.limits.maxLlmUsdPerDay;
}

export function launchesToday(state: State, now: string): number {
  return state.global.launches_by_day[day(now)] ?? 0;
}

// Content policy. The agent's offers/hypotheses are free text written by the LLM; any experiment
// matching these patterns is rejected outright, regardless of expected value. This is a backstop:
// the system prompt already forbids these, and Phase 3+ adds human approval for anything public.
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\b(phishing|credential|password harvest|fake login)\b/i, "phishing / credential harvesting"],
  [/\b(spam|mass (e-?mail|dm|message)|bulk (e-?mail|sms)|email blast)\b/i, "mass spam"],
  [/\b(fake review|recensioni false|astroturf|bot follower|buy followers|comprare follower)\b/i, "manipulation / fake social proof"],
  [/\b(gambl|scommess|casino|betting)\w*/i, "gambling"],
  [/\b(forex|crypto trading|trading bot|leverage|margin trading|day trading|opzioni binarie|binary options)\b/i, "automated high-risk trading"],
  [/\b(scrap(e|ing) (linkedin|facebook|instagram)|bypass captcha|evade (ban|detection))\b/i, "abusive scraping / evasion"],
  [/\b(pirat|crack(ed)?|warez|counterfeit|contraffat)\w*/i, "IP infringement"],
  [/\b(pyramid|ponzi|schema piramidale|mlm)\b/i, "pyramid schemes"],
  [/\b(impersonat|spacciarsi per|fingersi)\w*/i, "impersonation"],
];

export function policyCheck(...texts: string[]): GuardVerdict {
  const joined = texts.join(" \n ");
  for (const [re, label] of FORBIDDEN) {
    if (re.test(joined)) return { ok: false, reason: `policy violation: ${label}` };
  }
  return { ok: true, reason: null };
}
