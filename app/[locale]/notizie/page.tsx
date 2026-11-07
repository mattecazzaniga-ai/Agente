import { getTranslations, setRequestLocale } from "next-intl/server";
import Intestazione from "@/components/Intestazione";
import Vuoto from "@/components/Vuoto";
import { diarioRecente, notiziePubblicate } from "@/lib/dati";
import SchedaNotizia from "@/components/SchedaNotizia";
import Diario from "@/components/Diario";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("notizie.titolo") };
}

/** Notizie: il diario dei tornei (dai risultati veri) e la rassegna curata dall'admin (link alle fonti). */
export default async function Notizie({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, notizie, diario] = await Promise.all([getTranslations(), notiziePubblicate(locale, 50), diarioRecente(16)]);
  return (
    <div>
      <Intestazione titolo={t("notizie.titolo")} sotto={t("notizie.sottotitoloPagina")} />
      {diario.length > 0 && (
        <section>
          <h2 className="titolo-sezione">{t("diario.titolo")}</h2>
          <p className="-mt-2 mb-3 text-sm text-tenue">{t("diario.sotto")}</p>
          <Diario voci={diario} />
        </section>
      )}
      {notizie.length > 0 && (
        <section>
          <h2 className="titolo-sezione">{t("diario.curate")}</h2>
          <div className="space-y-3">
            {notizie.map((n) => (
              <SchedaNotizia key={n.id} notizia={n} />
            ))}
          </div>
        </section>
      )}
      {notizie.length === 0 && diario.length === 0 && (
        <div className="mt-4">
          <Vuoto testo={t("notizie.nessuna")} />
        </div>
      )}
      {diario.length > 0 && <p className="mt-4 px-1 text-xs text-tenue">{t("diario.fonteDati")}</p>}
    </div>
  );
}
