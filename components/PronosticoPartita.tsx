"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import { gameIniziali, gamePossibili, limitiGame } from "@/lib/punti";
import Condividi from "./Condividi";
import { IconaMeno, IconaPiu, IconaSpunta } from "./Icone";

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
      <button type="button" onClick={() => scegli(c.id)} aria-pressed={scelto} className={classe}>
        {contenuto}
      </button>
    );
  };

  const contatore = (c: LatoCoppia, lim: readonly [number, number]) => {
    const valore = game[c.id] ?? lim[0];
    const tasto = "grid h-11 w-11 place-items-center rounded-lg border border-linea bg-notte text-testo transition hover:border-tenue active:scale-90 disabled:opacity-30";
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="min-w-0 truncate font-semibold">
          <span aria-hidden className="mr-1.5">
            {c.bandiere}
          </span>
          {c.righe.join(" / ")}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <button type="button" className={tasto} onClick={() => cambiaGame(c.id, -1, lim)} disabled={valore <= lim[0]} aria-label={t("partita.meno")}>
            <IconaMeno />
          </button>
          <span className="cifre w-10 text-center text-[28px] leading-none">{valore}</span>
          <button type="button" className={tasto} onClick={() => cambiaGame(c.id, 1, lim)} disabled={valore >= lim[1]} aria-label={t("partita.piu")}>
            <IconaPiu />
          </button>
        </span>
      </div>
    );
  };

  const segmento = (attiva: boolean) =>
    `cifre h-11 rounded-md text-xl transition ${attiva ? "bg-lime text-notte" : "text-tenue hover:text-testo"}`;

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-4">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <input type="hidden" name="set" value={scelta ? formula : ""} />
      <input type="hidden" name="game_previsti_a" value={possibile ? game[props.a.id] : ""} />
      <input type="hidden" name="game_previsti_b" value={possibile ? game[props.b.id] : ""} />

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
                  <button key={p} type="button" onClick={() => scegliSet(p)} className={segmento(persi === p)} aria-pressed={persi === p}>
                    2-{p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            {passo(props.setPerVincere === 2 ? 3 : 2, t("partita.passoGame"), possibile)}
            <div className="divide-y divide-linea rounded-lg border border-linea bg-pannello-2 px-3">
              {[props.a, props.b].map((c) => (
                <div key={c.id}>{contatore(c, c.id === scelta.id ? limiti.vincitore : limiti.perdente)}</div>
              ))}
            </div>
            {props.setPerVincere === 2 && <p className="mt-1.5 text-xs text-tenue">{t("partita.notaSuperTieBreak")}</p>}
            {!possibile && <p className="mt-1.5 text-sm font-semibold text-corallo">{t("errori.gameImpossibili")}</p>}
          </div>

          {/* Riepilogo: quello che verrà salvato, in una riga */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-notte px-3 py-2.5 ring-1 ring-linea">
            <p className="min-w-0 text-sm">
              <span className="font-display text-[11px] font-bold uppercase tracking-wider text-tenue">{t("partita.riepilogo")}</span>
              <span className="block truncate font-semibold">
                {t("partita.vince", { nome: scelta.righe.join("/") })} <span className="cifre text-lime">{formula}</span>
                {possibile && (
                  <>
                    {" "}
                    · {t("partita.game")} <span className="cifre">{`${game[props.a.id]}-${game[props.b.id]}`}</span>
                  </>
                )}
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
                  testo={t("condividi.testoPronostico", { scelta: `${scelta.nome} ${formula} · game ${game[props.a.id]}-${game[props.b.id]} (${props.descrizione})` })}
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
            <button className="bottone" disabled={inCorso || !possibile}>
              {inCorso ? t("partita.salvataggio") : completoSalvato ? t("partita.aggiorna") : t("partita.conferma")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
