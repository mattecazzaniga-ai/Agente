import { getTranslations } from "next-intl/server";
import type { Medaglie, Trofeo } from "@/lib/trofei";
import { IconaBersaglio, IconaCoppa, IconaFulmine, IconaFuoco, IconaGlobo, IconaMedaglia, IconaPallina, IconaPiu, IconaPodio, IconaSpunta, IconaStella } from "./Icone";

const ICONE = {
  esordio: IconaSpunta,
  fedelissimo: IconaPallina,
  serie: IconaFuoco,
  occhio: IconaBersaglio,
  long: IconaStella,
  perfetta: IconaMedaglia,
  fiuto: IconaFulmine,
  giramondo: IconaGlobo,
  campione: IconaCoppa,
  podio: IconaPodio,
  reTorneo: IconaCoppa,
  podioTorneo: IconaPodio,
} as const;

// colori dei livelli: nessuno, bronzo, argento, oro (l'oro è il giallo del logo)
const COLORI = ["bg-sabbia-2 text-tenue/50 ring-linea", "bg-[#f6e3d1] text-[#9a5a24] ring-[#d9965b]", "bg-[#eceef3] text-[#5a6274] ring-[#b8bfcc]", "bg-sole-chiaro text-[#8a5a12] ring-sole"];

/**
 * La bacheca dei trofei, chiusa: si vede il titolo, quanti ne hai e le icone di quelli presi.
 * Toccandola si apre la griglia completa, con i bloccati in grigio e quanto manca.
 */
export async function Bacheca({ trofei, titolo, aperta = false }: { trofei: Trofeo[]; titolo: string; aperta?: boolean }) {
  const t = await getTranslations("trofei");
  const presi = trofei.filter((x) => x.livello > 0);
  const ordinati = [...trofei].sort((a, b) => b.livello - a.livello);
  return (
    <details className="pannello group overflow-hidden" open={aperta}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-bold leading-tight">{titolo}</span>
          <span className="mt-0.5 block text-sm text-tenue">
            {t("sbloccati", { n: presi.length, totale: trofei.length })}
            <span className="group-open:hidden"> · {t("apriTutti").toLowerCase()}</span>
          </span>
        </span>
        <span className="flex -space-x-2">
          {presi.slice(0, 5).map((x) => {
            const Icona = ICONE[x.id];
            return (
              <span key={x.id} className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-carta ${COLORI[x.livello]}`}>
                <Icona className="h-4.5 w-4.5" />
              </span>
            );
          })}
        </span>
        <span className="text-viola transition group-open:rotate-45" aria-hidden>
          <IconaPiu />
        </span>
      </summary>
      <div className="flex items-center gap-3 border-t border-linea px-4 py-2.5">
        <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-linea">
          <span className="block h-full rounded-full bg-viola" style={{ width: `${(presi.length / trofei.length) * 100}%` }} />
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-px border-t border-linea bg-linea sm:grid-cols-3">
        {ordinati.map((x) => {
          const Icona = ICONE[x.id];
          const avanzamento = x.prossima == null ? 1 : Math.min(1, x.valore / x.prossima);
          return (
            <li key={x.id} className="flex flex-col items-center bg-carta px-3 py-4 text-center">
              <span className={`relative flex h-14 w-14 items-center justify-center rounded-full ring-2 ${COLORI[x.livello]}`}>
                <Icona className="h-7 w-7" />
                {x.livello > 0 && x.id !== "esordio" && (
                  <span className="cifre absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-inchiostro px-1 text-[11px] text-white">{x.valore}</span>
                )}
              </span>
              <p className={`mt-2 text-sm font-semibold leading-tight ${x.livello === 0 ? "text-tenue" : ""}`}>{t(`${x.id}.nome`)}</p>
              <p className="mt-0.5 text-xs leading-snug text-tenue">{t(`${x.id}.descr`)}</p>
              {x.id !== "esordio" && (
                <p className="mt-1.5 text-[11px] font-semibold text-tenue">
                  {x.livello > 0 && <span className="mr-1 text-inchiostro">{t(`livello${x.livello}`)}</span>}
                  {x.prossima != null ? t("prossimo", { valore: x.valore, soglia: x.prossima }) : t("massimo")}
                </p>
              )}
              {x.prossima != null && x.id !== "esordio" && (
                <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-linea">
                  <span className="block h-full rounded-full bg-viola/70" style={{ width: `${avanzamento * 100}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Medaglie dei mesi chiusi, piccole accanto al nickname. */
export function MedaglieMese({ m, titolo }: { m?: Medaglie; titolo: string }) {
  if (!m || m.oro + m.argento + m.bronzo === 0) return null;
  const pezzi: [number, string][] = [
    [m.oro, "bg-sole text-inchiostro"],
    [m.argento, "bg-[#c9cfdb] text-inchiostro"],
    [m.bronzo, "bg-[#d9965b] text-white"],
  ];
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle" title={titolo}>
      {pezzi
        .filter(([n]) => n > 0)
        .map(([n, colore], i) => (
          <span key={i} className={`cifre inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full px-1 text-[10px] leading-none ${colore}`}>
            <IconaCoppa className="h-2.5 w-2.5" />
            {n > 1 ? n : ""}
          </span>
        ))}
    </span>
  );
}
