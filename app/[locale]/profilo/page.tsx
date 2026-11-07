import { redirect } from "next/navigation";
import Intestazione from "@/components/Intestazione";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sessione, storicoPronostici, type PartitaConCoppie } from "@/lib/dati";
import { meseIso, nomeMese } from "@/lib/formato";
import RigaPartita from "@/components/RigaPartita";
import Vuoto from "@/components/Vuoto";
import { urlAccesso } from "@/lib/sito";
import { esci, eliminaAccount } from "../azioni";
import FormProfilo from "@/components/FormProfilo";
import FormPassword from "@/components/FormPassword";
import BottoneConferma from "@/components/BottoneConferma";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("profilo.titolo") };
}

export default async function Profilo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, profilo, supabase } = await sessione();
  if (!user || !profilo) redirect(urlAccesso(locale, `/${locale}/profilo`));
  const t = await getTranslations();
  const mese = meseIso();
  const [storico, { data: mia }] = await Promise.all([storicoPronostici(user.id, 200), supabase.rpc("mia_posizione", { p_mese: mese })]);
  const io = (mia as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0];
  // statistiche solo sui pronostici già valutati (partite concluse)
  const valutati = storico.filter((x) => x.mio.punti != null);
  const vincitori = valutati.filter((x) => (x.mio.punti_vincitore ?? 0) > 0).length;
  const puntiTotali = valutati.reduce((tot, x) => tot + (x.mio.punti ?? 0), 0);
  const link = (p: PartitaConCoppie) => `/tornei/${p.tabellone.torneo.id}?${new URLSearchParams({ tab: p.tabellone.genere, turno: p.turno })}#p-${p.id}`;
  const numeri: [string, string][] = [
    [io ? `${io.posizione}°` : "—", t("home.posizione", { mese: nomeMese(mese, locale) })],
    [String(io?.punti ?? 0), t("profilo.puntiMese", { mese: nomeMese(mese, locale) })],
    [String(storico.length), t("profilo.pronostici")],
    [valutati.length ? `${Math.round((vincitori / valutati.length) * 100)}%` : "—", t("profilo.vincitoriPercentuale", { n: vincitori, totale: valutati.length })],
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Intestazione titolo={profilo.nickname} sotto={user.email ?? ""} />
      <dl className="pannello grid grid-cols-2 divide-linea overflow-hidden sm:grid-cols-4 sm:divide-x [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(-n+2)]:border-linea sm:[&>div:nth-child(-n+2)]:border-b-0 [&>div:nth-child(odd)]:border-r [&>div:nth-child(odd)]:border-linea sm:[&>div:nth-child(odd)]:border-r-0">
        {numeri.map(([valore, etichetta], i) => (
          <div key={i} className="flex flex-col p-4">
            <dt className="order-last mt-1.5 text-xs font-semibold leading-snug text-tenue">{etichetta}</dt>
            <dd className={`cifre text-4xl leading-none ${i === 0 && io ? "text-viola" : ""}`}>{valore}</dd>
          </div>
        ))}
      </dl>
      {valutati.length > 0 && <p className="px-1 text-xs text-tenue">{t("profilo.puntiTotali", { punti: puntiTotali, partite: valutati.length })}</p>}

      <h2 className="titolo-sezione">{t("profilo.storico")}</h2>
      {storico.length === 0 ? (
        <Vuoto testo={t("profilo.storicoVuoto")} azione={t("classifica.vaiAPronosticare")} link="/tornei" />
      ) : (
        <ul className="pannello divide-y divide-linea overflow-hidden">
          {storico.map(({ partita: p, mio }) => (
            <li key={p.id}>
              <RigaPartita partita={p} a={p.coppia_a} b={p.coppia_b} mio={mio} href={link(p)} sopra={`${p.tabellone.torneo.nome} · ${t(`turno.${p.turno}`)}`} />
            </li>
          ))}
        </ul>
      )}
      {storico.length > 0 && <p className="px-1 text-xs text-tenue">{t("profilo.storicoAiuto")}</p>}
      {profilo.is_admin && (
        <Link href="/admin" className="pannello solleva mt-4 flex items-center justify-between gap-3 p-4">
          <span>
            <span className="block font-semibold">{t("profilo.pannelloAdmin")}</span>
            <span className="block text-sm text-tenue">{t("profilo.pannelloAdminSotto")}</span>
          </span>
          <span className="bottone w-auto px-4">{t("nav.admin")}</span>
        </Link>
      )}
      <h2 className="titolo-sezione">{t("profilo.impostazioni")}</h2>
      <div className="scheda">
        <FormProfilo nickname={profilo.nickname} paese={profilo.paese} testoBottone={t("profilo.salva")} />
      </div>
      <h2 className="titolo-sezione">{t("profilo.passwordTitolo")}</h2>
      <div className="scheda">
        <FormPassword />
      </div>
      <form action={esci}>
        <input type="hidden" name="lingua" value={locale} />
        <button className="bottone-secondario">{t("profilo.esci")}</button>
      </form>
      <form action={eliminaAccount} className="pt-6 text-center">
        <input type="hidden" name="lingua" value={locale} />
        <BottoneConferma messaggio={t("profilo.eliminaConferma")} className="text-sm font-semibold text-corallo underline-offset-2 hover:underline">
          {t("profilo.elimina")}
        </BottoneConferma>
      </form>
      <p className="text-center">
        <Link href="/privacy" className="text-xs text-tenue underline">
          {t("profilo.privacy")}
        </Link>
      </p>
    </div>
  );
}
