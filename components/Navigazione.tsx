"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { IconaAmici, IconaCasa, IconaCoppa, IconaNotizie, IconaPodio } from "./Icone";

const VOCI = [
  { href: "/", chiave: "home", Icona: IconaCasa },
  { href: "/tornei", chiave: "tornei", Icona: IconaCoppa },
  { href: "/classifica", chiave: "classifica", Icona: IconaPodio },
  { href: "/leghe", chiave: "leghe", Icona: IconaAmici },
  { href: "/notizie", chiave: "notizie", Icona: IconaNotizie },
] as const;

/** Barra in basso, comoda con il pollice. */
export default function Navigazione() {
  const t = useTranslations("nav");
  const percorso = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <ul className="mx-auto flex max-w-xl rounded-[26px] border border-white/70 bg-white/90 px-1 py-1 shadow-[0_12px_32px_-12px_rgba(23,50,63,.35)] backdrop-blur-md">
        {VOCI.map(({ href, chiave, Icona }) => {
          const attiva = href === "/" ? percorso === "/" : percorso.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={`flex flex-col items-center gap-1 py-2 text-[11px] font-bold transition ${attiva ? "text-mare" : "text-nebbia"}`} aria-current={attiva ? "page" : undefined}>
                <span className={`grid h-8 w-14 place-items-center rounded-full transition ${attiva ? "bg-mare text-white shadow-[0_6px_14px_-6px_rgba(10,126,164,.9)]" : ""}`}>
                  <Icona className="h-[22px] w-[22px]" />
                </span>
                {t(chiave)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
