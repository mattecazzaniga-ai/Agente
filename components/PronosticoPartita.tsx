"use client";
import { useActionState, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import { SET_VINTI } from "@/lib/punti";
import Condividi from "./Condividi";
import { IconaSpunta } from "./Icone";

export interface LatoCoppia {
  id: string;
  nome: string; // "Ricci / Neri", per la condivisione
  righe: [string, string]; // un cognome per riga
  bandiere: string;
  testa_di_serie: number | null;
}

type Mio = { id: string; vincitore_id: string; game_a: number[] | null; game_b: number[] | null } | null;
/** Un set dal lato della coppia scelta: [game suoi, game avversari]. */
type SetScelto = [number, number] | null;

/** Dal pronostico salvato (lato A/B) ai set dal lato della coppia scelta. */
function iniziali(mio: Mio, idA: string): { formula: "2-0" | "2-1"; persoIl: 0 | 1; set: SetScelto[] } {
  if (!mio?.game_a || !mio.game_b) return { formula: "2-0", persoIl: 1, set: [null, null] };
  const daA = mio.vincitore_id === idA;
  const set = mio.game_a.map((a, i): [number, number] => (daA ? [a, mio.game_b![i]] : [mio.game_b![i], a]));
  const perso = set.findIndex(([n, m]) => n < m);
  return { formula: perso >= 0 ? "2-1" : "2-0", persoIl: perso === 0 ? 0 : 1, set };
}

/**
 * Pronostico su una partita: chi vince e il risultato esatto (game di ogni set).
 * Al meglio dei 3 si sceglie 2-0 o 2-1; nel 2-1 il terzo set (super tie-break) va alla coppia scelta.
 */
export default function PronosticoPartita(props: {
  partitaId: string;
  a: LatoCoppia;
  b: LatoCoppia;
  setPerVincere: 1 | 2;
  mio: Mio;
  collegato: boolean;
  urlAccesso: string;
  sito: string;
  descrizione: string;
}) {
  const t = useTranslations();
  const lingua = useLocale();
  const [esito, azione, inCorso] = useActionState<Esito | null, FormData>(salvaPronosticoPartita, null);
  const inizio = useMemo(() => iniziali(props.mio, props.a.id), [props.mio, props.a.id]);
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [formula, setFormula] = useState<"2-0" | "2-1">(inizio.formula);
  const [persoIl, setPersoIl] = useState<0 | 1>(inizio.persoIl);
  const [set, setSet] = useState<SetScelto[]>(props.setPerVincere === 2 ? inizio.set.slice(0, 2) : inizio.set.slice(0, 1));
  const [modificato, setModificato] = useState(false);
  const salvato = esito?.ok && !modificato;
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const scelta = vincitore === props.a.id ? props.a : vincitore === props.b.id ? props.b : null;
  const numeroSet = props.setPerVincere === 2 ? 2 : 1;
  const perso = (i: number) => props.setPerVincere === 2 && formula === "2-1" && persoIl === i;

  // set che non corrisponde più alla formula scelta (es. un set perso in un 2-0): va riscelto
  const coerente = (s: SetScelto, i: number) => s !== null && (perso(i) ? s[0] < s[1] : s[0] > s[1]);
  const completo = Boolean(scelta) && set.length === numeroSet && set.every(coerente);
  const cambia = (f: () => void) => {
    f();
    setModificato(true);
  };

  // Dal lato della coppia scelta a game_a / game_b
  const daA = vincitore === props.a.id;
  const gameA = set.map((s) => (s ? (daA ? s[0] : s[1]) : 0)).join(",");
  const gameB = set.map((s) => (s ? (daA ? s[1] : s[0]) : 0)).join(",");

  const bottone = (c: LatoCoppia) => {
    const scelto = vincitore === c.id;
    const contenuto = (
      <>
        <span className="text-lg leading-none" aria-hidden>
          {c.bandiere}
        </span>
        <span className="mt-1.5 block text-[15px] font-extrabold leading-tight">{c.righe[0]}</span>
        <span className="block text-[15px] font-extrabold leading-tight">{c.righe[1]}</span>
        {c.testa_di_serie ? <span className={`mt-1 block text-[11px] font-bold ${scelto ? "text-white/80" : "text-nebbia"}`}>TDS {c.testa_di_serie}</span> : null}
        {scelto && (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-mare">
            <IconaSpunta className="h-4 w-4" />
          </span>
        )}
      </>
    );
    const classe = `relative flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 text-center transition active:scale-[.97] ${
      scelto ? "border-mare bg-mare text-white shadow-[0_8px_20px_-10px_rgba(10,126,164,.9)]" : "border-sabbia-scura/80 bg-gradient-to-b from-white to-crema hover:border-cielo"
    }`;
    if (!props.collegato)
      return (
        <a href={props.urlAccesso} className={classe}>
          {contenuto}
        </a>
      );
    return (
      <button type="button" onClick={() => cambia(() => setVincitore(c.id))} aria-pressed={scelto} className={classe}>
        {contenuto}
      </button>
    );
  };

  const pill = (attiva: boolean) =>
    `rounded-xl border-2 px-2 py-2 text-[15px] font-extrabold tabular-nums transition active:scale-95 ${attiva ? "border-mare bg-mare text-white" : "border-sabbia-scura/70 bg-white text-inchiostro"}`;

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-3">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <input type="hidden" name="game_a" value={completo ? gameA : ""} />
      <input type="hidden" name="game_b" value={completo ? gameB : ""} />
      <div className="relative grid grid-cols-2 gap-3">
        {bottone(props.a)}
        {bottone(props.b)}
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-sole text-[11px] font-black text-inchiostro shadow-md">VS</span>
      </div>

      {!props.collegato ? (
        <a href={props.urlAccesso} className="bottone">
          {t("torneo.accediPerPronosticare")}
        </a>
      ) : !scelta ? (
        <p className="text-center text-sm font-semibold text-nebbia">{t("partita.tocca")}</p>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl bg-onda/60 p-3">
            <p className="text-sm font-bold">
              {t("partita.risultatoDi", { nome: scelta.nome })}
            </p>
            {props.setPerVincere === 2 && (
              <div className="grid grid-cols-2 gap-2">
                {(["2-0", "2-1"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => cambia(() => setFormula(f))} className={pill(formula === f)}>
                    {f}
                  </button>
                ))}
              </div>
            )}
            {props.setPerVincere === 2 && formula === "2-1" && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-nebbia">{t("partita.setPerso")}</span>
                {([0, 1] as const).map((i) => (
                  <button key={i} type="button" onClick={() => cambia(() => setPersoIl(i))} className={`${pill(persoIl === i)} px-3 py-1`}>
                    {t("partita.setN", { n: i + 1 })}
                  </button>
                ))}
              </div>
            )}
            {Array.from({ length: numeroSet }, (_, i) => (
              <div key={i}>
                <p className="etichetta mb-1">
                  {numeroSet > 1 ? t("partita.setN", { n: i + 1 }) : t("partita.ilSet")} · {perso(i) ? t("partita.lovince", { nome: (scelta === props.a ? props.b : props.a).righe.join("/") }) : t("partita.lovince", { nome: scelta.righe.join("/") })}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {SET_VINTI.map(([v, p]) => {
                    const valore: [number, number] = perso(i) ? [p, v] : [v, p];
                    const attivo = set[i]?.[0] === valore[0] && set[i]?.[1] === valore[1];
                    return (
                      <button
                        key={`${v}-${p}`}
                        type="button"
                        onClick={() => cambia(() => setSet((s) => s.map((x, j) => (j === i ? valore : x))))}
                        className={pill(attivo)}
                      >
                        {valore[0]}-{valore[1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {props.setPerVincere === 2 && formula === "2-1" && <p className="text-xs text-nebbia">{t("partita.superTieBreak", { nome: scelta.righe.join("/") })}</p>}
          </div>
          <p className="text-center text-xs leading-relaxed text-nebbia">{t("partita.inPalio")}</p>

          {esito && !esito.ok && <p className="text-center text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-2xl bg-menta-chiaro p-3 text-center">
              <p className="font-extrabold text-menta">{t("partita.salvato")}</p>
              <p className="text-xs text-nebbia">{t("partita.puoiCambiare")}</p>
              {idSalvato && (
                <Condividi
                  immagine={`/api/immagine/pronostico?tipo=partita&id=${idSalvato}&lingua=${lingua}`}
                  testo={t("condividi.testoPronostico", { scelta: `${scelta.nome} ${set.map((s) => (s ? `${s[0]}-${s[1]}` : "")).join(" ")} (${props.descrizione})` })}
                  url={`${props.sito}/${lingua}`}
                  etichetta={t("condividi.pronostico")}
                />
              )}
            </div>
          ) : props.mio?.game_a && !modificato && !esito ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-menta-chiaro px-3 py-2.5 text-sm font-bold text-menta">
              <IconaSpunta className="h-4 w-4" /> {t("torneo.ilTuo")} · <span className="font-medium text-nebbia">{t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso || !completo}>
              {inCorso ? "…" : completo ? t("partita.salva") : t("partita.completa")}
            </button>
          )}
        </>
      )}
    </form>
  );
}
