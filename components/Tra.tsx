"use client";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

/** "tra 3 ore", "tra 2 giorni": più facile da capire di una data. Si aggiorna ogni minuto. */
export default function Tra({ iso }: { iso: string }) {
  const lingua = useLocale();
  const [ora, setOra] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setOra(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const diff = (new Date(iso).getTime() - ora) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lingua, { numeric: "auto" });
  const a = Math.abs(diff);
  const testo = a < 3600 ? rtf.format(Math.round(diff / 60), "minute") : a < 86400 - 1800 ? rtf.format(Math.round(diff / 3600), "hour") : rtf.format(Math.round(diff / 86400), "day");
  return (
    <time dateTime={iso} suppressHydrationWarning title={new Date(iso).toLocaleString(lingua)}>
      {testo}
    </time>
  );
}
