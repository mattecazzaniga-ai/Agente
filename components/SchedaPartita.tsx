import { getTranslations } from "next-intl/server";
import type { Coppia, Partita, PronosticoPartita as Pronostico } from "@/lib/tipi";
import { bandiera, nomeCoppia, punteggio } from "@/lib/formato";
import { massimo20, massimo21, recapPronostico, type RigaRecap } from "@/lib/punti";
import { regolePunti } from "@/lib/dati";
import PronosticoPartita, { type LatoCoppia } from "./PronosticoPartita";
import Tra from "./Tra";
import Ora from "./Ora";
import { IconaLucchetto } from "./Icone";

export interface VotoMostrato {
  percentuale: number;
  punti: number;
}

const lato = (c: Coppia): LatoCoppia => ({
  id: c.id,
  nome: nomeCoppia(c),
  righe: [c.g1.cognome, c.g2.cognome],
  bandiere: [bandiera(c.g1.paese), bandiera(c.g2.paese)],
  testa_di_serie: c.testa_di_serie,
});

/** Una partita: prima dell'inizio si pronostica; poi tabellino, voti della community e punti presi. */
export default async function SchedaPartita(props: {
  partita: Partita;
  a: Coppia | null;
  b: Coppia | null;
  mio: Pronostico | null;
  voti: Record<string, VotoMostrato>;
  collegato: boolean;
  urlAccesso: string;
  sito: string;
  descrizione: string;
  intestazione?: React.ReactNode;
}) {
  const t = await getTranslations();
  const { partita: p, a, b, mio } = props;
  const mancano = new Date(p.inizio_at).getTime() - Date.now();
  const aperta = p.stato === "in_programma" && mancano > 0 && a && b;
  const imminente = aperta && mancano < 3 * 3600_000;
  const conclusa = p.stato === "conclusa";
  const live = !conclusa && !aperta && a && b && p.stato !== "annullata";
  const haVoti = Object.keys(props.voti).length > 0;
  const regole = await regolePunti();
  const inPalio = t("partita.inPalio", { vincitore: regole.vincitore, set20: regole.set_esatti_2_0, set21: regole.set_esatti, set: regole.set_errore_0, m20: massimo20(regole), m21: massimo21(regole) });

  const stato = aperta ? (
    <span className={`chip ${imminente ? "bg-viola text-white" : "bg-viola/10 text-viola"}`}>
      {t("partita.chiudeTra", { quando: "" })} <Tra iso={p.inizio_at} />
    </span>
  ) : conclusa ? (
    <span className="chip">{t("partita.conclusa")}</span>
  ) : live ? (
    <span className="chip-live">
      <span className="punto-live" /> Live
    </span>
  ) : (
    <span className="chip">{t("partita.inAttesa")}</span>
  );

  const riga = (c: Coppia | null, quale: "a" | "b") => {
    const vinta = Boolean(c && p.vincitore_id === c.id);
    const giochi = quale === "a" ? p.game_a : p.game_b;
    const altri = quale === "a" ? p.game_b : p.game_a;
    const voto = c ? props.voti[c.id] : undefined;
    const mia = Boolean(mio && c && mio.vincitore_id === c.id);
    return (
      <div className="flex items-center gap-3 py-2">
        <span className={`h-8 w-1 shrink-0 rounded-full ${vinta ? "bg-viola" : "bg-linea"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[16px] ${conclusa ? (vinta ? "font-bold" : "text-tenue") : "font-semibold"}`}>
            {c ? (
              <>
                <span aria-hidden className="mr-1">{bandiera(c.g1.paese)}</span>
                {c.g1.cognome} / <span aria-hidden className="mr-1">{bandiera(c.g2.paese)}</span>
                {c.g2.cognome}
                {c.testa_di_serie ? <span className="ml-1.5 text-xs font-semibold text-seme">{c.testa_di_serie}</span> : null}
                {mia && <span className="ml-2 text-xs font-semibold text-viola">{t("partita.tuaScelta")}</span>}
              </>
            ) : (
              <span className="text-tenue">{t("partita.inAttesa")}</span>
            )}
          </p>
          {haVoti && voto && (
            <div className="mt-1 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-linea">
                <span className="block h-full rounded-full bg-tenue" style={{ width: `${voto.percentuale}%` }} />
              </span>
              <span className="w-9 text-right text-xs font-semibold tabular-nums text-tenue">{voto.percentuale}%</span>
            </div>
          )}
        </div>
        {giochi && (
          <span className="flex shrink-0 gap-3">
            {giochi.map((x, i) => (
              <span key={i} className={`cifre w-5 text-right text-[22px] leading-none ${x > (altri?.[i] ?? 0) ? "text-inchiostro" : "text-tenue"}`}>
                {x}
              </span>
            ))}
          </span>
        )}
      </div>
    );
  };

  const coppiaDi = (id: string | null) => (id === a?.id ? a : id === b?.id ? b : null);
  const nome = (id: string | null) => {
    const c = coppiaDi(id);
    return c ? `${c.g1.cognome}/${c.g2.cognome}` : null;
  };
  const righeRecap = mio ? recapPronostico(regole, mio, p, nome) : [];
  const esitoTesto = (r: RigaRecap) =>
    r.esito === "differenza"
      ? t(r.voce === "long" ? "recap.differenzaLong" : "recap.differenza", { n: r.differenza ?? 0 })
      : r.esito
        ? t(`recap.${r.esito}`)
        : "";
  // i due cognomi uno sotto l'altro, così non si spezzano a metà parola
  const aCapo = (v: string | null) =>
    v ? v.split("/").map((x, i) => (<span key={i} className="block truncate">{x}</span>)) : "—";
  const nomeVoce = (r: RigaRecap) => (r.voce === "set" ? t("recap.set", { n: r.numero ?? 1 }) : t(`recap.${r.voce}`));

  return (
    <article className={`pannello overflow-hidden transition ${imminente ? "border-viola/40" : ""}`}>
      <header className="flex items-center gap-2 border-b border-linea px-4 py-2.5">
        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-tenue">
          {props.intestazione}
          <span className="mx-1.5 text-linea">|</span>
          <Ora iso={p.inizio_at} />
        </div>
        {stato}
      </header>

      <div className="p-4">
        {aperta ? (
          <PronosticoPartita
            partitaId={p.id}
            a={lato(a)}
            b={lato(b)}
            setPerVincere={p.set_per_vincere}
            mio={mio}
            collegato={props.collegato}
            urlAccesso={props.urlAccesso}
            sito={props.sito}
            descrizione={props.descrizione}
            inPalio={inPalio}
          />
        ) : (
          <>
            <div className="-my-2 divide-y divide-linea/60">
              {riga(a, "a")}
              {riga(b, "b")}
            </div>
            {conclusa && p.ritiro && (
              <p className="mt-2 text-xs text-tenue">
                {punteggio({ ...p, ritiro: false })} · {t("partita.ritiro")}
              </p>
            )}
            
            {mio && righeRecap.length > 0 && (
              <div className={`mt-4 overflow-hidden rounded-lg border ${mio.punti && mio.punti > 0 ? "festa border-viola/40" : "border-linea"}`}>
                <div className={`flex items-center justify-between gap-3 px-3 py-2.5 ${mio.punti && mio.punti > 0 ? "bg-viola/[.06]" : "bg-sabbia-2"}`}>
                  <p className="text-sm font-semibold">{t("recap.titolo")}</p>
                  {mio.punti != null && (
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-tenue">{t("recap.totale")}</span>
                      <span className={`cifre text-3xl leading-none ${mio.punti > 0 ? "text-viola" : "text-tenue"}`}>+{mio.punti}</span>
                    </p>
                  )}
                </div>
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-t border-linea text-left text-xs font-semibold text-tenue">
                      <th className="w-[31%] px-3 py-1.5 font-semibold"></th>
                      <th className="px-1 py-1.5 font-semibold">{t("recap.tu")}</th>
                      <th className="px-1 py-1.5 font-semibold">{conclusa ? t("recap.finale") : ""}</th>
                      <th className="w-14 px-3 py-1.5 text-right font-semibold">{conclusa ? t("recap.punti") : ""}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {righeRecap.map((r, i) => {
                      const preso = (r.punti ?? 0) > 0;
                      const nomi = r.voce === "chiVince";
                      return (
                        <tr key={i} className="border-t border-linea align-top">
                          <td className="px-3 py-2">
                            <span className="block font-semibold leading-tight">{nomeVoce(r)}</span>
                            {r.esito && <span className={`block text-xs leading-tight ${preso ? "text-viola" : "text-tenue"}`}>{esitoTesto(r)}</span>}
                          </td>
                          <td className={`px-1 py-2 ${nomi ? "text-[13px] font-semibold leading-tight" : "cifre text-base"}`}>{nomi ? aCapo(r.tuo) : (r.tuo ?? "—")}</td>
                          <td className={`px-1 py-2 ${nomi ? "text-[13px] leading-tight" : "cifre text-base"}`}>{conclusa ? (nomi ? aCapo(r.reale) : (r.reale ?? "—")) : ""}</td>
                          <td className={`cifre px-3 py-2 text-right text-lg leading-tight ${preso ? "text-viola" : "text-tenue"}`}>{r.punti != null ? `+${r.punti}` : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!conclusa && <p className="border-t border-linea px-3 py-2 text-xs text-tenue">{t("recap.attesa")}</p>}
                {conclusa && p.ritiro && <p className="border-t border-linea px-3 py-2 text-xs text-tenue">{t("recap.ritiro")}</p>}
              </div>
            )}
            {!conclusa && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-tenue">
                <IconaLucchetto className="h-3.5 w-3.5" /> {t("partita.chiusa")}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
