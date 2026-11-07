import Image from "next/image";
import type { Foto } from "@/lib/foto";

/** Testata di pagina con una foto vera: titolo e contesto sopra una sfumatura che garantisce la lettura. */
export default function TestataFoto({ foto, titolo, sotto, posizione = "50% 40%" }: { foto: Foto; titolo: string; sotto?: string; posizione?: string }) {
  return (
    <header className="group relative -mx-4 -mt-5 overflow-hidden border-b border-linea sm:mx-0 sm:mt-0 sm:rounded-xl sm:border">
      <Image src={foto.src} alt={foto.alt} placeholder="blur" sizes="(min-width: 1152px) 1120px, 100vw" className="foto-zoom h-44 w-full object-cover sm:h-56" style={{ objectPosition: posizione }} />
      <div className="velo absolute inset-0" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white sm:px-6">
        <h1 className="titolo-pagina">{titolo}</h1>
        {sotto && <p className="mt-1.5 text-sm text-white/85">{sotto}</p>}
      </div>
    </header>
  );
}
