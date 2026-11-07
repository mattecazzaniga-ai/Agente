import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { sessione } from "@/lib/dati";
import FormAccesso from "./FormAccesso";
import Avviso from "@/components/Avviso";
import Image from "next/image";
import { FOTO } from "@/lib/foto";
import CreditoFoto from "@/components/CreditoFoto";

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
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-xl border border-linea bg-pannello md:grid-cols-[1fr_1.1fr]">
      <div className="relative h-44 md:h-auto">
        <Image src={FOTO.giocatrice.src} alt={FOTO.giocatrice.alt} placeholder="blur" fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover object-[50%_25%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-pannello via-pannello/30 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-pannello/80" aria-hidden />
        <CreditoFoto foto={FOTO.giocatrice} className="absolute bottom-2 left-3" />
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
