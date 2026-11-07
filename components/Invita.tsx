"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconaCondividi } from "./Icone";

/** Invito a una lega: menu di condivisione del telefono, altrimenti WhatsApp o copia del link. */
export default function Invita({ nome, codice, sito }: { nome: string; codice: string; sito: string }) {
  const t = useTranslations();
  const lingua = useLocale();
  const [copiato, setCopiato] = useState(false);
  const [fallback, setFallback] = useState(false);
  const url = `${sito}/${lingua}/leghe/${codice}`;
  const testo = t("leghe.invitoTesto", { nome, codice });
  async function invita() {
    if (navigator.share) {
      try {
        await navigator.share({ text: testo, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    setFallback(true);
  }
  async function copia() {
    try {
      await navigator.clipboard.writeText(`${testo} ${url}`);
      setCopiato(true);
    } catch {
      /* niente appunti: resta il link WhatsApp */
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={invita} className="bottone">
        <IconaCondividi /> {t("leghe.invita")}
      </button>
      {fallback && (
        <div className="grid grid-cols-2 gap-2">
          <a className="bottone-secondario text-sm" href={`https://wa.me/?text=${encodeURIComponent(`${testo} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <button type="button" className="bottone-secondario text-sm" onClick={copia}>
            {copiato ? t("condividi.copiato") : t("condividi.copia")}
          </button>
        </div>
      )}
    </div>
  );
}
