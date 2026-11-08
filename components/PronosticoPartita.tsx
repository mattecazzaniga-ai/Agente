"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import { setValido, tiebreakValido } from "@/lib/punti";
import Condividi from "./Condividi";
import { IconaMeno, IconaPiu, IconaSpunta } from "./Icone";

export interface LatoCoppia {
  id: string;
  nome: string; // "Ricci / Neri", per la condivisione
  righe: [string, string]; // un cognome per riga
  bandiere: [string, string]; // la bandiera di ciascun giocatore
  testa_di_serie: number | null;
}

type Mio = { id: string; vincitore_id: string; game_a: number[] | null; game_b: number[] | null } | null;
/** Una casella del tabellone: game (o punti del long) della coppia A e della coppia B, null se non ancora scelta. */
type Valore = [number, number] | null;

// Gli unici risultati possibili di un set, dal lato di chi lo vince
const SET_POSSIBILI: [number, number][] = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]];
// Long tie-break a 10: i più comuni con un tocco, oltre il 10 con + e −
const LONG_POSSIBILI: [number, number][] = Array.from({ length: 9 }, (_, i) => [10, i] as [number, number]);
const MAX_LONG = 50;

/**
 * Pronostico su una partita. Prima si sceglie chi vince, poi il punteggio di ogni set toccando uno dei
 * risultati possibili (6-0…7-6): così non si può scrivere un punteggio che non esiste. Il long tie-break
 * compare solo se i set finiscono 1-1, e lo vince chi vince la partita. La logica dei punti non cambia:
 * si salvano i game set per set, come prima.
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
  const colonne = numeroSet === 2 ? 3 : 1; // 1° set, 2° set, long

  const iniziali = (): Valore[] =>
    Array.from({ length: colonne }, (_, i) => {
      const x = props.mio?.game_a?.[i];
      const y = props.mio?.game_b?.[i];
      return x != null && y != null ? [x, y] : null;
    });
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [valori, setValori] = useState<Valore[]>(iniziali);
  const [attiva, setAttiva] = useState(0); // colonna che si sta compilando
  const [modificato, setModificato] = useState(false);
  const salvato = esito?.ok && !modificato;
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const completoSalvato = Boolean(props.mio?.game_a);

  const scelta = vincitore === props.a.id ? props.a : vincitore === props.b.id ? props.b : null;
  const daA = vincitore === props.a.id;

  // Stato del tabellone
  const set = valori.slice(0, numeroSet);
  const setFatti = set.every((v) => v && setValido(v[0], v[1]));
  const vintiA = set.filter((v) => v && v[0] > v[1]).length;
  const pari = numeroSet === 2 && setFatti && vintiA === 1;
  const long = pari ? valori[2] : null;
  const longFatto = !pari || Boolean(long && tiebreakValido(long[0], long[1]));
  const completo = Boolean(scelta) && setFatti && longFatto;
  const usati = pari ? 3 : numeroSet;
  const gameA = valori.slice(0, usati).map((v) => v?.[0] ?? 0);
  const gameB = valori.slice(0, usati).map((v) => v?.[1] ?? 0);
  const vinceA = pari ? (long ? long[0] > long[1] : daA) : vintiA === numeroSet;
  const coerente = completo && vinceA === daA;
  const punteggio = gameA.map((x, i) => (daA ? `${x}-${gameB[i]}` : `${gameB[i]}-${x}`)).join(" ");
  const visibili = pari ? 3 : numeroSet;

  const titoli = numeroSet === 2 ? [t("partita.setN", { n: 1 }), t("partita.setN", { n: 2 }), t("partita.longBreve")] : [t("partita.ilSet")];
  const mancante = !scelta ? null : set.findIndex((v) => !v) >= 0 ? set.findIndex((v) => !v) : pari && !longFatto ? 2 : null;
  const colonnaAttiva = attiva < visibili ? attiva : (mancante ?? 0);

  /** Dopo ogni scelta: il vincitore segue i set (2-0 o 1-0), il long resta a chi vince, si passa al prossimo vuoto. */
  const aggiorna = (nuovi: Valore[], nuovoVincitore = vincitore) => {
    const s = nuovi.slice(0, numeroSet);
    const fatti = s.every(Boolean);
    const vA = s.filter((v) => v && v[0] > v[1]).length;
    let v = nuovoVincitore;
    if (fatti && vA === numeroSet) v = props.a.id;
    else if (fatti && vA === 0) v = props.b.id;
    // il long lo vince sempre chi vince la partita: se cambia il vincitore si gira il punteggio
    if (numeroSet === 2 && nuovi[2]) {
      const [x, y] = nuovi[2];
      const vinceLongA = x > y;
      if (vinceLongA !== (v === props.a.id)) nuovi = nuovi.map((c, i) => (i === 2 ? [y, x] : c));
    }
    setValori(nuovi);
    setVincitore(v);
    setModificato(true);
    const pareggio = numeroSet === 2 && fatti && vA === 1;
    const prossimo = nuovi.findIndex((c, i) => i < numeroSet && !c);
    if (prossimo >= 0) setAttiva(prossimo);
    else if (pareggio && !nuovi[2]) setAttiva(2);
  };

  // Se si cambia vincitore dopo aver messo un 2-0 (o 1-0) per l'altra coppia, si girano i set: stessi punteggi, a parti invertite.
  const scegliVincitore = (id: string) => {
    const s = valori.slice(0, numeroSet);
    const vA = s.filter((v) => v && v[0] > v[1]).length;
    const tuttiAltra = s.every(Boolean) && (id === props.a.id ? vA === 0 : vA === numeroSet);
    aggiorna(tuttiAltra ? valori.map((v, i) => (i < numeroSet && v ? ([v[1], v[0]] as [number, number]) : v)) : valori, id);
  };
  const scegliSet = (i: number, valore: [number, number]) => aggiorna(valori.map((c, j) => (j === i ? valore : c)));
  const scegliLong = (vincente: number, perdente: number) => aggiorna(valori.map((c, j) => (j === 2 ? (daA ? [vincente, perdente] : [perdente, vincente]) : c)));

  const passo = (n: number, titolo: string, fatto: boolean) => (
    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-inchiostro">
      <span className={`cifre grid h-5 w-5 place-items-center rounded-full text-xs ${fatto ? "bg-viola text-white" : "bg-sabbia-2 text-tenue"}`}>{n}</span>
      {titolo}
    </p>
  );

  const nomeBreve = (c: LatoCoppia) => `${c.righe[0]}/${c.righe[1]}`;

  /** Bottone di una coppia: compatto, i due giocatori uno sotto l'altro. */
  const bottone = (c: LatoCoppia) => {
    const scelto = vincitore === c.id;
    const contenuto = (
      <>
        <span className="min-w-0 flex-1">
          {[0, 1].map((k) => (
            <span key={k} className="block break-words text-[14px] font-semibold leading-tight">
              <span aria-hidden className="mr-1">
                {c.bandiere[k]}
              </span>
              {c.righe[k]}
            </span>
          ))}
          {c.testa_di_serie ? <span className={`block text-[11px] font-semibold ${scelto ? "text-white/80" : "text-seme"}`}>{t("partita.testaDiSerie", { n: c.testa_di_serie })}</span> : null}
        </span>
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${scelto ? "bg-white text-viola" : "ring-1 ring-linea"}`} aria-hidden>
          {scelto && <IconaSpunta className="h-3.5 w-3.5" />}
        </span>
      </>
    );
    const classe = `flex min-h-[60px] items-center gap-2 rounded-lg border px-3 py-2 text-left transition active:scale-[.98] ${
      scelto ? "border-viola bg-viola text-white" : "border-linea bg-carta text-inchiostro hover:border-tenue/50"
    }`;
    if (!props.collegato)
      return (
        <a href={props.urlAccesso} className={classe}>
          {contenuto}
        </a>
      );
    return (
      <button type="button" onClick={() => scegliVincitore(c.id)} aria-pressed={scelto} className={classe}>
        {contenuto}
      </button>
    );
  };

  /** Casella del tabellone (44 px): il numero, oppure tratteggiata se manca. Toccandola si compila quel set. */
  const casella = (i: number, lato: 0 | 1) => {
    const v = valori[i];
    const n = v?.[lato];
    const vince = v ? (lato === 0 ? v[0] > v[1] : v[1] > v[0]) : false;
    const selezionata = colonnaAttiva === i;
    return (
      <button
        type="button"
        onClick={() => setAttiva(i)}
        aria-label={`${titoli[i]}: ${v ? `${v[0]}-${v[1]}` : t("partita.daInserire")}`}
        className={`cifre grid h-11 w-11 place-items-center rounded-md text-[22px] leading-none transition ${
          v ? (vince ? "bg-inchiostro text-white" : "bg-carta text-inchiostro ring-1 ring-linea") : "border-2 border-dashed border-tenue/35 text-tenue/50"
        } ${selezionata ? "ring-2 ring-viola ring-offset-1 ring-offset-sabbia-2" : ""}`}
      >
        {n ?? "–"}
      </button>
    );
  };

  const chip = (testo: string, attivo: boolean, onClick: () => void, etichetta: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      aria-label={etichetta}
      className={`cifre h-10 w-full rounded-md text-[17px] leading-none transition active:scale-95 ${attivo ? "bg-viola text-white" : "bg-carta text-inchiostro ring-1 ring-linea hover:ring-viola/50"}`}
    >
      {testo}
    </button>
  );

  /** Scelta del risultato per la colonna attiva: per un set, chi lo vince e come; per il long, il punteggio. */
  const selettore = () => {
    if (colonnaAttiva < numeroSet) {
      const v = valori[colonnaAttiva];
      return (
        <div className="space-y-2.5">
          {[props.a, props.b].map((c, lato) => (
            <div key={c.id}>
              <p className="mb-1 truncate text-xs font-semibold text-tenue">{t("partita.vinceIlSet", { nome: nomeBreve(c), set: titoli[colonnaAttiva].toLowerCase() })}</p>
              <div className="grid grid-cols-7 gap-1">
                {SET_POSSIBILI.map(([w, l]) => {
                  const valore: [number, number] = lato === 0 ? [w, l] : [l, w];
                  const preso = Boolean(v && v[0] === valore[0] && v[1] === valore[1]);
                  return <div key={`${w}-${l}`}>{chip(`${w}-${l}`, preso, () => scegliSet(colonnaAttiva, valore), `${nomeBreve(c)} ${w}-${l}, ${titoli[colonnaAttiva]}`)}</div>;
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }
    // long: lo vince chi vince la partita
    const v = valori[2];
    const [vincente, perdente] = v ? (daA ? v : [v[1], v[0]]) : [0, 0];
    const oltre = vincente > 10;
    return (
      <div>
        <p className="mb-1 truncate text-xs font-semibold text-tenue">{t("partita.vinceLong", { nome: scelta ? nomeBreve(scelta) : "" })}</p>
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
          {LONG_POSSIBILI.map(([w, l]) => (
            <div key={l}>{chip(`${w}-${l}`, Boolean(v) && vincente === w && perdente === l, () => scegliLong(w, l), `${t("partita.longBreve")} ${w}-${l}`)}</div>
          ))}
          <button
            type="button"
            onClick={() => scegliLong(oltre ? vincente : 11, oltre ? perdente : 9)}
            aria-pressed={oltre}
            aria-label={t("partita.oltre10")}
            title={t("partita.oltre10")}
            className={`cifre h-10 rounded-md text-[17px] leading-none transition active:scale-95 ${oltre ? "bg-viola text-white" : "bg-carta text-inchiostro ring-1 ring-linea"}`}
          >
            11-9+
          </button>
        </div>
        {oltre && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <button type="button" onClick={() => scegliLong(vincente - 1, perdente - 1)} disabled={vincente <= 11} aria-label={t("partita.meno")} className="grid h-10 w-10 place-items-center rounded-full bg-carta ring-1 ring-linea disabled:opacity-30">
              <IconaMeno className="h-4 w-4" />
            </button>
            <span className="cifre w-20 text-center text-2xl">{`${vincente}-${perdente}`}</span>
            <button type="button" onClick={() => scegliLong(vincente + 1, perdente + 1)} disabled={vincente >= MAX_LONG} aria-label={t("partita.piu")} className="grid h-10 w-10 place-items-center rounded-full bg-carta ring-1 ring-linea disabled:opacity-30">
              <IconaPiu className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const testoBottone = inCorso
    ? t("partita.salvataggio")
    : mancante != null
      ? t("partita.manca", { cosa: titoli[mancante].toLowerCase() })
      : completoSalvato
        ? t("partita.aggiorna")
        : t("partita.conferma");

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-3">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <input type="hidden" name="game_a" value={coerente ? gameA.join(",") : ""} />
      <input type="hidden" name="game_b" value={coerente ? gameB.join(",") : ""} />

      <div>
        {props.collegato && passo(1, t("partita.passoVincitore"), Boolean(scelta))}
        <div className="grid grid-cols-2 gap-2">
          {bottone(props.a)}
          {bottone(props.b)}
        </div>
      </div>

      {!props.collegato ? (
        <a href={props.urlAccesso} className="bottone">
          {t("torneo.accediPerPronosticare")}
        </a>
      ) : !scelta ? (
        <p className="text-center text-sm text-tenue">{t("partita.tocca")}</p>
      ) : (
        <div className="entra space-y-3">
          <div>
            {passo(2, t("partita.passoPunteggio"), coerente)}
            <div className="overflow-hidden rounded-xl border border-linea bg-sabbia-2/60">
              {/* tabellone: nomi a sinistra, una colonna da 44 px per set */}
              <div className="grid items-center gap-x-1.5 gap-y-1.5 p-2.5" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${visibili}, 44px)` }}>
                <span />
                {titoli.slice(0, visibili).map((x, i) => (
                  <span key={i} className={`text-center text-[11px] font-semibold uppercase tracking-wide ${colonnaAttiva === i ? "text-viola" : "text-tenue"}`}>
                    {x}
                  </span>
                ))}
                {[props.a, props.b].map((c, lato) => (
                  <div key={c.id} className="contents">
                    <span className={`min-w-0 text-[13px] leading-tight ${c.id === vincitore ? "font-bold text-inchiostro" : "font-medium text-tenue"}`}>
                      {[0, 1].map((k) => (
                        <span key={k} className="block truncate">
                          <span aria-hidden>{c.bandiere[k]}</span> {c.righe[k]}
                        </span>
                      ))}
                    </span>
                    {Array.from({ length: visibili }, (_, i) => (
                      <div key={i} className="grid place-items-center">
                        {casella(i, lato as 0 | 1)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t border-linea bg-carta/70 p-2.5">{selettore()}</div>
            </div>
          </div>

          {coerente && (
            <p className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-carta px-3 py-2 text-sm ring-1 ring-linea">
              <span className="text-xs font-semibold text-tenue">{t("partita.riepilogo")}</span>
              <span className="font-semibold">{nomeBreve(scelta)}</span>
              <span className="cifre text-viola">{numeroSet === 1 ? "1-0" : `2-${pari ? 1 : 0}`}</span>
              <span className="cifre">{punteggio}</span>
            </p>
          )}

          {esito && !esito.ok && <p className="rounded-lg bg-corallo/10 px-3 py-2 text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-xl border border-verde/30 bg-verde/[.07] p-3">
              <p className="flex items-center gap-2 font-semibold text-verde">
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
              <IconaSpunta className="h-4 w-4 text-viola" />
              <span className="font-semibold">{t("torneo.ilTuo")}</span>
              <span className="text-tenue">· {t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso || !coerente}>
              {testoBottone}
            </button>
          )}
          <details className="text-xs text-tenue">
            <summary className="cursor-pointer font-semibold">{t("partita.quantiPunti")}</summary>
            <p className="mt-1 leading-relaxed">{props.inPalio}</p>
          </details>
        </div>
      )}
    </form>
  );
}
