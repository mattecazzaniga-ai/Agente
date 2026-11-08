import { getTranslations, setRequestLocale } from "next-intl/server";
import { IconaCoppa } from "@/components/Icone";
import TestataFoto from "@/components/TestataFoto";
import { FOTO } from "@/lib/foto";
import Vuoto from "@/components/Vuoto";
import { Link } from "@/i18n/navigation";
import { mieLeghe, podiMesiChiusi, premi, sessione } from "@/lib/dati";
import { medagliePerUtente, type Medaglie } from "@/lib/trofei";
import { MedaglieMese } from "@/components/Trofei";
import { indirizzoSito } from "@/lib/sito";
import { bandiera, meseIso, nomeMese, ultimiMesi } from "@/lib/formato";
import type { RigaClassifica } from "@/lib/tipi";
import Condividi from "@/components/Condividi";
import SelettoreMese from "@/components/SelettoreMese";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("classifica.titolo") };
}

type Ambito = "globale" | "paese" | "lega";

export default async function Classifica({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ambito?: string; mese?: string; lega?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations();
  const mesi = ultimiMesi(6);
  const anno = new Date().getUTCFullYear();
  const stagione = sp.mese === "stagione"; // tutti i mesi dell'anno
  const mese = stagione ? "stagione" : mesi.includes(sp.mese ?? "") ? sp.mese! : meseIso();
  const ambito: Ambito = sp.ambito === "paese" || sp.ambito === "lega" ? sp.ambito : "globale";
  const [{ supabase, user, profilo }, sito, inPalio, podi] = await Promise.all([sessione(), indirizzoSito(), premi(), podiMesiChiusi()]);
  const medaglie = medagliePerUtente(podi);
  const titoloMedaglie = t("trofei.medaglie");
  const leghe = user ? await mieLeghe() : [];
  const lega = ambito === "lega" ? (leghe.find((l) => l.id === sp.lega) ?? leghe[0]) : undefined;

  const filtro = { p_ambito: ambito, p_paese: profilo?.paese ?? null, p_lega: lega?.id ?? null };
  const argomenti = { p_mese: mese, ...filtro };
  const puoMostrare = ambito === "globale" || (ambito === "paese" && profilo?.paese) || (ambito === "lega" && lega);
  let lista: RigaClassifica[] = [];
  let io: { posizione: number; punti: number; partecipanti: number } | undefined;
  if (puoMostrare && stagione) {
    // stagione: classifica sull'anno intero (stessi conti e spareggi), la mia riga si cerca nell'elenco
    const { data } = await supabase.rpc("classifica_periodo", { p_dal: `${anno}-01-01`, p_al: `${anno}-12-31`, ...filtro, p_limite: 1000 });
    const tutte = (data as RigaClassifica[] | null) ?? [];
    lista = tutte.slice(0, 100);
    const mia = user ? tutte.find((r) => r.utente_id === user.id) : undefined;
    io = mia ? { posizione: Number(mia.posizione), punti: Number(mia.punti), partecipanti: tutte.length } : undefined;
  } else if (puoMostrare) {
    const [{ data: righe }, { data: mia }] = await Promise.all([
      supabase.rpc("classifica", { ...argomenti, p_limite: 100 }),
      user ? supabase.rpc("mia_posizione", argomenti) : Promise.resolve({ data: null }),
    ]);
    lista = (righe as RigaClassifica[]) ?? [];
    io = (mia as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0];
  }
  const precisione = (r: RigaClassifica) => (Number(r.pronostici) ? `${Math.round((Number(r.vincitori) / Number(r.pronostici)) * 100)}%` : "—");

  // chi sta subito davanti a me (per dire quanti punti mancano a superarlo)
  const davanti = io ? [...lista].reverse().find((r) => r.punti > io.punti) : undefined;
  const href = (a: Ambito, extra: Record<string, string> = {}) => {
    const u = new URLSearchParams({ ambito: a, mese, ...extra });
    return `/classifica?${u}`;
  };
  const tab = (a: Ambito) =>
    `flex min-h-11 items-center justify-center rounded-md text-[15px] font-semibold transition ${ambito === a ? "bg-sabbia-2 text-inchiostro ring-1 ring-linea" : "text-tenue hover:text-inchiostro"}`;
  const nomeAmbito = ambito === "lega" ? lega?.nome : ambito === "paese" ? `${bandiera(profilo?.paese)} ${t("classifica.paese")}` : t("classifica.globale");
  const etichettaPeriodo = stagione ? t("classifica.stagione", { anno }) : nomeMese(mese, locale);
  const immagine = `/api/immagine/classifica?${new URLSearchParams({ mese, ambito, lingua: locale, ...(lega ? { lega: lega.id } : {}) })}`;

  return (
    <div>
      <TestataFoto foto={FOTO.giocatrice} titolo={t("classifica.titolo")} sotto={t("classifica.sottotitoloPagina")} posizione="50% 35%" />
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg border border-linea bg-carta p-1">
        <Link href={href("globale")} className={tab("globale")}>
          {t("classifica.globale")}
        </Link>
        <Link href={href("paese")} className={tab("paese")}>
          {bandiera(profilo?.paese)} {t("classifica.paese")}
        </Link>
        <Link href={href("lega", lega ? { lega: lega.id } : {})} className={tab("lega")}>
          {t("classifica.lega")}
        </Link>
      </div>

      {Object.keys(inPalio).length > 0 && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-sole/60 bg-sole-chiaro">
          <h2 className="flex items-center gap-2 px-4 pt-3 font-display text-xl font-bold">
            <IconaCoppa className="h-5 w-5 text-viola" /> {t("classifica.inPalio")}
          </h2>
          <ol className="grid gap-2 p-3 sm:grid-cols-3">
            {[1, 2, 3].filter((n) => inPalio[n]).map((n) => (
              <li key={n} className="flex items-center gap-3 rounded-xl bg-carta p-3 ring-1 ring-linea">
                <span className={`cifre grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${MEDAGLIE[n]}`}>{n}°</span>
                <span className="text-sm font-semibold leading-snug">{inPalio[n]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-4 flex gap-2 [&>label]:min-w-0 [&>label]:flex-1">
        <SelettoreMese etichetta={t("classifica.periodo")} mesi={[...mesi.map((m) => ({ valore: m, nome: nomeMese(m, locale) })), { valore: "stagione", nome: t("classifica.stagione", { anno })}]} attuale={mese} />
        {ambito === "lega" && leghe.length > 0 && (
          <SelettoreMese etichetta={t("classifica.scegliLega")} nome="lega" mesi={leghe.map((l) => ({ valore: l.id, nome: l.nome }))} attuale={lega?.id ?? ""} />
        )}
      </div>

      {ambito === "paese" && !profilo?.paese && (
        <p className="scheda mt-4 text-sm">
          {t("classifica.paeseMancante")}{" "}
          <Link href={user ? "/profilo" : "/accedi"} className="font-semibold text-viola underline">
            {t(user ? "nav.profilo" : "nav.accedi")}
          </Link>
        </p>
      )}
      {ambito === "lega" && !lega && (
        <p className="scheda mt-4 text-sm">
          {t("classifica.nessunaLega")}{" "}
          <Link href={user ? "/leghe" : "/accedi"} className="font-semibold text-viola underline">
            {t(user ? "leghe.titolo" : "nav.accedi")}
          </Link>
        </p>
      )}

      {user && puoMostrare && (
        <section className="pannello mt-4 overflow-hidden border-l-4 border-l-viola">
          {io ? (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 p-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-viola">{t("classifica.tuaSfida")}</p>
                <p className="cifre text-6xl leading-none">
                  {io.posizione}
                  <span className="text-2xl text-tenue">°</span>
                </p>
              </div>
              <div className="pb-1">
                <p className="cifre text-3xl leading-none text-viola">{io.punti}</p>
                <p className=" text-[12px] font-semibold text-tenue">{t("classifica.punti")}</p>
              </div>
              <div className="pb-1">
                <p className="cifre text-3xl leading-none">{io.partecipanti}</p>
                <p className=" text-[12px] font-semibold text-tenue">{t("classifica.giocatori")}</p>
              </div>
              {davanti ? (
                <p className="w-full rounded-lg bg-sole-chiaro px-3 py-2 text-sm font-semibold text-inchiostro">{t("classifica.distacco", { punti: davanti.punti - io.punti + 1, nome: davanti.nickname })}</p>
              ) : io.posizione === 1 ? (
                <p className="w-full rounded-lg bg-sole-chiaro px-3 py-2 text-sm font-semibold text-inchiostro">{t("classifica.inTesta")}</p>
              ) : null}
            </div>
          ) : (
            <p className="p-4 text-sm text-tenue">{t("classifica.senzaPunti")}</p>
          )}
          {io && !stagione && (
            <div className="border-t border-linea p-3">
              <Condividi
                immagine={immagine}
                testo={t("condividi.testoClassifica", { posizione: io.posizione, mese: `${etichettaPeriodo} (${nomeAmbito})` })}
                url={ambito === "lega" && lega ? `${sito}/${locale}/leghe/${lega.codice}` : `${sito}/${locale}`}
                etichetta={t("condividi.classifica")}
              />
            </div>
          )}
        </section>
      )}

      {puoMostrare && lista.length === 0 && <div className="mt-4"><Vuoto testo={t("classifica.nessuno")} azione={t("classifica.vaiAPronosticare")} link="/tornei" /></div>}
      {puoMostrare && lista.length > 0 && (
        <>
          <Podio medaglie={medaglie} titoloMedaglie={titoloMedaglie} righe={lista.slice(0, 3)} io={user?.id} tu={t("classifica.tu")} distacco={(n) => t("classifica.dalPrimo", { punti: n })} premi={inPalio} />
          <h2 className="titolo-sezione">{t("classifica.completa")}</h2>
          <div className="pannello overflow-hidden">
            {/* telefono: posizione, giocatore e punti, con le statistiche in piccolo sotto il nome; da tablet in su anche le colonne */}
            <div className="grid grid-cols-[2rem_1fr_3rem] items-center gap-2 border-b border-linea bg-sabbia-2 px-3 py-2 text-xs font-semibold text-tenue sm:grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_3.5rem]">
              <span>#</span>
              <span>{t("classifica.utente")}</span>
              <span className="text-right">{t("classifica.punti")}</span>
              <span className="hidden text-right sm:block">{t("classifica.colPronostici")}</span>
              <span className="hidden text-right sm:block">{t("classifica.colVincitori")}</span>
              <span className="hidden text-right sm:block">{t("classifica.colSet")}</span>
              <span className="hidden text-right sm:block">{t("classifica.colGame")}</span>
              <span className="hidden text-right sm:block">{t("classifica.colPrecisione")}</span>
            </div>
            <ol className="divide-y divide-linea">
              {lista.map((r) => {
                const sonoIo = r.utente_id === user?.id;
                return (
                  <li key={r.utente_id} className="entra">
                  <Link href={`/giocatore/${r.utente_id}`} className={`grid grid-cols-[2rem_1fr_3rem] items-center gap-2 px-3 py-2.5 text-sm tabular-nums transition hover:bg-sabbia-2 sm:grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_3.5rem] ${sonoIo ? "bg-viola/10 shadow-[inset_3px_0_0_var(--color-viola)]" : ""}`}>
                    <span className={`cifre text-lg ${r.posizione <= 3 ? "text-viola" : "text-tenue"}`}>{r.posizione}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        <span aria-hidden>{bandiera(r.paese)}</span> {r.nickname}
                        <MedaglieMese m={medaglie.get(r.utente_id)} titolo={titoloMedaglie} />
                        {sonoIo && <span className="chip ml-1 bg-viola text-white">{t("classifica.tu")}</span>}
                      </span>
                      <span className="block text-xs text-tenue sm:hidden">
                        {t("classifica.statRiga", { pronostici: r.pronostici, vincitori: r.vincitori, set: r.set_esatti, game: r.game_esatti })} · {precisione(r)}
                      </span>
                    </span>
                    <span className="cifre text-right text-xl">{r.punti}</span>
                    <span className="hidden text-right text-tenue sm:block">{r.pronostici}</span>
                    <span className="hidden text-right sm:block">{r.vincitori}</span>
                    <span className="hidden text-right sm:block">{r.set_esatti}</span>
                    <span className="hidden text-right sm:block">{r.game_esatti}</span>
                    <span className="hidden text-right font-semibold sm:block">{precisione(r)}</span>
                  </Link>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-2 px-1 text-xs leading-relaxed text-tenue">{t("classifica.legenda")}</p>
          {lista.length < 5 && (
            <section className="mt-6 rounded-xl bg-inchiostro p-5 text-white">
              <h2 className="font-display text-2xl font-bold leading-tight">{t("classifica.pochiTitolo")}</h2>
              <p className="mt-1.5 text-sm text-white/80">{t("classifica.pochiTesto")}</p>
              <Link href={user ? "/leghe" : "/accedi"} className="bottone mt-4 w-auto bg-sole px-6 text-inchiostro hover:bg-sole/90">
                {t("classifica.pochiAzione")}
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * I primi tre come un tabellone del distacco: il leader in grande, poi gli inseguitori con una barra
 * proporzionale ai suoi punti e quanti punti mancano per raggiungerlo.
 */
const MEDAGLIE: Record<number, string> = { 1: "bg-sole text-inchiostro", 2: "bg-[#c9cfdb] text-inchiostro", 3: "bg-[#d9965b] text-white" };

function Podio({ righe, io, tu, distacco, premi: inPalio, medaglie, titoloMedaglie }: { righe: RigaClassifica[]; io?: string; tu: string; distacco: (n: number) => string; premi: Record<number, string>; medaglie: Map<string, Medaglie>; titoloMedaglie: string }) {
  const [primo, ...altri] = righe;
  if (!primo) return null;
  const max = Math.max(1, primo.punti);
  return (
    <section className="pannello mt-6 overflow-hidden">
      <div className="relative flex items-center gap-4 border-b border-linea p-4">
        <span className="cifre text-[88px] leading-[.8] text-viola" aria-hidden>
          1
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl font-extrabold leading-tight tracking-tight">
            <Link href={`/giocatore/${primo.utente_id}`} className="hover:text-viola">{bandiera(primo.paese)} {primo.nickname}</Link>
            <MedaglieMese m={medaglie.get(primo.utente_id)} titolo={titoloMedaglie} />
            {primo.utente_id === io && <span className="chip ml-2 bg-viola align-middle text-white">{tu}</span>}
          </p>
          <p className="text-sm text-tenue">
            {primo.vincitori} V · {primo.set_esatti} Set · {primo.game_esatti} Game
          </p>
          {inPalio[1] && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-sole-chiaro px-2 py-0.5 text-xs font-semibold text-inchiostro"><IconaCoppa className="h-3.5 w-3.5 text-viola" /> {inPalio[1]}</p>}
        </div>
        <p className="cifre text-right text-5xl leading-none">
          {primo.punti}
          <span className="block text-xs font-semibold text-tenue">pt</span>
        </p>
      </div>
      {altri.map((r) => (
        <div key={r.utente_id} className="flex items-center gap-4 border-b border-linea px-4 py-3 last:border-b-0">
          <span className="cifre w-[52px] text-center text-4xl leading-none text-tenue">{r.posizione}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              <Link href={`/giocatore/${r.utente_id}`} className="hover:text-viola">{bandiera(r.paese)} {r.nickname}</Link>
              <MedaglieMese m={medaglie.get(r.utente_id)} titolo={titoloMedaglie} />
              {r.utente_id === io && <span className="chip ml-2 bg-viola text-white">{tu}</span>}
            </p>
            {inPalio[r.posizione] && <p className="text-xs font-semibold text-seme">{inPalio[r.posizione]}</p>}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-linea">
                <span className="block h-full rounded-full bg-inchiostro/70" style={{ width: `${(r.punti / max) * 100}%` }} />
              </span>
              <span className="w-16 text-right text-xs font-semibold text-tenue">{primo.punti - r.punti > 0 ? distacco(primo.punti - r.punti) : "="}</span>
            </div>
          </div>
          <span className="cifre text-2xl">{r.punti}</span>
        </div>
      ))}
    </section>
  );
}
