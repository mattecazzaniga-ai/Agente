import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { SELECT_COPPIA } from "@/lib/dati";
import { nomeCoppia } from "@/lib/formato";
import type { Coppia } from "@/lib/tipi";
import { cartolina, linguaValida } from "@/lib/cartolina";

// Immagine di un pronostico. La RLS fa vedere solo i propri: chi non è il proprietario riceve 404.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const tipo = u.searchParams.get("tipo");
  const lingua = linguaValida(u.searchParams.get("lingua"));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const t = await getTranslations({ locale: lingua });
  const supabase = await supabaseServer();

  if (tipo === "torneo") {
    const { data } = await supabase
      .from("pronostici_torneo")
      .select(`vincitore:coppie!pronostici_torneo_vincitore_id_fkey(${SELECT_COPPIA}), finalista:coppie!pronostici_torneo_finalista_id_fkey(${SELECT_COPPIA}), tabellone:tabelloni(genere, torneo:tornei(nome))`)
      .eq("id", id)
      .maybeSingle();
    if (!data) return new Response("Not found", { status: 404 });
    const d = data as unknown as { vincitore: Coppia; finalista: Coppia | null; tabellone: { genere: string; torneo: { nome: string } } };
    return cartolina({
      etichetta: t("torneo.vincitore"),
      titolo: nomeCoppia(d.vincitore),
      riga: `${d.tabellone.torneo.nome} · ${t(`genere.${d.tabellone.genere}`)}`,
      dettaglio: d.finalista ? `${t("torneo.finalista").split(" (")[0]}: ${nomeCoppia(d.finalista)}` : undefined,
      piede: t("condividi.testoPronostico", { scelta: nomeCoppia(d.vincitore) }),
      avviso: t("avviso"),
    });
  }

  const { data } = await supabase
    .from("pronostici_partita")
    .select(
      `set_vincitore, set_perdente, totale_game, vincitore:coppie!pronostici_partita_vincitore_id_fkey(${SELECT_COPPIA}), partita:partite(turno, coppia_a:coppie!partite_coppia_a_id_fkey(${SELECT_COPPIA}), coppia_b:coppie!partite_coppia_b_id_fkey(${SELECT_COPPIA}), tabellone:tabelloni(genere, torneo:tornei(nome)))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  const d = data as unknown as {
    set_vincitore: number | null;
    set_perdente: number | null;
    totale_game: number | null;
    vincitore: Coppia;
    partita: { turno: string; coppia_a: Coppia; coppia_b: Coppia; tabellone: { genere: string; torneo: { nome: string } } };
  };
  const extra = [d.set_vincitore != null ? `${t("partita.set")} ${d.set_vincitore}-${d.set_perdente}` : "", d.totale_game ? `${t("partita.game")}: ${d.totale_game}` : ""].filter(Boolean).join(" · ");
  return cartolina({
    etichetta: t("partita.chiVince"),
    titolo: nomeCoppia(d.vincitore),
    riga: `${nomeCoppia(d.partita.coppia_a)} vs ${nomeCoppia(d.partita.coppia_b)}`,
    dettaglio: [`${d.partita.tabellone.torneo.nome} · ${t(`turno.${d.partita.turno}`)}`, extra].filter(Boolean).join(" · "),
    piede: t("condividi.testoPronostico", { scelta: nomeCoppia(d.vincitore) }),
    avviso: t("avviso"),
  });
}
