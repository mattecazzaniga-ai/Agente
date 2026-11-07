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
      <Intestazione titolo={t("notizie.titolo")} sotto={t("notizie.sottotitoloPagina")} />
      {notizie.length === 0 && <Vuoto testo={t("notizie.nessuna")} />}
      {notizie.map((n) => (
        <SchedaNotizia key={n.id} notizia={n} />
      ))}
    </div>
  );
}
