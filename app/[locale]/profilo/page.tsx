import { redirect } from "next/navigation";
import Intestazione from "@/components/Intestazione";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { podiMesiChiusi, podiTornei, sessione, storicoPronostici, type PartitaConCoppie } from "@/lib/dati";
import { calcolaTrofei, medagliePerUtente } from "@/lib/trofei";
import { Bacheca } from "@/components/Trofei";
import { meseIso, nomeMese } from "@/lib/formato";
import RigaPartita from "@/components/RigaPartita";
import Vuoto from "@/components/Vuoto";
import { statistichePersonali } from "@/lib/statistiche";
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
  const [storico, { data: mia }, podi, podiT] = await Promise.all([storicoPronostici(user.id, 500), supabase.rpc("mia_posizione", { p_mese: mese }), podiMesiChiusi(), podiTornei()]);
  const nessuna = { oro: 0, argento: 0, bronzo: 0 };
  const trofei = calcolaTrofei(storico, medagliePerUtente(podi).get(user.id) ?? nessuna, medagliePerUtente([podiT]).get(user.id) ?? nessuna);
  const io = (mia as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0];
  // statistiche solo sui pronostici già valutati (partite concluse)
  const valutati = storico.filter((x) => x.mio.punti != null);
  const vincitori = valutati.filter((x) => (x.mio.punti_vincitore ?? 0) > 0).length;
  const puntiTotali = valutati.reduce((tot, x) => tot + (x.mio.punti ?? 0), 0);
  const st = statistichePersonali(storico);
  const migliore = st.migliore ? storico.find((x) => x.partita.id === st.migliore!.partitaId) : undefined;
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

      <div className="pt-4">
        <Bacheca trofei={trofei} titolo={t("profilo.trofei")} />
      </div>
      <p className="px-1 text-right text-sm">
        <Link href={`/giocatore/${user.id}`} className="font-semibold text-viola">
          {t("giocatore.vediPubblico")} →
        </Link>
      </p>

      <h2 className="titolo-sezione">{t("statistiche.tueTitolo")}</h2>
      {st.valutati === 0 ? (
        <p className="scheda text-sm text-tenue">{t("statistiche.nessunaValutata")}</p>
      ) : (
        <section className="pannello overflow-hidden">
          <div className="flex items-center gap-4 border-b border-linea p-4">
            <p className={`cifre text-6xl leading-none ${st.serieAttuale > 0 ? "text-viola" : "text-tenue"}`}>{st.serieAttuale}</p>
            <div>
              <p className="font-semibold leading-tight">{t("statistiche.serie")}</p>
              <p className="text-sm text-tenue">{t("statistiche.serieMigliore", { n: st.serieMigliore })}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 [&>div]:border-linea [&>div:nth-child(odd)]:border-r sm:[&>div]:border-r [&>div:nth-child(-n+2)]:border-b sm:[&>div:nth-child(-n+2)]:border-b-0 sm:[&>div:last-child]:border-r-0">
            {(
              [
                [String(st.media ?? "—").replace(".", ","), t("statistiche.media")],
                [`${st.setVinti}/${st.valutati}`, t("statistiche.setVinti")],
                [String(st.setEsatti), t("statistiche.setEsatti")],
                [String(st.longEsatti), t("statistiche.longEsatti")],
              ] as [string, string][]
            ).map(([v, e]) => (
              <div key={e} className="flex flex-col p-4">
                <dt className="order-last mt-1 text-xs font-semibold leading-snug text-tenue">{e}</dt>
                <dd className="cifre text-3xl leading-none">{v}</dd>
              </div>
            ))}
          </dl>
          {migliore && (
            <Link href={link(migliore.partita)} className="flex items-center justify-between gap-3 border-t border-linea bg-sole-chiaro/60 px-4 py-3 transition hover:bg-sole-chiaro">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-tenue">{t("statistiche.migliore")}</span>
                <span className="block truncate font-semibold">
                  {migliore.partita.coppia_a?.g1.cognome}/{migliore.partita.coppia_a?.g2.cognome} vs {migliore.partita.coppia_b?.g1.cognome}/{migliore.partita.coppia_b?.g2.cognome}
                </span>
              </span>
              <span className="cifre shrink-0 text-3xl text-viola">+{st.migliore!.punti}</span>
            </Link>
          )}
        </section>
      )}

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
