import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { sessione } from "@/lib/dati";
import FormAccesso from "./FormAccesso";
import Avviso from "@/components/Avviso";
import Image from "next/image";
import { FOTO } from "@/lib/foto";

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
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-xl border border-linea bg-carta md:grid-cols-[1fr_1.1fr]">
      <div className="group relative h-44 overflow-hidden md:h-auto">
        <Image src={FOTO.giocatrice.src} alt={FOTO.giocatrice.alt} placeholder="blur" fill sizes="(min-width: 768px) 420px, 100vw" className="foto-zoom object-cover object-[50%_25%]" />
              </div>
      <div className="space-y-5 p-5 sm:p-8">
        <div>
          <h1 className="titolo-pagina">{t("accedi.titolo")}</h1>
          <p className="mt-1.5 text-sm text-tenue">{t("accedi.sottotitolo")}</p>
        </div>
        <FormAccesso dopo={destinazione} google={process.env.NEXT_PUBLIC_GOOGLE_ABILITATO === "1"} />
        <Avviso grande />
      </div>
    </div>
  );
}
