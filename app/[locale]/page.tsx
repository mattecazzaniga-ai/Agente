import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { caricaTornei, mieiPronostici, notiziePubblicate, partiteAperte, sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import SchedaPartita from "@/components/SchedaPartita";
import SchedaNotizia from "@/components/SchedaNotizia";
import RigaTorneo from "@/components/RigaTorneo";
import Avviso from "@/components/Avviso";
import { IconaAmici, IconaCoppa, IconaPodio, Spiaggia } from "@/components/Icone";
import Vuoto from "@/components/Vuoto";

export const dynamic = "force-dynamic";

function Titolo({ children, link, testoLink }: { children: React.ReactNode; link?: string; testoLink?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between">
      <h2 className="text-xl font-extrabold tracking-tight">{children}</h2>
      {link && (
        <Link href={link} className="text-sm font-bold text-mare">
          {testoLink} →
        </Link>
      )}
    </div>
  );
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [{ user, profilo }, partite, inCorso, prossimi, notizie, sito] = await Promise.all([
    sessione(),
    partiteAperte(6),
    caricaTornei("in_corso", 5),
    caricaTornei("in_programma", 5),
    notiziePubblicate(locale, 3),
    indirizzoSito(),
  ]);
  const miei = user ? await mieiPronostici([], partite.map((p) => p.id)) : null;
  const tornei = [...inCorso, ...prossimi].slice(0, 4);
  const passi = [
    { Icona: IconaCoppa, titolo: t("home.passo1t"), testo: t("home.passo1"), colore: "bg-onda text-mare" },
    { Icona: IconaPodio, titolo: t("home.passo2t"), testo: t("home.passo2"), colore: "bg-sole-chiaro text-inchiostro" },
    { Icona: IconaAmici, titolo: t("home.passo3t"), testo: t("home.passo3"), colore: "bg-menta-chiaro text-menta" },
  ];

  return (
    <div>
      {user ? (
        <section className="eroe relative overflow-hidden rounded-[28px] px-5 pb-5 pt-6 text-white shadow-[0_18px_40px_-20px_rgba(7,91,120,.8)]">
          <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sole/90" aria-hidden />
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sole/20" aria-hidden />
          <h1 className="relative text-3xl font-black tracking-tight">{t("home.ciao", { nome: profilo?.nickname ?? "" })}</h1>
          <p className="relative mt-1 text-white/85">{t("home.ciaoSotto")}</p>
          <div className="relative mt-4 flex gap-2">
            <Link href="/tornei" className="rounded-full bg-sole px-4 py-2 text-sm font-extrabold text-inchiostro">{t("nav.tornei")}</Link>
            <Link href="/classifica" className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/30">{t("nav.classifica")}</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="eroe overflow-hidden rounded-[28px] text-white shadow-[0_18px_40px_-20px_rgba(7,91,120,.8)]">
            <div className="space-y-3 px-5 pb-1 pt-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wider ring-1 ring-white/25">🎾 ITF Beach Tennis</span>
              <h1 className="text-[32px] font-black leading-[1.05] tracking-tight">{t("home.titolo")}</h1>
              <p className="text-white/85">{t("home.intro")}</p>
            </div>
            <Spiaggia className="-mb-px h-28 w-full" />
            <div className="space-y-3 bg-sabbia px-5 pb-5">
              <Link href="/accedi" className="bottone-sole">
                {t("home.inizia")}
              </Link>
              <Avviso grande />
            </div>
          </section>
          <Titolo>{t("home.comeFunziona")}</Titolo>
          <ol className="scheda divide-y divide-sabbia-scura/40 p-0">
            {passi.map(({ Icona, titolo, testo, colore }, i) => (
              <li key={titolo} className="flex items-center gap-4 px-4 py-3.5">
                <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${colore}`}>
                  <Icona className="h-6 w-6" />
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-inchiostro text-[11px] font-black text-white ring-2 ring-white">{i + 1}</span>
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold leading-tight">{titolo}</span>
                  <span className="block text-sm leading-snug text-nebbia">{testo}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <Titolo>{t("home.daPronosticare")}</Titolo>
      {partite.length === 0 ? (
        <Vuoto emoji="🏖️" testo={t("home.nessunaAperta")} colore="bg-sole-chiaro" />
      ) : (
        <div className="space-y-4">
          {partite.map((p) => (
            <SchedaPartita
              key={p.id}
              partita={p}
              a={p.coppia_a}
              b={p.coppia_b}
              mio={miei?.partita.get(p.id) ?? null}
              voti={{}}
              collegato={Boolean(user)}
              urlAccesso={urlAccesso(locale, `/${locale}`)}
              sito={sito}
              descrizione={`${p.tabellone.torneo.nome} · ${t(`turno.${p.turno}`)}`}
              intestazione={
                <Link href={`/tornei/${p.tabellone.torneo.id}`} className="font-bold text-inchiostro">
                  {p.tabellone.torneo.nome} <span className="font-medium text-nebbia">· {t(`turno.${p.turno}`)}</span>
                </Link>
              }
            />
          ))}
        </div>
      )}

      <Titolo link="/tornei" testoLink={t("home.vediTutti")}>
        {t("home.prossimiTornei")}
      </Titolo>
      {tornei.length === 0 ? (
        <Vuoto emoji="📅" testo={t("tornei.nessuno")} />
      ) : (
      <ul className="scheda divide-y divide-sabbia-scura/50 p-0">
        {tornei.map((to) => (
          <li key={to.id}>
            <RigaTorneo torneo={to} />
          </li>
        ))}
      </ul>
      )}

      <Titolo link="/notizie" testoLink={t("home.vediTutti")}>
        {t("home.ultimeNotizie")}
      </Titolo>
      <div className="space-y-3">
        {notizie.length === 0 && <Vuoto emoji="📰" testo={t("notizie.nessuna")} colore="bg-menta-chiaro" />}
        {notizie.map((n) => (
          <SchedaNotizia key={n.id} notizia={n} />
        ))}
      </div>
    </div>
  );
}
