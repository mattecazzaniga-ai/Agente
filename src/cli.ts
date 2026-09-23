// Operator CLI. Also used by the GitHub Actions workflows (tick + manual control).
//
//   npm run cli -- <command> [args]
//
// Commands: init, tick, simulate, status, report, log, pause, resume, kill, killswitch,
//           approvals, approve, deny, tools

import "./env.js";
import { loadConfig } from "./config.js";
import { JsonStore } from "./store/jsonStore.js";
import { ensureGenesis, runTick } from "./agent/loop.js";
import { ClaudeBrain } from "./llm/claude.js";
import { HeuristicBrain } from "./agent/brain.js";
import { evaluate, committedCapital, runningExperiments } from "./decision/engine.js";
import { countLaunch } from "./agent/experiments.js";
import { availableTools, CURRENT_PHASE, PLANNED_TOOLS } from "./tools/registry.js";
import { memorySnapshot } from "./agent/memory.js";
import { llmSpentToday } from "./safety/guard.js";
import type { Agent, State } from "./types.js";
import { money } from "./util.js";

const cfg = loadConfig();
const store = new JsonStore(cfg.dataDir);
const [cmd = "help", ...args] = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const positional = args.filter((a) => !a.startsWith("--"));

function agentOrDie(state: State, id: string | undefined): Agent {
  const agent = id ? state.agents[id] : Object.values(state.agents)[0];
  if (!agent) throw new Error(`agent not found: ${id ?? "(none exists yet — run init)"}`);
  return agent;
}

async function mutate(fn: (s: State, now: string) => string): Promise<void> {
  const state = await store.load();
  const now = new Date().toISOString();
  const msg = fn(state, now);
  await store.save(state);
  await store.log({ at: now, agent_id: null, type: `operator_${cmd}`, message: msg });
  console.log(msg);
}

