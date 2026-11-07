"use client";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Conto alla rovescia preciso fino alla chiusura: "2 g 4 h", "5 h 20 min", "12 min".
 * Passando sopra (o tenendo premuto) si vede data e ora esatte. Si aggiorna ogni minuto.
 */
export default function Tra({ iso }: { iso: string }) {
  const lingua = useLocale();
  const t = useTranslations("tempo");
  const [ora, setOra] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setOra(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const minuti = Math.max(0, Math.floor((new Date(iso).getTime() - ora) / 60_000));
  const g = Math.floor(minuti / 1440);
  const h = Math.floor((minuti % 1440) / 60);
  const m = minuti % 60;
  const testo = g > 0 ? t("giorniOre", { g, h }) : h > 0 ? t("oreMinuti", { h, m }) : t("minuti", { m: Math.max(1, m) });
  return (
    <time dateTime={iso} suppressHydrationWarning title={new Date(iso).toLocaleString(lingua, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}>
      {testo}
    </time>
  );
}
