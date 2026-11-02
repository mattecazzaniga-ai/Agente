"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoPartita, type Esito } from "@/app/[locale]/azioni";
import Condividi from "./Condividi";

/** Pronostico su una partita: chi vince (due pulsanti grandi), poi set e game facoltativi. */
export default function PronosticoPartita(props: {
  partitaId: string;
  a: { id: string; nome: string };
  b: { id: string; nome: string };
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
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const setIniziale = props.mio?.set_vincitore != null ? `${props.mio.set_vincitore}-${props.mio.set_perdente}` : "";

  if (!props.collegato) {
    return (
      <a href={props.urlAccesso} className="bottone-secondario text-sm">
        {t("torneo.accediPerPronosticare")}
      </a>
    );
  }

  return (
    <form action={azione} className="space-y-2">
      <input type="hidden" name="partita_id" value={props.partitaId} />
      <input type="hidden" name="vincitore_id" value={vincitore} />
      <p className="text-xs font-semibold uppercase tracking-wide text-nebbia">{t("partita.chiVince")}</p>
      <div className="grid grid-cols-2 gap-2">
        {[props.a, props.b].map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => setVincitore(c.id)}
            aria-pressed={vincitore === c.id}
            className={`min-h-14 rounded-xl border px-2 text-sm font-semibold leading-tight transition ${vincitore === c.id ? "border-mare bg-mare text-white" : "border-sabbia-scura bg-white"}`}
          >
            {c.nome}
          </button>
        ))}
      </div>
      {!dettagli ? (
        <button type="button" onClick={() => setDettagli(true)} className="text-sm font-medium text-mare underline">
          + {t("partita.set")} / {t("partita.game")} ({t("partita.facoltativo")})
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {props.setPerVincere === 2 ? (
            <label>
              <span className="etichetta">{t("partita.set")}</span>
              <select name="set" defaultValue={setIniziale} className="campo">
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
            <input name="game" type="number" inputMode="numeric" min={1} max={60} defaultValue={props.mio?.totale_game ?? ""} className="campo" />
          </label>
        </div>
      )}
      {esito && !esito.ok && <p className="text-sm font-medium text-corallo">{t(`errori.${esito.errore}`)}</p>}
      <button className="bottone" disabled={inCorso || !vincitore}>
        {inCorso ? "…" : esito?.ok ? t("partita.salvato") : t("partita.salva")}
      </button>
      {idSalvato && vincitore && esito?.ok && (
        <Condividi
          immagine={`/api/immagine/pronostico?tipo=partita&id=${idSalvato}&lingua=${lingua}`}
          testo={t("condividi.testoPronostico", { scelta: `${vincitore === props.a.id ? props.a.nome : props.b.nome} (${props.descrizione})` })}
          url={`${props.sito}/${lingua}`}
          etichetta={t("condividi.pronostico")}
        />
      )}
    </form>
  );
}
