"use client";
import { useLocale } from "next-intl";

/** Data e ora nel fuso del telefono (sul server si mostra in UTC, poi il browser corregge). */
export default function Ora({ iso, solo = "dataOra" }: { iso: string; solo?: "data" | "dataOra" | "ora" }) {
  const lingua = useLocale();
  const opzioni: Intl.DateTimeFormatOptions =
    solo === "data" ? { day: "numeric", month: "short" } : solo === "ora" ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  const testo = new Intl.DateTimeFormat(lingua, opzioni).format(new Date(iso));
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {testo}
    </time>
  );
}
