import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { caricaTorneo } from "@/lib/dati";
import { nomeCoppia, nomeCoppiaLungo, punteggio } from "@/lib/formato";
import { GENERI, TURNI, type Coppia, type Partita, type Tabellone } from "@/lib/tipi";
import { creaTabellone, eliminaCoppia, eliminaPartita, eliminaTabellone, eliminaTorneo, importaTabellone, salvaPartita, salvaRisultato, salvaTorneo } from "../../azioni";
import FormAdmin from "@/components/admin/FormAdmin";
import Pannello from "@/components/admin/Pannello";
import CampiTorneo from "@/components/admin/CampiTorneo";
import CampoDataOra from "@/components/admin/CampoDataOra";
import BottoneConferma from "@/components/BottoneConferma";

const GENERE_IT = { maschile: "Maschile", femminile: "Femminile", misto: "Misto" } as const;
const ESEMPIO = `1. Andrea Ricci (ITA) / Paolo Neri (ITA)
2. SILVA João BRA / SANTOS Pedro BRA
Garcia, Luis (ESP) – Lopez, Marc (ESP)
BYE
Luca;Bianchi;ITA;Marco;Verdi;ITA;`;

export default async function AdminTorneo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await caricaTorneo(id);
  if (!r) notFound();
  const { torneo, tabelloni } = r;
  const mancanti = GENERI.filter((g) => !tabelloni.some((t) => t.genere === g));

  return (
    <div className="space-y-4">
      <Link href="/admin/tornei" className="text-sm font-semibold text-viola">
        ← Tornei
      </Link>
      <h1 className="text-xl font-extrabold">{torneo.nome}</h1>
      <p className="text-sm">
        <Link href={`/tornei/${torneo.id}`} className="text-viola underline">
          Vedi la pagina pubblica
        </Link>
      </p>

      <Pannello titolo={<>Dati del torneo e stato</>}>
        <div className="mt-3 space-y-3">
          <FormAdmin azione={salvaTorneo} bottone="Salva torneo">
            <CampiTorneo torneo={torneo} />
          </FormAdmin>
          <form action={eliminaTorneo}>
            <input type="hidden" name="id" value={torneo.id} />
            <BottoneConferma messaggio="Eliminare il torneo con tabelloni, partite e pronostici?" className="text-sm text-corallo underline">
              Elimina torneo
            </BottoneConferma>
          </form>
        </div>
      </Pannello>

      {mancanti.length > 0 && (
        <FormAdmin azione={creaTabellone} bottone="+ Aggiungi tabellone" className="scheda flex items-end gap-2 [&>button]:w-auto" secondario>
          <input type="hidden" name="torneo_id" value={torneo.id} />
          <label className="flex-1">
            <span className="etichetta">Nuovo tabellone</span>
            <select name="genere" className="campo">
              {mancanti.map((g) => (
                <option key={g} value={g}>
                  {GENERE_IT[g]}
                </option>
              ))}
            </select>
          </label>
        </FormAdmin>
      )}

      {tabelloni.map((tb) => (
        <SezioneTabellone key={tb.id} tb={tb} inizio={torneo.inizio_at} />
      ))}
    </div>
  );
}

