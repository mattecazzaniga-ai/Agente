"use client";
import { useEffect } from "react";

/** Service worker: l'app si installa sul telefono e mostra una pagina offline senza rete. */
export default function RegistraSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
