import { getTranslations, setRequestLocale } from "next-intl/server";
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
  const tab = (a: Ambito) => `flex-1 rounded-full py-2 text-center text-sm font-semibold ${ambito === a ? "bg-mare text-white" : "bg-white shadow-sm"}`;
  const nomeAmbito = ambito === "lega" ? lega?.nome : ambito === "paese" ? `${bandiera(profilo?.paese)} ${t("classifica.paese")}` : t("classifica.globale");
  const immagine = `/api/immagine/classifica?${new URLSearchParams({ mese, ambito, lingua: locale, ...(lega ? { lega: lega.id } : {}) })}`;

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t("classifica.titolo")}</h1>
      <div className="mt-3 flex gap-2">
        <Link href={href("globale")} className={tab("globale")}>
          🌍 {t("classifica.globale")}
        </Link>
        <Link href={href("paese")} className={tab("paese")}>
          {bandiera(profilo?.paese)} {t("classifica.paese")}
        </Link>
        <Link href={href("lega", lega ? { lega: lega.id } : {})} className={tab("lega")}>
          👥 {t("classifica.lega")}
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
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
        <div className="scheda mt-4 space-y-3 bg-onda">
          <p className="font-semibold">{io ? t("classifica.sei", { posizione: io.posizione, totale: io.partecipanti }) + ` · ${io.punti} ${t("classifica.punti").toLowerCase()}` : t("classifica.senzaPunti")}</p>
          {io && (
            <Condividi
              immagine={immagine}
              testo={t("condividi.testoClassifica", { posizione: io.posizione, mese: `${nomeMese(mese, locale)} (${nomeAmbito})` })}
              url={ambito === "lega" && lega ? `${sito}/${locale}/leghe/${lega.codice}` : `${sito}/${locale}`}
              etichetta={t("condividi.classifica")}
            />
          )}
        </div>
      )}

      {puoMostrare && (
        <ol className="scheda mt-4 divide-y divide-sabbia p-0">
          {lista.length === 0 && <li className="p-4 text-sm text-nebbia">{t("classifica.nessuno")}</li>}
          {lista.map((r) => {
            const sonoIo = r.utente_id === user?.id;
            return (
              <li key={r.utente_id} className={`flex items-center gap-3 px-4 py-2.5 ${sonoIo ? "bg-sole/20" : ""}`}>
                <span className={`w-8 text-center font-extrabold tabular-nums ${r.posizione <= 3 ? "text-lg" : "text-nebbia"}`}>{r.posizione <= 3 ? ["🥇", "🥈", "🥉"][r.posizione - 1] : r.posizione}</span>
                <span aria-hidden>{bandiera(r.paese)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.nickname}
                  {sonoIo && <span className="chip ml-2">{t("classifica.tu")}</span>}
                </span>
                <span className="font-bold tabular-nums">{r.punti}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