function SezioneTabellone({ tb, inizio }: { tb: Tabellone; inizio: string }) {
  const c = (id: string | null) => tb.coppie.find((x) => x.id === id) ?? null;
  return (
    <section className="space-y-3 rounded-[var(--radius-scheda)] border-2 border-linea p-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">Tabellone {GENERE_IT[tb.genere]}</h2>
        <span className="chip">{tb.coppie.length} coppie</span>
        <span className="chip">{tb.partite.length} partite</span>
      </div>

      <Pannello titolo={<>Incolla il tabellone ITF</>} aperto className="scheda border-2 border-viola/40">
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-tenue">
          <li>Sul sito ITF apri il torneo → <b>Draws &amp; Results</b> → questo tabellone.</li>
          <li>Tieni premuto sulla pagina → <b>Seleziona tutto</b> → <b>Copia</b>.</li>
          <li>Incolla qui sotto e premi <b>Carica</b>.</li>
        </ol>
        <p className="mt-1 text-xs text-tenue">
          {tb.partite.length === 0
            ? "La prima volta crea coppie, partite e risultati già giocati. I vincitori avanzano da soli (1ª contro 2ª, 3ª contro 4ª…)."
            : "Il tabellone c'è già: si scrivono solo i risultati nuovi o cambiati, i vincitori avanzano e i punti si calcolano da soli. Rifallo ogni volta che vuoi."}
        </p>
        <div className="mt-3">
          <FormAdmin azione={importaTabellone} bottone={tb.partite.length === 0 ? "Carica tabellone" : "Carica risultati"}>
            <input type="hidden" name="tabellone_id" value={tb.id} />
            <input type="hidden" name="set_per_vincere" value="2" />
            <textarea name="testo" required rows={6} placeholder="Incolla qui il testo copiato da Draws & Results" className="campo min-h-32 py-2 font-mono text-sm" />
            <CampoDataOra
              nome="inizio_at"
              valore={tb.partite.length === 0 ? inizio : undefined}
              etichetta={tb.partite.length === 0 ? "Orario delle prossime partite" : "Orario delle prossime partite (facoltativo)"}
              obbligatorio={tb.partite.length === 0}
            />
          </FormAdmin>
        </div>
      </Pannello>

      <Pannello titolo={<>Altro: entry list a mano</>}>
        <p className="mt-2 text-xs text-tenue">
          Solo se non hai il tabellone ITF. Incolla le coppie <b>nell&apos;ordine del tabellone</b> (dall&apos;alto in basso), una per riga. Scrivi BYE per un posto vuoto. Si creano giocatori,
          coppie e partite del primo turno; chi ha il BYE passa al turno dopo.
        </p>
        <div className="mt-3">
          <FormAdmin azione={importaTabellone} bottone="Importa">
            <input type="hidden" name="tabellone_id" value={tb.id} />
            <textarea name="testo" required rows={8} placeholder={ESEMPIO} className="campo min-h-40 py-2 font-mono text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <CampoDataOra nome="inizio_at" valore={inizio} etichetta="Inizio primo turno" obbligatorio={false} />
              <label className="block">
                <span className="etichetta">Formato</span>
                <select name="set_per_vincere" className="campo">
                  <option value="1">Set unico</option>
                  <option value="2">Al meglio dei 3</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="solo_coppie" value="1" className="h-5 w-5" /> Solo iscrivere le coppie (senza creare partite)
            </label>
          </FormAdmin>
        </div>
      </Pannello>

      <Pannello titolo={<>👥 Coppie ({tb.coppie.length})</>}>
        <ul className="mt-2 divide-y divide-linea text-sm">
          {tb.coppie.map((x) => (
            <li key={x.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1">
                {x.testa_di_serie ? <b>[{x.testa_di_serie}] </b> : null}
                {nomeCoppiaLungo(x)}
              </span>
              <form action={eliminaCoppia}>
                <input type="hidden" name="id" value={x.id} />
                <BottoneConferma messaggio="Eliminare la coppia? Si cancellano anche i pronostici su di lei." className="text-xs text-corallo">
                  ✕
                </BottoneConferma>
              </form>
            </li>
          ))}
        </ul>
      </Pannello>

      {TURNI.filter((t) => tb.partite.some((p) => p.turno === t)).map((t) => (
        <div key={t} className="space-y-2">
          <h3 className="text-sm font-bold text-tenue">{t}</h3>
          {tb.partite
            .filter((p) => p.turno === t)
            .map((p) => (
              <SchedaRisultato key={p.id} p={p} a={c(p.coppia_a_id)} b={c(p.coppia_b_id)} coppie={tb.coppie} />
            ))}
        </div>
      ))}

      <Pannello titolo={<>+ Partita a mano</>}>
        <div className="mt-3">
          <FormAdmin azione={salvaPartita} bottone="Aggiungi partita">
            <CampiPartita tabelloneId={tb.id} coppie={tb.coppie} />
          </FormAdmin>
        </div>
      </Pannello>

      <form action={eliminaTabellone}>
        <input type="hidden" name="id" value={tb.id} />
        <BottoneConferma messaggio="Eliminare il tabellone con coppie, partite e pronostici?" className="text-xs text-corallo underline">
          Elimina tabellone
        </BottoneConferma>
      </form>
    </section>
  );
}

function CampiPartita({ tabelloneId, coppie, p }: { tabelloneId: string; coppie: Coppia[]; p?: Partita }) {
  const opzioni = (
    <>
      <option value="">— da definire —</option>
      {coppie.map((x) => (
        <option key={x.id} value={x.id}>
          {nomeCoppia(x)}
        </option>
      ))}
    </>
  );
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="tabellone_id" value={tabelloneId} />
      <div className="grid grid-cols-3 gap-2">
        <label>
          <span className="etichetta">Turno</span>
          <select name="turno" defaultValue={p?.turno ?? "R16"} className="campo">
            {TURNI.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="etichetta">Posizione</span>
          <input name="ordine" type="number" min={0} max={32} defaultValue={p?.ordine ?? 1} className="campo" />
        </label>
        <label>
          <span className="etichetta">Formato</span>
          <select name="set_per_vincere" defaultValue={String(p?.set_per_vincere ?? 1)} className="campo">
            <option value="1">1 set</option>
            <option value="2">2 su 3</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="etichetta">Coppia A</span>
        <select name="coppia_a_id" defaultValue={p?.coppia_a_id ?? ""} className="campo">
          {opzioni}
        </select>
      </label>
      <label className="block">
        <span className="etichetta">Coppia B</span>
        <select name="coppia_b_id" defaultValue={p?.coppia_b_id ?? ""} className="campo">
          {opzioni}
        </select>
      </label>
      <CampoDataOra nome="inizio_at" valore={p?.inizio_at} etichetta="Inizio (chiude i pronostici)" />
    </>
  );
}

function SchedaRisultato({ p, a, b, coppie }: { p: Partita; a: Coppia | null; b: Coppia | null; coppie: Coppia[] }) {
  const pronta = a && b;
  return (
    <div className={`scheda space-y-2 ${p.stato === "conclusa" ? "opacity-80" : ""}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="chip">#{p.ordine}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">
          {nomeCoppia(a)} <span className="text-tenue">vs</span> {nomeCoppia(b)}
        </span>
        <span className="text-xs text-tenue">{p.stato === "conclusa" ? punteggio(p) || "✓" : new Date(p.inizio_at).toLocaleString("it", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      {pronta && (
        <FormAdmin azione={salvaRisultato} bottone="Salva risultato" className="space-y-2">
          <input type="hidden" name="id" value={p.id} />
          <div className="grid grid-cols-2 gap-2">
            <select name="stato" defaultValue={p.stato === "in_programma" ? "conclusa" : p.stato} className="campo">
              <option value="conclusa">Conclusa</option>
              <option value="in_corso">In corso</option>
              <option value="in_programma">In programma</option>
              <option value="annullata">Annullata</option>
            </select>
            <input name="punteggio" defaultValue={punteggio({ ...p, ritiro: false })} placeholder={p.set_per_vincere === 2 ? "6-4 3-6 10-7" : "6-4"} className="campo font-mono" aria-label="Punteggio (dal lato della coppia A)" />
          </div>
          <details className="text-sm" open={p.ritiro}>
            <summary className="cursor-pointer text-tenue">Ritiro</summary>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="ritiro" value="1" defaultChecked={p.ritiro} className="h-5 w-5" /> Vittoria per ritiro
              </label>
              <select name="vincitore_id" defaultValue={p.vincitore_id ?? ""} className="campo">
                <option value="">Chi passa il turno?</option>
                <option value={a.id}>{nomeCoppia(a)}</option>
                <option value={b.id}>{nomeCoppia(b)}</option>
              </select>
            </div>
          </details>
        </FormAdmin>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-tenue">Modifica partita</summary>
        <div className="mt-2 space-y-2">
          <FormAdmin azione={salvaPartita} bottone="Salva partita" secondario>
            <CampiPartita tabelloneId={p.tabellone_id} coppie={coppie} p={p} />
          </FormAdmin>
          <form action={eliminaPartita}>
            <input type="hidden" name="id" value={p.id} />
            <BottoneConferma messaggio="Eliminare la partita e i suoi pronostici?" className="text-xs text-corallo underline">
              Elimina partita
            </BottoneConferma>
          </form>
        </div>
      </details>
    </div>
  );
}
