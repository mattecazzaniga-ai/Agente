import { Link } from "@/i18n/navigation";

/** Stato vuoto illustrato: un'emoji in un cerchio colorato, una frase e, se serve, un'azione. */
export default function Vuoto({ emoji, testo, azione, link, colore = "bg-onda" }: { emoji: string; testo: string; azione?: string; link?: string; colore?: string }) {
  return (
    <div className="scheda flex flex-col items-center gap-3 px-6 py-7 text-center">
      <span className={`grid h-16 w-16 place-items-center rounded-full text-3xl ${colore}`} aria-hidden>
        {emoji}
      </span>
      <p className="max-w-[26ch] text-[15px] font-semibold leading-snug text-inchiostro/80">{testo}</p>
      {azione && link && (
        <Link href={link} className="rounded-full bg-onda px-4 py-2 text-sm font-bold text-mare-scuro">
          {azione}
        </Link>
      )}
    </div>
  );
}
