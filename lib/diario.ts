// Diario dei tornei: brevi notizie generate dai risultati veri (nessun testo inventato, solo fatti dal tabellone).
import type { Coppia, Partita, Tabellone, Torneo, Turno } from "./tipi";
import { TURNI } from "./tipi";
import { cammino, statisticheTorneo } from "./statistiche";

export type TipoVoce = "campioni" | "turno" | "imbattuti" | "sorpresa" | "long";

export interface VoceDiario {
  tipo: TipoVoce;
  quando: string; // ISO, per ordinare
  torneo: Pick<Torneo, "id" | "nome">;
  genere: string;
  turno?: Turno;
  coppie: (Coppia | null)[]; // le coppie di cui si parla
  punteggio?: string;
  testa?: number | null;
  sfide?: [Coppia | null, Coppia | null][]; // per "turno": gli accoppiamenti
}

const ordine = (t: Turno) => TURNI.indexOf(t);
const punteggioDi = (p: Partita, vincitoreA: boolean) =>
  (p.game_a ?? []).map((x, i) => (vincitoreA ? `${x}-${p.game_b?.[i] ?? 0}` : `${p.game_b?.[i] ?? 0}-${x}`)).join(" ");

export function diarioTorneo(torneo: Torneo, tabelloni: Tabellone[]): VoceDiario[] {
  const voci: VoceDiario[] = [];
  for (const tb of tabelloni) {
    const coppia = (id: string | null) => tb.coppie.find((c) => c.id === id) ?? null;
    const base = { torneo: { id: torneo.id, nome: torneo.nome }, genere: tb.genere };
    const concluse = tb.partite.filter((p) => p.stato === "conclusa" && p.vincitore_id);

    // 1. La finale: i vincitori del tabellone
    const finale = concluse.find((p) => p.turno === "F");
    if (finale) {
      const vA = finale.vincitore_id === finale.coppia_a_id;
      voci.push({ ...base, tipo: "campioni", quando: finale.inizio_at, turno: "F", coppie: [coppia(finale.vincitore_id), coppia(vA ? finale.coppia_b_id : finale.coppia_a_id)], punteggio: finale.ritiro ? undefined : punteggioDi(finale, vA) });
    }

    // 2. Il turno appena definito (tutte le sfide con le due coppie, nessuna ancora giocata), dai quarti in poi
    const prossimo = TURNI.filter((t) => ordine(t) >= ordine("QF")).find((t) => {
      const qui = tb.partite.filter((p) => p.turno === t);
      return qui.length > 0 && qui.every((p) => p.coppia_a_id && p.coppia_b_id) && qui.every((p) => p.stato !== "conclusa");
    });
    if (prossimo) {
      const qui = tb.partite.filter((p) => p.turno === prossimo).sort((x, y) => x.ordine - y.ordine);
      const precedente = concluse.filter((p) => ordine(p.turno) === ordine(prossimo) - 1);
      voci.push({
        ...base,
        tipo: "turno",
        turno: prossimo,
        quando: precedente.length ? precedente.map((p) => p.inizio_at).sort().at(-1)! : qui[0].inizio_at,
        coppie: [],
        sfide: qui.map((p) => [coppia(p.coppia_a_id), coppia(p.coppia_b_id)]),
      });
      // chi ci arriva senza aver perso un set (una sola notizia con tutte le coppie)
      const imbattute = qui
        .flatMap((p) => [p.coppia_a_id, p.coppia_b_id])
        .filter((id) => {
          const tappe = cammino(tb.partite, tb.coppie, id, prossimo);
          return tappe.length >= 2 && tappe.every((x) => x.vinta && !x.ritiro && x.punteggio.split(" ").length === 2);
        });
      if (imbattute.length) voci.push({ ...base, tipo: "imbattuti", turno: prossimo, quando: voci.at(-1)!.quando, coppie: imbattute.map(coppia) });
    }

    // 3. Le sorprese: teste di serie eliminate
    const st = statisticheTorneo(tb.partite, tb.coppie);
    for (const s of st.sorprese) {
      const p = concluse.find((x) => x.turno === s.turno && [x.coppia_a_id, x.coppia_b_id].includes(s.perdente.id));
      if (!p) continue;
      const vA = p.vincitore_id === p.coppia_a_id;
      voci.push({ ...base, tipo: "sorpresa", quando: p.inizio_at, turno: s.turno, coppie: [s.vincitore, s.perdente], testa: s.perdente.testa_di_serie, punteggio: p.ritiro ? undefined : punteggioDi(p, vA) });
    }

    // 4. I long tie-break più tirati (oltre il 10)
    for (const p of concluse.filter((x) => !x.ritiro && (x.game_a?.length ?? 0) >= 3 && Math.max(x.game_a![2], x.game_b![2]) > 10)) {
      const vA = p.vincitore_id === p.coppia_a_id;
      voci.push({ ...base, tipo: "long", quando: p.inizio_at, turno: p.turno, coppie: [coppia(p.vincitore_id), coppia(vA ? p.coppia_b_id : p.coppia_a_id)], punteggio: punteggioDi(p, vA) });
    }
  }
  return voci.sort((x, y) => y.quando.localeCompare(x.quando) || ordineTipo(x.tipo) - ordineTipo(y.tipo));
}

const ordineTipo = (t: TipoVoce) => ["campioni", "turno", "imbattuti", "sorpresa", "long"].indexOf(t);
