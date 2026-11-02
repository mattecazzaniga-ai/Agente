"use client";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

/** Menu a tendina che cambia un parametro dell'indirizzo (mese, lega…) senza bottone "vai". */
export default function SelettoreMese({ etichetta, mesi, attuale, nome = "mese" }: { etichetta?: string; mesi: { valore: string; nome: string }[]; attuale: string; nome?: string }) {
  const router = useRouter();
  const percorso = usePathname();
  const sp = useSearchParams();
  const select = (
    <select
      name={nome}
      value={attuale}
      className="campo capitalize"
      onChange={(e) => {
        const u = new URLSearchParams(sp.toString());
        u.set(nome, e.target.value);
        router.push(`${percorso}?${u}`);
      }}
    >
      {mesi.map((m) => (
        <option key={m.valore} value={m.valore}>
          {m.nome}
        </option>
      ))}
    </select>
  );
  if (!etichetta) return select;
  return (
    <label>
      <span className="etichetta">{etichetta}</span>
      {select}
    </label>
  );
}
