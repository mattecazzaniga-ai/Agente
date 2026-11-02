import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mieLeghe, sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { esciLega } from "../azioni";
import FormLeghe from "@/components/FormLeghe";
import Invita from "@/components/Invita";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("leghe.titolo") };
}

export default async function Leghe({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await sessione();
  if (!user) redirect(urlAccesso(locale, `/${locale}/leghe`));
  const [t, leghe, sito] = await Promise.all([getTranslations(), mieLeghe(), indirizzoSito()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("leghe.titolo")}</h1>
      <FormLeghe sito={sito} />
      <h2 className="titolo-sezione">{t("leghe.mie")}</h2>
      {leghe.length === 0 && <p className="scheda text-sm text-nebbia">{t("leghe.nessuna")}</p>}
      {leghe.map((l) => (
        <div key={l.id} className="scheda space-y-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{l.nome}</p>
              <p className="text-xs text-nebbia">
                <span className="font-mono tracking-widest">{l.codice}</span> · 👥 {l.membri}
              </p>
            </div>
            <Link href={`/classifica?ambito=lega&lega=${l.id}`} className="chip py-1.5">
              📊 {t("leghe.classifica")}
            </Link>
          </div>
          <Invita nome={l.nome} codice={l.codice} sito={sito} />
          <form action={esciLega}>
            <input type="hidden" name="lega" value={l.id} />
            <button className="text-xs text-nebbia underline">{t("leghe.esci")}</button>
          </form>
        </div>
      ))}
    </div>
  );
}
