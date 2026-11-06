import { getTranslations } from "next-intl/server";
import { IconaCoppa, IconaLucchetto, IconaPodio } from "./Icone";
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
      }),
      colore: "bg-onda text-mare",
    },
    { Icona: IconaCoppa, testo: t("torneo", { vincitore: r.torneo_vincitore, finalista: r.torneo_finalista }), colore: "bg-sole-chiaro text-inchiostro" },
    { Icona: IconaLucchetto, testo: t("blocco"), colore: "bg-menta-chiaro text-menta" },
  ];
  return (
    <details className="scheda group mt-8">
      <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold">
        {t("titolo")}
        <span className="grid h-7 w-7 place-items-center rounded-full bg-onda text-mare transition group-open:rotate-45">+</span>
      </summary>
      <ul className="mt-4 space-y-3">
        {voci.map(({ Icona, testo, colore }) => (
          <li key={testo} className="flex gap-3 text-sm leading-relaxed text-inchiostro/85">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colore}`}>
              <Icona className="h-5 w-5" />
            </span>
            <span>{testo}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
