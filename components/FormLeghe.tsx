"use client";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { creaLega, uniscitiLega, type Esito } from "@/app/[locale]/azioni";
import Invita from "./Invita";

/** Crea una lega (e invita subito) oppure entra con un codice. */
export default function FormLeghe({ sito, codiceIniziale = "", soloEntra = false }: { sito: string; codiceIniziale?: string; soloEntra?: boolean }) {
  const t = useTranslations();
  const lingua = useLocale();
  const [creata, crea, creando] = useActionState<Esito | null, FormData>(creaLega, null);
  const [entrata, entra, entrando] = useActionState<Esito | null, FormData>(uniscitiLega, null);
  const errore = (e: Esito | null) => (e && !e.ok ? <p className="text-sm font-medium text-corallo">{e.errore === "codiceLega" ? t("leghe.codiceNonValido") : t(`errori.${e.errore}`)}</p> : null);

  return (
    <div className="space-y-4">
      <form action={entra} className="scheda space-y-3">
        <h2 className="text-lg font-extrabold">{t("leghe.entra")}</h2>
        <input type="hidden" name="lingua" value={lingua} />
        <input
          name="codice"
          defaultValue={codiceIniziale}
          required
          minLength={6}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABC234"
          aria-label={t("leghe.codice")}
          className="campo text-center font-mono text-xl uppercase tracking-[.3em]"
        />
        {errore(entrata)}
        <button className="bottone" disabled={entrando}>
          {entrando ? "…" : soloEntra ? t("leghe.entraOra") : t("leghe.entraBtn")}
        </button>
      </form>

      {!soloEntra && (
      <form action={crea} className="scheda space-y-3">
        <h2 className="text-lg font-extrabold">{t("leghe.crea")}</h2>
        <input name="nome" required minLength={3} maxLength={40} placeholder={t("leghe.nome")} aria-label={t("leghe.nome")} className="campo" />
        {errore(creata)}
        <button className="bottone-secondario" disabled={creando}>
          {creando ? "…" : t("leghe.creaBtn")}
        </button>
        {creata?.ok && creata.dati?.codice && (
          <div className="space-y-2 rounded-xl bg-onda p-3 text-center">
            <p className="font-mono text-2xl font-bold tracking-[.3em]">{creata.dati.codice}</p>
            <Invita nome={creata.dati.nome ?? ""} codice={creata.dati.codice} sito={sito} />
          </div>
        )}
      </form>
      )}
    </div>
  );
}
