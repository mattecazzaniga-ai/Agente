import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { sessione } from "@/lib/dati";
import { avvisiUtente } from "@/lib/notifiche";
import { cookies } from "next/headers";
import Navigazione from "@/components/Navigazione";
import SceltaLingua from "@/components/SceltaLingua";
import Avviso from "@/components/Avviso";
import Attivita from "@/components/Attivita";
import RegistraSW from "@/components/RegistraSW";
import { IconaCampanella, IconaIngranaggio, Marchio } from "@/components/Icone";
import CreditiFoto from "@/components/CreditoFoto";
import FasciaSponsor from "@/components/FasciaSponsor";
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
  // numerino sulla campanella: partite in scadenza da pronosticare + novità dopo l'ultima visita agli avvisi
  let nuovi = 0;
  if (user) {
    const [avvisi, biscotti] = await Promise.all([avvisiUtente(user.id).catch(() => []), cookies()]);
    const visti = biscotti.get("avvisi_visti")?.value ?? "";
    nuovi = avvisi.filter((a) => a.tipo === "scadenza" || a.quando > visti).length;
  }

  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider>
          <header className="sticky top-0 z-30 border-b border-linea bg-sabbia/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
              <Link href="/" aria-label={t("app.nome")} className="shrink-0 transition hover:scale-[1.03]">
                <Marchio className="h-12" />
              </Link>
              <Navigazione tipo="header" />
              <div className="ml-auto flex items-center gap-2">
                <SceltaLingua etichetta={t("lingua.scegli")} />
                {profilo?.is_admin && (
                  <Link href="/admin" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-linea bg-carta px-2.5 text-sm font-semibold text-inchiostro hover:border-viola hover:text-viola">
                    <IconaIngranaggio className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("nav.admin")}</span>
                    <span className="sr-only sm:hidden">{t("nav.admin")}</span>
                  </Link>
                )}
                {user && (
                  <Link href="/notifiche" aria-label={t("avvisi.titolo")} className="relative grid h-10 w-10 place-items-center rounded-lg border border-linea bg-carta text-inchiostro hover:border-viola hover:text-viola">
                    <IconaCampanella />
                    {nuovi > 0 && <span className="cifre absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-corallo px-1 text-[11px] text-white">{nuovi > 9 ? "9+" : nuovi}</span>}
                  </Link>
                )}
                {user ? (
                  <Link
                    href="/profilo"
                    className="grid h-10 w-10 place-items-center rounded-lg bg-sabbia-2 font-display text-base font-extrabold text-viola ring-1 ring-linea hover:ring-viola"
                    aria-label={t("nav.profilo")}
                  >
                    {(profilo?.nickname ?? "?").slice(0, 1)}
                  </Link>
                ) : (
                  <Link href="/accedi" className="inline-flex h-10 items-center rounded-lg bg-viola px-4 transition active:scale-95 text-[15px] font-semibold text-white hover:bg-viola-scuro">
                    {t("nav.accedi")}
                  </Link>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-16">{children}</main>
          <FasciaSponsor />
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
