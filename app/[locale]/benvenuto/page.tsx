import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { sessione } from "@/lib/dati";
import FormProfilo from "@/components/FormProfilo";

export default async function Benvenuto({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ dopo?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { dopo } = await searchParams;
  const { profilo } = await sessione();
  if (!profilo) redirect(`/${locale}/accedi`);
  const t = await getTranslations();
  const destinazione = dopo && dopo.startsWith("/") && !dopo.startsWith("//") ? dopo : `/${locale}`;
  return (
    <div className="space-y-5 pt-4">
      <h1 className="text-center text-3xl font-black tracking-tight">{t("benvenuto.titolo")}</h1>
      <div className="scheda">
        <FormProfilo nickname={profilo.nickname} paese={profilo.paese} dopo={destinazione} testoBottone={t("benvenuto.salva")} />
      </div>
    </div>
  );
}
