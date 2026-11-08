"use client";
import { useEffect } from "react";

/** Ricorda (in un cookie tecnico) quando hai guardato gli avvisi: il numerino sulla campanella conta solo i nuovi. */
export default function SegnaVisti() {
  useEffect(() => {
    document.cookie = `avvisi_visti=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);
  return null;
}
