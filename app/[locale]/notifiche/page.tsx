import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Intestazione from "@/components/Intestazione";
import Vuoto from "@/components/Vuoto";
import SegnaVisti from "@/components/SegnaVisti";
import Tra from "@/components/Tra";
import { sessione } from "@/lib/dati";
import { avvisiUtente, type TipoAvviso } from "@/lib/notifiche";
import { urlAccesso } from "@/lib/sito";
import { dataOra } from "@/lib/formato";
import { IconaAmici, IconaNotizie, IconaOrologio, IconaStella } from "@/components/Icone";

export const dynamic = "force-dynamic";

const STILE: Record<TipoAvviso, { Icona: typeof IconaStella; colore: string }> = {
  scadenza: { Icona: IconaOrologio, colore: "bg-corallo/10 text-corallo" },
  punti: { Icona: IconaStella, colore: "bg-viola/10 text-viola" },
  notizia: { Icona: IconaNotizie, colore: "bg-sabbia-2 text-inchiostro" },
  lega: { Icona: IconaAmici, colore: "bg-sole-chiaro text-inchiostro" },
};

/** Gli avvisi di chi gioca: partite che chiudono, punti arrivati, notizie, nuovi membri nelle leghe. */
export default async function Notifiche({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await sessione();
  if (!user) redirect(urlAccesso(locale, `/${locale}/notifiche`));
  const [t, avvisi] = await Promise.all([getTranslations(), avvisiUtente(user.id)]);
  return (
    <div className="mx-auto max-w-2xl">
      <SegnaVisti />
      <Intestazione titolo={t("avvisi.titolo")} sotto={t("avvisi.sotto")} />
      {avvisi.length === 0 ? (
        <div className="mt-4">
          <Vuoto testo={t("avvisi.nessuno")} azione={t("home.daPronosticare")} link="/tornei" />
        </div>
      ) : (
        <ul className="pannello mt-4 divide-y divide-linea overflow-hidden">
          {avvisi.map((a, i) => {
            const { Icona, colore } = STILE[a.tipo];
            return (
              <li key={i}>
                <Link href={a.link} className="flex gap-3 px-4 py-3 transition hover:bg-sabbia-2">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${colore}`}>
                    <Icona className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {a.tipo === "scadenza" ? (
                        <>
                          {t("avvisi.scadenza")} <Tra iso={a.quando} />
                        </>
                      ) : a.tipo === "punti" ? (
                        t("avvisi.punti", { punti: a.punti ?? 0 })
                      ) : a.tipo === "notizia" ? (
                        t("avvisi.notizia")
                      ) : (
                        t("avvisi.lega", { nome: a.titolo, lega: a.dettaglio ?? "" })
                      )}
                    </span>
                    {a.tipo !== "lega" && <span className="block truncate text-sm text-inchiostro/80">{a.titolo}</span>}
                    <span className="block text-xs text-tenue">
                      {a.tipo === "scadenza" || a.tipo === "punti" ? `${a.dettaglio} · ` : ""}
                      {dataOra(a.quando, locale)}
                    </span>
                  </span>
                  {a.tipo === "punti" && <span className={`cifre self-center text-2xl ${a.punti ? "text-viola" : "text-tenue"}`}>+{a.punti}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 px-1 text-xs text-tenue">{t("avvisi.nota")}</p>
    </div>
  );
}
