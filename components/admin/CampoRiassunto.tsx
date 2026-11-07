"use client";
import { useState } from "react";

/** Riassunto con contatore: massimo 320 caratteri (circa 3 righe su telefono). */
export default function CampoRiassunto({ nome, valore }: { nome: string; valore?: string }) {
  const [n, setN] = useState(valore?.length ?? 0);
  return (
    <div>
      <textarea name={nome} defaultValue={valore} maxLength={320} rows={3} onChange={(e) => setN(e.target.value.length)} placeholder="Riassunto scritto con parole tue (non copiare il testo dell'articolo)" className="campo py-2 text-sm" />
      <p className={`text-right text-xs ${n > 300 ? "text-corallo" : "text-tenue"}`}>{n}/320</p>
    </div>
  );
}
