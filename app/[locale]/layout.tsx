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

export const viewport: Viewport = { themeColor: "#0b4f6c", width: "device-width", initialScale: 1, viewportFit: "cover" };

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
          <header className="sticky top-0 z-20 bg-mare pt-[env(safe-area-inset-top)] text-white">
            <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
              <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <span aria-hidden>🎾</span> {t("app.nome")}
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <SceltaLingua etichetta={t("lingua.scegli")} />
                {profilo?.is_admin && (
                  <Link href="/admin" className="rounded-full bg-sole px-3 py-1.5 text-sm font-bold text-inchiostro">
                    {t("nav.admin")}
                  </Link>
                )}
                {user ? (
                  <Link href="/profilo" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-sm font-bold" aria-label={t("nav.profilo")}>
                    {(profilo?.nickname ?? "?").slice(0, 1).toUpperCase()}
                  </Link>
                ) : (
                  <Link href="/accedi" className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-mare">
                    {t("nav.accedi")}
                  </Link>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-xl px-4 pb-28 pt-4">{children}</main>
          <footer className="mx-auto max-w-xl px-4 pb-24 text-center">
            <Avviso />
            <Link href="/privacy" className="mt-1 inline-block text-xs text-nebbia underline">
              {t("profilo.privacy")}
            </Link>
          </footer>
          <Navigazione />
          <Attivita collegato={Boolean(user)} />
          <RegistraSW />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
