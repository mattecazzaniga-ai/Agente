"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { IconaAmici, IconaCalendario, IconaCasa, IconaNotizie, IconaPodio } from "./Icone";

// Le stesse cinque voci ovunque, su telefono e computer. Il profilo si apre dall'avatar in alto.
const VOCI = [
  { href: "/", chiave: "home", Icona: IconaCasa },
  { href: "/tornei", chiave: "tornei", Icona: IconaCalendario },
  { href: "/classifica", chiave: "classifica", Icona: IconaPodio },
  { href: "/leghe", chiave: "leghe", Icona: IconaAmici },
  { href: "/notizie", chiave: "notizie", Icona: IconaNotizie },
] as const;

/** Navigazione: barra in basso sul telefono (comoda col pollice), voci nell'header da tablet in su. */
export default function Navigazione({ tipo }: { tipo: "barra" | "header" }) {
  const t = useTranslations("nav");
  const percorso = usePathname();
  const attiva = (href: string) => (href === "/" ? percorso === "/" : percorso.startsWith(href));

  if (tipo === "header")
    return (
      <nav className="hidden h-full items-stretch md:flex" aria-label="Menu">
        {VOCI.map(({ href, chiave }) => (
          <Link
            key={href}
            href={href}
            aria-current={attiva(href) ? "page" : undefined}
            className={`relative flex items-center px-3 text-[15px] font-semibold transition ${
              attiva(href) ? "text-inchiostro after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-viola" : "text-tenue hover:text-inchiostro"
            }`}
          >
            {t(chiave)}
          </Link>
        ))}
      </nav>
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-sabbia/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Menu">
      <ul className="mx-auto flex max-w-xl">
        {VOCI.map(({ href, chiave, Icona }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={attiva(href) ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-xs font-semibold transition ${attiva(href) ? "text-viola" : "text-tenue"}`}
            >
              {attiva(href) && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-viola" />}
              <Icona className="h-[22px] w-[22px]" />
              {t(chiave)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
