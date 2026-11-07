"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import { gameTotali, setValido, tiebreakValido } from "@/lib/punti";
import Condividi from "./Condividi";
import { IconaGiu, IconaSpunta, IconaSu } from "./Icone";

export interface LatoCoppia {
  id: string;
  nome: string; // "Ricci / Neri", per la condivisione
  righe: [string, string]; // un cognome per riga
  bandiere: [string, string]; // la bandiera di ciascun giocatore
  testa_di_serie: number | null;
}

type Mio = { id: string; vincitore_id: string; game_a: number[] | null; game_b: number[] | null } | null;

const MAX_SET = 7;
const MAX_LONG = 50;

/**
 * Pronostico su una partita, come un tabellone: si sceglie chi vince e si scrive il punteggio di ogni set
 * con le frecce, partendo da 0-0. Se i set finiscono uno pari si gioca il long tie-break (a 10, 2 punti
 * di scarto, fino a 50). Risultato in set e game totali (long = 1 game) si ricavano dai numeri.
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
  const numeroSet = props.setPerVincere === 2 ? 2 : 1;
  const colonne = props.setPerVincere === 2 ? 3 : 1; // 1° set, 2° set, long
  const iniziale = (g: number[] | null | undefined) => Array.from({ length: colonne }, (_, i) => g?.[i] ?? 0);
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [ga, setGa] = useState<number[]>(iniziale(props.mio?.game_a));
  const [gb, setGb] = useState<number[]>(iniziale(props.mio?.game_b));
  const [modificato, setModificato] = useState(false);
  const salvato = esito?.ok && !modificato;
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const completoSalvato = Boolean(props.mio?.game_a);

  const scelta = vincitore === props.a.id ? props.a : vincitore === props.b.id ? props.b : null;
  const daA = vincitore === props.a.id;

  // Controlli, nell'ordine in cui l'utente compila
  const setOk = Array.from({ length: numeroSet }, (_, i) => setValido(ga[i], gb[i]));
  const vintiA = Array.from({ length: numeroSet }, (_, i) => ga[i] > gb[i]).filter(Boolean).length;
  const pari = numeroSet === 2 && setOk.every(Boolean) && vintiA === 1;
  const longOk = !pari || tiebreakValido(ga[2], gb[2]);
  const vinceA = pari ? ga[2] > gb[2] : vintiA === numeroSet;
  const tuttoValido = setOk.every(Boolean) && longOk;
  const coerente = tuttoValido && Boolean(scelta) && vinceA === daA;
  const toccato = (i: number) => ga[i] + gb[i] > 0;
  const primoSetSbagliato = setOk.findIndex((ok) => !ok);
  let errore = "";
  if (primoSetSbagliato >= 0 && toccato(primoSetSbagliato)) errore = t("partita.setNonValido", { n: primoSetSbagliato + 1 });
  else if (pari && !longOk && toccato(2)) errore = t("partita.longNonValido");
  else if (tuttoValido && scelta && vinceA !== daA) errore = t("partita.vinceAltra", { nome: (daA ? props.b : props.a).righe.join("/") });

  const usati = pari ? 3 : numeroSet;
  const gameA = ga.slice(0, usati);
  const gameB = gb.slice(0, usati);
  const [totA, totB] = gameTotali(gameA, gameB, props.setPerVincere);
  const punteggio = gameA.map((x, i) => (daA ? `${x}-${gameB[i]}` : `${gameB[i]}-${x}`)).join(" ");

  const cambia = (lato: "a" | "b", i: number, delta: number) => {
    const max = i === 2 ? MAX_LONG : MAX_SET;
    (lato === "a" ? setGa : setGb)((g) => g.map((x, j) => (j === i ? Math.min(max, Math.max(0, x + delta)) : x)));
    setModificato(true);
  };

  const passo = (n: number, titolo: string, fatto: boolean) => (
    <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-inchiostro">
      <span className={`cifre grid h-6 w-6 place-items-center rounded-full text-sm ${fatto ? "bg-mare text-white" : "bg-sabbia-2 text-tenue"}`}>{n}</span>
      {titolo}
    </p>
  );

  const bottone = (c: LatoCoppia) => {
    const scelto = vincitore === c.id;
    const contenuto = (
      <>
        {[0, 1].map((k) => (
          <span key={k} className="block font-display text-[19px] font-bold leading-[1.15]">
            <span aria-hidden className="mr-1 font-sans text-base">
              {c.bandiere[k]}
            </span>
            {c.righe[k]}
          </span>
        ))}
        {c.testa_di_serie ? <span className={`mt-1.5 block text-xs font-semibold ${scelto ? "text-white/80" : "text-seme"}`}>{t("partita.testaDiSerie", { n: c.testa_di_serie })}</span> : null}
        {scelto && (
          <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white text-mare">
            <IconaSpunta className="h-3.5 w-3.5" />
          </span>
        )}
      </>
    );
    const classe = `relative flex min-h-[104px] flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition active:scale-[.98] ${
      scelto ? "border-mare bg-mare text-white" : "border-linea bg-sabbia-2 text-inchiostro hover:border-tenue/50"
    }`;
    if (!props.collegato)
      return (
        <a href={props.urlAccesso} className={classe}>
          {contenuto}
        </a>
      );
    return (
      <button type="button" onClick={() => (setVincitore(c.id), setModificato(true))} aria-pressed={scelto} className={classe}>
        {contenuto}
      </button>
    );
  };

  /** Una casella del tabellone: freccia su, numero, freccia giù. */
  const casella = (lato: "a" | "b", i: number, nome: string, colonna: string) => {
    const valore = (lato === "a" ? ga : gb)[i];
    const max = i === 2 ? MAX_LONG : MAX_SET;
    const freccia = "grid h-9 w-full place-items-center rounded-md text-tenue transition hover:bg-sabbia-2 hover:text-mare active:scale-90 disabled:opacity-25";
    return (
      <div className="flex flex-col items-center rounded-lg border border-linea bg-carta">
        <button type="button" className={freccia} onClick={() => cambia(lato, i, 1)} disabled={valore >= max} aria-label={t("partita.piuDi", { nome, set: colonna })}>
          <IconaSu />
        </button>
        <span className="cifre py-0.5 text-[26px] leading-none" aria-live="polite">
          {valore}
        </span>
        <button type="button" className={freccia} onClick={() => cambia(lato, i, -1)} disabled={valore <= 0} aria-label={t("partita.menoDi", { nome, set: colonna })}>
          <IconaGiu />
        </button>
      </div>
    );
  };

  const titoli = props.setPerVincere === 2 ? [t("partita.setN", { n: 1 }), t("partita.setN", { n: 2 }), t("partita.longBreve")] : [t("partita.ilSet")];
  const visibili = pari ? colonne : numeroSet;

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-4">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <input type="hidden" name="game_a" value={coerente ? gameA.join(",") : ""} />
      <input type="hidden" name="game_b" value={coerente ? gameB.join(",") : ""} />

      <div>
        {props.collegato && passo(1, t("partita.passoVincitore"), Boolean(scelta))}
        <div className="relative grid grid-cols-2 gap-2">
          {bottone(props.a)}
          {bottone(props.b)}
          <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-carta text-xs font-semibold text-tenue ring-1 ring-linea">vs</span>
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
          <div>
            {passo(2, t("partita.passoPunteggio"), coerente)}
            <div className="rounded-xl border border-linea bg-sabbia-2/60 p-2.5">
              <div className="grid items-center gap-x-2 gap-y-2" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${visibili}, 60px)` }}>
                <span />
                {titoli.slice(0, visibili).map((x, i) => (
                  <span key={i} className={`text-center text-xs font-semibold ${i === 2 ? "text-mare" : "text-tenue"}`}>
                    {x}
                  </span>
                ))}
                {[props.a, props.b].map((c, r) => (
                  <div key={c.id} className="contents">
                    <span className={`min-w-0 text-sm leading-tight ${c.id === vincitore ? "font-bold" : "font-medium"}`}>
                      {[0, 1].map((k) => (
                        <span key={k} className="block truncate">
                          <span aria-hidden>{c.bandiere[k]}</span> {c.righe[k]}
                        </span>
                      ))}
                    </span>
                    {Array.from({ length: visibili }, (_, i) => (
                      <div key={i}>{casella(r === 0 ? "a" : "b", i, c.righe.join("/"), titoli[i])}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-tenue">{pari ? t("partita.notaLong") : t("partita.notaSet")}</p>
            {errore && <p className="mt-1.5 text-sm font-semibold text-corallo">{errore}</p>}
          </div>

          {/* Riepilogo: quello che verrà salvato */}
          {coerente && (
            <div className="rounded-xl bg-carta px-3 py-2.5 ring-1 ring-linea">
              <p className="text-xs font-semibold text-tenue">{t("partita.riepilogo")}</p>
              <p className="font-semibold">
                {t("partita.vince", { nome: scelta.righe.join("/") })} <span className="cifre text-mare">{numeroSet === 1 ? "1-0" : `2-${pari ? 1 : 0}`}</span>
                <span className="cifre ml-2">{punteggio}</span>
              </p>
              <p className="text-sm text-tenue">
                {t("partita.gameCalcolati")}{" "}
                <span className="cifre text-inchiostro">
                  {props.a.righe[0]} {totA} - {totB} {props.b.righe[0]}
                </span>
              </p>
            </div>
          )}
          <p className="text-xs leading-relaxed text-tenue">{props.inPalio}</p>

          {esito && !esito.ok && <p className="rounded-lg bg-corallo/10 px-3 py-2 text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-xl border border-mare/30 bg-mare/[.06] p-3">
              <p className="flex items-center gap-2 text-lg font-semibold text-mare">
                <IconaSpunta className="h-5 w-5" /> {t("partita.salvato")}
              </p>
              <p className="text-xs text-tenue">{t("partita.puoiCambiare")}</p>
              {idSalvato && (
                <Condividi
                  immagine={`/api/immagine/pronostico?tipo=partita&id=${idSalvato}&lingua=${lingua}`}
                  testo={t("condividi.testoPronostico", { scelta: `${scelta.nome} ${punteggio} (${props.descrizione})` })}
                  url={`${props.sito}/${lingua}`}
                  etichetta={t("condividi.pronostico")}
                />
              )}
            </div>
          ) : completoSalvato && !modificato && !esito ? (
            <p className="flex items-center gap-2 rounded-lg border border-linea px-3 py-2.5 text-sm">
              <IconaSpunta className="h-4 w-4 text-mare" />
              <span className="font-semibold">{t("torneo.ilTuo")}</span>
              <span className="text-tenue">· {t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso || !coerente}>
              {inCorso ? t("partita.salvataggio") : !coerente ? t("partita.completaPunteggio") : completoSalvato ? t("partita.aggiorna") : t("partita.conferma")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
