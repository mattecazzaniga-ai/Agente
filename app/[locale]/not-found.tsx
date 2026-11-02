import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NonTrovato() {
  const t = await getTranslations();
  return (
    <div className="scheda mt-6 space-y-3 text-center">
      <div className="text-5xl" aria-hidden>🏖️</div>
      <p className="font-semibold">{t("errori.nonTrovato")}</p>
      <Link href="/" className="bottone">
        {t("nav.home")}
      </Link>
    </div>
  );
}
