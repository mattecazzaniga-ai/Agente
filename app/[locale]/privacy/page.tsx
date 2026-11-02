import { getTranslations, setRequestLocale } from "next-intl/server";
import Avviso from "@/components/Avviso";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("privacy.titolo") };
}

export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("privacy.titolo")}</h1>
      <p className="scheda leading-relaxed">{t("privacy.testo")}</p>
      <Avviso grande />
    </div>
  );
}
