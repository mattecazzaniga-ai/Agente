import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Immagine quadrata da condividere (WhatsApp, storie Instagram), con la stessa identità del sito:
// fondo sabbia, testo blu scuro, blu mare e pallina gialla, Barlow Condensed letto dal disco (nessuna chiamata di rete).
export const LATO = 1080;

const font = (peso: number) => readFile(join(process.cwd(), "assets/font", `barlow-condensed-latin-${peso}-normal.woff`));

export async function cartolina({ etichetta, titolo, riga, dettaglio, piede, avviso }: { etichetta: string; titolo: string; riga?: string; dettaglio?: string; piede: string; avviso: string }) {
  const [f600, f800] = await Promise.all([font(600), font(800)]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fbf6ec", color: "#13293a", padding: 80, fontFamily: "Barlow Condensed" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: 30, background: "#e8f24a", border: "3px solid #13293a", display: "flex" }} />
          <div style={{ fontSize: 60, fontWeight: 800, display: "flex" }}>
            Beach<span style={{ color: "#0a6a93", marginLeft: 14 }}>Peck</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, color: "#56656f", fontWeight: 600 }}>
            <div style={{ width: 10, height: 44, borderRadius: 5, background: "#0a6a93", display: "flex" }} />
            {etichetta}
          </div>
          <div style={{ fontSize: titolo.length > 26 ? 96 : 128, fontWeight: 800, lineHeight: 1 }}>{titolo}</div>
          {riga && <div style={{ fontSize: 46, fontWeight: 600, color: "#13293a", opacity: 0.85 }}>{riga}</div>}
          {dettaglio && <div style={{ fontSize: 40, fontWeight: 600, color: "#0a6a93" }}>{dettaglio}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, borderTop: "2px solid #e5d9c3", paddingTop: 32 }}>
          <div style={{ fontSize: 40, fontWeight: 600, display: "flex" }}>{piede}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#56656f" }}>{avviso}</div>
        </div>
      </div>
    ),
    {
      width: LATO,
      height: LATO,
      fonts: [
        { name: "Barlow Condensed", data: f600, weight: 600, style: "normal" },
        { name: "Barlow Condensed", data: f800, weight: 800, style: "normal" },
      ],
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}

export const linguaValida = (l: string | null) => (["it", "pt-BR", "es", "en"].includes(l ?? "") ? (l as string) : "it");
