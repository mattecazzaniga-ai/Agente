import { getTranslations } from "next-intl/server";
import type { Medaglie, Trofeo } from "@/lib/trofei";
import { IconaBersaglio, IconaCoppa, IconaFulmine, IconaFuoco, IconaGlobo, IconaMedaglia, IconaPallina, IconaPodio, IconaSpunta, IconaStella } from "./Icone";

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
} as const;

// colori dei livelli: nessuno, bronzo, argento, oro (l'oro è il giallo del logo)
const COLORI = ["bg-sabbia-2 text-tenue/50 ring-linea", "bg-[#f6e3d1] text-[#9a5a24] ring-[#d9965b]", "bg-[#eceef3] text-[#5a6274] ring-[#b8bfcc]", "bg-sole-chiaro text-[#8a5a12] ring-sole"];

/** La bacheca dei trofei: sbloccati a colori, gli altri in grigio con quanto manca. */
export async function Bacheca({ trofei }: { trofei: Trofeo[] }) {
  const t = await getTranslations("trofei");
  const presi = trofei.filter((x) => x.livello > 0).length;
  const ordinati = [...trofei].sort((a, b) => b.livello - a.livello);
  return (
    <section className="pannello overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-linea px-4 py-3">
        <p className="text-sm text-tenue">{t("sbloccati", { n: presi, totale: trofei.length })}</p>
        <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-linea">
          <span className="block h-full rounded-full bg-viola" style={{ width: `${(presi / trofei.length) * 100}%` }} />
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-px bg-linea sm:grid-cols-3">
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
    </section>
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
