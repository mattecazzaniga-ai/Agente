import { getTranslations, setRequestLocale } from "next-intl/server";
import Intestazione from "@/components/Intestazione";
import Vuoto from "@/components/Vuoto";
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
      <Intestazione emoji="📰" titolo={t("notizie.titolo")} sotto={t("notizie.sottotitoloPagina")} colore="bg-onda" />
      {notizie.length === 0 && <Vuoto emoji="📰" testo={t("notizie.nessuna")} colore="bg-menta-chiaro" />}
      {notizie.map((n) => (
        <SchedaNotizia key={n.id} notizia={n} />
      ))}
    </div>
  );
}
