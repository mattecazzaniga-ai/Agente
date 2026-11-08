import { supabaseServer } from "@/lib/supabase/server";
import { attivaSponsor, eliminaSponsor, eliminaStagione, salvaPremi, salvaSponsor, salvaStagione } from "../azioni";
import FormAdmin from "@/components/admin/FormAdmin";
import Pannello from "@/components/admin/Pannello";
import BottoneConferma from "@/components/BottoneConferma";

export const dynamic = "force-dynamic";

export default async function AdminPremiSponsor() {
  const supabase = await supabaseServer();
  const [{ data: premi }, { data: sponsor }, { data: elencoStagioni }] = await Promise.all([
    supabase.from("premi").select("posizione, descrizione"),
    supabase.from("sponsor").select("id, nome, link, logo_url, ordine, attivo").order("ordine").order("creato_at"),
    supabase.from("stagioni").select("id, nome, inizio, fine").order("inizio", { ascending: false }),
  ]);
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const stagioniElenco = (elencoStagioni as { id: string; nome: string; inizio: string; fine: string }[]) ?? [];
  const campiStagione = (s?: { id: string; nome: string; inizio: string; fine: string }) => (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <label className="block">
        <span className="etichetta">Nome</span>
        <input name="nome" required maxLength={40} defaultValue={s?.nome ?? ""} placeholder="Stagione invernale 2027" className="campo" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="etichetta">Inizio</span>
          <input name="inizio" type="date" required defaultValue={s?.inizio ?? ""} className="campo" />
        </label>
        <label className="block">
          <span className="etichetta">Fine (compresa)</span>
          <input name="fine" type="date" required defaultValue={s?.fine ?? ""} className="campo" />
        </label>
      </div>
    </>
  );
  const premio = (n: number) => (premi ?? []).find((p) => p.posizione === n)?.descrizione ?? "";
  return (
    <div className="space-y-4">
      <h1 className="titolo-pagina">Premi e sponsor</h1>

      <Pannello titolo={<>Stagioni (durata e conto alla rovescia)</>} aperto>
        <p className="mt-2 text-sm text-tenue">
          La stagione in corso compare in classifica con il timer «Finisce tra…». La classifica di stagione somma i punti delle partite giocate tra inizio e fine (ora
          italiana). Puoi allungarla o accorciarla quando vuoi: i punti si ricalcolano da soli.
        </p>
        <ul className="mt-3 space-y-3">
          {stagioniElenco.map((s) => {
            const stato = s.inizio <= oggi && oggi <= s.fine ? "in corso" : s.inizio > oggi ? "prossima" : "finita";
            return (
              <li key={s.id} className="rounded-lg border border-linea p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {s.nome} <span className={`chip ${stato === "in corso" ? "bg-viola text-white" : ""}`}>{stato}</span>
                </p>
                <FormAdmin azione={salvaStagione} bottone="Salva stagione" secondario className="space-y-2">
                  {campiStagione(s)}
                </FormAdmin>
                <form action={eliminaStagione} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                  <BottoneConferma messaggio={`Eliminare «${s.nome}»? I punti restano, sparisce solo la stagione.`} className="text-xs text-corallo underline">
                    Elimina stagione
                  </BottoneConferma>
                </form>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 rounded-lg bg-sabbia-2 p-3">
          <p className="mb-2 text-sm font-semibold">+ Nuova stagione</p>
          <FormAdmin azione={salvaStagione} bottone="Crea stagione" className="space-y-2">
            {campiStagione()}
          </FormAdmin>
        </div>
      </Pannello>

      <Pannello titolo={<>Premi della classifica del mese</>} aperto>
        <div className="mt-3">
          <FormAdmin azione={salvaPremi} bottone="Salva premi">
            {[1, 2, 3].map((n) => (
              <label key={n} className="block">
                <span className="etichetta">{n}° posto</span>
                <input name={`premio_${n}`} defaultValue={premio(n)} maxLength={120} placeholder={n === 1 ? "es. Racchetta offerta da …" : "lascia vuoto se non c'è"} className="campo" />
              </label>
            ))}
            <p className="text-xs text-tenue">
              Compaiono in classifica sopra il podio. Per premi con un valore, in Italia serve rispettare le regole dei concorsi a premi (DPR 430/2001): verifica con un consulente prima di pubblicarli.
            </p>
          </FormAdmin>
        </div>
      </Pannello>

      <Pannello titolo={<>Aggiungi uno sponsor</>} aperto>
        <div className="mt-3">
          <FormAdmin azione={salvaSponsor} bottone="Aggiungi sponsor">
            <label className="block">
              <span className="etichetta">Nome</span>
              <input name="nome" required maxLength={80} className="campo" />
            </label>
            <label className="block">
              <span className="etichetta">Logo (PNG, JPG, WebP o SVG, massimo 2 MB)</span>
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="campo py-2.5" />
            </label>
            <label className="block">
              <span className="etichetta">…oppure indirizzo del logo</span>
              <input name="logo_url" type="url" placeholder="https://…" className="campo" />
            </label>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <label className="block">
                <span className="etichetta">Link al sito (facoltativo)</span>
                <input name="link" type="url" placeholder="https://…" className="campo" />
              </label>
              <label className="block">
                <span className="etichetta">Ordine</span>
                <input name="ordine" type="number" defaultValue={0} className="campo" />
              </label>
            </div>
          </FormAdmin>
        </div>
      </Pannello>

      <Pannello titolo={<>Sponsor ({sponsor?.length ?? 0})</>} aperto>
        <ul className="mt-2 divide-y divide-linea">
          {(sponsor ?? []).length === 0 && <li className="py-3 text-sm text-tenue">Nessuno sponsor: la fascia che scorre compare quando ne aggiungi almeno uno.</li>}
          {(sponsor ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo_url} alt="" className="h-10 w-20 rounded bg-carta object-contain ring-1 ring-linea" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.nome}</span>
                <span className="block truncate text-xs text-tenue">{s.link ?? "senza link"} · ordine {s.ordine}</span>
              </span>
              <form action={attivaSponsor}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="attivo" value={s.attivo ? "0" : "1"} />
                <button className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${s.attivo ? "bg-viola/10 text-viola" : "bg-sabbia-2 text-tenue"}`}>{s.attivo ? "Visibile" : "Nascosto"}</button>
              </form>
              <form action={eliminaSponsor}>
                <input type="hidden" name="id" value={s.id} />
                <BottoneConferma messaggio={`Eliminare lo sponsor ${s.nome}?`} className="min-h-11 px-2 text-sm text-corallo">
                  Elimina
                </BottoneConferma>
              </form>
            </li>
          ))}
        </ul>
      </Pannello>
    </div>
  );
}
