"use client";
import { useState } from "react";

/** Sezione apribile che resta aperta dopo il salvataggio (così si legge l'esito). */
export default function Pannello({ titolo, aperto = false, className = "scheda", children }: { titolo: React.ReactNode; aperto?: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(aperto);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-bold">{titolo}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
