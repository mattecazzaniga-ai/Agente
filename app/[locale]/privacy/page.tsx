import { getTranslations, setRequestLocale } from "next-intl/server";
import Avviso from "@/components/Avviso";
import Intestazione from "@/components/Intestazione";
import { FOTO } from "@/lib/foto";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("privacy.titolo") };
}

export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Intestazione titolo={t("privacy.titolo")} />
      <p className="leading-relaxed text-inchiostro/85">{t("privacy.testo")}</p>
      <Avviso grande />
      <section>
        <h2 className="titolo-sezione">{t("privacy.crediti")}</h2>
        <ul className="pannello divide-y divide-linea text-sm">
          {Object.values(FOTO).map((f) => (
            <li key={f.fonte} className="px-4 py-3">
              <p>{f.alt}</p>
              <p className="mt-0.5 text-tenue">
                <a href={f.fonte} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {f.autore} / Wikimedia Commons
                </a>{" "}
                ·{" "}
                <a href={f.urlLicenza} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {f.licenza}
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
