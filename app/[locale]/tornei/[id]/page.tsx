import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { caricaTorneo, classificaTorneo, mieiPronostici, notiziePubblicate, sessione } from "@/lib/dati";
import SchedaNotizia from "@/components/SchedaNotizia";
import CampioniTorneo from "@/components/CampioniTorneo";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { bandiera, coppiaLungaConBandiere, data, nomeCoppia } from "@/lib/formato";
import { TURNI, type Coppia, type Genere } from "@/lib/tipi";
import PronosticoTorneo from "@/components/PronosticoTorneo";
import SchedaPartita, { type VotoMostrato } from "@/components/SchedaPartita";
import Regole from "@/components/Regole";
import { IconaIndietro } from "@/components/Icone";
import Image from "next/image";
import { FOTO } from "@/lib/foto";
import Vuoto from "@/components/Vuoto";
import { Cammino, NumeriTorneo } from "@/components/Statistiche";
import { cammino, statisticheTorneo } from "@/lib/statistiche";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = /^[0-9a-f-]{36}$/i.test(id) ? await caricaTorneo(id) : null;
  return { title: r?.torneo.nome ?? "—" };
}

export default async function PaginaTorneo({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ tab?: string; turno?: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r, { user, supabase }, sito, t] = await Promise.all([caricaTorneo(id), sessione(), indirizzoSito(), getTranslations()]);
  if (!r) notFound();
  const { torneo, tabelloni } = r;
  const { tab, turno } = await searchParams;
  const scelto = tabelloni.find((x) => x.genere === tab) ?? tabelloni[0];
  // Turni del tabellone; si apre su quello con partite ancora da pronosticare (o sull'ultimo giocato)
  const apribile = (p: { stato: string; inizio_at: string; coppia_a_id: string | null; coppia_b_id: string | null }) =>
    p.stato === "in_programma" && Boolean(p.coppia_a_id && p.coppia_b_id) && new Date(p.inizio_at).getTime() > Date.now();
  const turni = scelto ? TURNI.filter((tu) => scelto.partite.some((p) => p.turno === tu && (p.coppia_a_id || p.coppia_b_id))) : [];
  const aperteIn = (tu: string) => scelto?.partite.filter((p) => p.turno === tu && apribile(p)).length ?? 0;
  const turnoScelto =
    turni.find((tu) => tu === turno) ?? turni.find((tu) => aperteIn(tu) > 0) ?? [...turni].reverse().find((tu) => scelto?.partite.some((p) => p.turno === tu && p.stato !== "in_programma")) ?? turni[0];

  const [miei, { data: votiRighe }, pronosticatori] = await Promise.all([
    user ? mieiPronostici(tabelloni.map((x) => x.id), tabelloni.flatMap((x) => x.partite.map((p) => p.id))) : Promise.resolve(null),
    supabase.rpc("voti_del_torneo", { p_torneo: id }),
    classificaTorneo(id),
  ]);
  const articoli = await notiziePubblicate(locale, 3, { torneo: id });
  const concluso = torneo.stato === "concluso";
  // rif (partita o tabellone) -> coppia -> percentuale e punti in palio
  const voti = new Map<string, Record<string, VotoMostrato>>();
  const righeVoti = (votiRighe as { rif: string; coppia_id: string; voti: number; percentuale: number; punti_in_palio: number }[]) ?? [];
  const conVoti = new Set(righeVoti.filter((v) => Number(v.voti) > 0).map((v) => v.rif)); // senza voti non si mostra nulla
  for (const v of righeVoti.filter((x) => conVoti.has(x.rif))) {
    const m = voti.get(v.rif) ?? {};
    m[v.coppia_id] = { percentuale: v.percentuale, punti: v.punti_in_palio };
    voti.set(v.rif, m);
  }
  const mieiPunti =
    (miei ? [...miei.torneo.values(), ...miei.partita.values()] : []).reduce((s, p) => s + (p.punti ?? 0), 0);
  const ritorno = `/${locale}/tornei/${id}${scelto ? `?tab=${scelto.genere}` : ""}`;
  const aperto = torneo.stato === "in_programma" && new Date(torneo.inizio_at).getTime() > Date.now();

  return (
    <div>
      <Link href="/tornei" className="inline-flex items-center gap-1 text-sm font-semibold text-tenue hover:text-inchiostro">
        <IconaIndietro /> {t("tornei.titolo")}
      </Link>

      <header className="group relative -mx-4 mt-3 overflow-hidden border-y border-linea sm:mx-0 sm:rounded-xl sm:border">
        <Image src={FOTO.torneo.src} alt={FOTO.torneo.alt} placeholder="blur" sizes="(min-width: 1152px) 1120px, 100vw" className="foto-zoom h-56 w-full object-cover object-[50%_45%] sm:h-64" />
        <div className="velo absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip bg-sole text-inchiostro">
              {torneo.circuito}
              {torneo.categoria ? ` ${torneo.categoria}` : ""}
            </span>
            {torneo.stato === "in_corso" ? (
              <span className="chip-live bg-white text-corallo">
                <span className="punto-live" /> {t("stato.in_corso")}
              </span>
            ) : (
              <span className="chip bg-white text-inchiostro">{t(`stato.${torneo.stato}`)}</span>
            )}
          </div>
          <h1 className="mt-2 font-display text-[38px] font-bold leading-[1] sm:text-5xl">{torneo.nome}</h1>
          <p className="mt-1.5 text-sm text-white/85">
            {bandiera(torneo.paese)} {torneo.luogo} · {t("tornei.dal", { inizio: data(torneo.data_inizio, locale), fine: data(torneo.data_fine, locale, { day: "numeric", month: "short", year: "numeric" }) })}
          </p>
        </div>
        {user && mieiPunti > 0 && (
          <div className="festa absolute right-4 top-9 rounded-lg bg-viola px-3 py-1.5 text-center text-white sm:right-6">
            <p className="cifre text-2xl leading-none">+{mieiPunti}</p>
            <p className="text-xs font-semibold">{t("torneo.tuoiPuntiBreve")}</p>
          </div>
        )}
      </header>

      {concluso && <CampioniTorneo righe={pronosticatori} concluso io={user?.id} />}

      {tabelloni.length > 1 && (
        <div className="mt-4 grid grid-flow-col gap-1 rounded-lg border border-linea bg-carta p-1">
          {tabelloni.map((x) => (
            <Link
              key={x.id}
              href={`/tornei/${id}?tab=${x.genere}`}
              className={`min-h-11 rounded-md py-2.5 text-center text-[15px] font-semibold transition ${x.id === scelto?.id ? "bg-sabbia-2 text-inchiostro ring-1 ring-linea" : "text-tenue hover:text-inchiostro"}`}
            >
              {t(`genere.${x.genere as Genere}`)}
            </Link>
          ))}
        </div>
      )}

      {!scelto ? (
        <div className="mt-4">
          <Vuoto testo={t("torneo.nessunaCoppia")} />
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:gap-8">
          <div>
            <h2 className="titolo-sezione">{t("torneo.partite")}</h2>
            {scelto.partite.length === 0 && <Vuoto testo={t("torneo.nessunaPartita")} />}
            {turni.length > 0 && (
              <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0" aria-label={t("torneo.partite")}>
                {turni.map((tu) => {
                  const attivo = tu === turnoScelto;
                  const aperte = aperteIn(tu);
                  return (
                    <Link
                      key={tu}
                      href={`/tornei/${id}?${new URLSearchParams({ ...(scelto ? { tab: scelto.genere } : {}), turno: tu })}`}
                      scroll={false}
                      aria-current={attivo ? "page" : undefined}
                      className={`relative flex shrink-0 items-center gap-1.5 px-3 pb-3 pt-2 text-[15px] font-semibold transition ${
                        attivo ? "text-inchiostro after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-viola" : "text-tenue hover:text-inchiostro"
                      }`}
                    >
                      {t(`turno.${tu}`)}
                      {aperte > 0 && <span className="cifre rounded bg-viola px-1.5 text-[12px] text-white">{aperte}</span>}
                    </Link>
                  );
                })}
              </nav>
            )}
            {turnoScelto && (
              <section key={turnoScelto} className="entra space-y-3">
                {scelto.partite
                  .filter((p) => p.turno === turnoScelto && (p.coppia_a_id || p.coppia_b_id))
                  .sort((x, y) => Number(apribile(y)) - Number(apribile(x)) || x.ordine - y.ordine)
                  .map((p) => {
                    const coppia = (cid: string | null): Coppia | null => scelto.coppie.find((c) => c.id === cid) ?? null;
                    return (
                      <div key={p.id} id={`p-${p.id}`} className="scroll-mt-20">
                        <SchedaPartita
                          partita={p}
                          a={coppia(p.coppia_a_id)}
                          b={coppia(p.coppia_b_id)}
                          mio={miei?.partita.get(p.id) ?? null}
                          voti={voti.get(p.id) ?? {}}
                          collegato={Boolean(user)}
                          urlAccesso={urlAccesso(locale, ritorno)}
                          sito={sito}
                          descrizione={`${nomeCoppia(coppia(p.coppia_a_id))} vs ${nomeCoppia(coppia(p.coppia_b_id))} · ${torneo.nome}`}
                          intestazione={`${t(`turno.${p.turno}`)} · ${t("torneo.match", { n: p.ordine })}`}
                          cammino={
                            <Cammino
                              a={coppia(p.coppia_a_id)}
                              b={coppia(p.coppia_b_id)}
                              tappeA={cammino(scelto.partite, scelto.coppie, p.coppia_a_id, p.turno)}
                              tappeB={cammino(scelto.partite, scelto.coppie, p.coppia_b_id, p.turno)}
                            />
                          }
                        />
                      </div>
                    );
                  })}
              </section>
            )}
          </div>

          <aside>
            <h2 className="titolo-sezione">{t("torneo.chiVinceTorneo", { genere: t(`genere.${scelto.genere}`).toLowerCase() })}</h2>
            <section className="pannello p-4">
              <PronosticoTorneo
                tabelloneId={scelto.id}
                titolo={t(`genere.${scelto.genere}`)}
                nomeTorneo={torneo.nome}
                coppie={scelto.coppie.map((c) => ({ id: c.id, nome: coppiaLungaConBandiere(c), testa_di_serie: c.testa_di_serie }))}
                mio={miei?.torneo.get(scelto.id) ?? null}
                aperto={aperto}
                chiusura={torneo.inizio_at}
                collegato={Boolean(user)}
                urlAccesso={urlAccesso(locale, ritorno)}
                voti={voti.get(scelto.id) ?? {}}
                sito={sito}
              />
            </section>
            {!concluso && <CampioniTorneo righe={pronosticatori} concluso={false} io={user?.id} />}
            <NumeriTorneo s={statisticheTorneo(scelto.partite, scelto.coppie)} />
            {articoli.length > 0 && (
              <section>
                <h2 className="titolo-sezione">{t("notizie.titolo")}</h2>
                <div className="space-y-3">
                  {articoli.map((n) => (
                    <SchedaNotizia key={n.id} notizia={n} />
                  ))}
                </div>
              </section>
            )}
            <Regole />
          </aside>
        </div>
      )}
    </div>
  );
}
