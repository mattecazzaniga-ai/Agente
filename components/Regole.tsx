import { getTranslations } from "next-intl/server";
import { IconaCoppa, IconaLucchetto, IconaPiu, IconaPodio } from "./Icone";
import { regolePunti } from "@/lib/dati";
import { massimoPartita, scalaGame } from "@/lib/punti";

/** Come si fanno i punti: in breve e sempre a portata di mano. */
export default async function Regole() {
  const [t, r] = await Promise.all([getTranslations("regole"), regolePunti()]);
  const scala = scalaGame(r);
  const voci = [
    {
      Icona: IconaPodio,
      testo: t("partita", {
        massimo: massimoPartita(r),
        vincitore: r.vincitore,
        set: r.set_esatti,
        scala: scala.map((p, e) => `${e}→${p}`).join(", "),
        oltre: scala.length - 1,
        esatto: r.esatto,
        quasi: r.quasi_esatto,
      }),
      colore: "bg-sabbia-2 text-mare",
    },
    { Icona: IconaCoppa, testo: t("torneo", { vincitore: r.torneo_vincitore, finalista: r.torneo_finalista }), colore: "bg-mare/15 text-inchiostro" },
    { Icona: IconaLucchetto, testo: t("blocco"), colore: "bg-mare/10 text-mare" },
  ];
  return (
    <details className="pannello group mt-6">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-semibold">
        {t("titolo")}
        <span className="text-mare transition group-open:rotate-45" aria-hidden>
          <IconaPiu />
        </span>
      </summary>
      <ul className="divide-y divide-linea border-t border-linea">
        {voci.map(({ Icona, testo }) => (
          <li key={testo} className="flex gap-3 px-4 py-3 text-sm leading-relaxed text-inchiostro/85">
            <Icona className="mt-0.5 h-5 w-5 shrink-0 text-mare" />
            <span>{testo}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
