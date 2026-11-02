"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const VOCI = [
  { href: "/", chiave: "home", icona: "🏠" },
  { href: "/tornei", chiave: "tornei", icona: "🏆" },
  { href: "/classifica", chiave: "classifica", icona: "📊" },
  { href: "/leghe", chiave: "leghe", icona: "👥" },
  { href: "/notizie", chiave: "notizie", icona: "📰" },
] as const;

/** Barra in basso, comoda con il pollice. */
export default function Navigazione() {
  const t = useTranslations("nav");
  const percorso = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-sabbia-scura/60 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {VOCI.map((v) => {
          const attiva = v.href === "/" ? percorso === "/" : percorso.startsWith(v.href);
          return (
            <li key={v.href} className="flex-1">
              <Link href={v.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${attiva ? "text-mare" : "text-nebbia"}`} aria-current={attiva ? "page" : undefined}>
                <span className="text-xl leading-none" aria-hidden>{v.icona}</span>
                {t(v.chiave)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
