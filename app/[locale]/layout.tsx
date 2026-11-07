import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { sessione } from "@/lib/dati";
import Navigazione from "@/components/Navigazione";
import SceltaLingua from "@/components/SceltaLingua";
import Avviso from "@/components/Avviso";
import Attivita from "@/components/Attivita";
import RegistraSW from "@/components/RegistraSW";
import { Marchio } from "@/components/Icone";
import CreditiFoto from "@/components/CreditoFoto";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: { default: `${t("app.nome")} · ${t("app.slogan")}`, template: `%s · ${t("app.nome")}` },
    description: `${t("app.slogan")}. ${t("avviso")}.`,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icone/icona-192.png", apple: "/icone/icona-180.png" },
    appleWebApp: { capable: true, title: t("app.nome"), statusBarStyle: "default" },
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = { themeColor: "#fbf6ec", width: "device-width", initialScale: 1, viewportFit: "cover" };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LayoutLingua({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const { user, profilo } = await sessione();

  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider>
          <header className="sticky top-0 z-30 border-b border-linea bg-sabbia/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
              <Link href="/" aria-label={t("app.nome")}>
                <Marchio />
              </Link>
              <Navigazione tipo="header" />
              <div className="ml-auto flex items-center gap-2">
                <SceltaLingua etichetta={t("lingua.scegli")} />
                {profilo?.is_admin && (
                  <Link href="/admin" className="hidden h-10 items-center rounded-lg border border-linea px-3 text-sm font-semibold text-tenue hover:text-inchiostro sm:inline-flex">
                    {t("nav.admin")}
                  </Link>
                )}
                {user ? (
                  <Link
                    href="/profilo"
                    className="grid h-10 w-10 place-items-center rounded-lg bg-sabbia-2 font-display text-base font-extrabold text-mare ring-1 ring-linea hover:ring-mare"
                    aria-label={t("nav.profilo")}
                  >
                    {(profilo?.nickname ?? "?").slice(0, 1)}
                  </Link>
                ) : (
                  <Link href="/accedi" className="inline-flex h-10 items-center rounded-lg bg-mare px-4 transition active:scale-95 text-[15px] font-semibold text-white hover:bg-mare-scuro">
                    {t("nav.accedi")}
                  </Link>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-16">{children}</main>
          <footer className="mx-auto max-w-6xl border-t border-linea px-4 pb-24 pt-5 md:pb-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Avviso />
              <Link href="/privacy" className="inline-flex min-h-11 items-center text-xs text-tenue underline-offset-2 hover:text-inchiostro hover:underline">
                {t("profilo.privacy")}
              </Link>
            </div>
            <CreditiFoto etichetta={t("privacy.creditiBreve")} />
          </footer>
          <Navigazione tipo="barra" />
          <Attivita collegato={Boolean(user)} />
          <RegistraSW />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
