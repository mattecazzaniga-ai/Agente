"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaPronosticoTorneo, type Esito } from "@/app/[locale]/azioni";
import Condividi from "./Condividi";
import Ora from "./Ora";

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
  const nome = (id?: string | null) => props.coppie.find((c) => c.id === id)?.nome ?? "—";
  const idSalvato = esito?.ok ? esito.dati?.id : props.mio?.id;

  if (!props.coppie.length) return <p className="text-sm text-nebbia">{t("torneo.nessunaCoppia")}</p>;

  if (!props.aperto) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-nebbia">{t("torneo.chiusoTorneo")}</p>
        {props.mio && (
          <p className="rounded-xl bg-onda p-3 text-sm">
            <b>{t("torneo.ilTuo")}:</b> {nome(props.mio.vincitore_id)}
            {props.mio.finalista_id ? ` · ${t("torneo.finalista").split(" (")[0]}: ${nome(props.mio.finalista_id)}` : ""}
            {props.mio.punti != null && <b className="ml-2 text-mare">{t("partita.punti", { punti: props.mio.punti })}</b>}
          </p>
        )}
        {Object.keys(props.voti).length > 0 && (
          <ul className="space-y-1">
            {[...props.coppie]
              .sort((a, b) => (props.voti[b.id]?.percentuale ?? 0) - (props.voti[a.id]?.percentuale ?? 0))
              .slice(0, 8)
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                  <span className="h-2 w-20 overflow-hidden rounded-full bg-onda">
                    <span className="block h-full bg-mare" style={{ width: `${props.voti[c.id]?.percentuale ?? 0}%` }} />
                  </span>
                  <span className="w-24 text-right text-xs text-nebbia">{t("torneo.hannoScelto", { percentuale: props.voti[c.id]?.percentuale ?? 0, punti: props.voti[c.id]?.punti ?? 0 })}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }

  if (!props.collegato) {
    return (
      <a href={props.urlAccesso} className="bottone">
        {t("torneo.accediPerPronosticare")}
      </a>
    );
  }

  return (
    <form action={azione} className="space-y-3">
      <input type="hidden" name="tabellone_id" value={props.tabelloneId} />
      <p className="text-xs text-nebbia">
        {t("torneo.chiudeIl", { data: "" })}
        <Ora iso={props.chiusura} />
      </p>
      <fieldset>
        <legend className="etichetta">{t("torneo.vincitore")}</legend>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {props.coppie.map((c) => (
            <label key={c.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${vincitore === c.id ? "border-mare bg-onda" : "border-sabbia-scura bg-white"}`}>
              <input type="radio" name="vincitore_id" value={c.id} checked={vincitore === c.id} onChange={() => setVincitore(c.id)} className="h-5 w-5 accent-mare" required />
              <span className="flex-1 text-sm font-medium">{c.nome}</span>
              {c.testa_di_serie && <span className="chip">#{c.testa_di_serie}</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="etichetta">{t("torneo.finalista")}</span>
        <select name="finalista_id" value={finalista} onChange={(e) => setFinalista(e.target.value)} className="campo">
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
      {esito && !esito.ok && <p className="text-sm font-medium text-corallo">{t(`errori.${esito.errore}`)}</p>}
      <button className="bottone" disabled={inCorso || !vincitore}>
        {inCorso ? "…" : esito?.ok ? t("torneo.salvato") : t("torneo.salva")}
      </button>
      {idSalvato && vincitore && (
        <Condividi
          immagine={`/api/immagine/pronostico?tipo=torneo&id=${idSalvato}&lingua=${lingua}`}
          testo={t("condividi.testoPronostico", { scelta: `${nome(vincitore)} (${props.nomeTorneo} · ${props.titolo})` })}
          url={`${props.sito}/${lingua}`}
          etichetta={t("condividi.pronostico")}
        />
      )}
    </form>
  );
}
