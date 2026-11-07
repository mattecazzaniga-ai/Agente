import { redirect } from "next/navigation";
import TestataFoto from "@/components/TestataFoto";
import { FOTO } from "@/lib/foto";
import Vuoto from "@/components/Vuoto";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mieLeghe, sessione } from "@/lib/dati";
import { bandiera, meseIso, nomeMese } from "@/lib/formato";
import type { RigaClassifica } from "@/lib/tipi";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import { esciLega } from "../azioni";
import FormLeghe from "@/components/FormLeghe";
import Invita from "@/components/Invita";
import { IconaAmici, IconaPodio } from "@/components/Icone";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("leghe.titolo") };
}

export default async function Leghe({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, supabase } = await sessione();
  if (!user) redirect(urlAccesso(locale, `/${locale}/leghe`));
  const [t, leghe, sito] = await Promise.all([getTranslations(), mieLeghe(), indirizzoSito()]);
  const mese = meseIso();
  // per ogni lega: i primi tre del mese e la mia posizione
  const situazioni = await Promise.all(
    leghe.map(async (l) => {
      const arg = { p_mese: mese, p_ambito: "lega", p_paese: null, p_lega: l.id };
      const [{ data: primi }, { data: mia }] = await Promise.all([supabase.rpc("classifica", { ...arg, p_limite: 3 }), supabase.rpc("mia_posizione", arg)]);
      return { primi: (primi as RigaClassifica[] | null) ?? [], io: (mia as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0] };
    }),
  );
  return (
    <div>
      <TestataFoto foto={FOTO.squadre} titolo={t("leghe.titolo")} sotto={t("leghe.sottotitoloPagina")} posizione="50% 30%" />
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-8">
      <div>
      <h2 className="titolo-sezione">{t("leghe.mie")}</h2>
      {leghe.length === 0 && <Vuoto testo={t("leghe.nessuna")} />}
      <div className="space-y-3">
      {leghe.map((l) => (
        <div key={l.id} className="pannello space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold tracking-tight">{l.nome}</p>
              <p className="flex items-center gap-2 text-sm text-tenue">
                <span className="cifre tracking-[.2em] text-inchiostro">{l.codice}</span>
                <span className="inline-flex items-center gap-1">
                  <IconaAmici className="h-4 w-4" /> {l.membri}
                </span>
              </p>
            </div>
            <Link href={`/classifica?ambito=lega&lega=${l.id}`} className="chip py-1.5">
              <IconaPodio className="h-4 w-4" /> {t("leghe.classifica")}
            </Link>
          </div>
          {(() => {
            const { primi, io } = situazioni[leghe.indexOf(l)];
            if (!primi.length) return <p className="rounded-lg bg-sabbia-2 px-3 py-2 text-sm text-tenue">{t("leghe.nessunPunto", { mese: nomeMese(mese, locale) })}</p>;
            const davanti = io && io.posizione > 1 ? primi.find((r) => r.posizione === io.posizione - 1) : undefined;
            return (
              <div className="overflow-hidden rounded-lg border border-linea">
                <ol className="divide-y divide-linea">
                  {primi.map((r) => (
                    <li key={r.utente_id} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.utente_id === user.id ? "bg-viola/10" : ""}`}>
                      <span className={`cifre w-5 text-base ${r.posizione === 1 ? "text-viola" : "text-tenue"}`}>{r.posizione}</span>
                      <Link href={`/giocatore/${r.utente_id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-viola">
                        {bandiera(r.paese)} {r.nickname}
                      </Link>
                      <span className="cifre text-base">{r.punti}</span>
                    </li>
                  ))}
                </ol>
                {io && (
                  <p className="border-t border-linea bg-sabbia-2/60 px-3 py-2 text-sm">
                    <span className="font-semibold">{t("leghe.tuSei", { posizione: io.posizione, totale: io.partecipanti })}</span>
                    {davanti ? <span className="text-tenue"> · {t("classifica.distacco", { punti: davanti.punti - io.punti + 1, nome: davanti.nickname })}</span> : io.posizione === 1 ? <span className="text-tenue"> · {t("leghe.inTesta")}</span> : null}
                  </p>
                )}
              </div>
            );
          })()}
          <Invita nome={l.nome} codice={l.codice} sito={sito} />
          <form action={esciLega}>
            <input type="hidden" name="lega" value={l.id} />
            <button className="text-xs text-tenue underline-offset-2 hover:text-corallo hover:underline">{t("leghe.esci")}</button>
          </form>
        </div>
      ))}
      </div>
      </div>
      <aside>
        <h2 className="titolo-sezione">{t("leghe.entraOCrea")}</h2>
        <FormLeghe sito={sito} />
      </aside>
      </div>
    </div>
  );
}
