"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

/** Errore imprevisto in una pagina: messaggio chiaro e un bottone per riprovare, senza perdere il resto del sito. */
export default function Errore({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="scheda mx-auto mt-8 max-w-md space-y-3 text-center">
      <p className="font-display text-2xl font-bold">{t("errori.generico")}</p>
      <p className="text-sm text-tenue">{t("errori.pagina")}</p>
      <button type="button" onClick={reset} className="bottone">
        {t("errori.riprova")}
      </button>
    </div>
  );
}