async function main(): Promise<void> {
  switch (cmd) {
    case "init": {
      await mutate((s, now) => {
        const a = ensureGenesis(s, cfg, now);
        return a ? `Creato ${a.name} (${a.id}) con capitale virtuale €${a.capital}` : "Esiste già almeno un agente: nulla da fare.";
      });
      break;
    }

    case "tick": {
      const offline = flag("--offline") || !cfg.llm.enabled;
      const brain = offline ? new HeuristicBrain() : new ClaudeBrain(cfg);
      if (offline && !flag("--offline")) console.log("ANTHROPIC_API_KEY non impostata o LLM_ENABLED=false → cervello euristico offline.");
      const reports = await runTick(store, cfg, { brain, force: flag("--force") });
      for (const r of reports) {
        console.log(`\n=== ${r.agent_id} ${r.skipped ? `SKIPPED (${r.skipped})` : `[${r.brain}]`}`);
        if (r.skipped) continue;
        console.log(`capitale €${r.capital_before} → €${r.capital_after} · LLM $${r.llm_usd.toFixed(4)}`);
        for (const e of r.events) if (!e.startsWith("tool_call")) console.log(`  · ${e.slice(0, 300)}`);
        if (r.summary) console.log(`riassunto: ${r.summary}`);
      }
      break;
    }

    case "simulate": {
      // Fast-forward N hourly ticks locally (offline brain unless --llm). Useful to test dynamics.
      const n = Number(positional[0] ?? 48);
      const brain = flag("--llm") && cfg.llm.enabled ? new ClaudeBrain(cfg) : new HeuristicBrain();
      const start = Date.now();
      for (let i = 0; i < n; i++) {
        const now = new Date(start + i * 3_600_000).toISOString();
        const reports = await runTick(store, cfg, { brain, now, force: true });
        const line = reports.map((r) => `${r.agent_id}: €${r.capital_after}${r.skipped ? " (skip)" : ""}`).join(" | ");
        console.log(`tick ${String(i + 1).padStart(3)} ${now.slice(0, 16)}  ${line}`);
        if (reports.every((r) => r.skipped)) break;
      }
      break;
    }

    case "status": {
      const s = await store.load();
      const now = new Date().toISOString();
      console.log(`Phase ${CURRENT_PHASE} · kill switch: ${s.global.kill_switch ? `ON (${s.global.kill_reason})` : "off"} · LLM oggi $${llmSpentToday(s, now).toFixed(4)} / $${cfg.limits.maxLlmUsdPerDay} · brain: ${cfg.llm.enabled ? cfg.llm.model : "heuristic (offline)"}`);
      for (const a of Object.values(s.agents)) {
        console.log(
          `\n${a.name} [${a.id}] ${a.status}${a.status_reason ? ` (${a.status_reason})` : ""} · gen ${a.generation}${a.parent_id ? ` · padre ${a.parent_id}` : ""}\n` +
            `  capitale €${a.capital} (iniziale €${a.initial_capital}, impegnato €${money(committedCapital(s, a.id))}) · ricavi €${a.revenue} · spese €${a.expenses} · profitto €${a.profit} · LLM $${a.llm_cost_usd.toFixed(4)}\n` +
            `  tick ${a.tick_count} · ultimo ${a.last_tick_at ?? "-"} · successi ${a.success_count} · fallimenti ${a.failure_count}\n` +
            `  strategia v${a.strategy.version}: ${a.strategy.focus_model ?? "-"} → ${a.strategy.focus_niche ?? "-"} · ${a.strategy.thesis.slice(0, 200)}\n` +
            `  prossima azione: ${a.next_action ?? "-"}`,
        );
        for (const e of runningExperiments(s, a.id))
          console.log(`  ▶ ${e.id} ${e.business_model} → ${e.niche} via ${e.channel} · tick ${e.ticks_elapsed}/${e.duration_ticks} · speso €${e.spent}/${e.budget} · ricavi €${e.revenue} · ${e.conversions}/${e.visitors}`);
      }
      const pending = Object.values(s.approvals).filter((a) => a.status === "PENDING");
      if (pending.length) console.log(`\n⚠ ${pending.length} approvazioni in attesa: npm run cli -- approvals`);
      break;
    }

    case "report": {
      const s = await store.load();
      const a = agentOrDie(s, positional[0]);
      console.log(memorySnapshot(a));
      console.log("\n## Esperimenti");
      for (const e of Object.values(s.experiments).filter((e) => e.agent_id === a.id))
        console.log(`- ${e.id} ${e.status} ${e.business_model} → ${e.niche} via ${e.channel} · €${e.price} · speso €${e.spent} · ricavi €${e.revenue} · ${e.outcome_note ?? ""}`);
      break;
    }

    case "log": {
      for (const e of await store.readLog(Number(positional[0] ?? 40))) console.log(`${e.at} ${e.agent_id ?? "-"} ${e.type}: ${e.message.slice(0, 300)}`);
      break;
    }

    case "pause":
    case "resume": {
      await mutate((s) => {
        const a = agentOrDie(s, positional[0]);
        if (a.status === "DEAD") return `${a.id} è DEAD: non può essere modificato.`;
        a.status = cmd === "pause" ? "PAUSED" : "ACTIVE";
        a.status_reason = cmd === "pause" ? positional.slice(1).join(" ") || "paused by operator" : null;
        return `${a.id} → ${a.status}`;
      });
      break;
    }

    case "kill": {
      // Per-agent kill switch: permanent. Cancels running experiments; capital is frozen.
      await mutate((s, now) => {
        const a = agentOrDie(s, positional[0]);
        a.status = "DEAD";
        a.status_reason = `killed by operator: ${positional.slice(1).join(" ") || "no reason"}`;
        for (const e of Object.values(s.experiments))
          if (e.agent_id === a.id && (e.status === "RUNNING" || e.status === "PENDING_APPROVAL")) {
            e.status = "CANCELLED";
            e.ended_at = now;
          }
        return `${a.id} → DEAD`;
      });
      break;
    }

    case "killswitch": {
      await mutate((s) => {
        const on = positional[0] !== "off";
        s.global.kill_switch = on;
        s.global.kill_reason = on ? positional.slice(1).join(" ") || "operator" : null;
        return `global kill switch ${on ? "ON" : "off"}`;
      });
      break;
    }

    case "approvals": {
      const s = await store.load();
      const list = Object.values(s.approvals).filter((a) => flag("--all") || a.status === "PENDING");
      if (!list.length) console.log("Nessuna approvazione in attesa.");
      for (const a of list) {
        console.log(`${a.id} [${a.status}] ${a.summary}`);
        const e = s.experiments[a.ref_id];
        if (e) console.log(`   ipotesi: ${e.hypothesis}\n   offerta: ${e.offer}\n   decisione: ${e.decision.reasons.join(" | ")}`);
      }
      break;
    }

    case "approve":
    case "deny": {
      await mutate((s, now) => {
        const apr = s.approvals[positional[0] ?? ""];
        if (!apr || apr.status !== "PENDING") return `approvazione non trovata o già decisa: ${positional[0]}`;
        const e = s.experiments[apr.ref_id]!;
        apr.decided_at = now;
        if (cmd === "deny") {
          apr.status = "DENIED";
          e.status = "REJECTED";
          e.ended_at = now;
          e.outcome_note = "denied by operator";
          return `${apr.id} negata`;
        }
        // Conditions may have changed since the request: re-run the decision engine.
        const agent = s.agents[e.agent_id]!;
        const d = evaluate(s, agent, { ...e, estimates: e.estimates }, cfg, now);
        if (!d.approved || agent.status !== "ACTIVE") return `impossibile avviare ${e.id} ora: ${d.reasons.filter((r) => r.startsWith("REJECT")).join("; ") || agent.status}`;
        apr.status = "APPROVED";
        e.status = "RUNNING";
        e.started_at = now;
        e.decision = { ...d, requires_human_approval: false };
        countLaunch(s, now);
        return `${apr.id} approvata: ${e.id} avviato`;
      });
      break;
    }

    case "tools": {
      console.log(`Phase attuale: ${CURRENT_PHASE}\n\nStrumenti disponibili:`);
      for (const t of availableTools()) console.log(`  [${t.permission}] ${t.name} (phase ${t.phase})`);
      console.log("\nStrumenti pianificati:");
      for (const t of PLANNED_TOOLS) console.log(`  [${t.permission}] ${t.name} (phase ${t.phase}) — ${t.purpose}`);
      break;
    }

    default:
      console.log(`Comandi:
  init                       crea l'agente genesi (€${cfg.economy.initialCapital} virtuali)
  tick [--force] [--offline] esegue un ciclo per ogni agente attivo
  simulate [N] [--llm]       avanza N tick orari in locale (default cervello offline)
  status                     stato di agenti, esperimenti, spesa LLM
  report [agent-id]          memoria ed esperimenti di un agente
  log [N]                    ultimi N eventi
  pause|resume <agent-id>    pausa / ripresa di un agente
  kill <agent-id> [motivo]   kill switch per agente (permanente)
  killswitch on|off [motivo] kill switch globale
  approvals [--all]          richieste di approvazione
  approve|deny <apr-id>      decide una richiesta
  tools                      strumenti e permessi`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
