"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconaCondividi } from "./Icone";

/**
 * Condivide un link, con un'immagine generata quando c'è (pronostico o posizione), con il menu del telefono: WhatsApp,
 * Instagram (storie), Telegram… Dove la condivisione di file non c'è: WhatsApp con link + scarica immagine.
 */
export default function Condividi({ immagine, testo, url, etichetta, nomeFile = "beachpeck.png" }: { immagine?: string; testo: string; url: string; etichetta: string; nomeFile?: string }) {
  const t = useTranslations("condividi");
  const [stato, setStato] = useState<"" | "attesa" | "fallback">("");
  async function condividi() {
    setStato("attesa");
    try {
      const file = immagine ? new File([await (await fetch(immagine, { credentials: "same-origin" })).blob()], nomeFile, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
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
          {immagine ? (
            <a className="bottone-secondario text-sm" href={immagine} download={nomeFile}>
              {t("scarica")}
            </a>
          ) : (
            <button type="button" className="bottone-secondario text-sm" onClick={() => navigator.clipboard?.writeText(url).then(() => setStato(""))}>
              {t("copia")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
