import { FOTO } from "@/lib/foto";

/** Crediti delle foto (CC BY-SA 4.0) in una sola riga nel piè di pagina: niente didascalie sulle immagini. */
export default function CreditiFoto({ etichetta }: { etichetta: string }) {
  const autori = [...new Set(Object.values(FOTO).map((f) => f.autore))];
  return (
    <p className="text-xs text-tenue">
      {etichetta}: {autori.join(", ")} / Wikimedia Commons,{" "}
      <a href={FOTO.partita.urlLicenza} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-inchiostro hover:underline">
        CC BY-SA 4.0
      </a>
    </p>
  );
}
