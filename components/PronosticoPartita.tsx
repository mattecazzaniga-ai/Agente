"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import Condividi from "./Condividi";
import { IconaSpunta } from "./Icone";

export interface LatoCoppia {
  id: string;
  nome: string; // "Ricci / Neri", per la condivisione
  righe: [string, string]; // un cognome per riga
  bandiere: string;
  testa_di_serie: number | null;
}

/** Pronostico su una partita: le due coppie sono i due bottoni. Set e game sono facoltativi. */
export default function PronosticoPartita(props: {
  partitaId: string;
  a: LatoCoppia;
  b: LatoCoppia;
  setPerVincere: 1 | 2;
  mio: { id: string; vincitore_id: string; set_vincitore: number | null; set_perdente: number | null; totale_game: number | null } | null;
  collegato: boolean;
  urlAccesso: string;
  sito: string;
  descrizione: string;
}) {
  const t = useTranslations();
  const lingua = useLocale();
  const [esito, azione, inCorso] = useActionState<Esito | null, FormData>(salvaPronosticoPartita, null);
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [dettagli, setDettagli] = useState(Boolean(props.mio?.totale_game || props.mio?.set_vincitore));
  const [modificato, setModificato] = useState(false);
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const [setScelto, setSetScelto] = useState(props.mio?.set_vincitore != null ? `${props.mio.set_vincitore}-${props.mio.set_perdente}` : "");
  const [game, setGame] = useState(props.mio?.totale_game != null ? String(props.mio.totale_game) : "");
  const salvato = esito?.ok && !modificato;

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
      <button
        type="button"
        onClick={() => {
          setVincitore(c.id);
          setModificato(true);
        }}
        aria-pressed={scelto}
        className={classe}
      >
        {contenuto}
      </button>
    );
  };

  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-3">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <div className="relative grid grid-cols-2 gap-3">
        {bottone(props.a)}
        {bottone(props.b)}
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-sole text-[11px] font-black text-inchiostro shadow-md">VS</span>
      </div>

      {!props.collegato ? (
        <a href={props.urlAccesso} className="bottone">
          {t("torneo.accediPerPronosticare")}
        </a>
      ) : (
        <>
          {!dettagli ? (
            <button type="button" onClick={() => setDettagli(true)} className="w-full text-center text-sm font-semibold text-mare">
              + {props.setPerVincere === 2 ? `${t("partita.set")} · ` : ""}
              {t("partita.game")} <span className="font-normal text-nebbia">({t("partita.facoltativo")})</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-onda/60 p-3">
              {props.setPerVincere === 2 ? (
                <label>
                  <span className="etichetta">{t("partita.set")}</span>
                  <select
                    name="set"
                    value={setScelto}
                    onChange={(e) => {
                      setSetScelto(e.target.value);
                      setModificato(true);
                    }}
                    className="campo"
                  >
                    <option value="">—</option>
                    <option value="2-0">2-0</option>
                    <option value="2-1">2-1</option>
                  </select>
                </label>
              ) : (
                <input type="hidden" name="set" value="" />
              )}
              <label className={props.setPerVincere === 2 ? "" : "col-span-2"}>
                <span className="etichetta">{t("partita.game")}</span>
                <input name="game" type="number" inputMode="numeric" min={1} max={60} placeholder="—" value={game}
                  onChange={(e) => {
                    setGame(e.target.value);
                    setModificato(true);
                  }}
                  className="campo"
                />
              </label>
            </div>
          )}
          {esito && !esito.ok && <p className="text-center text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-2xl bg-menta-chiaro p-3 text-center">
              <p className="font-extrabold text-menta">{t("partita.salvato")}</p>
              <p className="text-xs text-nebbia">{t("partita.puoiCambiare")}</p>
              {idSalvato && (
                <Condividi
                  immagine={`/api/immagine/pronostico?tipo=partita&id=${idSalvato}&lingua=${lingua}`}
                  testo={t("condividi.testoPronostico", { scelta: `${vincitore === props.a.id ? props.a.nome : props.b.nome} (${props.descrizione})` })}
                  url={`${props.sito}/${lingua}`}
                  etichetta={t("condividi.pronostico")}
                />
              )}
            </div>
          ) : props.mio && !modificato && !esito ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-menta-chiaro px-3 py-2.5 text-sm font-bold text-menta">
              <IconaSpunta className="h-4 w-4" /> {t("torneo.ilTuo")} · <span className="font-medium text-nebbia">{t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso || !vincitore}>
              {inCorso ? "…" : vincitore ? t("partita.salva") : t("partita.scegliPrima")}
            </button>
          )}
        </>
      )}
    </form>
  );
}
