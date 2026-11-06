import { getTranslations, setRequestLocale } from "next-intl/server";
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

  const href = (a: Ambito, extra: Record<string, string> = {}) => {
    const u = new URLSearchParams({ ambito: a, mese, ...extra });
    return `/classifica?${u}`;
  };
  const tab = (a: Ambito) => `flex-1 rounded-full py-2 text-center text-sm font-bold transition ${ambito === a ? "bg-white text-mare shadow-sm" : "text-nebbia"}`;
  const nomeAmbito = ambito === "lega" ? lega?.nome : ambito === "paese" ? `${bandiera(profilo?.paese)} ${t("classifica.paese")}` : t("classifica.globale");
  const immagine = `/api/immagine/classifica?${new URLSearchParams({ mese, ambito, lingua: locale, ...(lega ? { lega: lega.id } : {}) })}`;

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">{t("classifica.titolo")}</h1>
      <div className="mt-4 flex gap-1 rounded-full bg-sabbia p-1">
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
        <div className="mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-mare to-mare-scuro p-4 text-white">
          {io ? (
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sole text-2xl font-black text-inchiostro">#{io.posizione}</span>
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight">{t("classifica.sei", { posizione: io.posizione, totale: io.partecipanti })}</p>
                <p className="text-white/80">
                  {io.punti} {t("classifica.punti").toLowerCase()} · {nomeMese(mese, locale)}
                </p>
              </div>
            </div>
          ) : (
            <p className="font-semibold">{t("classifica.senzaPunti")}</p>
          )}
          {io && (
            <div className="mt-4 [&_.bottone-secondario]:border-white/30 [&_.bottone-secondario]:bg-white/10 [&_.bottone-secondario]:text-white">
              <Condividi
                immagine={immagine}
                testo={t("condividi.testoClassifica", { posizione: io.posizione, mese: `${nomeMese(mese, locale)} (${nomeAmbito})` })}
                url={ambito === "lega" && lega ? `${sito}/${locale}/leghe/${lega.codice}` : `${sito}/${locale}`}
                etichetta={t("condividi.classifica")}
              />
            </div>
          )}
        </div>
      )}

      {puoMostrare && lista.length === 0 && <div className="mt-4"><Vuoto emoji="🏆" testo={t("classifica.nessuno")} colore="bg-sole-chiaro" /></div>}
      {puoMostrare && lista.length > 0 && (
        <>
          <Podio righe={lista.slice(0, 3)} io={user?.id} tu={t("classifica.tu")} />
          {lista.length > 3 && (
            <ol className="scheda mt-4 divide-y divide-sabbia-scura/40 p-0">
              {lista.slice(3).map((r) => {
                const sonoIo = r.utente_id === user?.id;
                return (
                  <li key={r.utente_id} className={`flex items-center gap-3 px-4 py-3 ${sonoIo ? "bg-sole-chiaro" : ""}`}>
                    <span className="w-7 text-center font-black tabular-nums text-nebbia">{r.posizione}</span>
                    <span aria-hidden>{bandiera(r.paese)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {r.nickname}
                      {sonoIo && <span className="chip ml-2 bg-sole text-inchiostro">{t("classifica.tu")}</span>}
                    </span>
                    <span className="font-black tabular-nums">{r.punti}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

/** I primi tre sul podio: il primo al centro e più in alto. */
function Podio({ righe, io, tu }: { righe: RigaClassifica[]; io?: string; tu: string }) {
  const ordine = [righe[1], righe[0], righe[2]];
  const stile = [
    { altezza: "h-20", colore: "bg-cielo", medaglia: "bg-[#c9d3da]" },
    { altezza: "h-28", colore: "bg-sole", medaglia: "bg-[#f5b400]" },
    { altezza: "h-14", colore: "bg-sabbia-scura", medaglia: "bg-[#d79a62]" },
  ];
  return (
    <div className="mt-6 grid grid-cols-3 items-end gap-2">
      {ordine.map((r, i) =>
        r ? (
          <div key={r.utente_id} className="flex flex-col items-center gap-1.5 text-center">
            <span className={`grid h-12 w-12 place-items-center rounded-full ${stile[i].medaglia} text-lg font-black text-white ring-4 ring-white`}>{r.nickname.slice(0, 1).toUpperCase()}</span>
            <span className="w-full truncate text-sm font-bold">
              {bandiera(r.paese)} {r.nickname}
            </span>
            {r.utente_id === io && <span className="chip bg-sole text-inchiostro">{tu}</span>}
            <div className={`flex w-full ${stile[i].altezza} flex-col items-center justify-start rounded-t-2xl ${stile[i].colore} pt-2`}>
              <span className="text-2xl font-black">{r.posizione}</span>
              <span className="text-xs font-bold tabular-nums">{r.punti} pt</span>
            </div>
          </div>
        ) : (
          <div key={i} />
        ),
      )}
    </div>
  );
}
