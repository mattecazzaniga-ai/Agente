import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bandiera, data } from "@/lib/formato";
import type { Torneo } from "@/lib/tipi";
import { IconaFreccia } from "./Icone";

const COLORI_STATO = {
  in_corso: "bg-corallo/15 text-corallo",
  in_programma: "bg-onda text-mare-scuro",
  concluso: "bg-sabbia text-nebbia",
} as const;

/** Torneo in elenco: la data come un foglietto del calendario, poi nome, luogo e stato. */
export default async function RigaTorneo({ torneo: to, scheda = false }: { torneo: Torneo; scheda?: boolean }) {
  const [t, lingua] = await Promise.all([getTranslations(), getLocale()]);
  const giorno = new Date(`${to.data_inizio}T12:00:00Z`);
  return (
    <Link href={`/tornei/${to.id}`} className={`flex items-center gap-3 ${scheda ? "scheda" : "px-4 py-3"} transition active:bg-crema`}>
      <span className={`flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border-2 ${to.stato === "in_corso" ? "border-corallo/40" : "border-sabbia-scura"} bg-white`}>
        <span className={`w-full py-0.5 text-center text-[10px] font-black uppercase tracking-wide text-white ${to.stato === "in_corso" ? "bg-corallo" : "bg-mare"}`}>
          {new Intl.DateTimeFormat(lingua, { month: "short", timeZone: "UTC" }).format(giorno).replace(".", "")}
        </span>
        <span className="py-0.5 text-xl font-black leading-tight">{giorno.getUTCDate()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold">{to.nome}</span>
        <span className="block truncate text-sm text-nebbia">
          {bandiera(to.paese)} {to.luogo} · {t("tornei.dal", { inizio: data(to.data_inizio, lingua), fine: data(to.data_fine, lingua) })}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span className={`chip ${COLORI_STATO[to.stato]}`}>
            {to.stato === "in_corso" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-corallo" />}
            {t(`stato.${to.stato}`)}
          </span>
          <span className="chip bg-sabbia text-inchiostro">
            {to.circuito}
            {to.categoria ? ` ${to.categoria}` : ""}
          </span>
        </span>
      </span>
      <IconaFreccia className="h-5 w-5 shrink-0 text-nebbia" />
    </Link>
  );
}
