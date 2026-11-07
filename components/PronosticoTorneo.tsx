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

  if (!props.coppie.length) return <p className="rounded-2xl bg-notte p-3 text-center text-sm text-tenue">{t("torneo.nessunaCoppia")}</p>;

  if (!props.aperto) {
    const haVoti = Object.keys(props.voti).length > 0;
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm text-tenue">
          <IconaLucchetto /> {t("torneo.chiusoTorneo")}
        </p>
        {props.mio && (
          <div className="flex items-center gap-3 rounded-lg border border-linea bg-pannello-2 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] font-bold uppercase tracking-wider text-tenue">{t("torneo.ilTuo")}</p>
              <p className="truncate font-semibold">{nome(props.mio.vincitore_id)}</p>
              {props.mio.finalista_id && (
                <p className="truncate text-xs text-tenue">
                  {finalistaBreve}: {nome(props.mio.finalista_id)}
                </p>
              )}
            </div>
            {props.mio.punti != null && <span className={`cifre text-3xl leading-none ${props.mio.punti > 0 ? "text-lime" : "text-tenue"}`}>+{props.mio.punti}</span>}
          </div>
        )}
        {haVoti && (
          <ul className="space-y-2.5">
            {[...props.coppie]
              .sort((a, b) => (props.voti[b.id]?.percentuale ?? 0) - (props.voti[a.id]?.percentuale ?? 0))
              .slice(0, 6)
              .map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                    <span className="cifre text-[15px]">{props.voti[c.id]?.percentuale ?? 0}%</span>
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-linea">
                    <span className="block h-full rounded-full bg-tenue" style={{ width: `${props.voti[c.id]?.percentuale ?? 0}%` }} />
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
      <p className="flex items-center gap-1.5 text-sm text-tenue">
        <IconaOrologio /> {t("partita.chiudeTra", { quando: "" })}
        <Tra iso={props.chiusura} />
      </p>
      <fieldset>
        <legend className="etichetta">{t("torneo.vincitore")}</legend>
        <div className="max-h-80 divide-y divide-linea overflow-y-auto rounded-lg border border-linea">
          {props.coppie.map((c) => {
            const scelto = vincitore === c.id;
            const contenuto = (
              <>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${scelto ? "border-notte bg-notte text-lime" : "border-linea"}`}>{scelto && <IconaSpunta className="h-3 w-3" />}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.nome}</span>
                {c.testa_di_serie && <span className={`font-display text-xs font-bold ${scelto ? "text-notte/70" : "text-sabbia"}`}>{c.testa_di_serie}</span>}
              </>
            );
            const classe = `flex min-h-12 w-full items-center gap-3 px-3 text-left transition ${scelto ? "bg-lime text-notte" : "bg-pannello-2 hover:bg-linea/60"}`;
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
          {esito && !esito.ok && <p className="rounded-lg bg-corallo/10 px-3 py-2 text-sm font-semibold text-corallo">{t(`errori.${esito.errore}`)}</p>}
          {salvato ? (
            <div className="festa space-y-3 rounded-lg border border-lime/40 bg-lime/[.06] p-3">
              <p className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-lime"><IconaSpunta className="h-5 w-5" /> {t("torneo.salvato")}</p>
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
            <p className="flex items-center gap-2 rounded-lg border border-linea px-3 py-2.5 text-sm">
              <IconaSpunta className="h-4 w-4 text-lime" /> <span className="font-semibold">{t("torneo.ilTuo")}</span> <span className="text-tenue">· {t("partita.puoiCambiare")}</span>
            </p>
          ) : (
            <button className="bottone" disabled={inCorso || !vincitore}>
              {inCorso ? t("partita.salvataggio") : vincitore ? t("torneo.salva") : t("partita.scegliPrima")}
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
