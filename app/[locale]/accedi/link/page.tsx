"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Arrivo dal link nell'email. Il link porta i token nel frammento (#access_token=…), quindi
 * funziona anche se si apre in un browser diverso da quello in cui si è chiesta l'email.
 */
export default function LinkEmail() {
  const t = useTranslations("accedi");
  const lingua = useLocale();
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    (async () => {
      const frammento = new URLSearchParams(window.location.hash.slice(1));
      const access_token = frammento.get("access_token");
      const refresh_token = frammento.get("refresh_token");
      if (!access_token || !refresh_token) return setErrore(true);
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: false } });
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error || !data.user) return setErrore(true);
      const dopoGrezzo = new URLSearchParams(window.location.search).get("dopo") ?? `/${lingua}`;
      const dopo = dopoGrezzo.startsWith("/") && !dopoGrezzo.startsWith("//") ? dopoGrezzo : `/${lingua}`;
      const { data: profilo } = await supabase.from("profili").select("profilo_completo").eq("id", data.user.id).single();
      window.location.replace(profilo?.profilo_completo ? dopo : `/${lingua}/benvenuto?dopo=${encodeURIComponent(dopo)}`);
    })();
  }, [lingua]);

  return (
    <div className="mx-auto max-w-sm space-y-4 py-10 text-center">
      {errore ? (
        <>
          <p className="font-medium text-corallo">{t("linkScaduto")}</p>
          <a href={`/${lingua}/accedi`} className="bottone inline-block">{t("titolo")}</a>
        </>
      ) : (
        <p className="text-tenue">{t("entrando")}</p>
      )}
    </div>
  );
}
