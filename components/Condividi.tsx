"use client";
import { useState } from "react";
import { IconaCondividi } from "./Icone";

/**
 * Condivide un'immagine generata (pronostico o posizione) con il menu del telefono: WhatsApp,
 * Instagram (storie), Telegram… Dove la condivisione di file non c'è: WhatsApp con link + scarica immagine.
 */
export default function Condividi({ immagine, testo, url, etichetta, nomeFile = "beachpeck.png" }: { immagine: string; testo: string; url: string; etichetta: string; nomeFile?: string }) {
  const [stato, setStato] = useState<"" | "attesa" | "fallback">("");
  async function condividi() {
    setStato("attesa");
    try {
      const r = await fetch(immagine, { credentials: "same-origin" });
      const blob = await r.blob();
      const file = new File([blob], nomeFile, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${testo} ${url}` });
        setStato("");
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: testo, url });
        setStato("");
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return setStato("");
    }
    setStato("fallback");
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={condividi} className="bottone-secondario" disabled={stato === "attesa"}>
        <IconaCondividi /> {etichetta}
      </button>
      {stato === "fallback" && (
        <div className="grid grid-cols-2 gap-2">
          <a className="bottone-secondario text-sm" href={`https://wa.me/?text=${encodeURIComponent(`${testo} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a className="bottone-secondario text-sm" href={immagine} download={nomeFile}>
            PNG ⬇
          </a>
        </div>
      )}
    </div>
  );
}
