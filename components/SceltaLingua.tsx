"use client";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Lingua } from "@/i18n/routing";

const SIGLE: Record<Lingua, string> = { it: "IT", "pt-BR": "PT", es: "ES", en: "EN" };
import { salvaLingua } from "@/app/[locale]/azioni";

/** Cambio lingua con un tocco: resta sulla stessa pagina e la ricorda nel profilo. */
export default function SceltaLingua({ etichetta }: { etichetta: string }) {
  const lingua = useLocale();
  const percorso = usePathname();
  const router = useRouter();
  const [, avvia] = useTransition();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{etichetta}</span>
      <select
        value={lingua}
        onChange={(e) => {
          const nuova = e.target.value as Lingua;
          avvia(() => {
            void salvaLingua(nuova);
            router.replace(percorso, { locale: nuova });
          });
        }}
        className="h-9 appearance-none rounded-lg border border-linea bg-transparent pl-2.5 pr-6 font-display text-sm font-bold uppercase tracking-wide text-testo outline-none hover:border-tenue"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} className="bg-pannello text-testo">
            {SIGLE[l]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-[10px] text-tenue" aria-hidden>▼</span>
    </label>
  );
}
