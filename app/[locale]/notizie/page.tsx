import { getTranslations, setRequestLocale } from "next-intl/server";
import { notiziePubblicate } from "@/lib/dati";
import SchedaNotizia from "@/components/SchedaNotizia";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("notizie.titolo") };
}

export default async function Notizie({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, notizie] = await Promise.all([getTranslations(), notiziePubblicate(locale, 50)]);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">{t("notizie.titolo")}</h1>
      {notizie.length === 0 && <p className="scheda text-sm text-nebbia">{t("notizie.nessuna")}</p>}
      {notizie.map((n) => (
        <SchedaNotizia key={n.id} notizia={n} />
      ))}
    </div>
  );
}
