"use client";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Segna l'utente come attivo oggi (una volta al giorno): serve a misurare gli utenti attivi a settimana. */
export default function Attivita({ collegato }: { collegato: boolean }) {
  useEffect(() => {
    if (!collegato) return;
    const oggi = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem("bp-attivo") === oggi) return;
    } catch {}
    supabaseBrowser()
      .rpc("segna_attivita")
      .then(({ error }) => {
        if (!error) {
          try {
            localStorage.setItem("bp-attivo", oggi);
          } catch {}
        }
      });
  }, [collegato]);
  return null;
}
