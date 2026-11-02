import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { bandiera, data } from "@/lib/formato";
import { CIRCUITI, type Circuito, type StatoTorneo, type Torneo } from "@/lib/tipi";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("tornei.titolo") };
}

const STATI: { valore?: StatoTorneo; chiave: string }[] = [
  { chiave: "tutti" },
  { valore: "in_corso", chiave: "inCorso" },
  { valore: "in_programma", chiave: "inProgramma" },
  { valore: "concluso", chiave: "conclusi" },
];

export default async function Tornei({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ stato?: string; circuito?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const stato = STATI.find((s) => s.valore === sp.stato)?.valore;
  const circuito = CIRCUITI.includes(sp.circuito as Circuito) ? (sp.circuito as Circuito) : undefined;
  const t = await getTranslations();
  const supabase = await supabaseServer();
  let q = supabase.from("tornei").select("*").order("data_inizio", { ascending: stato !== "concluso" }).limit(100);
  if (stato) q = q.eq("stato", stato);
  if (circuito) q = q.eq("circuito", circuito);
  const { data: righe } = await q;
  const tornei = (righe as Torneo[]) ?? [];
  // Senza filtro: prima quelli in corso, poi i prossimi, poi i conclusi (dal più recente).
  if (!stato) {
    const peso = { in_corso: 0, in_programma: 1, concluso: 2 };
    tornei.sort((a, b) => peso[a.stato] - peso[b.stato] || (a.stato === "concluso" ? b.data_inizio.localeCompare(a.data_inizio) : a.data_inizio.localeCompare(b.data_inizio)));
  }
  const link = (s?: string, c?: string) => {
    const u = new URLSearchParams();
    if (s) u.set("stato", s);
    if (c) u.set("circuito", c);
    const qs = u.toString();
    return `/tornei${qs ? `?${qs}` : ""}`;
  };
  const pill = (attiva: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${attiva ? "bg-mare text-white" : "bg-white text-inchiostro shadow-sm"}`;

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t("tornei.titolo")}</h1>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {STATI.map((s) => (
          <Link key={s.chiave} href={link(s.valore, circuito)} className={pill(stato === s.valore)}>
            {t(`tornei.${s.chiave}`)}
          </Link>
        ))}
      </div>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={link(stato)} className={pill(!circuito)}>
          {t("tornei.tutti")}
        </Link>
        {CIRCUITI.map((c) => (
          <Link key={c} href={link(stato, c)} className={pill(circuito === c)}>
            {c}
          </Link>
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {tornei.length === 0 && <li className="scheda text-sm text-nebbia">{t("tornei.nessuno")}</li>}
        {tornei.map((to) => (
          <li key={to.id}>
            <Link href={`/tornei/${to.id}`} className="scheda flex items-center gap-3">
              <span className="text-3xl" aria-hidden>{bandiera(to.paese)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{to.nome}</span>
                <span className="block text-sm text-nebbia">{to.luogo}</span>
                <span className="block text-xs text-nebbia">{t("tornei.dal", { inizio: data(to.data_inizio, locale), fine: data(to.data_fine, locale, { day: "numeric", month: "short", year: "numeric" }) })}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="chip">
                  {to.circuito}
                  {to.categoria ? ` ${to.categoria}` : ""}
                </span>
                <span className={`chip ${to.stato === "in_corso" ? "bg-sole/30 text-inchiostro" : to.stato === "concluso" ? "bg-sabbia text-nebbia" : ""}`}>{t(`stato.${to.stato}`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
