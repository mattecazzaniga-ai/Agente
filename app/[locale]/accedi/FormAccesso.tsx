"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { accediConPassword, inviaCodice, registrati, verificaCodice, type Esito } from "../azioni";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Accesso con email e password (registrazione inclusa). Piano B: link via email. Oppure Google. */
export default function FormAccesso({ dopo, google }: { dopo: string; google: boolean }) {
  const t = useTranslations();
  const lingua = useLocale();
  const [invio, inviaAzione, invioInCorso] = useActionState<Esito | null, FormData>(inviaCodice, null);
  const [verifica, verificaAzione, verificaInCorso] = useActionState<Esito | null, FormData>(verificaCodice, null);
  const [cambia, setCambia] = useState(false);
  const [modo, setModo] = useState<"accedi" | "registrati" | "link">("accedi");
  const [accesso, accessoAzione, accessoInCorso] = useActionState<Esito | null, FormData>(accediConPassword, null);
  const [registra, registraAzione, registraInCorso] = useActionState<Esito | null, FormData>(registrati, null);
  const email = invio?.ok && !cambia ? invio.dati?.email : null;

  async function conGoogle() {
    const indirizzo = `${window.location.origin}/auth/callback?dopo=${encodeURIComponent(dopo)}&lingua=${lingua}`;
    await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: indirizzo } });
  }

  return (
    <div className="space-y-4">
      {google && (
        <>
          <button type="button" onClick={conGoogle} className="bottone-secondario bg-white">
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {t("accedi.google")}
          </button>
          <p className="text-center text-sm text-nebbia">{t("accedi.oppure")}</p>
        </>
      )}

      {modo !== "link" && (
        <div className="grid grid-cols-2 rounded-full bg-sabbia p-1 text-sm font-bold">
          {(["accedi", "registrati"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setModo(m)} className={`rounded-full py-2 transition ${modo === m ? "bg-white text-mare shadow-sm" : "text-nebbia"}`}>
              {t(m === "accedi" ? "accedi.schedaAccedi" : "accedi.schedaRegistrati")}
            </button>
          ))}
        </div>
      )}

      {modo === "accedi" && (
        <form action={accessoAzione} className="space-y-3">
          <input type="hidden" name="lingua" value={lingua} />
          <input type="hidden" name="dopo" value={dopo} />
          <label className="block">
            <span className="etichetta">{t("accedi.email")}</span>
            <input name="email" type="email" inputMode="email" autoComplete="email" required className="campo" placeholder="nome@email.com" />
          </label>
          <label className="block">
            <span className="etichetta">{t("accedi.password")}</span>
            <input name="password" type="password" autoComplete="current-password" required className="campo" />
          </label>
          {accesso && !accesso.ok && <p className="text-sm font-medium text-corallo">{t(`errori.${accesso.errore}`)}</p>}
          <button className="bottone" disabled={accessoInCorso}>{accessoInCorso ? "…" : t("accedi.entra")}</button>
          <button type="button" onClick={() => setModo("link")} className="w-full text-sm text-nebbia underline">
            {t("accedi.dimenticata")}
          </button>
        </form>
      )}

      {modo === "registrati" && (
        <form action={registraAzione} className="space-y-3">
          <input type="hidden" name="lingua" value={lingua} />
          <input type="hidden" name="dopo" value={dopo} />
          <label className="block">
            <span className="etichetta">{t("accedi.email")}</span>
            <input name="email" type="email" inputMode="email" autoComplete="email" required className="campo" placeholder="nome@email.com" />
          </label>
          <label className="block">
            <span className="etichetta">{t("accedi.sceglPassword")}</span>
            <input name="password" type="password" autoComplete="new-password" minLength={6} required className="campo" />
            <span className="mt-1 block text-xs text-nebbia">{t("accedi.passwordAiuto")}</span>
          </label>
          {registra && !registra.ok && <p className="text-sm font-medium text-corallo">{t(`errori.${registra.errore}`)}</p>}
          {registra?.ok && <p className="rounded-xl bg-onda p-3 text-sm">{t("accedi.confermaEmail")}</p>}
          <button className="bottone" disabled={registraInCorso}>{registraInCorso ? "…" : t("accedi.creaAccount")}</button>
        </form>
      )}

      {modo === "link" && (
        <div className="space-y-3">
          <p className="text-sm text-nebbia">{t("accedi.spiegaLink")}</p>
      {!email ? (
          <form action={(f) => { setCambia(false); inviaAzione(f); }} className="space-y-3">
            <input type="hidden" name="lingua" value={lingua} />
            <input type="hidden" name="dopo" value={dopo} />
            <label className="block">
              <span className="etichetta">{t("accedi.email")}</span>
              <input name="email" type="email" inputMode="email" autoComplete="email" required className="campo" placeholder="nome@email.com" />
            </label>
            {invio && !invio.ok && <p className="text-sm font-medium text-corallo">{t(`errori.${invio.errore}`)}</p>}
            <button className="bottone" disabled={invioInCorso}>{invioInCorso ? "…" : t("accedi.inviaLink")}</button>
          </form>
        ) : (
          <form action={verificaAzione} className="space-y-3">
            <p className="rounded-xl bg-onda p-3 text-sm">{t("accedi.codiceInviato", { email })}</p>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="lingua" value={lingua} />
            <input type="hidden" name="dopo" value={dopo} />
            <label className="block">
              <span className="etichetta">{t("accedi.codice")}</span>
              <input name="codice" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" maxLength={8} required autoFocus className="campo text-center text-2xl tracking-[.4em]" />
            </label>
            {verifica && !verifica.ok && <p className="text-sm font-medium text-corallo">{t("accedi.codiceErrato")}</p>}
            <button className="bottone" disabled={verificaInCorso}>{verificaInCorso ? "…" : t("accedi.verifica")}</button>
            <button type="button" onClick={() => setCambia(true)} className="w-full text-sm text-nebbia underline">
              {t("accedi.cambiaEmail")}
            </button>
          </form>
        )}
          <button type="button" onClick={() => setModo("accedi")} className="w-full text-sm text-nebbia underline">
            ← {t("accedi.tornaPassword")}
          </button>
        </div>
      )}
    </div>
  );
}
