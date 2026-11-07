import { getTranslations } from "next-intl/server";
import { IconaCoppa, IconaLucchetto, IconaPiu } from "./Icone";
import { regolePunti } from "@/lib/dati";
import { massimoPartita } from "@/lib/punti";

/** Come si fanno i punti: le quattro voci di una partita, un esempio, poi torneo e chiusura. */
export default async function Regole() {
  const [t, r] = await Promise.all([getTranslations("regole"), regolePunti()]);
  const v = {
    massimo: massimoPartita(r),
    vincitore: r.vincitore,
    set20: r.set_esatti_2_0,
    set21: r.set_esatti,
    s0: r.set_errore_0,
    s1: r.set_errore_1,
    s2: r.set_errore_2,
    l0: r.long_errore_0,
    l1: r.long_errore_1,
    l2: r.long_errore_2,
    totale: (r.vincitore ?? 0) + (r.set_esatti_2_0 ?? 0) + (r.set_errore_0 ?? 0) + (r.set_errore_1 ?? 0),
  };
  const voci: [string, string, number][] = [
    [t("chiVince"), t("chiVinceTesto", v), r.vincitore ?? 0],
    [t("comeFinisce"), t("comeFinisceTesto", v), Math.max(r.set_esatti_2_0 ?? 0, r.set_esatti ?? 0)],
    [t("ogniSet"), t("ogniSetTesto", v), r.set_errore_0 ?? 0],
    [t("long"), t("longTesto", v), r.long_errore_0 ?? 0],
  ];
  return (
    <details className="pannello group mt-6">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold">
        {t("titolo")}
        <span className="text-viola transition group-open:rotate-45" aria-hidden>
          <IconaPiu />
        </span>
      </summary>
      <div className="border-t border-linea px-4 py-3 text-sm leading-relaxed text-inchiostro/85">
        <p>{t("intro", v)}</p>
        <ol className="mt-3 space-y-2.5">
          {voci.map(([titolo, testo, punti], i) => (
            <li key={titolo} className="flex gap-3">
              <span className="cifre mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-viola text-sm text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2 font-semibold text-inchiostro">
                  {titolo}
                  <span className="cifre shrink-0 text-viola">{t("fino", { n: punti })}</span>
                </p>
                <p>{testo}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-lg bg-sole-chiaro px-3 py-2 text-inchiostro">{t("esempio", v)}</p>
      </div>
      <ul className="divide-y divide-linea border-t border-linea">
        {[
          [IconaCoppa, t("torneo", { vincitore: r.torneo_vincitore, finalista: r.torneo_finalista })] as const,
          [IconaLucchetto, t("blocco")] as const,
        ].map(([Icona, testo]) => (
          <li key={testo} className="flex gap-3 px-4 py-3 text-sm leading-relaxed text-inchiostro/85">
            <Icona className="mt-0.5 h-5 w-5 shrink-0 text-viola" />
            <span>{testo}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
