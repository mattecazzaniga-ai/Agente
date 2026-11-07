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
        <h3 className="font-display text-lg font-bold uppercase tracking-wide">{t("leghe.entra")}</h3>
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
          className="campo text-center font-display text-2xl font-bold uppercase tracking-[.35em]"
        />
        {errore(entrata)}
        <button className="bottone" disabled={entrando}>
          {entrando ? t("partita.salvataggio") : soloEntra ? t("leghe.entraOra") : t("leghe.entraBtn")}
        </button>
      </form>

      {!soloEntra && (
      <form action={crea} className="scheda space-y-3">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide">{t("leghe.crea")}</h3>
        <input name="nome" required minLength={3} maxLength={40} placeholder={t("leghe.nome")} aria-label={t("leghe.nome")} className="campo" />
        {errore(creata)}
        <button className="bottone-secondario" disabled={creando}>
          {creando ? t("partita.salvataggio") : t("leghe.creaBtn")}
        </button>
        {creata?.ok && creata.dati?.codice && (
          <div className="festa space-y-2 rounded-lg border border-lime/40 bg-lime/[.06] p-3 text-center">
            <p className="cifre text-3xl tracking-[.3em] text-lime">{creata.dati.codice}</p>
            <Invita nome={creata.dati.nome ?? ""} codice={creata.dati.codice} sito={sito} />
          </div>
        )}
      </form>
      )}
    </div>
  );
}
