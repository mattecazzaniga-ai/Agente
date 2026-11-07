import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bandiera } from "@/lib/formato";
import type { Coppia, Partita, PronosticoPartita } from "@/lib/tipi";
import Ora from "./Ora";
import { IconaFreccia, IconaSpunta } from "./Icone";

/** Stato visibile di una partita, dal punto di vista di chi pronostica. */
export function statoPartita(p: Pick<Partita, "stato" | "inizio_at" | "coppia_a_id" | "coppia_b_id">): "aperta" | "live" | "finita" | "attesa" | "annullata" {
  if (p.stato === "conclusa") return "finita";
  if (p.stato === "annullata") return "annullata";
  if (!p.coppia_a_id || !p.coppia_b_id) return "attesa";
  if (p.stato === "in_corso" || new Date(p.inizio_at).getTime() <= Date.now()) return "live";
  return "aperta";
}

/**
 * Una partita su una riga, come nelle app di risultati: stato/orario, le due coppie, i set e, a destra,
 * cosa può fare l'utente (pronosticare, già fatto, punti presi). Tutta la riga porta alla partita nel torneo.
 */
export default async function RigaPartita({
  partita: p,
  a,
  b,
  mio,
  href,
  sopra,
}: {
  partita: Partita;
  a: Coppia | null;
  b: Coppia | null;
  mio?: PronosticoPartita | null;
  href: string;
  sopra?: React.ReactNode;
}) {
  const t = await getTranslations();
  const stato = statoPartita(p);
  const finita = stato === "finita";

  const lato = (c: Coppia | null, quale: "a" | "b") => {
    const vinta = Boolean(c && p.vincitore_id === c.id);
    const giochi = quale === "a" ? p.game_a : p.game_b;
    const altri = quale === "a" ? p.game_b : p.game_a;
    return (
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-[15px] ${finita ? (vinta ? "font-bold text-testo" : "text-tenue") : "font-semibold text-testo"}`}>
          {c ? (
            <>
              <span aria-hidden className="mr-1.5">
                {bandiera(c.g1.paese)}
              </span>
              {c.g1.cognome} / {c.g2.cognome}
              {c.testa_di_serie ? <span className="ml-1.5 font-display text-xs font-bold text-sabbia">{c.testa_di_serie}</span> : null}
            </>
          ) : (
            <span className="text-tenue">{t("partita.inAttesa")}</span>
          )}
        </span>
        {giochi && (
          <span className="flex shrink-0 gap-2">
            {giochi.map((x, i) => (
              <span key={i} className={`cifre w-5 text-right text-[17px] ${x > (altri?.[i] ?? 0) ? "text-testo" : "text-tenue"}`}>
                {x}
              </span>
            ))}
          </span>
        )}
      </div>
    );
  };

  return (
    <Link href={href} className="group flex items-stretch gap-3 px-3 py-3 transition hover:bg-pannello-2 sm:px-4">
      <div className="flex w-12 shrink-0 flex-col justify-center text-center">
        {stato === "live" ? (
          <span className="flex items-center justify-center gap-1 font-display text-[13px] font-bold uppercase tracking-wide text-corallo">
            <span className="punto-live" /> Live
          </span>
        ) : finita ? (
          <span className="font-display text-[13px] font-bold uppercase tracking-wide text-tenue">{p.ritiro ? t("riga.rit") : t("riga.fine")}</span>
        ) : (
          <>
            <span className="cifre text-[15px] text-testo">
              <Ora iso={p.inizio_at} solo="ora" />
            </span>
            <span className="text-[11px] uppercase text-tenue">
              <Ora iso={p.inizio_at} solo="data" />
            </span>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1 border-l border-linea pl-3">
        {sopra && <div className="truncate font-display text-[12px] font-semibold uppercase tracking-wider text-tenue">{sopra}</div>}
        {lato(a, "a")}
        {lato(b, "b")}
      </div>
      <div className={`flex shrink-0 items-center justify-end ${stato === "aperta" ? "w-[68px]" : finita && mio?.punti != null ? "w-11" : "w-4"}`}>
        {stato === "aperta" ? (
          mio ? (
            <span className="flex items-center gap-1 font-display text-[12px] font-bold uppercase tracking-wide text-lime">
              <IconaSpunta className="h-3.5 w-3.5" /> {t("riga.fatto")}
            </span>
          ) : (
            <span className="flex items-center gap-0.5 rounded-md bg-lime px-2 py-1 font-display text-[12px] font-bold uppercase tracking-wide text-notte transition group-hover:bg-lime-scuro">
              {t("riga.pronostica")}
            </span>
          )
        ) : finita && mio?.punti != null ? (
          <span className={`cifre text-xl ${mio.punti > 0 ? "text-lime" : "text-tenue"}`}>+{mio.punti}</span>
        ) : (
          <IconaFreccia className="h-4 w-4 text-tenue transition group-hover:translate-x-0.5 group-hover:text-testo" />
        )}
      </div>
    </Link>
  );
}
