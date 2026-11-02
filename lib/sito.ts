import "server-only";
import { headers } from "next/headers";

/** Indirizzo pubblico del sito (per link d'invito e condivisioni). */
export async function indirizzoSito(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Pagina di accesso che poi riporta qui. */
export const urlAccesso = (lingua: string, dopo: string) => `/${lingua}/accedi?dopo=${encodeURIComponent(dopo)}`;
