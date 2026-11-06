"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import { gameIniziali, gamePossibili, limitiGame } from "@/lib/punti";
import Condividi from "./Condividi";
import { IconaSpunta } from "./Icone";

export interface LatoCoppia {
  id: string;
  nome: string; // "Ricci / Neri", per la condivisione
  righe: [string, string]; // un cognome per riga
  bandiere: string;
  testa_di_serie: number | null;
}

type Mio = { id: string; vincitore_id: string; set_vincitore: number | null; set_perdente: number | null; game_previsti_a: number | null; game_previsti_b: number | null } | null;

/**
 * Pronostico su una partita (regolamento): chi vince, risultato dei set (2-0 / 2-1) e game totali di
 * ciascuna coppia, con il super tie-break che vale 1 game. I game devono essere possibili con quel risultato.
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
  const completoSalvato = props.mio?.game_previsti_a != null;
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [persi, setPersi] = useState<0 | 1>(props.mio?.set_perdente === 1 ? 1 : 0);
  const [game, setGame] = useState<Record<string, number>>(() => {
    if (completoSalvato) return { [props.a.id]: props.mio!.game_previsti_a!, [props.b.id]: props.mio!.game_previsti_b! };
    if (!props.mio) return {};
    // pronostico vecchio senza game: si parte da un punteggio tipico
    const [v, p] = gameIniziali(props.setPerVincere === 2 ? 2 : 1, props.mio.set_perdente === 1 ? 1 : 0);
    const altra = props.mio.vincitore_id === props.a.id ? props.b.id : props.a.id;
    return { [props.mio.vincitore_id]: v, [altra]: p };
  });
  const [modificato, setModificato] = useState(false);
  const salvato = esito?.ok && !modificato;
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;

  const scelta = vincitore === props.a.id ? props.a : vincitore === props.b.id ? props.b : null;
  const altra = scelta === props.a ? props.b : props.a;
  const vinti = props.setPerVincere === 2 ? 2 : 1;
  const formula = `${vinti}-${props.setPerVincere === 2 ? persi : 0}`;
  const limiti = limitiGame(vinti, props.setPerVincere === 2 ? persi : 0);
  const gv = scelta ? game[scelta.id] : undefined;
  const gp = scelta ? game[altra.id] : undefined;
  const possibile = gv !== undefined && gp !== undefined && gamePossibili(vinti, props.setPerVincere === 2 ? persi : 0, gv, gp);

  /** Quando cambiano vincitore o risultato dei set, si riparte da un punteggio tipico e possibile. */
  const riparti = (idVincitore: string, nuoviPersi: 0 | 1) => {
    const [v, p] = gameIniziali(vinti, props.setPerVincere === 2 ? nuoviPersi : 0);
    const idAltra = idVincitore === props.a.id ? props.b.id : props.a.id;
    setGame({ [idVincitore]: v, [idAltra]: p });
  };
  const scegli = (id: string) => {
    if (id !== vincitore) riparti(id, persi);
    setVincitore(id);
    setModificato(true);
  };
  const scegliSet = (p: 0 | 1) => {
    setPersi(p);
    if (vincitore) riparti(vincitore, p);
    setModificato(true);
  };
  const cambiaGame = (id: string, delta: number, [min, max]: readonly [number, number]) => {
    setGame((g) => ({ ...g, [id]: Math.min(max, Math.max(min, (g[id] ?? min) + delta)) }));
    setModificato(true);
  };

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
      <button type="button" onClick={() => scegli(c.id)} aria-pressed={scelto} className={classe}>
        {contenuto}
      </button>
    );
  };

  const contatore = (c: LatoCoppia, lim: readonly [number, number]) => {
    const valore = game[c.id] ?? lim[0];
    const tasto = "grid h-11 w-11 place-items-center rounded-full border-2 border-sabbia-scura/70 bg-white text-xl font-black text-mare transition active:scale-90 disabled:opacity-30";
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2">
        <span className="min-w-0 truncate text-sm font-bold">
          <span aria-hidden>{c.bandiere}</span> {c.righe.join("/")}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button type="button" className={tasto} onClick={() => cambiaGame(c.id, -1, lim)} disabled={valore <= lim[0]} aria-label="−">
            −
          </button>
          <span className="w-8 text-center text-2xl font-black tabular-nums">{valore}</span>
          <button type="button" className={tasto} onClick={() => cambiaGame(c.id, 1, lim)} disabled={valore >= lim[1]} aria-label="+">
            +
          </button>
        </span>
      </div>
    );
  };

  const pill = (attiva: boolean) =>
    `rounded-xl border-2 py-2 text-lg font-black tabular-nums transition active:scale-95 ${attiva ? "border-mare bg-mare text-white" : "border-sabbia-scura/70 bg-white text-inchiostro"}`;

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-3">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <input type="hidden" name="set" value={scelta ? formula : ""} />
      <input type="hidden" name="game_previsti_a" value={possibile ? game[props.a.id] : ""} />
      <input type="hidden" name="game_previsti_b" value={possibile ? game[props.b.id] : ""} />
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
            {props.setPerVincere === 2 && (
              <div>
                <p className="etichetta">{t("partita.risultatoSet", { nome: scelta.righe.join("/") })}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([0, 1] as const).map((p) => (
                    <button key={p} type="button" onClick={() => scegliSet(p)} className={pill(persi === p)}>
                      2-{p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="etichetta">{t("partita.gameTotali")}</p>
              <div className="space-y-1.5">
                {[props.a, props.b].map((c) => contatore(c, c.id === scelta.id ? limiti.vincitore : limiti.perdente))}
              </div>
              <p className="mt-1.5 text-xs text-nebbia">{props.setPerVincere === 2 ? t("partita.notaSuperTieBreak") : null}</p>
              {!possibile && <p className="mt-1 text-xs font-bold text-corallo">{t("errori.gameImpossibili")}</p>}
            </div>
          </div>
          <p className="text-center text-xs leading-relaxed text-nebbia">{props.inPalio}</p>

          {esito && !esito.ok && <p className="text-center text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-2xl bg-menta-chiaro p-3 text-center">
              <p className="font-extrabold text-menta">{t("partita.salvato")}</p>
              <p className="text-xs text-nebbia">{t("partita.puoiCambiare")}</p>
              {idSalvato && (
                <Condividi
                  immagine={`/api/immagine/pronostico?tipo=partita&id=${idSalvato}&lingua=${lingua}`}
                  testo={t("condividi.testoPronostico", { scelta: `${scelta.nome} ${formula} · game ${game[props.a.id]}-${game[props.b.id]} (${props.descrizione})` })}
                  url={`${props.sito}/${lingua}`}
                  etichetta={t("condividi.pronostico")}
                />
              )}
            </div>
          ) : completoSalvato && !modificato && !esito ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-menta-chiaro px-3 py-2.5 text-sm font-bold text-menta">
              <IconaSpunta className="h-4 w-4" /> {t("torneo.ilTuo")} · <span className="font-medium text-nebbia">{t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso || !possibile}>
              {inCorso ? "…" : t("partita.salva")}
            </button>
          )}
        </>
      )}
    </form>
  );
}
