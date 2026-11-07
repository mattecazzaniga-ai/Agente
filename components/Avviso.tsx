import { getTranslations } from "next-intl/server";
import { IconaInfo } from "./Icone";

/** Avviso sempre presente: gioco gratuito, niente scommesse né denaro. */
export default async function Avviso({ grande = false }: { grande?: boolean }) {
  const t = await getTranslations();
  return grande ? (
    <p className="flex items-center gap-2 text-sm text-tenue">
      <IconaInfo className="h-4 w-4 shrink-0 text-mare" />
      {t("avviso")}
    </p>
  ) : (
    <p className="text-xs text-tenue">{t("avviso")}</p>
  );
}
