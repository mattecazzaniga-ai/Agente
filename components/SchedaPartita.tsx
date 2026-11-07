import { getTranslations } from "next-intl/server";
import type { Coppia, Partita, PronosticoPartita as Pronostico } from "@/lib/tipi";
import { bandiera, nomeCoppia, punteggio } from "@/lib/formato";
import { gameTotali, massimoPartita } from "@/lib/punti";
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
  const reali = conclusa && !p.ritiro && p.game_a && p.game_b ? gameTotali(p.game_a, p.game_b, p.set_per_vincere) : null;
  const inPalio = t("partita.inPalio", { vincitore: regole.vincitore, set: regole.set_esatti, game: regole.game_errore_0, long: regole.long_vicino, massimo: massimoPartita(regole) });

  const stato = aperta ? (
    <span className={`chip ${imminente ? "bg-mare text-white" : "bg-mare/10 text-mare"}`}>
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
        <span className={`h-8 w-1 shrink-0 rounded-full ${vinta ? "bg-mare" : "bg-linea"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[16px] ${conclusa ? (vinta ? "font-bold" : "text-tenue") : "font-semibold"}`}>
            {c ? (
              <>
                <span aria-hidden className="mr-1">{bandiera(c.g1.paese)}</span>
                {c.g1.cognome} / <span aria-hidden className="mr-1">{bandiera(c.g2.paese)}</span>
                {c.g2.cognome}
                {c.testa_di_serie ? <span className="ml-1.5 text-xs font-semibold text-seme">{c.testa_di_serie}</span> : null}
                {mia && <span className="ml-2 text-xs font-semibold text-mare">{t("partita.tuaScelta")}</span>}
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

  const vincitoreMio = mio ? (mio.vincitore_id === a?.id ? a : b) : null;
  // colonne del dettaglio punti; il long compare se la partita è andata al long o lo avevi previsto
  const conLong = Boolean(mio && ((p.game_a?.length ?? 0) === 3 || (mio.game_a?.length ?? 0) === 3));
  const colonne: [string, number, string][] = mio
    ? [
        [t("punti.vincitore"), mio.punti_vincitore ?? 0, ""],
        [t("punti.set"), mio.punti_set ?? 0, ""],
        [t("punti.game"), mio.punti_game ?? 0, mio.errore_game != null && mio.errore_game > 0 ? t("punti.errore", { n: mio.errore_game }) : mio.errore_game === 0 ? t("punti.esatti") : ""],
        ...(conLong ? [[t("punti.long"), mio.punti_long ?? 0, ""] as [string, number, string]] : []),
      ]
    : [];

  return (
    <article className={`pannello overflow-hidden transition ${imminente ? "border-mare/40" : ""}`}>
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
            {reali && <p className="mt-2 text-xs font-semibold text-tenue">{t("partita.gameReali", { a: reali[0], b: reali[1] })}</p>}

            {mio && vincitoreMio && (
              <div className={`mt-4 rounded-lg border ${mio.punti && mio.punti > 0 ? "festa border-mare/40 bg-mare/[.06]" : "border-linea bg-sabbia-2"}`}>
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className=" text-xs font-semibold text-tenue">{t("torneo.ilTuo")}</p>
                    <p className="truncate font-semibold">
                      {vincitoreMio.g1.cognome}/{vincitoreMio.g2.cognome}
                      {mio.set_vincitore != null && <span className="cifre ml-2 text-mare">{`${mio.set_vincitore}-${mio.set_perdente}`}</span>}
                      {mio.game_a && mio.game_b && (
                        <span className="cifre ml-2">{mio.game_a.map((x, i) => (mio.vincitore_id === a?.id ? `${x}-${mio.game_b![i]}` : `${mio.game_b![i]}-${x}`)).join(" ")}</span>
                      )}
                    </p>
                    <p className="truncate text-sm">
                      {mio.game_previsti_a != null && (
                        <span className="text-tenue">
                          {t("partita.game")} <span className="cifre text-inchiostro">{`${mio.game_previsti_a}-${mio.game_previsti_b}`}</span>
                        </span>
                      )}
                    </p>
                  </div>
                  {mio.punti != null && <span className={`cifre shrink-0 text-3xl leading-none ${mio.punti > 0 ? "text-mare" : "text-tenue"}`}>+{mio.punti}</span>}
                </div>
                {mio.punti != null && (
                  <dl className={`grid border-t border-linea text-center ${colonne.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                    {colonne.map(([nome, punti, nota], i) => (
                      <div key={i} className={`px-2 py-2 ${i > 0 ? "border-l border-linea" : ""}`}>
                        <dt className=" text-xs font-semibold text-tenue">{nome}</dt>
                        <dd className={`cifre text-lg ${Number(punti) > 0 ? "text-mare" : "text-tenue"}`}>+{punti}</dd>
                        {nota && <dd className="text-xs text-tenue">{nota}</dd>}
                      </div>
                    ))}
                  </dl>
                )}
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
