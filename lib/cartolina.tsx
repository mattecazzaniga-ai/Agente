import { ImageResponse } from "next/og";

// Immagine quadrata da condividere (WhatsApp, storie Instagram). Niente emoji né font esterni:
// si usa il carattere incluso in next/og, così l'immagine si genera senza chiamate di rete.
export const LATO = 1080;

export function cartolina({ etichetta, titolo, riga, dettaglio, piede, avviso }: { etichetta: string; titolo: string; riga?: string; dettaglio?: string; piede: string; avviso: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(170deg, #bfe7f5 0%, #e3f4fa 45%, #fbf1df 100%)", color: "#17323f", padding: 80, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "#ffc83d", display: "flex" }} />
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1, display: "flex" }}>Beach<span style={{ color: "#0a7ea4", marginLeft: 14 }}>Peck</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 28 }}>
          <div style={{ fontSize: 40, color: "#0a7ea4", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{etichetta}</div>
          <div style={{ fontSize: titolo.length > 30 ? 76 : 100, fontWeight: 800, lineHeight: 1.05 }}>{titolo}</div>
          {riga && <div style={{ fontSize: 44, opacity: 0.85 }}>{riga}</div>}
          {dettaglio && <div style={{ fontSize: 36, opacity: 0.75 }}>{dettaglio}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 38, fontWeight: 700, background: "#ffc83d", borderRadius: 40, padding: "18px 32px", display: "flex" }}>{piede}</div>
          <div style={{ fontSize: 26, color: "#1fa98a", fontWeight: 700 }}>{avviso}</div>
        </div>
      </div>
    ),
    { width: LATO, height: LATO, headers: { "Cache-Control": "private, max-age=60" } },
  );
}

export const linguaValida = (l: string | null) => (["it", "pt-BR", "es", "en"].includes(l ?? "") ? (l as string) : "it");
