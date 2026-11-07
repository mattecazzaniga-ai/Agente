import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Immagine quadrata da condividere (WhatsApp, storie Instagram), con la stessa identità del sito:
// fondo blu notte, testo bianco caldo, accento lime, Barlow Condensed letto dal disco (nessuna chiamata di rete).
export const LATO = 1080;

const font = (peso: number) => readFile(join(process.cwd(), "assets/font", `barlow-condensed-latin-${peso}-normal.woff`));

export async function cartolina({ etichetta, titolo, riga, dettaglio, piede, avviso }: { etichetta: string; titolo: string; riga?: string; dettaglio?: string; piede: string; avviso: string }) {
  const [f600, f800] = await Promise.all([font(600), font(800)]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0b1018", color: "#f3eee3", padding: 80, fontFamily: "Barlow Condensed" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: 30, background: "#d4f53c", display: "flex" }} />
          <div style={{ fontSize: 56, fontWeight: 800, textTransform: "uppercase", display: "flex" }}>
            Beach<span style={{ color: "#d4f53c", marginLeft: 14 }}>Peck</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 38, color: "#8d98aa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 4 }}>
            <div style={{ width: 10, height: 44, borderRadius: 5, background: "#d4f53c", display: "flex" }} />
            {etichetta}
          </div>
          <div style={{ fontSize: titolo.length > 26 ? 96 : 128, fontWeight: 800, lineHeight: 0.95, textTransform: "uppercase" }}>{titolo}</div>
          {riga && <div style={{ fontSize: 46, fontWeight: 600, color: "#f3eee3", opacity: 0.85 }}>{riga}</div>}
          {dettaglio && <div style={{ fontSize: 40, fontWeight: 600, color: "#d4f53c" }}>{dettaglio}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, borderTop: "2px solid #263142", paddingTop: 32 }}>
          <div style={{ fontSize: 40, fontWeight: 600, display: "flex" }}>{piede}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#8d98aa" }}>{avviso}</div>
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
