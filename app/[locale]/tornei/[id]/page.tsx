import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { caricaTorneo, mieiPronostici, sessione } from "@/lib/dati";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { bandiera, data, nomeCoppia, nomeCoppiaLungo } from "@/lib/formato";
import { TURNI, type Coppia, type Genere } from "@/lib/tipi";
import PronosticoTorneo from "@/components/PronosticoTorneo";
import SchedaPartita, { type VotoMostrato } from "@/components/SchedaPartita";
import Regole from "@/components/Regole";
import Ora from "@/components/Ora";
import { IconaCoppa, IconaIndietro } from "@/components/Icone";

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

  const [miei, { data: votiRighe }] = await Promise.all([
    user ? mieiPronostici(tabelloni.map((x) => x.id), tabelloni.flatMap((x) => x.partite.map((p) => p.id))) : Promise.resolve(null),
    supabase.rpc("voti_del_torneo", { p_torneo: id }),
  ]);
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
      <Link href="/tornei" className="inline-flex items-center gap-1 text-sm font-bold text-mare">
        <IconaIndietro /> {t("tornei.titolo")}
      </Link>
      <header className="eroe relative mt-3 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-20px_rgba(7,91,120,.8)]">
        <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sole/90" aria-hidden />
        <span className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sole/20" aria-hidden />
        <div className="flex flex-wrap gap-1.5">
          <span className={`chip relative ${torneo.stato === "in_corso" ? "bg-corallo text-white" : torneo.stato === "concluso" ? "bg-white/70 text-nebbia" : "bg-white text-mare-scuro"}`}>
            {torneo.stato === "in_corso" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
            {t(`stato.${torneo.stato}`)}
          </span>
          <span className="chip relative bg-inchiostro text-white">
            {torneo.circuito}
            {torneo.categoria ? <span className="text-sole">{torneo.categoria}</span> : null}
          </span>
        </div>
        <h1 className="relative mt-3 text-[28px] font-black leading-tight tracking-tight">{torneo.nome}</h1>
        <p className="relative mt-1 text-white/85">
          {bandiera(torneo.paese)} {torneo.luogo} · {t("tornei.dal", { inizio: data(torneo.data_inizio, locale), fine: data(torneo.data_fine, locale, { day: "numeric", month: "short", year: "numeric" }) })}
        </p>
        {user && mieiPunti > 0 && (
          <p className="festa relative mt-3 inline-flex items-center gap-2 rounded-full bg-sole px-4 py-1.5 text-sm font-black text-inchiostro">{t("torneo.tuoiPunti", { punti: mieiPunti })} 🎉</p>
        )}
      </header>

      {tabelloni.length > 1 && (
        <div className="mt-4 flex gap-1 rounded-full bg-sabbia p-1">
          {tabelloni.map((x) => (
            <Link key={x.id} href={`/tornei/${id}?tab=${x.genere}`} className={`flex-1 rounded-full py-2 text-center text-sm font-bold transition ${x.id === scelto?.id ? "bg-white text-mare shadow-sm" : "text-nebbia"}`}>
              {t(`genere.${x.genere as Genere}`)}
            </Link>
          ))}
        </div>
      )}

      {!scelto ? (
        <p className="scheda mt-4 text-sm text-nebbia">{t("torneo.nessunaCoppia")}</p>
      ) : (
        <>
          <section className="scheda mt-4 space-y-4">
            <h2 className="flex items-center gap-2.5 text-lg font-extrabold leading-tight">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sole-chiaro">
                <IconaCoppa className="h-6 w-6" />
              </span>
              {t("torneo.chiVinceTorneo", { genere: t(`genere.${scelto.genere}`).toLowerCase() })}
            </h2>
            <PronosticoTorneo
              tabelloneId={scelto.id}
              titolo={t(`genere.${scelto.genere}`)}
              nomeTorneo={torneo.nome}
              coppie={scelto.coppie.map((c) => ({ id: c.id, nome: `${bandiera(c.g1.paese)} ${nomeCoppiaLungo(c)}`, testa_di_serie: c.testa_di_serie }))}
              mio={miei?.torneo.get(scelto.id) ?? null}
              aperto={aperto}
              chiusura={torneo.inizio_at}
              collegato={Boolean(user)}
              urlAccesso={urlAccesso(locale, ritorno)}
              voti={voti.get(scelto.id) ?? {}}
              sito={sito}
            />
          </section>

          <h2 className="titolo-sezione">{t("torneo.partite")}</h2>
          {scelto.partite.length === 0 && <p className="scheda text-sm text-nebbia">{t("torneo.nessunaPartita")}</p>}
          {turni.length > 0 && (
            <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={t("torneo.partite")}>
              {turni.map((tu) => {
                const attivo = tu === turnoScelto;
                const aperte = aperteIn(tu);
                return (
                  <Link
                    key={tu}
                    href={`/tornei/${id}?${new URLSearchParams({ ...(scelto ? { tab: scelto.genere } : {}), turno: tu })}`}
                    scroll={false}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-bold transition ${attivo ? "border-mare bg-mare text-white" : "border-sabbia-scura bg-white text-inchiostro"}`}
                  >
                    {t(`turno.${tu}`)}
                    {aperte > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-black ${attivo ? "bg-sole text-inchiostro" : "bg-sole-chiaro text-inchiostro"}`}>{aperte}</span>}
                  </Link>
                );
              })}
            </nav>
          )}
          {turnoScelto && (
            <section key={turnoScelto} className="mb-6">
              <div className="space-y-3">
                {scelto.partite
                  .filter((p) => p.turno === turnoScelto && (p.coppia_a_id || p.coppia_b_id))
                  .sort((x, y) => Number(apribile(y)) - Number(apribile(x)) || x.ordine - y.ordine)
                  .map((p) => {
                    const coppia = (cid: string | null): Coppia | null => scelto.coppie.find((c) => c.id === cid) ?? null;
                    return (
                      <SchedaPartita
                        key={p.id}
                        partita={p}
                        a={coppia(p.coppia_a_id)}
                        b={coppia(p.coppia_b_id)}
                        mio={miei?.partita.get(p.id) ?? null}
                        voti={voti.get(p.id) ?? {}}
                        collegato={Boolean(user)}
                        urlAccesso={urlAccesso(locale, ritorno)}
                        sito={sito}
                        descrizione={`${nomeCoppia(coppia(p.coppia_a_id))} vs ${nomeCoppia(coppia(p.coppia_b_id))} · ${torneo.nome}`}
                        intestazione={<span className="font-semibold capitalize"><Ora iso={p.inizio_at} /></span>}
                      />
                    );
                  })}
              </div>
            </section>
          )}
        </>
      )}
      <Regole />
    </div>
  );
}
