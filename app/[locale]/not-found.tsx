import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NonTrovata() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="cifre text-[96px] leading-none text-mare">404</p>
      <p className="mt-3 text-lg text-tenue">{t("errori.nonTrovato")}</p>
      <Link href="/" className="bottone mt-8">
        {t("nav.home")}
      </Link>
    </div>
  );
}
