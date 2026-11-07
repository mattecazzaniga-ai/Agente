"use client";
import { useActionState } from "react";
import type { EsitoAdmin } from "@/app/[locale]/admin/azioni";

/** Modulo del pannello admin: invia l'azione e mostra l'esito sotto al bottone. */
export default function FormAdmin({
  azione,
  bottone,
  children,
  className = "space-y-3",
  secondario = false,
}: {
  azione: (s: EsitoAdmin, f: FormData) => Promise<EsitoAdmin>;
  bottone: string;
  children: React.ReactNode;
  className?: string;
  secondario?: boolean;
}) {
  const [esito, invia, inCorso] = useActionState<EsitoAdmin, FormData>(azione, null);
  return (
    <form action={invia} className={className}>
      {children}
      <button className={secondario ? "bottone-secondario" : "bottone"} disabled={inCorso}>
        {inCorso ? "…" : bottone}
      </button>
      {esito && <p className={`whitespace-pre-line text-sm font-medium ${esito.ok ? "text-lime" : "text-corallo"}`}>{esito.messaggio}</p>}
    </form>
  );
}
