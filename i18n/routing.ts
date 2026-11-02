import { defineRouting } from "next-intl/routing";

// Lingue dell'app: italiano, portoghese brasiliano, spagnolo, inglese.
// La prima visita sceglie da Accept-Language, poi vale il cookie NEXT_LOCALE.
export const routing = defineRouting({
  locales: ["it", "pt-BR", "es", "en"],
  defaultLocale: "it",
  localePrefix: "always",
});

export type Lingua = (typeof routing.locales)[number];
export const NOMI_LINGUE: Record<Lingua, string> = { it: "Italiano", "pt-BR": "Português (BR)", es: "Español", en: "English" };
