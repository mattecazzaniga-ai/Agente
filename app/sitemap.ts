import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { indirizzoSito } from "@/lib/sito";
import { routing } from "@/i18n/routing";

export const revalidate = 3600;

/** Pagine pubbliche nelle quattro lingue: home, sezioni, tornei e articoli. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sito = await indirizzoSito();
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const [{ data: tornei }, { data: notizie }] = await Promise.all([
    db.from("tornei").select("id, data_fine").order("data_inizio", { ascending: false }).limit(500),
    db.from("notizie").select("id, pubblicata_at").eq("stato", "pubblicata").lte("pubblicata_at", new Date().toISOString()).limit(500),
  ]);
  const percorsi: { p: string; quando?: string }[] = [
    { p: "" },
    { p: "/tornei" },
    { p: "/classifica" },
    { p: "/notizie" },
    ...((tornei as { id: string; data_fine: string }[]) ?? []).map((t) => ({ p: `/tornei/${t.id}`, quando: t.data_fine })),
    ...((notizie as { id: string; pubblicata_at: string }[]) ?? []).map((n) => ({ p: `/notizie/${n.id}`, quando: n.pubblicata_at })),
  ];
  return percorsi.flatMap(({ p, quando }) =>
    routing.locales.map((l) => ({ url: `${sito}/${l}${p}`, ...(quando ? { lastModified: new Date(quando) } : {}) })),
  );
}
