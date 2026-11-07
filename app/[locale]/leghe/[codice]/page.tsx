import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import FormLeghe from "@/components/FormLeghe";
import Avviso from "@/components/Avviso";
import { IconaAmici } from "@/components/Icone";

export const dynamic = "force-dynamic";

/** Pagina del link d'invito: mostra la lega, fa accedere se serve e poi entrare con un tocco. */
export default async function Invito({ params }: { params: Promise<{ locale: string; codice: string }> }) {
  const { locale, codice: grezzo } = await params;
  setRequestLocale(locale);
  const codice = grezzo.toUpperCase();
  const t = await getTranslations();
  const { supabase, user } = await sessione();
  const { data } = /^[A-Z2-9]{6}$/.test(codice) ? await supabase.rpc("lega_da_codice", { p_codice: codice }) : { data: null };
  const lega = (data as { id: string; nome: string; membri: number }[] | null)?.[0];
  if (!lega) {
    return (
      <div className="scheda mt-4 space-y-3 text-center">
        <p className="font-semibold">{t("leghe.invitoNonTrovato")}</p>
        <Link href="/leghe" className="bottone">
          {t("leghe.titolo")}
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-5 pt-2">
      <div className="border-b border-linea pb-4">
        <p className=" text-sm font-semibold tracking-[.14em] text-mare">{t("leghe.titolo")}</p>
        <h1 className="titolo-pagina mt-1">{t("leghe.invitoTitolo", { nome: lega.nome })}</h1>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-tenue">
          <IconaAmici className="h-4 w-4" /> {lega.membri}
        </p>
      </div>
      {user ? (
        <FormLeghe sito={await indirizzoSito()} codiceIniziale={codice} soloEntra />
      ) : (
        <a href={urlAccesso(locale, `/${locale}/leghe/${codice}`)} className="bottone">
          {t("leghe.entraOra")}
        </a>
      )}
      <Avviso grande />
    </div>
  );
}
