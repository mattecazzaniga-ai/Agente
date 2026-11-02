"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoTorneo, type Esito } from "@/app/[locale]/azioni";
import Condividi from "./Condividi";
import Tra from "./Tra";
import { IconaLucchetto, IconaOrologio, IconaSpunta } from "./Icone";

export interface OpzioneCoppia {
  id: string;
  nome: string;
  testa_di_serie: number | null;
}

/** Pronostico su un tabellone: vincitore (obbligatorio) e finalista (facoltativo). */
export default function PronosticoTorneo(props: {
  tabelloneId: string;
  titolo: string;
  nomeTorneo: string;
  coppie: OpzioneCoppia[];
  mio: { id: string; vincitore_id: string; finalista_id: string | null; punti: number | null } | null;
  aperto: boolean;
  chiusura: string;
  collegato: boolean;
  urlAccesso: string;
  voti: Record<string, { percentuale: number; punti: number }>;
  sito: string;
}) {
  const t = useTranslations();
  const lingua = useLocale();
  const [esito, azione, inCorso] = useActionState<Esito | null, FormData>(salvaPronosticoTorneo, null);
  const [vincitore, setVincitore] = useState(props.mio?.vincitore_id ?? "");
  const [finalista, setFinalista] = useState(props.mio?.finalista_id ?? "");
  const [modificato, setModificato] = useState(false);
  const nome = (id?: string | null) => props.coppie.find((c) => c.id === id)?.nome ?? "—";
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;
  const finalistaBreve = t("torneo.finalista").split(" (")[0];

  if (!props.coppie.length) return <p className="rounded-2xl bg-crema p-3 text-center text-sm text-nebbia">{t("torneo.nessunaCoppia")}</p>;

  if (!props.aperto) {
    const haVoti = Object.keys(props.voti).length > 0;
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm text-nebbia">
          <IconaLucchetto /> {t("torneo.chiusoTorneo")}
        </p>
        {props.mio && (
          <div className="flex items-center gap-3 rounded-2xl bg-onda p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-mare">{t("torneo.ilTuo")}</p>
              <p className="truncate font-extrabold">{nome(props.mio.vincitore_id)}</p>
              {props.mio.finalista_id && (
                <p className="truncate text-xs text-nebbia">
                  {finalistaBreve}: {nome(props.mio.finalista_id)}
                </p>
              )}
            </div>
            {props.mio.punti != null && <span className="rounded-full bg-menta px-3 py-1 text-sm font-black text-white">{t("partita.punti", { punti: props.mio.punti })}</span>}
          </div>
        )}
        {haVoti && (
          <ul className="space-y-1.5">
            {[...props.coppie]
              .sort((a, b) => (props.voti[b.id]?.percentuale ?? 0) - (props.voti[a.id]?.percentuale ?? 0))
              .slice(0, 6)
              .map((c) => (
                <li key={c.id} className="relative overflow-hidden rounded-xl bg-crema px-3 py-2 text-sm">
                  <span className="absolute inset-y-0 left-0 bg-cielo/50" style={{ width: `${props.voti[c.id]?.percentuale ?? 0}%` }} aria-hidden />
                  <span className="relative flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.nome}</span>
                    <span className="text-xs font-bold tabular-nums">{props.voti[c.id]?.percentuale ?? 0}%</span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }

  const salvato = esito?.ok && !modificato;
  return (
    <form action={(f) => (setModificato(false), azione(f))} className="space-y-4">
      <input type="hidden" name="tabellone_id" value={props.tabelloneId} />
      <p className="flex items-center gap-1.5 text-sm text-nebbia">
        <IconaOrologio /> {t("partita.chiudeTra", { quando: "" })}
        <Tra iso={props.chiusura} />
      </p>
      <fieldset>
        <legend className="etichetta">{t("torneo.vincitore")}</legend>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {props.coppie.map((c) => {
            const scelto = vincitore === c.id;
            const contenuto = (
              <>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${scelto ? "border-white bg-white text-mare" : "border-sabbia-scura"}`}>{scelto && <IconaSpunta className="h-3.5 w-3.5" />}</span>
                <span className="flex-1 text-sm font-bold">{c.nome}</span>
                {c.testa_di_serie && <span className={`text-xs font-bold ${scelto ? "text-white/80" : "text-nebbia"}`}>TDS {c.testa_di_serie}</span>}
              </>
            );
            const classe = `flex min-h-13 w-full items-center gap-3 rounded-2xl border-2 px-3 text-left transition ${scelto ? "border-mare bg-mare text-white" : "border-sabbia-scura bg-white"}`;
            return props.collegato ? (
              <label key={c.id} className={`${classe} cursor-pointer`}>
                <input
                  type="radio"
                  name="vincitore_id"
                  value={c.id}
                  checked={scelto}
                  onChange={() => {
                    setVincitore(c.id);
                    setModificato(true);
                    if (finalista === c.id) setFinalista("");
                  }}
                  className="sr-only"
                  required
                />
                {contenuto}
              </label>
            ) : (
              <a key={c.id} href={props.urlAccesso} className={classe}>
                {contenuto}
              </a>
            );
          })}
        </div>
      </fieldset>
      {props.collegato ? (
        <>
          <label className="block">
            <span className="etichetta">{t("torneo.finalista")}</span>
            <select
              name="finalista_id"
              value={finalista}
              onChange={(e) => {
                setFinalista(e.target.value);
                setModificato(true);
              }}
              className="campo"
            >
              <option value="">{t("torneo.nessuno")}</option>
              {props.coppie
                .filter((c) => c.id !== vincitore)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
          {esito && !esito.ok && <p className="text-center text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-2xl bg-menta-chiaro p-3 text-center">
              <p className="font-extrabold text-menta">{t("torneo.salvato")}</p>
              {idSalvato && (
                <Condividi
                  immagine={`/api/immagine/pronostico?tipo=torneo&id=${idSalvato}&lingua=${lingua}`}
                  testo={t("condividi.testoPronostico", { scelta: `${nome(vincitore)} (${props.nomeTorneo} · ${props.titolo})` })}
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
              {inCorso ? "…" : vincitore ? t("torneo.salva") : t("partita.scegliPrima")}
            </button>
          )}
        </>
      ) : (
        <a href={props.urlAccesso} className="bottone">
          {t("torneo.accediPerPronosticare")}
        </a>
      )}
    </form>
  );
}
