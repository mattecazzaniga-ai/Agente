import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { caricaTornei, mieiPronostici, notiziePubblicate, partiteAperte, sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import SchedaPartita from "@/components/SchedaPartita";
import SchedaNotizia from "@/components/SchedaNotizia";
import RigaTorneo from "@/components/RigaTorneo";
import Avviso from "@/components/Avviso";
import { IconaAmici, IconaCoppa, IconaPodio, Spiaggia } from "@/components/Icone";

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
        <section className="pt-2">
          <h1 className="text-3xl font-black tracking-tight">{t("home.ciao", { nome: profilo?.nickname ?? "" })}</h1>
          <p className="mt-1 text-nebbia">{t("home.ciaoSotto")}</p>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-[28px] bg-gradient-to-b from-cielo/70 via-onda to-sabbia">
            <div className="space-y-3 px-5 pb-2 pt-6">
              <h1 className="text-[28px] font-black leading-[1.1] tracking-tight">{t("home.titolo")}</h1>
              <p className="text-inchiostro/80">{t("home.intro")}</p>
            </div>
            <Spiaggia className="h-28 w-full" />
            <div className="space-y-3 bg-sabbia px-5 pb-5">
              <Link href="/accedi" className="bottone-sole">
                {t("home.inizia")}
              </Link>
              <Avviso grande />
            </div>
          </section>
          <Titolo>{t("home.comeFunziona")}</Titolo>
          <ol className="grid grid-cols-3 gap-2">
            {passi.map(({ Icona, titolo, testo, colore }, i) => (
              <li key={titolo} className="scheda flex flex-col items-center gap-2 p-3 text-center">
                <span className={`relative grid h-11 w-11 place-items-center rounded-2xl ${colore}`}>
                  <Icona className="h-6 w-6" />
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-inchiostro text-[11px] font-black text-white">{i + 1}</span>
                </span>
                <span className="text-sm font-extrabold leading-tight">{titolo}</span>
                <span className="text-xs leading-snug text-nebbia">{testo}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <Titolo>{t("home.daPronosticare")}</Titolo>
      {partite.length === 0 ? (
        <p className="scheda text-center text-nebbia">{t("home.nessunaAperta")}</p>
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
      <ul className="scheda divide-y divide-sabbia-scura/50 p-0">
        {tornei.length === 0 && <li className="p-4 text-sm text-nebbia">{t("tornei.nessuno")}</li>}
        {tornei.map((to) => (
          <li key={to.id}>
            <RigaTorneo torneo={to} />
          </li>
        ))}
      </ul>

      <Titolo link="/notizie" testoLink={t("home.vediTutti")}>
        {t("home.ultimeNotizie")}
      </Titolo>
      <div className="space-y-3">
        {notizie.length === 0 && <p className="scheda text-sm text-nebbia">{t("notizie.nessuna")}</p>}
        {notizie.map((n) => (
          <SchedaNotizia key={n.id} notizia={n} />
        ))}
      </div>
    </div>
  );
}
