import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { meseIso, nomeMese } from "@/lib/formato";
import { cartolina, linguaValida } from "@/lib/cartolina";

// Immagine con la propria posizione in classifica (mese, ambito, lega).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lingua = linguaValida(u.searchParams.get("lingua"));
  const mese = /^\d{4}-\d{2}-01$/.test(u.searchParams.get("mese") ?? "") ? u.searchParams.get("mese")! : meseIso();
  const ambito = ["paese", "lega"].includes(u.searchParams.get("ambito") ?? "") ? u.searchParams.get("ambito")! : "globale";
  const legaId = u.searchParams.get("lega");
  const t = await getTranslations({ locale: lingua });
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profilo } = await supabase.from("profili").select("nickname, paese").eq("id", user.id).single();
  const lega = ambito === "lega" && legaId && /^[0-9a-f-]{36}$/i.test(legaId) ? (await supabase.from("leghe").select("id, nome").eq("id", legaId).maybeSingle()).data : null;
  const { data } = await supabase.rpc("mia_posizione", { p_mese: mese, p_ambito: ambito, p_paese: profilo?.paese ?? null, p_lega: lega?.id ?? null });
  const io = (data as { posizione: number; punti: number; partecipanti: number }[] | null)?.[0];
  if (!io) return new Response("Not found", { status: 404 });
  const nomeAmbito = ambito === "lega" ? (lega?.nome ?? t("classifica.lega")) : ambito === "paese" ? t("classifica.paese") : t("classifica.globale");
  return cartolina({
    etichetta: `${t("classifica.titolo")} · ${nomeMese(mese, lingua)}`,
    titolo: `#${io.posizione}`,
    riga: `${profilo?.nickname ?? ""} · ${io.punti} ${t("classifica.punti").toLowerCase()}`,
    dettaglio: `${nomeAmbito} · ${t("classifica.sei", { posizione: io.posizione, totale: io.partecipanti })}`,
    piede: t("condividi.testoClassifica", { posizione: io.posizione, mese: nomeMese(mese, lingua) }),
    avviso: t("avviso"),
  });
}
