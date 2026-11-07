"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import { gameTotali, puntiVincitoreLong, SET_VINTI } from "@/lib/punti";
import Condividi from "./Condividi";
import { IconaMeno, IconaPiu, IconaSpunta } from "./Icone";

export interface LatoCoppia {
  id: string;
  nome: string; // "Ricci / Neri", per la condivisione
  righe: [string, string]; // un cognome per riga
  bandiere: string;
  testa_di_serie: number | null;
}

type Mio = { id: string; vincitore_id: string; set_perdente: number | null; game_a: number[] | null; game_b: number[] | null; game_previsti_a: number | null } | null;
/** Un set dal lato di chi vince la partita: [game suoi, game avversari]. */
type Set2 = [number, number];

const INIZIO_SET: Set2 = [6, 4];
const LONG_PERDENTE = 8;

/** Dal pronostico salvato (lato A/B) allo stato della scheda, dal lato del vincitore scelto. */
function daSalvato(mio: Mio, idA: string) {
  if (!mio?.game_a || !mio.game_b) return null;
  const daA = mio.vincitore_id === idA;
  const set = mio.game_a.map((x, i): Set2 => (daA ? [x, mio.game_b![i]] : [mio.game_b![i], x]));
  const persoIl = set.slice(0, 2).findIndex(([v, p]) => v < p);
  // lo stato tiene ogni set dal lato di chi lo vince: un set perso si gira
  const normale = (s: Set2): Set2 => (s[0] < s[1] ? [s[1], s[0]] : s);
  return {
    persi: (persoIl >= 0 ? 1 : 0) as 0 | 1,
    persoIl: (persoIl === 0 ? 0 : 1) as 0 | 1,
    set: [normale(set[0]), normale(set[1] ?? INIZIO_SET)] as [Set2, Set2],
    long: set[2] ? set[2][1] : LONG_PERDENTE,
  };
}

