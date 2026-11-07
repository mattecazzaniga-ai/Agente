"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { impostaPassword, type Esito } from "@/app/[locale]/azioni";

/** Imposta o cambia la password (anche per chi è entrato con il link). */
export default function FormPassword() {
  const t = useTranslations();
  const [esito, azione, inCorso] = useActionState<Esito | null, FormData>(impostaPassword, null);
  return (
    <form action={azione} className="space-y-3">
      <label className="block">
        <span className="etichetta">{t("profilo.passwordNuova")}</span>
        <input name="password" type="password" autoComplete="new-password" minLength={6} required className="campo" />
        <span className="mt-1 block text-xs text-tenue">{t("accedi.passwordAiuto")}</span>
      </label>
      {esito && !esito.ok && <p className="text-sm font-medium text-corallo">{t(`errori.${esito.errore}`)}</p>}
      {esito?.ok && <p className="festa text-sm font-bold text-viola">{t("profilo.passwordSalvata")}</p>}
      <button className="bottone-secondario" disabled={inCorso}>{inCorso ? "…" : t("profilo.passwordSalva")}</button>
    </form>
  );
}
