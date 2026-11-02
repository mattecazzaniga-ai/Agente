import { Link } from "@/i18n/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { NOMI_LINGUE, routing } from "@/i18n/routing";
import type { Notizia } from "@/lib/tipi";
import { eliminaNotizia, salvaNotizia } from "../azioni";
import FormAdmin from "@/components/admin/FormAdmin";
import CampoRiassunto from "@/components/admin/CampoRiassunto";
import BottoneConferma from "@/components/BottoneConferma";

function CampiNotizia({ n }: { n?: Notizia }) {
  const tr = (l: string) => n?.notizie_traduzioni.find((t) => t.lingua === l);
  return (
    <>
      {n && <input type="hidden" name="id" value={n.id} />}
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-1 block">
          <span className="etichetta">Fonte</span>
          <input name="fonte_nome" required minLength={2} maxLength={80} defaultValue={n?.fonte_nome} placeholder="ITF" className="campo" />
        </label>
        <label className="col-span-2 block">
          <span className="etichetta">Link all&apos;articolo originale</span>
          <input name="url_originale" type="url" required defaultValue={n?.url_originale} placeholder="https://…" className="campo" />
        </label>
      </div>
      <p className="text-xs text-nebbia">Titolo e riassunto vanno scritti con parole tue: mai copiare il testo della fonte. Basta una lingua; le altre mostrano quella disponibile.</p>
      {routing.locales.map((l) => (
        <fieldset key={l} className="space-y-1 rounded-xl bg-sabbia/50 p-2">
          <legend className="text-xs font-bold">{NOMI_LINGUE[l]}</legend>
          <input name={`titolo_${l}`} maxLength={120} defaultValue={tr(l)?.titolo} placeholder="Titolo" className="campo" />
          <CampoRiassunto nome={`riassunto_${l}`} valore={tr(l)?.riassunto} />
        </fieldset>
      ))}
      <label className="block">
        <span className="etichetta">Stato</span>
        <select name="stato" defaultValue={n?.stato ?? "bozza"} className="campo">
          <option value="bozza">Bozza</option>
          <option value="pubblicata">Pubblicata</option>
        </select>
      </label>
    </>
  );
}

export default async function AdminNotizie({ searchParams }: { searchParams: Promise<{ modifica?: string; salvata?: string }> }) {
  const { modifica, salvata } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("notizie")
    .select("id, fonte_nome, url_originale, pubblicata_at, stato, creato_at, notizie_traduzioni(lingua, titolo, riassunto)")
    .order("creato_at", { ascending: false })
    .limit(100);
  const notizie = (data as Notizia[]) ?? [];
  const inModifica = notizie.find((n) => n.id === modifica);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Notizie</h1>
      {salvata && <p className="rounded-xl bg-onda p-3 text-sm font-medium text-mare">Notizia salvata.</p>}
      <div className="scheda">
        <h2 className="mb-3 font-bold">{inModifica ? "Modifica notizia" : "+ Nuova notizia"}</h2>
        <FormAdmin key={inModifica?.id ?? "nuova"} azione={salvaNotizia} bottone={inModifica ? "Salva modifiche" : "Salva notizia"}>
          <CampiNotizia n={inModifica} />
        </FormAdmin>
        {inModifica && (
          <div className="mt-3 flex items-center justify-between">
            <Link href="/admin/notizie" className="text-sm text-mare underline">
              Annulla
            </Link>
            <form action={eliminaNotizia}>
              <input type="hidden" name="id" value={inModifica.id} />
              <BottoneConferma messaggio="Eliminare la notizia?" className="text-sm text-corallo underline">
                Elimina
              </BottoneConferma>
            </form>
          </div>
        )}
      </div>
      <ul className="scheda divide-y divide-sabbia p-0">
        {notizie.length === 0 && <li className="p-4 text-sm text-nebbia">Nessuna notizia.</li>}
        {notizie.map((n) => {
          const t = n.notizie_traduzioni.find((x) => x.lingua === "it") ?? n.notizie_traduzioni[0];
          return (
            <li key={n.id}>
              <Link href={`/admin/notizie?modifica=${n.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t?.titolo ?? "(senza titolo)"}</span>
                  <span className="block text-xs text-nebbia">
                    {n.fonte_nome} · {n.notizie_traduzioni.map((x) => x.lingua).join(", ")}
                  </span>
                </span>
                <span className={`chip ${n.stato === "pubblicata" ? "" : "bg-sabbia text-nebbia"}`}>{n.stato}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
