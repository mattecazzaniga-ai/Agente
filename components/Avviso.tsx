import { getTranslations } from "next-intl/server";

/** Avviso sempre visibile: gioco gratuito, niente scommesse né denaro. Tono sereno, non d'allarme. */
export default async function Avviso({ grande = false }: { grande?: boolean }) {
  const t = await getTranslations();
  return grande ? (
    <p className="flex items-center justify-center gap-2 rounded-full bg-menta-chiaro px-4 py-2.5 text-center text-sm font-semibold text-menta">
      <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-menta text-[11px] font-black text-white">✓</span>
      {t("avviso")}
    </p>
  ) : (
    <p className="text-center text-xs text-nebbia">{t("avviso")}</p>
  );
}
