import { getTranslations } from "next-intl/server";
import { IconaCoppa, IconaLucchetto, IconaPiu, IconaPodio } from "./Icone";
import { regolePunti } from "@/lib/dati";
import { massimoPartita } from "@/lib/punti";

/** Come si fanno i punti: in breve e sempre a portata di mano. */
export default async function Regole() {
  const [t, r] = await Promise.all([getTranslations("regole"), regolePunti()]);
  const voci = [
    {
      Icona: IconaPodio,
      testo: t("partita", {
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
      }),
      colore: "bg-sabbia-2 text-viola",
    },
    { Icona: IconaCoppa, testo: t("torneo", { vincitore: r.torneo_vincitore, finalista: r.torneo_finalista }), colore: "bg-viola/15 text-inchiostro" },
    { Icona: IconaLucchetto, testo: t("blocco"), colore: "bg-viola/10 text-viola" },
  ];
  return (
    <details className="pannello group mt-6">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold">
        {t("titolo")}
        <span className="text-viola transition group-open:rotate-45" aria-hidden>
          <IconaPiu />
        </span>
      </summary>
      <ul className="divide-y divide-linea border-t border-linea">
        {voci.map(({ Icona, testo }) => (
          <li key={testo} className="flex gap-3 px-4 py-3 text-sm leading-relaxed text-inchiostro/85">
            <Icona className="mt-0.5 h-5 w-5 shrink-0 text-viola" />
            <span>{testo}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
