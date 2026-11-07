"use client";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { salvaProfilo, type Esito } from "@/app/[locale]/azioni";
import { bandiera, nomePaese } from "@/lib/formato";
import { PAESI_PRINCIPALI } from "@/lib/paesi";

/** Nickname e Paese (onboarding e profilo). */
export default function FormProfilo({ nickname, paese, dopo, testoBottone }: { nickname: string; paese: string | null; dopo?: string; testoBottone: string }) {
  const t = useTranslations();
  const lingua = useLocale();
  const [esito, azione, inCorso] = useActionState<Esito | null, FormData>(salvaProfilo, null);
  const paesi = [...new Set([...(paese ? [paese] : []), ...PAESI_PRINCIPALI])].map((c) => ({ c, n: nomePaese(c, lingua) }));
  return (
    <form action={azione} className="space-y-4">
      <input type="hidden" name="lingua" value={lingua} />
      {dopo && <input type="hidden" name="dopo" value={dopo} />}
      <label className="block">
        <span className="etichetta">{t("benvenuto.nickname")}</span>
        <input name="nickname" defaultValue={nickname.startsWith("giocatore_") ? "" : nickname} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.\-]{3,24}" autoComplete="nickname" className="campo" />
        <span className="mt-1 block text-xs text-tenue">{t("benvenuto.nicknameAiuto")}</span>
      </label>
      <label className="block">
        <span className="etichetta">{t("benvenuto.paese")}</span>
        <select name="paese" defaultValue={paese ?? ""} required className="campo">
          <option value="" disabled>
            {t("benvenuto.scegliPaese")}
          </option>
          {paesi.map(({ c, n }) => (
            <option key={c} value={c}>
              {bandiera(c)} {n}
            </option>
          ))}
        </select>
      </label>
      {esito && !esito.ok && (
        <p className="text-sm font-medium text-corallo">{esito.errore === "duplicato" ? t("benvenuto.nicknameUsato") : esito.errore === "nonValido" ? t("benvenuto.nicknameNonValido") : t("errori.generico")}</p>
      )}
      {esito?.ok && <p className="text-sm font-medium text-lime">{t("profilo.salvato")}</p>}
      <button className="bottone" disabled={inCorso}>{inCorso ? "…" : testoBottone}</button>
    </form>
  );
}
