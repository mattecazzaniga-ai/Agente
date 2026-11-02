import { getTranslations } from "next-intl/server";

/** Avviso legale sempre visibile: gioco gratuito, niente scommesse né denaro. */
export default async function Avviso({ grande = false }: { grande?: boolean }) {
  const t = await getTranslations();
  return grande ? (
    <p className="rounded-2xl border border-sole/60 bg-sole/15 px-3 py-2 text-center text-sm font-medium">⚠️ {t("avviso")}</p>
  ) : (
    <p className="text-center text-xs text-nebbia">{t("avviso")}</p>
  );
}
