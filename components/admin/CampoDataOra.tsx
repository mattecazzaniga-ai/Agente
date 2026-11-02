"use client";
import { useState } from "react";

const locale = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Data e ora nel fuso del telefono dell'admin; al server arriva in ISO (UTC). */
export default function CampoDataOra({ nome, valore, etichetta, obbligatorio = true }: { nome: string; valore?: string | null; etichetta: string; obbligatorio?: boolean }) {
  const [v, setV] = useState(valore ? locale(valore) : "");
  return (
    <label className="block">
      <span className="etichetta">{etichetta}</span>
      <input type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} required={obbligatorio} className="campo" />
      <input type="hidden" name={nome} value={v ? new Date(v).toISOString() : ""} />
    </label>
  );
}
