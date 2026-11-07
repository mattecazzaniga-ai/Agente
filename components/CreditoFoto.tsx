import type { Foto } from "@/lib/foto";

/** Attribuzione obbligatoria per le foto CC BY-SA: autore, licenza, fonte. Discreta, sopra la foto. */
export default function CreditoFoto({ foto, className = "" }: { foto: Foto; className?: string }) {
  return (
    <p className={`text-[10px] leading-tight text-testo/60 ${className}`}>
      Foto{" "}
      <a href={foto.fonte} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {foto.autore} / Wikimedia Commons
      </a>
      ,{" "}
      <a href={foto.urlLicenza} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {foto.licenza}
      </a>
    </p>
  );
}
