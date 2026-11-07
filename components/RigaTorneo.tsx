import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bandiera, data } from "@/lib/formato";
import type { Torneo } from "@/lib/tipi";
import { IconaFreccia } from "./Icone";

/** Torneo in elenco: giorno e mese in grande, nome, luogo e date, categoria e stato. */
export default async function RigaTorneo({ torneo: to, scheda = false }: { torneo: Torneo; scheda?: boolean }) {
  const [t, lingua] = await Promise.all([getTranslations(), getLocale()]);
  const giorno = new Date(`${to.data_inizio}T12:00:00Z`);
  const live = to.stato === "in_corso";
  return (
    <Link href={`/tornei/${to.id}`} className={`group flex items-center gap-4 px-4 py-3.5 transition hover:bg-pannello-2 active:bg-linea/50 ${scheda ? "pannello solleva" : ""}`}>
      <span className="w-11 shrink-0 text-center">
        <span className="cifre block text-[28px] leading-none">{giorno.getUTCDate()}</span>
        <span className="block font-display text-[12px] font-bold uppercase tracking-wider text-tenue">
          {new Intl.DateTimeFormat(lingua, { month: "short", timeZone: "UTC" }).format(giorno).replace(".", "")}
        </span>
      </span>
      <span className="min-w-0 flex-1 border-l border-linea pl-4">
        <span className="flex items-center gap-2">
          <span className="chip bg-testo text-notte">
            {to.circuito}
            {to.categoria ? ` ${to.categoria}` : ""}
          </span>
          {live ? (
            <span className="chip-live">
              <span className="punto-live" /> {t("stato.in_corso")}
            </span>
          ) : to.stato === "concluso" ? (
            <span className="chip">{t("stato.concluso")}</span>
          ) : null}
        </span>
        <span className="mt-1 block truncate font-display text-[19px] font-bold uppercase leading-tight tracking-tight">{to.nome}</span>
        <span className="block truncate text-sm text-tenue">
          {bandiera(to.paese)} {to.luogo} · {t("tornei.dal", { inizio: data(to.data_inizio, lingua), fine: data(to.data_fine, lingua) })}
        </span>
      </span>
      <IconaFreccia className="h-4 w-4 shrink-0 text-tenue transition group-hover:translate-x-0.5 group-hover:text-testo" />
    </Link>
  );
}
