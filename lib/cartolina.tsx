import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Immagine quadrata da condividere (WhatsApp, storie Instagram) nello stile del logo: notte indaco,
// sole giallo-arancio, viola. Logo e font si leggono dal disco: nessuna chiamata di rete.
export const LATO = 1080;

const SOLE = "#f5b731";
const VIOLA = "#5b2bc0";
const NOTTE = "#16103a";
const CREMA = "#fcfaf5";

const file = (nome: string) => readFile(join(process.cwd(), "assets", nome));

export async function cartolina({
  etichetta,
  titolo,
  grande,
  riga,
  dettaglio,
  piede,
  sito,
  avviso,
}: {
  etichetta: string; // es. "Il mio pronostico"
  titolo: string; // es. la coppia scelta o il nickname
  grande?: string; // il numero da mostrare enorme: punteggio o posizione
  riga?: string;
  dettaglio?: string;
  piede: string; // invito a giocare
  sito: string; // indirizzo da mostrare
  avviso: string;
}) {
  const [f600, f800, logo] = await Promise.all([
    file("font/barlow-condensed-latin-600-normal.woff"),
    file("font/barlow-condensed-latin-800-normal.woff"),
    file("brand/logo-640.png"),
  ]);
  const logoUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const lungo = titolo.length > 22;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NOTTE, color: "#ffffff", fontFamily: "Barlow Condensed", position: "relative" }}>
        {/* il sole del logo, grande e tagliato dal bordo */}
        <div style={{ position: "absolute", right: -170, top: -190, width: 640, height: 640, borderRadius: 320, background: `linear-gradient(200deg, #ffd45c 0%, ${SOLE} 45%, #ef8f2c 100%)`, display: "flex" }} />
        {/* scia viola come la traiettoria della pallina */}
        <div style={{ position: "absolute", left: -120, bottom: 150, width: 900, height: 120, borderRadius: 60, background: `linear-gradient(90deg, rgba(91,43,192,0) 0%, rgba(91,43,192,.55) 100%)`, transform: "rotate(-12deg)", display: "flex" }} />

        <div style={{ display: "flex", padding: "64px 72px 0" }}>
          <div style={{ display: "flex", background: CREMA, borderRadius: 28, padding: "14px 22px", boxShadow: "0 18px 40px rgba(0,0,0,.35)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- immagine generata con next/og */}
            <img src={logoUrl} width={420} height={248} alt="" />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "0 72px", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 600, color: SOLE, textTransform: "uppercase", letterSpacing: 4 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: SOLE, display: "flex" }} />
            {etichetta}
          </div>
          <div style={{ fontSize: lungo ? 92 : 118, fontWeight: 800, lineHeight: 0.98, textTransform: "uppercase", display: "flex" }}>{titolo}</div>
          {grande && <div style={{ fontSize: grande.length > 12 ? 120 : 170, fontWeight: 800, lineHeight: 1, color: SOLE, display: "flex", letterSpacing: 2 }}>{grande}</div>}
          {riga && <div style={{ fontSize: 46, fontWeight: 600, color: "rgba(255,255,255,.9)", display: "flex" }}>{riga}</div>}
          {dettaglio && <div style={{ fontSize: 38, fontWeight: 600, color: "#c9b8ff", display: "flex" }}>{dettaglio}</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", background: VIOLA, padding: "34px 72px 30px", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 800, display: "flex" }}>{piede}</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: SOLE, display: "flex" }}>{sito}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,.75)", display: "flex" }}>{avviso}</div>
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
