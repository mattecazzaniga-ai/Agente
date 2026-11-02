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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = /^[0-9a-f-]{36}$/i.test(id) ? await caricaTorneo(id) : null;
  return { title: r?.torneo.nome ?? "—" };
}

export default async function PaginaTorneo({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r, { user, supabase }, sito, t] = await Promise.all([caricaTorneo(id), sessione(), indirizzoSito(), getTranslations()]);
  if (!r) notFound();
  const { torneo, tabelloni } = r;
  const { tab } = await searchParams;
  const scelto = tabelloni.find((x) => x.genere === tab) ?? tabelloni[0];

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
      <Link href="/tornei" className="text-sm font-semibold text-mare">
        ← {t("tornei.titolo")}
      </Link>
      <header className="scheda mt-2 space-y-1">
        <div className="flex items-start gap-3">
          <span className="text-4xl" aria-hidden>{bandiera(torneo.paese)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold leading-tight">{torneo.nome}</h1>
            <p className="text-sm text-nebbia">
              {torneo.luogo} · {t("tornei.dal", { inizio: data(torneo.data_inizio, locale), fine: data(torneo.data_fine, locale, { day: "numeric", month: "short", year: "numeric" }) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="chip">
            {torneo.circuito}
            {torneo.categoria ? ` ${torneo.categoria}` : ""}
          </span>
          <span className="chip">{t(`stato.${torneo.stato}`)}</span>
          {user && mieiPunti > 0 && <span className="chip bg-sole/30 text-inchiostro">{t("torneo.tuoiPunti", { punti: mieiPunti })}</span>}
        </div>
      </header>

      {tabelloni.length > 1 && (
        <div className="mt-3 flex gap-2">
          {tabelloni.map((x) => (
            <Link key={x.id} href={`/tornei/${id}?tab=${x.genere}`} className={`flex-1 rounded-full py-2 text-center text-sm font-semibold ${x.id === scelto?.id ? "bg-mare text-white" : "bg-white shadow-sm"}`}>
              {t(`genere.${x.genere as Genere}`)}
            </Link>
          ))}
        </div>
      )}

      {!scelto ? (
        <p className="scheda mt-4 text-sm text-nebbia">{t("torneo.nessunaCoppia")}</p>
      ) : (
        <>
          <section className="scheda mt-4 space-y-3">
            <h2 className="text-lg font-bold">🏆 {t("torneo.chiVinceTorneo", { genere: t(`genere.${scelto.genere}`).toLowerCase() })}</h2>
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
          {TURNI.filter((tu) => scelto.partite.some((p) => p.turno === tu)).map((tu) => (
            <section key={tu} className="mb-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-nebbia">{t(`turno.${tu}`)}</h3>
              <div className="space-y-3">
                {scelto.partite
                  .filter((p) => p.turno === tu && (p.coppia_a_id || p.coppia_b_id))
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
                        intestazione={<span className="font-semibold">{t(`turno.${p.turno}`)}</span>}
                      />
                    );
                  })}
              </div>
            </section>
          ))}
        </>
      )}
      <Regole />
    </div>
  );
}
