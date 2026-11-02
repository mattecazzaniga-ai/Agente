import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { caricaTornei, mieiPronostici, notiziePubblicate, partiteAperte, sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { bandiera, data } from "@/lib/formato";
import SchedaPartita from "@/components/SchedaPartita";
import SchedaNotizia from "@/components/SchedaNotizia";
import Avviso from "@/components/Avviso";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [{ user }, partite, inCorso, prossimi, notizie, sito] = await Promise.all([
    sessione(),
    partiteAperte(6),
    caricaTornei("in_corso", 5),
    caricaTornei("in_programma", 5),
    notiziePubblicate(locale, 3),
    indirizzoSito(),
  ]);
  const miei = user ? await mieiPronostici([], partite.map((p) => p.id)) : null;
  const tornei = [...inCorso, ...prossimi].slice(0, 5);

  return (
    <div>
      {!user && (
        <section className="scheda space-y-3 bg-gradient-to-br from-mare to-mare-scuro text-white">
          <h1 className="text-2xl font-extrabold leading-tight">{t("home.titolo")}</h1>
          <p className="text-white/85">{t("home.intro")}</p>
          <Link href="/accedi" className="bottone bg-sole text-inchiostro">
            {t("home.inizia")}
          </Link>
          <p className="text-center text-xs text-white/75">{t("avviso")}</p>
        </section>
      )}

      <h2 className="titolo-sezione">{t("home.daPronosticare")}</h2>
      {partite.length === 0 ? (
        <p className="scheda text-sm text-nebbia">{t("home.nessunaAperta")}</p>
      ) : (
        <div className="space-y-3">
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
                <Link href={`/tornei/${p.tabellone.torneo.id}`} className="truncate font-semibold text-mare">
                  {p.tabellone.torneo.nome} · {t(`genere.${p.tabellone.genere}`)} · {t(`turno.${p.turno}`)}
                </Link>
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="titolo-sezione">{t("home.prossimiTornei")}</h2>
        <Link href="/tornei" className="text-sm font-semibold text-mare">
          {t("home.vediTutti")}
        </Link>
      </div>
      <ul className="scheda divide-y divide-sabbia p-0">
        {tornei.length === 0 && <li className="p-4 text-sm text-nebbia">{t("tornei.nessuno")}</li>}
        {tornei.map((to) => (
          <li key={to.id}>
            <Link href={`/tornei/${to.id}`} className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl" aria-hidden>{bandiera(to.paese)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{to.nome}</span>
                <span className="block text-xs text-nebbia">
                  {to.luogo} · {t("tornei.dal", { inizio: data(to.data_inizio, locale), fine: data(to.data_fine, locale) })}
                </span>
              </span>
              <span className="chip">{to.circuito}</span>
              {to.stato === "in_corso" && <span className="chip bg-sole/30 text-inchiostro">{t("stato.in_corso")}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between">
        <h2 className="titolo-sezione">{t("home.ultimeNotizie")}</h2>
        <Link href="/notizie" className="text-sm font-semibold text-mare">
          {t("home.vediTutti")}
        </Link>
      </div>
      <div className="space-y-3">
        {notizie.length === 0 && <p className="scheda text-sm text-nebbia">{t("notizie.nessuna")}</p>}
        {notizie.map((n) => (
          <SchedaNotizia key={n.id} notizia={n} />
        ))}
      </div>
      <div className="mt-6">
        <Avviso grande />
      </div>
    </div>
  );
}
