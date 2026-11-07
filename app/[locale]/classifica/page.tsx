import { getTranslations, setRequestLocale } from "next-intl/server";
import TestataFoto from "@/components/TestataFoto";
import { FOTO } from "@/lib/foto";
import Vuoto from "@/components/Vuoto";
import { Link } from "@/i18n/navigation";
import { mieLeghe, sessione } from "@/lib/dati";
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
  const mese = mesi.includes(sp.mese ?? "") ? sp.mese! : meseIso();
  const ambito: Ambito = sp.ambito === "paese" || sp.ambito === "lega" ? sp.ambito : "globale";
  const [{ supabase, user, profilo }, sito] = await Promise.all([sessione(), indirizzoSito()]);
  const leghe = user ? await mieLeghe() : [];
  const lega = ambito === "lega" ? (leghe.find((l) => l.id === sp.lega) ?? leghe[0]) : undefined;

  const argomenti = { p_mese: mese, p_ambito: ambito, p_paese: profilo?.paese ?? null, p_lega: lega?.id ?? null };
  const puoMostrare = ambito === "globale" || (ambito === "paese" && profilo?.paese) || (ambito === "lega" && lega);
  const [{ data: righe }, { data: mia }] = puoMostrare
    ? await Promise.all([
        supabase.rpc("classifica", { ...argomenti, p_limite: 100 }),
        user ? supabase.rpc("mia_posizione", argomenti) : Promise.resolve({ data: null }),
      ])
    : [{ data: [] }, { data: null }];
  const lista = (righe as RigaClassifica[]) ?? [];
  const io = (mia as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0];

  // chi sta subito davanti a me (per dire quanti punti mancano a superarlo)
  const davanti = io ? [...lista].reverse().find((r) => r.punti > io.punti) : undefined;
  const href = (a: Ambito, extra: Record<string, string> = {}) => {
    const u = new URLSearchParams({ ambito: a, mese, ...extra });
    return `/classifica?${u}`;
  };
  const tab = (a: Ambito) =>
    `flex min-h-11 items-center justify-center rounded-md text-[15px] font-semibold transition ${ambito === a ? "bg-sabbia-2 text-inchiostro ring-1 ring-linea" : "text-tenue hover:text-inchiostro"}`;
  const nomeAmbito = ambito === "lega" ? lega?.nome : ambito === "paese" ? `${bandiera(profilo?.paese)} ${t("classifica.paese")}` : t("classifica.globale");
  const immagine = `/api/immagine/classifica?${new URLSearchParams({ mese, ambito, lingua: locale, ...(lega ? { lega: lega.id } : {}) })}`;

  return (
    <div>
      <TestataFoto foto={FOTO.duello} titolo={t("classifica.titolo")} sotto={t("classifica.sottotitoloPagina")} posizione="50% 62%" />
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

      <div className="mt-4 flex gap-2 [&>label]:min-w-0 [&>label]:flex-1">
        <SelettoreMese etichetta={t("classifica.mese")} mesi={mesi.map((m) => ({ valore: m, nome: nomeMese(m, locale) }))} attuale={mese} />
        {ambito === "lega" && leghe.length > 0 && (
          <SelettoreMese etichetta={t("classifica.scegliLega")} nome="lega" mesi={leghe.map((l) => ({ valore: l.id, nome: l.nome }))} attuale={lega?.id ?? ""} />
        )}
      </div>

      {ambito === "paese" && !profilo?.paese && (
        <p className="scheda mt-4 text-sm">
          {t("classifica.paeseMancante")}{" "}
          <Link href={user ? "/profilo" : "/accedi"} className="font-semibold text-mare underline">
            {t(user ? "nav.profilo" : "nav.accedi")}
          </Link>
        </p>
      )}
      {ambito === "lega" && !lega && (
        <p className="scheda mt-4 text-sm">
          {t("classifica.nessunaLega")}{" "}
          <Link href={user ? "/leghe" : "/accedi"} className="font-semibold text-mare underline">
            {t(user ? "leghe.titolo" : "nav.accedi")}
          </Link>
        </p>
      )}

      {user && puoMostrare && (
        <section className="pannello mt-4 overflow-hidden border-l-4 border-l-lime">
          {io ? (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 p-4">
              <div>
                <p className=" text-[12px] font-semibold text-tenue">{t("classifica.tuaPosizione")}</p>
                <p className="cifre text-6xl leading-none">
                  {io.posizione}
                  <span className="text-2xl text-tenue">°</span>
                </p>
              </div>
              <div className="pb-1">
                <p className="cifre text-3xl leading-none text-mare">{io.punti}</p>
                <p className=" text-[12px] font-semibold text-tenue">{t("classifica.punti")}</p>
              </div>
              <div className="pb-1">
                <p className="cifre text-3xl leading-none">{io.partecipanti}</p>
                <p className=" text-[12px] font-semibold text-tenue">{t("classifica.giocatori")}</p>
              </div>
              {davanti && <p className="w-full text-sm text-tenue">{t("classifica.distacco", { punti: davanti.punti - io.punti + 1, nome: davanti.nickname })}</p>}
            </div>
          ) : (
            <p className="p-4 text-sm text-tenue">{t("classifica.senzaPunti")}</p>
          )}
          {io && (
            <div className="border-t border-linea p-3">
              <Condividi
                immagine={immagine}
                testo={t("condividi.testoClassifica", { posizione: io.posizione, mese: `${nomeMese(mese, locale)} (${nomeAmbito})` })}
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
          <Podio righe={lista.slice(0, 3)} io={user?.id} tu={t("classifica.tu")} distacco={(n) => t("classifica.dalPrimo", { punti: n })} />
          <h2 className="titolo-sezione">{t("classifica.completa")}</h2>
          <div className="pannello overflow-hidden">
            <div className="grid grid-cols-[1.75rem_1fr_2.75rem_2.25rem_2.25rem_2rem_2.5rem] items-center gap-1 border-b border-linea bg-sabbia-2 px-3 py-2 text-xs font-semibold text-tenue">
              <span>#</span>
              <span>{t("classifica.utente")}</span>
              <span className="text-right">{t("classifica.punti")}</span>
              <span className="text-right">{t("classifica.colPronostici")}</span>
              <span className="text-right">{t("classifica.colVincitori")}</span>
              <span className="text-right">{t("classifica.colSet")}</span>
              <span className="text-right">{t("classifica.colGame")}</span>
            </div>
            <ol className="divide-y divide-linea">
              {lista.map((r) => {
                const sonoIo = r.utente_id === user?.id;
                return (
                  <li key={r.utente_id} className={`entra grid grid-cols-[1.75rem_1fr_2.75rem_2.25rem_2.25rem_2rem_2.5rem] items-center gap-1 px-3 py-2.5 text-sm tabular-nums ${sonoIo ? "bg-mare/10 shadow-[inset_3px_0_0_var(--color-lime)]" : ""}`}>
                    <span className="cifre text-base text-tenue">{r.posizione}</span>
                    <span className="min-w-0 truncate font-semibold">
                      <span aria-hidden>{bandiera(r.paese)}</span> {r.nickname}
                      {sonoIo && <span className="chip ml-1 bg-mare text-white">{t("classifica.tu")}</span>}
                    </span>
                    <span className="cifre text-right text-lg">{r.punti}</span>
                    <span className="text-right text-tenue">{r.pronostici}</span>
                    <span className="text-right">{r.vincitori}</span>
                    <span className="text-right">{r.set_esatti}</span>
                    <span className="text-right">{r.game_esatti}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-2 px-1 text-xs leading-relaxed text-tenue">{t("classifica.legenda")}</p>
        </>
      )}
    </div>
  );
}

/**
 * I primi tre come un tabellone del distacco: il leader in grande, poi gli inseguitori con una barra
 * proporzionale ai suoi punti e quanti punti mancano per raggiungerlo.
 */
function Podio({ righe, io, tu, distacco }: { righe: RigaClassifica[]; io?: string; tu: string; distacco: (n: number) => string }) {
  const [primo, ...altri] = righe;
  if (!primo) return null;
  const max = Math.max(1, primo.punti);
  return (
    <section className="pannello mt-6 overflow-hidden">
      <div className="relative flex items-center gap-4 border-b border-linea p-4">
        <span className="cifre text-[88px] leading-[.8] text-mare" aria-hidden>
          1
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl font-extrabold leading-tight tracking-tight">
            {bandiera(primo.paese)} {primo.nickname}
            {primo.utente_id === io && <span className="chip ml-2 bg-mare align-middle text-white">{tu}</span>}
          </p>
          <p className="text-sm text-tenue">
            {primo.vincitori} V · {primo.set_esatti} Set · {primo.game_esatti} Game
          </p>
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
              {bandiera(r.paese)} {r.nickname}
              {r.utente_id === io && <span className="chip ml-2 bg-mare text-white">{tu}</span>}
            </p>
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
