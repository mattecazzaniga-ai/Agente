import { getTranslations, setRequestLocale } from "next-intl/server";
import Intestazione from "@/components/Intestazione";
import { Link } from "@/i18n/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Vuoto from "@/components/Vuoto";
import RigaTorneo from "@/components/RigaTorneo";
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
  const pill = (attiva: boolean) =>
    `shrink-0 rounded-md px-3 py-1.5 font-display text-[14px] font-bold uppercase tracking-wider transition ${attiva ? "bg-testo text-notte" : "text-tenue hover:text-testo"}`;

  return (
    <div>
      <Intestazione titolo={t("tornei.titolo")} sotto={t("tornei.sottotitoloPagina")} />
      <div className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {STATI.map((s) => (
          <Link key={s.chiave} href={link(s.valore, circuito)} className={pill(stato === s.valore)}>
            {t(`tornei.${s.chiave}`)}
          </Link>
        ))}
      </div>
      {tornei.length === 0 ? (
        <div className="mt-4">
          <Vuoto testo={t("tornei.nessuno")} />
        </div>
      ) : (
        <ul className="pannello mt-4 divide-y divide-linea overflow-hidden">
          {tornei.map((to) => (
            <li key={to.id}>
              <RigaTorneo torneo={to} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
