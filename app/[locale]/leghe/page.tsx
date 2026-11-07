import { redirect } from "next/navigation";
import Intestazione from "@/components/Intestazione";
import Vuoto from "@/components/Vuoto";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mieLeghe, sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { esciLega } from "../azioni";
import FormLeghe from "@/components/FormLeghe";
import Invita from "@/components/Invita";
import { IconaAmici, IconaPodio } from "@/components/Icone";

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
    <div>
      <Intestazione titolo={t("leghe.titolo")} sotto={t("leghe.sottotitoloPagina")} />
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8">
      <div>
      <h2 className="titolo-sezione">{t("leghe.mie")}</h2>
      {leghe.length === 0 && <Vuoto testo={t("leghe.nessuna")} />}
      <div className="space-y-3">
      {leghe.map((l) => (
        <div key={l.id} className="pannello space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold uppercase tracking-tight">{l.nome}</p>
              <p className="flex items-center gap-2 text-sm text-tenue">
                <span className="cifre tracking-[.2em] text-testo">{l.codice}</span>
                <span className="inline-flex items-center gap-1">
                  <IconaAmici className="h-4 w-4" /> {l.membri}
                </span>
              </p>
            </div>
            <Link href={`/classifica?ambito=lega&lega=${l.id}`} className="chip py-1.5">
              <IconaPodio className="h-4 w-4" /> {t("leghe.classifica")}
            </Link>
          </div>
          <Invita nome={l.nome} codice={l.codice} sito={sito} />
          <form action={esciLega}>
            <input type="hidden" name="lega" value={l.id} />
            <button className="text-xs text-tenue underline-offset-2 hover:text-corallo hover:underline">{t("leghe.esci")}</button>
          </form>
        </div>
      ))}
      </div>
      </div>
      <aside>
        <h2 className="titolo-sezione">{t("leghe.entraOCrea")}</h2>
        <FormLeghe sito={sito} />
      </aside>
      </div>
    </div>
  );
}
