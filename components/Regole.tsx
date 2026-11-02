import { getTranslations } from "next-intl/server";

/** Come si fanno i punti: in breve e sempre a portata di mano. */
export default async function Regole() {
  const t = await getTranslations("regole");
  return (
    <details className="scheda mt-6 text-sm">
      <summary className="cursor-pointer font-bold">ℹ️ {t("titolo")}</summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-inchiostro/85">
        <li>{t("partita")}</li>
        <li>{t("torneo")}</li>
        <li>{t("blocco")}</li>
      </ul>
    </details>
  );
}
