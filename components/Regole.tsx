import { getTranslations } from "next-intl/server";
import { IconaCoppa, IconaLucchetto, IconaPodio } from "./Icone";

/** Come si fanno i punti: in breve e sempre a portata di mano. */
export default async function Regole() {
  const t = await getTranslations("regole");
  const voci = [
    { Icona: IconaPodio, testo: t("partita"), colore: "bg-onda text-mare" },
    { Icona: IconaCoppa, testo: t("torneo"), colore: "bg-sole-chiaro text-inchiostro" },
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
