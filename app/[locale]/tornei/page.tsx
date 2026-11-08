import { getTranslations, setRequestLocale } from "next-intl/server";
import Intestazione from "@/components/Intestazione";
import { Link } from "@/i18n/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Vuoto from "@/components/Vuoto";
import RigaTorneo from "@/components/RigaTorneo";
import { situazioneTornei } from "@/lib/dati";
import { CIRCUITI, GENERI, type Circuito, type StatoTorneo, type Torneo } from "@/lib/tipi";
import { bandiera } from "@/lib/formato";

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

export default async function Tornei({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ stato?: string; circuito?: string; q?: string; categoria?: string; paese?: string; genere?: string }> }) {
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
  const tuttiQui = (righe as Torneo[]) ?? [];
  // filtri: testo (nome o città), categoria ITF, Paese, genere del tabellone
  const cerca = (sp.q ?? "").trim().toLowerCase().slice(0, 60);
  const categorie = [...new Set(tuttiQui.map((x) => x.categoria).filter(Boolean))].sort((a, b) => Number(String(b).replace(/\D/g, "")) - Number(String(a).replace(/\D/g, ""))) as string[];
  const paesi = [...new Set(tuttiQui.map((x) => x.paese).filter(Boolean))].sort() as string[];
  const situazioneTutti = await situazioneTornei(tuttiQui.map((x) => x.id));
  const tornei = tuttiQui.filter(
    (x) =>
      (!cerca || `${x.nome} ${x.luogo}`.toLowerCase().includes(cerca)) &&
      (!sp.categoria || x.categoria === sp.categoria) &&
      (!sp.paese || x.paese === sp.paese) &&
      (!sp.genere || situazioneTutti[x.id]?.generi.includes(sp.genere)),
  );
  const filtriAttivi = [cerca, sp.categoria, sp.paese, sp.genere].filter(Boolean).length;
  // Senza filtro: prima quelli in corso, poi i prossimi, poi i conclusi (dal più recente).
  if (!stato) {
    const peso = { in_corso: 0, in_programma: 1, concluso: 2 };
    tornei.sort((a, b) => peso[a.stato] - peso[b.stato] || (a.stato === "concluso" ? b.data_inizio.localeCompare(a.data_inizio) : a.data_inizio.localeCompare(b.data_inizio)));
  }
  const situazione = situazioneTutti;
  const link = (s?: string, c?: string) => {
    const u = new URLSearchParams();
    if (s) u.set("stato", s);
    if (c) u.set("circuito", c);
    const qs = u.toString();
    return `/tornei${qs ? `?${qs}` : ""}`;
  };
  const pill = (attiva: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-[15px] font-semibold transition ${attiva ? "bg-viola text-white" : "text-tenue hover:text-inchiostro"}`;

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
      <details className="pannello mt-3 group" open={filtriAttivi > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            {t("tornei.cercaFiltra")}
            {filtriAttivi > 0 && <span className="cifre ml-2 rounded bg-viola px-1.5 text-white">{filtriAttivi}</span>}
          </span>
          <span className="text-viola transition group-open:rotate-45" aria-hidden>+</span>
        </summary>
        <form action="" className="grid gap-2 border-t border-linea p-3 sm:grid-cols-4">
          {stato && <input type="hidden" name="stato" value={stato} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder={t("tornei.cerca")} aria-label={t("tornei.cerca")} className="campo sm:col-span-4" />
          <select name="categoria" defaultValue={sp.categoria ?? ""} aria-label={t("tornei.categoria")} className="campo">
            <option value="">{t("tornei.tutteCategorie")}</option>
            {categorie.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="paese" defaultValue={sp.paese ?? ""} aria-label={t("tornei.paese")} className="campo">
            <option value="">{t("tornei.tuttiPaesi")}</option>
            {paesi.map((p) => (
              <option key={p} value={p}>
                {bandiera(p)} {p}
              </option>
            ))}
          </select>
          <select name="genere" defaultValue={sp.genere ?? ""} aria-label={t("tornei.genere")} className="campo">
            <option value="">{t("tornei.tuttiGeneri")}</option>
            {GENERI.map((g) => (
              <option key={g} value={g}>
                {t(`genere.${g}`)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="bottone flex-1">{t("tornei.applica")}</button>
            {filtriAttivi > 0 && (
              <Link href={link(stato)} className="bottone-secondario w-auto px-3">
                {t("tornei.azzera")}
              </Link>
            )}
          </div>
        </form>
      </details>
      {tornei.length === 0 ? (
        <div className="mt-4">
          <Vuoto testo={t("tornei.nessuno")} />
        </div>
      ) : (
        <ul className="pannello mt-4 divide-y divide-linea overflow-hidden">
          {tornei.map((to) => (
            <li key={to.id}>
              <RigaTorneo torneo={to} situazione={situazione[to.id]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
