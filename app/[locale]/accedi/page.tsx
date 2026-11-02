import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { sessione } from "@/lib/dati";
import FormAccesso from "./FormAccesso";
import Avviso from "@/components/Avviso";
import { Logo } from "@/components/Icone";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("accedi.titolo") };
}

export default async function Accedi({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ dopo?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { dopo } = await searchParams;
  const destinazione = dopo && dopo.startsWith("/") && !dopo.startsWith("//") ? dopo : `/${locale}`;
  const { user } = await sessione();
  if (user) redirect(destinazione);
  const t = await getTranslations();
  return (
    <div className="space-y-5 pt-4">
      <div className="text-center">
        <Logo className="mx-auto h-16 w-16" />
        <h1 className="mt-3 text-3xl font-black tracking-tight">{t("accedi.titolo")}</h1>
        <p className="mt-1 text-nebbia">{t("accedi.sottotitolo")}</p>
      </div>
      <div className="scheda">
        <FormAccesso dopo={destinazione} google={process.env.NEXT_PUBLIC_GOOGLE_ABILITATO === "1"} />
      </div>
      <Avviso grande />
    </div>
  );
}
