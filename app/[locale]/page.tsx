import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { caricaTornei, mieiPronostici, notiziePubblicate, partiteAperte, partiteInCorso, sessione, ultimiRisultati, type PartitaConCoppie } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { bandiera, meseIso, nomeMese } from "@/lib/formato";
import { FOTO } from "@/lib/foto";
import type { RigaClassifica } from "@/lib/tipi";
import SchedaPartita from "@/components/SchedaPartita";
import RigaPartita from "@/components/RigaPartita";
import SchedaNotizia from "@/components/SchedaNotizia";
import RigaTorneo from "@/components/RigaTorneo";
import Vuoto from "@/components/Vuoto";
import { Marchio } from "@/components/Icone";

export const dynamic = "force-dynamic";

function Sezione({ titolo, link, testoLink, children, conteggio }: { titolo: string; link?: string; testoLink?: string; children: React.ReactNode; conteggio?: number }) {
  return (
    <section>
      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="titolo-sezione my-0">
          {titolo}
          {conteggio ? <span className="cifre rounded bg-sabbia-2 px-1.5 text-[13px] text-inchiostro">{conteggio}</span> : null}
        </h2>
        {link && (
          <Link href={link} className=" text-[13px] font-semibold text-viola hover:text-viola-scuro">
            {testoLink} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const mese = meseIso();
  const [{ user, profilo, supabase }, aperte, live, risultati, inCorso, prossimi, notizie, sito] = await Promise.all([
    sessione(),
    partiteAperte(8),
    partiteInCorso(6),
    ultimiRisultati(6),
    caricaTornei("in_corso", 4),
    caricaTornei("in_programma", 4),
    notiziePubblicate(locale, 3),
    indirizzoSito(),
  ]);
  const [{ data: classifica }, { data: mia }, miei] = await Promise.all([
    supabase.rpc("classifica", { p_mese: mese, p_limite: 5 }),
    user ? supabase.rpc("mia_posizione", { p_mese: mese }) : Promise.resolve({ data: null }),
    user ? mieiPronostici([], [...aperte, ...live, ...risultati].map((p) => p.id)) : Promise.resolve(null),
  ]);
  const primi = (classifica as RigaClassifica[] | null) ?? [];
  const io = (mia as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0];
  const tornei = [...inCorso, ...prossimi].slice(0, 4);
  const [inEvidenza, ...altreAperte] = aperte;
  const daFare = user ? aperte.filter((p) => !miei?.partita.has(p.id)).length : aperte.length;

  const link = (p: PartitaConCoppie) => `/tornei/${p.tabellone.torneo.id}?${new URLSearchParams({ tab: p.tabellone.genere, turno: p.turno })}#p-${p.id}`;
  const riga = (p: PartitaConCoppie) => (
    <li key={p.id}>
      <RigaPartita partita={p} a={p.coppia_a} b={p.coppia_b} mio={miei?.partita.get(p.id) ?? null} href={link(p)} sopra={`${p.tabellone.torneo.nome} · ${t(`turno.${p.turno}`)}`} />
    </li>
  );
  const passi = [t("home.passo1"), t("home.passo2"), t("home.passo3")];

  return (
    <div>
      {!user && (
        /* Apertura per chi arriva: il logo in grande sul crema, la promessa, e la spiaggia accanto */
        <section className="relative -mx-4 -mt-5 overflow-hidden border-b border-linea bg-carta sm:mx-0 sm:mt-0 sm:rounded-2xl sm:border md:grid md:grid-cols-[1.05fr_1fr]">
          <div className="relative px-5 pb-6 pt-5 sm:px-8 sm:pb-8">
            <span className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sole/20 blur-2xl" aria-hidden />
            <Marchio className="relative h-auto w-full max-w-[340px]" />
            <h1 className="relative mt-3 max-w-[18ch] font-display text-[38px] font-bold leading-[1.02] text-inchiostro sm:text-5xl">{t("home.titolo")}</h1>
            <p className="relative mt-3 max-w-md text-base leading-snug text-tenue">{t("home.intro")}</p>
            {inEvidenza && (
              <Link href={link(inEvidenza)} className="relative mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-sole-chiaro px-3.5 text-sm font-semibold text-inchiostro ring-1 ring-sole/50 transition hover:-translate-y-px">
                <span className="punto-live" />
                <span className="cifre text-lg leading-none text-viola">{aperte.length}</span>
                <span>{t("home.aperteOra", { torneo: inEvidenza.tabellone.torneo.nome })}</span>
              </Link>
            )}
            <div className="relative mt-5 flex flex-wrap gap-3">
              <Link href="/accedi" className="bottone w-auto px-6">
                {t("home.inizia")}
              </Link>
              <a href="#come-funziona" className="bottone-secondario w-auto px-5">
                {t("home.comeFunziona")}
              </a>
            </div>
          </div>
          <div className="group relative h-56 overflow-hidden md:h-auto">
            <Image src={FOTO.duello.src} alt={FOTO.duello.alt} priority placeholder="blur" fill sizes="(min-width: 768px) 540px, 100vw" className="foto-zoom object-cover object-[50%_38%]" />
          </div>
        </section>
      )}

      {/* Apertura per chi gioca: la spiaggia, il saluto e subito la situazione */}
      {user && (
      <section className="group relative -mx-4 -mt-5 overflow-hidden border-b border-linea sm:mx-0 sm:mt-0 sm:rounded-2xl sm:border">
        <Image src={FOTO.duello.src} alt={FOTO.duello.alt} priority placeholder="blur" sizes="(min-width: 1152px) 1120px, 100vw" className="foto-zoom h-56 w-full object-cover object-[50%_38%] sm:h-72" />
        <div className="velo absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 text-white sm:px-6 sm:pb-6">
          {user ? (
            <>
              <p className="flex items-center gap-2 text-base font-semibold text-white"><span className="h-2.5 w-2.5 rounded-full bg-sole" aria-hidden />{t("home.ciao", { nome: profilo?.nickname ?? "" })}</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="cifre text-5xl leading-none">{io ? `${io.posizione}°` : "—"}</p>
                  <p className="mt-1 text-sm text-white/80">{t("home.posizione", { mese: nomeMese(mese, locale) })}</p>
                </div>
                <div>
                  <p className="cifre text-5xl leading-none">{io?.punti ?? 0}</p>
                  <p className="mt-1 text-sm text-white/80">{t("classifica.punti")}</p>
                </div>
                <div>
                  <p className={`cifre text-5xl leading-none ${daFare ? "text-sole" : ""}`}>{daFare}</p>
                  <p className="mt-1 text-sm text-white/80">{t("home.daFare")}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
      )}

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:gap-8">
        <div>
          <Sezione titolo={t("home.daPronosticare")} conteggio={aperte.length} link="/tornei" testoLink={t("home.vediTutti")}>
            {!inEvidenza ? (
              <Vuoto testo={t("home.nessunaAperta")} azione={t("home.prossimiTornei")} link="/tornei" />
            ) : (
              <div className="space-y-3">
                <div id={`p-${inEvidenza.id}`}>
                  <SchedaPartita
                    partita={inEvidenza}
                    a={inEvidenza.coppia_a}
                    b={inEvidenza.coppia_b}
                    mio={miei?.partita.get(inEvidenza.id) ?? null}
                    voti={{}}
                    collegato={Boolean(user)}
                    urlAccesso={urlAccesso(locale, `/${locale}`)}
                    sito={sito}
                    descrizione={`${inEvidenza.tabellone.torneo.nome} · ${t(`turno.${inEvidenza.turno}`)}`}
                    intestazione={
                      <Link href={link(inEvidenza)} className="hover:text-inchiostro">
                        {inEvidenza.tabellone.torneo.nome} · {t(`turno.${inEvidenza.turno}`)}
                      </Link>
                    }
                  />
                </div>
                {altreAperte.length > 0 && <ul className="pannello divide-y divide-linea overflow-hidden">{altreAperte.map(riga)}</ul>}
              </div>
            )}
          </Sezione>

          {live.length > 0 && (
            <Sezione titolo={t("home.inCorso")}>
              <ul className="pannello divide-y divide-linea overflow-hidden">{live.map(riga)}</ul>
            </Sezione>
          )}

          {risultati.length > 0 && (
            <Sezione titolo={t("home.ultimiRisultati")}>
              <ul className="pannello divide-y divide-linea overflow-hidden">{risultati.map(riga)}</ul>
            </Sezione>
          )}

          {!user && (
            <section id="come-funziona" className="scroll-mt-20">
              <h2 className="titolo-sezione">{t("home.comeFunziona")}</h2>
              <ol className="pannello grid divide-y divide-linea sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {passi.map((testo, i) => (
                  <li key={i} className="flex gap-3 p-4 sm:block">
                    <span className="cifre text-3xl leading-none text-viola">0{i + 1}</span>
                    <p className="text-[15px] leading-snug text-inchiostro/90 sm:mt-2">{testo}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside>
          <Sezione titolo={t("home.classificaMese", { mese: nomeMese(mese, locale) })} link="/classifica" testoLink={t("home.vediTutti")}>
            {primi.length === 0 ? (
              <Vuoto testo={t("classifica.nessuno")} />
            ) : (
              <ol className="pannello divide-y divide-linea overflow-hidden">
                {primi.map((r) => (
                  <li key={r.utente_id} className={`flex items-center gap-3 px-4 py-2.5 ${r.utente_id === user?.id ? "bg-viola/10" : ""}`}>
                    <span className={`cifre w-6 text-lg ${r.posizione === 1 ? "text-viola" : "text-tenue"}`}>{r.posizione}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      <span aria-hidden className="mr-1.5">
                        {bandiera(r.paese)}
                      </span>
                      {r.nickname}
                    </span>
                    <span className="cifre text-lg">{r.punti}</span>
                  </li>
                ))}
              </ol>
            )}
          </Sezione>

          <Sezione titolo={t("home.prossimiTornei")} link="/tornei" testoLink={t("home.vediTutti")}>
            {tornei.length === 0 ? (
              <Vuoto testo={t("tornei.nessuno")} />
            ) : (
              <ul className="pannello divide-y divide-linea overflow-hidden">
                {tornei.map((to) => (
                  <li key={to.id}>
                    <RigaTorneo torneo={to} />
                  </li>
                ))}
              </ul>
            )}
          </Sezione>

          {notizie.length > 0 && (
            <Sezione titolo={t("home.ultimeNotizie")} link="/notizie" testoLink={t("home.vediTutti")}>
              <div className="space-y-3">
                {notizie.map((n) => (
                  <SchedaNotizia key={n.id} notizia={n} />
                ))}
              </div>
            </Sezione>
          )}
        </aside>
      </div>
    </div>
  );
}
