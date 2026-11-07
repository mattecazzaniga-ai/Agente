import { supabaseServer } from "@/lib/supabase/server";
import { bandiera } from "@/lib/formato";
import type { Giocatore } from "@/lib/tipi";
import { eliminaGiocatore, salvaGiocatore } from "../azioni";
import FormAdmin from "@/components/admin/FormAdmin";
import Pannello from "@/components/admin/Pannello";

function Campi({ g }: { g?: Giocatore }) {
  return (
    <>
      {g && <input type="hidden" name="id" value={g.id} />}
      <div className="grid grid-cols-2 gap-2">
        <input name="nome" required maxLength={60} defaultValue={g?.nome} placeholder="Nome" aria-label="Nome" className="campo" />
        <input name="cognome" required maxLength={60} defaultValue={g?.cognome} placeholder="Cognome" aria-label="Cognome" className="campo" />
        <input name="paese" maxLength={2} defaultValue={g?.paese ?? ""} placeholder="Paese (IT)" aria-label="Paese" className="campo" />
        <select name="sesso" defaultValue={g?.sesso ?? ""} aria-label="Sesso" className="campo">
          <option value="">—</option>
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
      </div>
    </>
  );
}

export default async function AdminGiocatori({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await supabaseServer();
  let query = supabase.from("giocatori").select("id, nome, cognome, paese, sesso").order("cognome").order("nome").limit(100);
  const cerca = q.trim().replace(/[%_,()]/g, "");
  if (cerca) query = query.or(`cognome.ilike.%${cerca}%,nome.ilike.%${cerca}%`);
  const { data } = await query;
  const giocatori = (data as Giocatore[]) ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Giocatori</h1>
      <p className="text-sm text-tenue">Di solito si creano da soli con l&apos;importazione del tabellone. Qui si correggono nomi e Paesi.</p>
      <Pannello titolo={<>+ Nuovo giocatore</>}>
        <div className="mt-3">
          <FormAdmin azione={salvaGiocatore} bottone="Aggiungi">
            <Campi />
          </FormAdmin>
        </div>
      </Pannello>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Cerca per nome o cognome" className="campo" />
        <button className="bottone w-auto">Cerca</button>
      </form>
      <ul className="space-y-2">
        {giocatori.length === 0 && <li className="scheda text-sm text-tenue">Nessun giocatore.</li>}
        {giocatori.map((g) => (
          <li key={g.id}>
            <details className="scheda">
              <summary className="cursor-pointer">
                {bandiera(g.paese)} <b>{g.cognome}</b> {g.nome}
              </summary>
              <div className="mt-3 space-y-2">
                <FormAdmin azione={salvaGiocatore} bottone="Salva" secondario>
                  <Campi g={g} />
                </FormAdmin>
                <FormAdmin azione={eliminaGiocatore} bottone="Elimina" secondario className="[&>button]:min-h-9 [&>button]:text-sm [&>button]:text-corallo">
                  <input type="hidden" name="id" value={g.id} />
                </FormAdmin>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
