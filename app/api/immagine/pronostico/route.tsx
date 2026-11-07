import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { SELECT_COPPIA } from "@/lib/dati";
import { nomeCoppia } from "@/lib/formato";
import type { Coppia } from "@/lib/tipi";
import { cartolina, linguaValida } from "@/lib/cartolina";
import { indirizzoSito } from "@/lib/sito";

// Immagine di un pronostico. La RLS fa vedere solo i propri: chi non è il proprietario riceve 404.
export async function GET(req: Request) {
  const sitoBreve = (await indirizzoSito()).replace(/^https?:\/\//, "");
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
      etichetta: t("condividi.etichettaTorneo"),
      titolo: nomeCoppia(d.vincitore),
      riga: `${d.tabellone.torneo.nome} · ${t(`genere.${d.tabellone.genere}`)}`,
      dettaglio: d.finalista ? `${t("torneo.finalista").split(" (")[0]}: ${nomeCoppia(d.finalista)}` : undefined,
      piede: t("condividi.invito"),
      sito: sitoBreve,
      avviso: t("avviso"),
    });
  }

  const { data } = await supabase
    .from("pronostici_partita")
    .select(
      `set_vincitore, set_perdente, game_a, game_b, game_previsti_a, game_previsti_b, vincitore_id, vincitore:coppie!pronostici_partita_vincitore_id_fkey(${SELECT_COPPIA}), partita:partite(turno, coppia_a:coppie!partite_coppia_a_id_fkey(${SELECT_COPPIA}), coppia_b:coppie!partite_coppia_b_id_fkey(${SELECT_COPPIA}), tabellone:tabelloni(genere, torneo:tornei(nome)))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  const d = data as unknown as {
    set_vincitore: number | null;
    set_perdente: number | null;
    game_a: number[] | null;
    game_b: number[] | null;
    game_previsti_a: number | null;
    game_previsti_b: number | null;
    vincitore_id: string;
    vincitore: Coppia;
    partita: { turno: string; coppia_a: Coppia; coppia_b: Coppia; tabellone: { genere: string; torneo: { nome: string } } };
  };
  // punteggio set per set dal lato del vincitore scelto, es. "6-4 3-6 10-8"
  const daA = d.vincitore_id === d.partita.coppia_a.id;
  const punteggio = d.game_a && d.game_b ? d.game_a.map((x, i) => (daA ? `${x}-${d.game_b![i]}` : `${d.game_b![i]}-${x}`)).join("  ") : d.set_vincitore != null ? `${d.set_vincitore}-${d.set_perdente}` : undefined;
  const avversari = daA ? d.partita.coppia_b : d.partita.coppia_a;
  return cartolina({
    etichetta: t("condividi.etichettaPronostico"),
    titolo: nomeCoppia(d.vincitore),
    grande: punteggio,
    riga: `vs ${nomeCoppia(avversari)}`,
    dettaglio: `${d.partita.tabellone.torneo.nome} · ${t(`turno.${d.partita.turno}`)}`,
    piede: t("condividi.invito"),
    sito: sitoBreve,
    avviso: t("avviso"),
  });
}
