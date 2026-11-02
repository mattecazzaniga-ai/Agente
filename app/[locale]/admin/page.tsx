import { supabaseServer } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";

const OBIETTIVO = 500;

/** Cruscotto: utenti attivi a settimana rispetto all'obiettivo di 500, nuovi, tornati e pronostici. */
export default async function Cruscotto() {
  const supabase = await supabaseServer();
  const [{ data }, { count: utenti }, { count: tornei }] = await Promise.all([
    supabase.rpc("metriche_settimanali", { p_settimane: 8 }),
    supabase.from("profili").select("id", { count: "exact", head: true }),
    supabase.from("tornei").select("id", { count: "exact", head: true }).neq("stato", "concluso"),
  ]);
  const righe = ((data as { settimana: string; attivi: number; nuovi: number; tornati: number; pronostici: number }[]) ?? []).reverse();
  const ora = righe[0];
  const perc = Math.min(100, Math.round(((ora?.attivi ?? 0) / OBIETTIVO) * 100));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Cruscotto</h1>
      <div className="scheda space-y-2">
        <p className="text-sm text-nebbia">Utenti attivi questa settimana</p>
        <p className="text-4xl font-extrabold">
          {ora?.attivi ?? 0} <span className="text-lg font-semibold text-nebbia">/ {OBIETTIVO}</span>
        </p>
        <div className="h-3 overflow-hidden rounded-full bg-onda">
          <div className="h-full bg-mare" style={{ width: `${perc}%` }} />
        </div>
        <p className="text-xs text-nebbia">
          Iscritti in totale: {utenti ?? 0} · Tornei non conclusi: {tornei ?? 0}
        </p>
      </div>
      <div className="scheda overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-nebbia">
            <tr>
              <th className="p-3">Settimana</th>
              <th className="p-3 text-right">Attivi</th>
              <th className="p-3 text-right">Nuovi</th>
              <th className="p-3 text-right">Tornati</th>
              <th className="p-3 text-right">Pronostici</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sabbia">
            {righe.map((r) => (
              <tr key={r.settimana}>
                <td className="p-3">{new Date(r.settimana).toLocaleDateString("it", { day: "numeric", month: "short", timeZone: "UTC" })}</td>
                <td className="p-3 text-right font-bold">{r.attivi}</td>
                <td className="p-3 text-right">{r.nuovi}</td>
                <td className="p-3 text-right">{r.tornati}</td>
                <td className="p-3 text-right">{r.pronostici}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-nebbia">
        &quot;Tornati&quot; = attivi anche la settimana prima. Un utente è attivo se apre l&apos;app collegato almeno una volta nella settimana.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/admin/tornei" className="bottone">
          + Torneo
        </Link>
        <Link href="/admin/notizie" className="bottone-secondario">
          + Notizia
        </Link>
      </div>
    </div>
  );
}