/**
 * Pronostico su una partita: chi vince, il punteggio del 1° e del 2° set e, se finisce 2-1, il long
 * tie-break a 10. Il risultato dei set e i game totali (super tie-break = 1 game) si ricavano da qui.
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
  inPalio: string;
}) {
  const t = useTranslations();
  const lingua = useLocale();
  const [esito, azione, inCorso] = useActionState<Esito | null, FormData>(salvaPronosticoPartita, null);
  const salvatoPrima = daSalvato(props.mio, props.a.id);
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [persi, setPersi] = useState<0 | 1>(salvatoPrima?.persi ?? (props.mio?.set_perdente === 1 ? 1 : 0));
  const [persoIl, setPersoIl] = useState<0 | 1>(salvatoPrima?.persoIl ?? 1);
  const [set, setSet] = useState<[Set2, Set2]>(salvatoPrima?.set ?? [INIZIO_SET, [6, 3]]);
  const [long, setLong] = useState(salvatoPrima?.long ?? LONG_PERDENTE);
  const [modificato, setModificato] = useState(false);
  const salvato = esito?.ok && !modificato;
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const completoSalvato = Boolean(salvatoPrima);

  const scelta = vincitore === props.a.id ? props.a : vincitore === props.b.id ? props.b : null;
  const altra = scelta === props.a ? props.b : props.a;
  const treSet = props.setPerVincere === 2 && persi === 1;
  const numeroSet = props.setPerVincere === 2 ? 2 : 1;
  /** Il set i lo perde il vincitore della partita? (solo nel 2-1) */
  const perso = (i: number) => treSet && persoIl === i;

  // Set dal lato del vincitore della partita, girati se quel set lo perde
  const setDalVincitore = set.slice(0, numeroSet).map((s, i): Set2 => (perso(i) ? [s[1], s[0]] : s));
  const tutti: Set2[] = treSet ? [...setDalVincitore, [puntiVincitoreLong(long), long]] : setDalVincitore;
  const daA = vincitore === props.a.id;
  const gameA = tutti.map(([v, p]) => (daA ? v : p));
  const gameB = tutti.map(([v, p]) => (daA ? p : v));
  const [totA, totB] = gameTotali(gameA, gameB, props.setPerVincere);
  const formula = numeroSet === 1 ? "1-0" : `2-${treSet ? 1 : 0}`;

  const cambia = (f: () => void) => {
    f();
    setModificato(true);
  };

  const passo = (n: number, titolo: string, fatto: boolean) => (
    <p className="mb-2 flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-wider text-tenue">
      <span className={`cifre grid h-5 w-5 place-items-center rounded text-[12px] ${fatto ? "bg-lime text-notte" : "bg-pannello-2 text-tenue"}`}>{n}</span>
      {titolo}
    </p>
  );

  const bottone = (c: LatoCoppia) => {
    const scelto = vincitore === c.id;
    const contenuto = (
      <>
        <span className="text-xl leading-none" aria-hidden>
          {c.bandiere}
        </span>
        <span className="mt-2 block font-display text-[19px] font-bold uppercase leading-[1.05] tracking-tight">{c.righe[0]}</span>
        <span className="block font-display text-[19px] font-bold uppercase leading-[1.05] tracking-tight">{c.righe[1]}</span>
        {c.testa_di_serie ? <span className={`mt-1.5 block font-display text-[11px] font-bold uppercase tracking-wider ${scelto ? "text-notte/70" : "text-sabbia"}`}>{t("partita.testaDiSerie", { n: c.testa_di_serie })}</span> : null}
        {scelto && (
          <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded bg-notte text-lime">
            <IconaSpunta className="h-3.5 w-3.5" />
          </span>
        )}
      </>
    );
    const classe = `relative flex min-h-[112px] flex-col items-center justify-center rounded-lg border px-2 py-3 text-center transition active:scale-[.98] ${
      scelto ? "border-lime bg-lime text-notte" : "border-linea bg-pannello-2 text-testo hover:border-tenue"
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

  const segmento = (attiva: boolean) => `cifre h-11 rounded-md text-xl transition ${attiva ? "bg-lime text-notte" : "text-tenue hover:text-testo"}`;
  const chip = (attiva: boolean) =>
    `cifre h-11 rounded-md border text-[17px] transition active:scale-95 ${attiva ? "border-lime bg-lime text-notte" : "border-linea bg-notte text-testo hover:border-tenue"}`;
  const tasto = "grid h-11 w-11 place-items-center rounded-lg border border-linea bg-notte text-testo transition hover:border-tenue active:scale-90 disabled:opacity-30";

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-4">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <input type="hidden" name="game_a" value={scelta ? gameA.join(",") : ""} />
      <input type="hidden" name="game_b" value={scelta ? gameB.join(",") : ""} />

      <div>
        {props.collegato && passo(1, t("partita.passoVincitore"), Boolean(scelta))}
        <div className="relative grid grid-cols-2 gap-2">
          {bottone(props.a)}
          {bottone(props.b)}
          <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded bg-notte font-display text-[12px] font-bold text-tenue ring-1 ring-linea">VS</span>
        </div>
      </div>

      {!props.collegato ? (
        <a href={props.urlAccesso} className="bottone">
          {t("torneo.accediPerPronosticare")}
        </a>
      ) : !scelta ? (
        <p className="text-center text-sm text-tenue">{t("partita.tocca")}</p>
      ) : (
        <div className="entra space-y-4">
          {props.setPerVincere === 2 && (
            <div>
              {passo(2, t("partita.passoSet"), true)}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-linea bg-notte p-1">
                {([0, 1] as const).map((p) => (
                  <button key={p} type="button" onClick={() => cambia(() => setPersi(p))} className={segmento(persi === p)} aria-pressed={persi === p}>
                    2-{p}
                  </button>
                ))}
              </div>
              {treSet && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-tenue">{t("partita.perdeIl", { nome: scelta.righe.join("/") })}</span>
                  {([0, 1] as const).map((i) => (
                    <button key={i} type="button" onClick={() => cambia(() => setPersoIl(i))} aria-pressed={persoIl === i} className={`${chip(persoIl === i)} h-9 px-3 text-[15px]`}>
                      {t("partita.setN", { n: i + 1 })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {passo(props.setPerVincere === 2 ? 3 : 2, t("partita.passoPunteggio"), true)}
            {Array.from({ length: numeroSet }, (_, i) => {
              const vince = perso(i) ? altra : scelta;
              return (
                <div key={i}>
                  <p className="mb-1.5 text-sm">
                    <span className="font-display font-bold uppercase tracking-wider">{numeroSet > 1 ? t("partita.setN", { n: i + 1 }) : t("partita.ilSet")}</span>
                    <span className="text-tenue"> · {t("partita.loVince", { nome: vince.righe.join("/") })}</span>
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SET_VINTI.map(([v, p]) => {
                      const attivo = set[i][0] === v && set[i][1] === p;
                      return (
                        <button key={`${v}-${p}`} type="button" onClick={() => cambia(() => setSet((s) => (i === 0 ? [[v, p], s[1]] : [s[0], [v, p]])))} aria-pressed={attivo} className={chip(attivo)}>
                          {perso(i) ? `${p}-${v}` : `${v}-${p}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {treSet && (
              <div className="rounded-lg border border-linea bg-pannello-2 p-3">
                <p className="text-sm">
                  <span className="font-display font-bold uppercase tracking-wider">{t("partita.long")}</span>
                  <span className="text-tenue"> · {t("partita.loVince", { nome: scelta.righe.join("/") })}</span>
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 text-sm text-tenue">{t("partita.puntiDi", { nome: altra.righe.join("/") })}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button type="button" className={tasto} onClick={() => cambia(() => setLong((x) => Math.max(0, x - 1)))} disabled={long <= 0} aria-label={t("partita.meno")}>
                      <IconaMeno />
                    </button>
                    <span className="cifre w-[76px] text-center text-[28px] leading-none">
                      <span className="text-lime">{puntiVincitoreLong(long)}</span>-{long}
                    </span>
                    <button type="button" className={tasto} onClick={() => cambia(() => setLong((x) => Math.min(30, x + 1)))} disabled={long >= 30} aria-label={t("partita.piu")}>
                      <IconaPiu />
                    </button>
                  </span>
                </div>
                <p className="mt-2 text-xs text-tenue">{t("partita.notaLong")}</p>
              </div>
            )}
          </div>

          {/* Riepilogo: quello che verrà salvato */}
          <div className="rounded-lg bg-notte px-3 py-2.5 ring-1 ring-linea">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-tenue">{t("partita.riepilogo")}</p>
            <p className="font-semibold">
              {t("partita.vince", { nome: scelta.righe.join("/") })} <span className="cifre text-lime">{formula}</span>
              <span className="cifre ml-2">{tutti.map(([v, p]) => `${v}-${p}`).join(" ")}</span>
            </p>
            <p className="text-sm text-tenue">
              {t("partita.gameCalcolati")}{" "}
              <span className="cifre text-testo">
                {props.a.righe[0]} {totA} - {totB} {props.b.righe[0]}
              </span>
            </p>
          </div>
          <p className="text-xs leading-relaxed text-tenue">{props.inPalio}</p>

          {esito && !esito.ok && <p className="rounded-lg bg-corallo/10 px-3 py-2 text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-lg border border-lime/40 bg-lime/[.06] p-3">
              <p className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-lime">
                <IconaSpunta className="h-5 w-5" /> {t("partita.salvato")}
              </p>
              <p className="text-xs text-tenue">{t("partita.puoiCambiare")}</p>
              {idSalvato && (
                <Condividi
                  immagine={`/api/immagine/pronostico?tipo=partita&id=${idSalvato}&lingua=${lingua}`}
                  testo={t("condividi.testoPronostico", { scelta: `${scelta.nome} ${tutti.map(([v, p]) => `${v}-${p}`).join(" ")} (${props.descrizione})` })}
                  url={`${props.sito}/${lingua}`}
                  etichetta={t("condividi.pronostico")}
                />
              )}
            </div>
          ) : completoSalvato && !modificato && !esito ? (
            <p className="flex items-center gap-2 rounded-lg border border-linea px-3 py-2.5 text-sm">
              <IconaSpunta className="h-4 w-4 text-lime" />
              <span className="font-semibold">{t("torneo.ilTuo")}</span>
              <span className="text-tenue">· {t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso}>
              {inCorso ? t("partita.salvataggio") : completoSalvato ? t("partita.aggiorna") : t("partita.conferma")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
