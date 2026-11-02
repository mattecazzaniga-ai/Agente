import { getTranslations } from "next-intl/server";
import type { Coppia, Partita, PronosticoPartita as Pronostico } from "@/lib/tipi";
import { bandiera, nomeCoppia, punteggio } from "@/lib/formato";
import PronosticoPartita from "./PronosticoPartita";
import Ora from "./Ora";

export interface VotoMostrato {
  percentuale: number;
  punti: number;
}

/** Una partita: prima dell'inizio il pronostico, dopo il risultato, le percentuali e i punti presi. */
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
  const riga = (c: Coppia | null, lato: "a" | "b") => {
    const vinta = c && p.vincitore_id === c.id;
    const giochi = lato === "a" ? p.game_a : p.game_b;
    const voto = c ? props.voti[c.id] : undefined;
    return (
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-sm ${vinta ? "font-bold" : ""}`}>
          {c ? (
            <>
              <span aria-hidden>{bandiera(c.g1.paese)}</span> {nomeCoppia(c)}
              {c.testa_di_serie ? <span className="ml-1 text-xs text-nebbia">[{c.testa_di_serie}]</span> : null}
            </>
          ) : (
            <span className="text-nebbia">{t("partita.inAttesa")}</span>
          )}
          {mio && c && mio.vincitore_id === c.id && <span className="ml-1" title={t("torneo.ilTuo")}>✓</span>}
        </span>
        {!aperta && voto && (
          <span className="w-20 text-right text-xs text-nebbia">{t("torneo.hannoScelto", { percentuale: voto.percentuale, punti: voto.punti })}</span>
        )}
        {conclusa && giochi && !p.ritiro && <span className="w-16 text-right font-mono text-sm tabular-nums">{giochi.join(" ")}</span>}
      </div>
    );
  };

  return (
    <article className="scheda space-y-3">
      <header className="flex items-center gap-2 text-xs text-nebbia">
        {props.intestazione}
        <span className="ml-auto">
          {conclusa ? t("partita.conclusa") : p.stato === "in_corso" ? t("stato.in_corso") : <Ora iso={p.inizio_at} />}
        </span>
      </header>
      <div className="space-y-1.5">
        {riga(a, "a")}
        {riga(b, "b")}
        {conclusa && p.ritiro && <p className="text-xs text-nebbia">{punteggio(p) || ""} ({t("partita.ritiro")})</p>}
      </div>
      {aperta ? (
        <PronosticoPartita
          partitaId={p.id}
          a={{ id: a.id, nome: nomeCoppia(a) }}
          b={{ id: b.id, nome: nomeCoppia(b) }}
          setPerVincere={p.set_per_vincere}
          mio={mio}
          collegato={props.collegato}
          urlAccesso={props.urlAccesso}
          sito={props.sito}
          descrizione={props.descrizione}
        />
      ) : (
        mio && (
          <p className="rounded-xl bg-onda px-3 py-2 text-sm">
            <b>{t("torneo.ilTuo")}:</b> {nomeCoppia(mio.vincitore_id === a?.id ? a : b)}
            {mio.set_vincitore != null && ` · ${mio.set_vincitore}-${mio.set_perdente}`}
            {mio.totale_game != null && ` · ${mio.totale_game} game`}
            {mio.punti != null && <b className="ml-2 text-mare">{t("partita.punti", { punti: mio.punti })}</b>}
            {!conclusa && !aperta && <span className="ml-2 text-nebbia">· {t("partita.chiusa")}</span>}
          </p>
        )
      )}
    </article>
  );
}
