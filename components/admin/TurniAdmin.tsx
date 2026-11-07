"use client";

import { useRef, useState } from "react";

export interface PaginaTurno {
  turno: string;
  nome: string;
  fatte: number;
  totale: number;
  contenuto: React.ReactNode;
}

/**
 * Le partite di un tabellone divise per turno: una pagina per turno.
 * Si cambia turno toccando la linguetta in alto, con le frecce, o scorrendo col dito a destra/sinistra.
 */
export default function TurniAdmin({ pagine, iniziale }: { pagine: PaginaTurno[]; iniziale: number }) {
  const [attivo, setAttivo] = useState(Math.min(iniziale, pagine.length - 1));
  const inizio = useRef<{ x: number; y: number } | null>(null);
  const vai = (i: number) => setAttivo(Math.max(0, Math.min(pagine.length - 1, i)));
  const pagina = pagine[attivo];

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-1 flex gap-1 overflow-x-auto bg-sabbia px-1 py-2" role="tablist">
        {pagine.map((p, i) => {
          const finito = p.totale > 0 && p.fatte === p.totale;
          return (
            <button
              key={p.turno}
              type="button"
              role="tab"
              aria-selected={attivo === i}
              onClick={() => vai(i)}
              className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-lg px-3 text-sm font-semibold transition ${
                attivo === i ? "bg-viola text-white" : "border border-linea bg-carta text-inchiostro"
              }`}
            >
              {p.nome}
              <span className={`text-[11px] font-semibold ${attivo === i ? "text-white/85" : finito ? "text-viola" : "text-tenue"}`}>
                {finito ? "✓ " : ""}
                {p.fatte}/{p.totale}
              </span>
            </button>
          );
        })}
      </div>
      <section
        key={pagina.turno}
        role="tabpanel"
        aria-label={pagina.nome}
        className="entra space-y-2"
        onTouchStart={(e) => (inizio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = inizio.current;
          inizio.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) vai(attivo + (dx < 0 ? 1 : -1));
        }}
      >
        {pagina.contenuto}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => vai(attivo - 1)} disabled={attivo === 0} className="bottone-secondario">
            ← {attivo > 0 ? pagine[attivo - 1].nome : ""}
          </button>
          <button type="button" onClick={() => vai(attivo + 1)} disabled={attivo === pagine.length - 1} className="bottone-secondario">
            {attivo < pagine.length - 1 ? pagine[attivo + 1].nome : ""} →
          </button>
        </div>
      </section>
    </div>
  );
}
