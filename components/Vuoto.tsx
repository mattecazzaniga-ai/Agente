import { Link } from "@/i18n/navigation";

/** Stato vuoto: una frase chiara e, se serve, l'azione per uscirne. Niente illustrazioni. */
export default function Vuoto({ testo, azione, link, icona }: { testo: string; azione?: string; link?: string; icona?: React.ReactNode }) {
  return (
    <div className="pannello flex flex-col items-center gap-3 px-6 py-8 text-center">
      {icona && <span className="text-tenue">{icona}</span>}
      <p className="max-w-[30ch] text-[15px] leading-snug text-tenue">{testo}</p>
      {azione && link && (
        <Link href={link} className=" text-sm font-semibold text-mare">
          {azione} →
        </Link>
      )}
    </div>
  );
}
