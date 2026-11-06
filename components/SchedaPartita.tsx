import { getTranslations } from "next-intl/server";
import type { Coppia, Partita, PronosticoPartita as Pronostico } from "@/lib/tipi";
import { bandiera, nomeCoppia, punteggio } from "@/lib/formato";
import PronosticoPartita, { type LatoCoppia } from "./PronosticoPartita";
import Tra from "./Tra";
import { dettaglioPunti } from "@/lib/punti";
import { IconaLucchetto, IconaOrologio, IconaSpunta } from "./Icone";

export interface VotoMostrato {
  percentuale: number;
  punti: number;
}

const lato = (c: Coppia): LatoCoppia => ({
  id: c.id,
  nome: nomeCoppia(c),
  righe: [c.g1.cognome, c.g2.cognome],
  bandiere: c.g1.paese === c.g2.paese ? bandiera(c.g1.paese) : `${bandiera(c.g1.paese)}${bandiera(c.g2.paese)}`,
  testa_di_serie: c.testa_di_serie,
});

/** Una partita: prima dell'inizio si sceglie chi vince; dopo si vedono risultato, voti e punti presi. */
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
  const aperta = p.stato === "in_programma" && new Date(p.inizio_at).getTime() > Date.now() && a && b;
  const conclusa = p.stato === "conclusa";
  const inCorso = p.stato === "in_corso" || (p.stato === "in_programma" && !aperta && a && b);
  const haVoti = Object.keys(props.voti).length > 0;
  /** "Ricci/Neri 6-4 3-6" dal lato della coppia scelta. */
  const scelto = (m: Pronostico) => {
    const c = m.vincitore_id === a?.id ? a : b;
    const nome = c ? `${c.g1.cognome}/${c.g2.cognome}` : "";
    if (!m.game_a || !m.game_b) return nome;
    const daA = m.vincitore_id === a?.id;
    return `${nome} ${m.game_a.map((x, i) => (daA ? `${x}-${m.game_b![i]}` : `${m.game_b![i]}-${x}`)).join(" ")}`;
  };
  const dettaglio = mio && conclusa ? dettaglioPunti(mio, p) : null;

  const stato = aperta ? (
    <span className="chip bg-sole-chiaro text-inchiostro">
      <IconaOrologio className="h-3.5 w-3.5" /> {t("partita.chiudeTra", { quando: "" })}
      <Tra iso={p.inizio_at} />
    </span>
  ) : conclusa ? (
    <span className="chip bg-sabbia text-nebbia">{t("partita.conclusa")}</span>
  ) : inCorso ? (
    <span className="chip bg-corallo/15 text-corallo">
      <span className="h-2 w-2 animate-pulse rounded-full bg-corallo" /> {t("stato.in_corso")}
    </span>
  ) : (
    <span className="chip">{t("partita.inAttesa")}</span>
  );

  const riga = (c: Coppia | null, quale: "a" | "b") => {
    const vinta = Boolean(c && p.vincitore_id === c.id);
    const giochi = quale === "a" ? p.game_a : p.game_b;
    const voto = c ? props.voti[c.id] : undefined;
    const mia = Boolean(mio && c && mio.vincitore_id === c.id);
    return (
      <div className={`relative overflow-hidden rounded-xl px-3 py-2 ${mia ? "bg-onda" : "bg-crema"}`}>
        {haVoti && voto && <span className="absolute inset-y-0 left-0 bg-cielo/40" style={{ width: `${voto.percentuale}%` }} aria-hidden />}
        <div className="relative flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate ${vinta ? "font-extrabold" : conclusa ? "text-nebbia" : "font-semibold"}`}>
            {c ? (
              <>
                <span aria-hidden>{bandiera(c.g1.paese)}</span> {nomeCoppia(c)}
                {c.testa_di_serie ? <span className="ml-1 text-xs font-medium text-nebbia">[{c.testa_di_serie}]</span> : null}
              </>
            ) : (
              <span className="text-nebbia">…</span>
            )}
          </span>
          {mia && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-mare text-white" title={t("torneo.ilTuo")}>
              <IconaSpunta className="h-3 w-3" />
            </span>
          )}
          {haVoti && voto && <span className="text-xs font-bold tabular-nums text-nebbia">{voto.percentuale}%</span>}
          {conclusa && giochi && !p.ritiro && <span className={`flex shrink-0 gap-2.5 font-mono tabular-nums ${vinta ? "font-extrabold" : "text-nebbia"}`}>{giochi.map((x, i) => <span key={i} className="w-5 text-right">{x}</span>)}</span>}
        </div>
      </div>
    );
  };

  return (
    <article className="scheda space-y-3">
      <header className="flex items-center gap-2 text-xs text-nebbia">
        <span className="min-w-0 flex-1 truncate">{props.intestazione}</span>
        {stato}
      </header>
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
        />
      ) : (
        <>
          <div className="space-y-1.5">
            {riga(a, "a")}
            {riga(b, "b")}
            {conclusa && p.ritiro && (
              <p className="text-xs text-nebbia">
                {punteggio({ ...p, ritiro: false })} ({t("partita.ritiro")})
              </p>
            )}
          </div>
          {mio && (
            <div className={`rounded-2xl px-3 py-2.5 text-sm ${mio.punti != null && mio.punti > 0 ? "festa bg-menta-chiaro" : "bg-crema"}`}>
              <p className="flex items-start justify-between gap-2 font-bold">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-nebbia">{t("torneo.ilTuo")}</span>
                  <span className="block font-extrabold">{scelto(mio)}</span>
                </span>
                {mio.punti != null && <span className={`shrink-0 text-base font-black ${mio.punti > 0 ? "text-menta" : "text-nebbia"}`}>{mio.punti > 0 ? t("partita.punti", { punti: mio.punti }) : "0 pt"}</span>}
              </p>
              {dettaglio && mio.punti! > 0 && (
                <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="chip bg-white text-menta">{t("punti.vincitore")} +{dettaglio.vincitore}</span>
                  {dettaglio.set > 0 && <span className="chip bg-white text-menta">{t("punti.set")} +{dettaglio.set}</span>}
                  {dettaglio.perSet.map((x, i) => (x > 0 ? <span key={i} className="chip bg-white text-menta">{t("partita.setN", { n: i + 1 })} +{x}</span> : null))}
                  {dettaglio.esatto > 0 && <span className="chip bg-sole text-inchiostro">🎯 {t("punti.esatto")} +{dettaglio.esatto}</span>}
                </p>
              )}
            </div>
          )}
          {!conclusa && (
            <p className="flex items-center gap-1.5 text-xs text-nebbia">
              <IconaLucchetto className="h-3.5 w-3.5" /> {t("partita.chiusa")}
            </p>
          )}
        </>
      )}
    </article>
  );
}
