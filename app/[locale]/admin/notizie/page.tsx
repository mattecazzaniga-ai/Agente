import { Link } from "@/i18n/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { NOMI_LINGUE, routing } from "@/i18n/routing";
import type { Notizia } from "@/lib/tipi";
import { eliminaNotizia, salvaNotizia } from "../azioni";
import FormAdmin from "@/components/admin/FormAdmin";
import CampoRiassunto from "@/components/admin/CampoRiassunto";
import CampoDataOra from "@/components/admin/CampoDataOra";
import BottoneConferma from "@/components/BottoneConferma";

const CATEGORIE: [string, string][] = [
  ["itf", "News ITF"],
  ["risultati", "Risultati"],
  ["giocatori", "Giocatori"],
  ["ranking", "Ranking"],
  ["curiosita", "Curiosità"],
  ["beachpeck", "Beach Peck"],
];

function CampiNotizia({ n, tornei }: { n?: Notizia; tornei: { id: string; nome: string }[] }) {
  const tr = (l: string) => n?.notizie_traduzioni.find((t) => t.lingua === l);
  return (
    <>
      {n && <input type="hidden" name="id" value={n.id} />}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="etichetta">Categoria</span>
          <select name="categoria" defaultValue={n?.categoria ?? "itf"} className="campo">
            {CATEGORIE.map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etichetta">Autore (facoltativo)</span>
          <input name="autore" maxLength={80} defaultValue={n?.autore ?? ""} placeholder="Redazione Beach Peck" className="campo" />
        </label>
      </div>
      <label className="block">
        <span className="etichetta">Torneo collegato (facoltativo)</span>
        <select name="torneo_id" defaultValue={n?.torneo_id ?? ""} className="campo">
          <option value="">— nessuno —</option>
          {tornei.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2 rounded-xl bg-sabbia-2 p-2">
        <legend className="text-xs font-bold">Foto (facoltativa)</legend>
        {n?.immagine_url && (
          // eslint-disable-next-line @next/next/no-img-element -- anteprima nell'admin
          <img src={n.immagine_url} alt="" className="h-28 w-full rounded-lg object-cover" />
        )}
        <input name="immagine" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" />
        <input name="immagine_url" type="url" defaultValue={n?.immagine_url ?? ""} placeholder="…oppure indirizzo della foto https://" className="campo" />
        <input name="credito_immagine" maxLength={120} defaultValue={n?.credito_immagine ?? ""} placeholder="Credito della foto (autore, licenza)" className="campo" />
        <p className="text-xs text-tenue">Usa solo foto tue o con licenza che ne permette l&apos;uso, e scrivi sempre il credito.</p>
      </fieldset>

      <p className="text-xs text-tenue">
        Scrivi con parole tue: mai copiare il testo di altri siti. Basta una lingua; le altre mostrano quella disponibile. Il sottotitolo compare nelle schede (circa 3 righe).
      </p>
      {routing.locales.map((l) => (
        <fieldset key={l} className="space-y-1 rounded-xl bg-sabbia-2 p-2">
          <legend className="text-xs font-bold">{NOMI_LINGUE[l]}</legend>
          <input name={`titolo_${l}`} maxLength={120} defaultValue={tr(l)?.titolo} placeholder="Titolo" className="campo" />
          <CampoRiassunto nome={`riassunto_${l}`} valore={tr(l)?.riassunto} />
          <textarea name={`corpo_${l}`} rows={6} maxLength={20000} defaultValue={tr(l)?.corpo ?? ""} placeholder="Testo dell'articolo (una riga vuota tra i paragrafi)" className="campo min-h-32 py-2 text-sm" />
        </fieldset>
      ))}

      <fieldset className="space-y-2 rounded-xl bg-sabbia-2 p-2">
        <legend className="text-xs font-bold">Fonte (facoltativa)</legend>
        <div className="grid grid-cols-3 gap-2">
          <input name="fonte_nome" maxLength={80} defaultValue={n?.fonte_nome ?? ""} placeholder="ITF" className="campo col-span-1" />
          <input name="url_originale" type="url" defaultValue={n?.url_originale ?? ""} placeholder="https://… articolo originale" className="campo col-span-2" />
        </div>
        <p className="text-xs text-tenue">Se lasci vuoto il testo e metti solo il link, la notizia porta direttamente alla fonte.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="etichetta">Stato</span>
          <select name="stato" defaultValue={n?.stato ?? "bozza"} className="campo">
            <option value="bozza">Bozza</option>
            <option value="pubblicata">Pubblicata</option>
          </select>
        </label>
        <CampoDataOra nome="pubblicata_at" valore={n?.pubblicata_at} etichetta="Esce il (vuoto = subito)" obbligatorio={false} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="in_evidenza" value="1" defaultChecked={n?.in_evidenza} className="h-5 w-5" /> In evidenza (articolo principale della pagina Notizie)
      </label>
    </>
  );
}

export default async function AdminNotizie({ searchParams }: { searchParams: Promise<{ modifica?: string; salvata?: string }> }) {
  const { modifica, salvata } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data }, { data: tornei }] = await Promise.all([
    supabase
      .from("notizie")
      .select("id, fonte_nome, url_originale, pubblicata_at, stato, categoria, immagine_url, credito_immagine, torneo_id, autore, in_evidenza, creato_at, notizie_traduzioni(lingua, titolo, riassunto, corpo)")
      .order("creato_at", { ascending: false })
      .limit(100),
    supabase.from("tornei").select("id, nome").order("data_inizio", { ascending: false }).limit(100),
  ]);
  const notizie = (data as unknown as Notizia[]) ?? [];
  const inModifica = notizie.find((n) => n.id === modifica);
  const adesso = Date.now();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Notizie</h1>
      {salvata && <p className="rounded-xl bg-sabbia-2 p-3 text-sm font-medium text-viola">Notizia salvata.</p>}
      <div className="scheda">
        <h2 className="mb-3 font-bold">{inModifica ? "Modifica notizia" : "+ Nuovo articolo"}</h2>
        <FormAdmin key={inModifica?.id ?? "nuova"} azione={salvaNotizia} bottone={inModifica ? "Salva modifiche" : "Salva articolo"}>
          <CampiNotizia n={inModifica} tornei={(tornei as { id: string; nome: string }[]) ?? []} />
        </FormAdmin>
        {inModifica && (
          <div className="mt-3 flex items-center justify-between">
            <Link href="/admin/notizie" className="text-sm text-viola underline">
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
      <p className="text-xs text-tenue">Per archiviare un articolo senza cancellarlo, rimettilo in «Bozza»: sparisce dal sito ma resta qui.</p>
      <ul className="scheda divide-y divide-linea p-0">
        {notizie.length === 0 && <li className="p-4 text-sm text-tenue">Nessuna notizia.</li>}
        {notizie.map((n) => {
          const t = n.notizie_traduzioni.find((x) => x.lingua === "it") ?? n.notizie_traduzioni[0];
          const programmata = n.stato === "pubblicata" && n.pubblicata_at && new Date(n.pubblicata_at).getTime() > adesso;
          return (
            <li key={n.id}>
              <Link href={`/admin/notizie?modifica=${n.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t?.titolo ?? "(senza titolo)"}</span>
                  <span className="block text-xs text-tenue">
                    {CATEGORIE.find(([v]) => v === n.categoria)?.[1]} · {n.notizie_traduzioni.map((x) => x.lingua).join(", ")}
                    {n.in_evidenza ? " · in evidenza" : ""}
                  </span>
                </span>
                <span className={`chip ${n.stato === "pubblicata" && !programmata ? "" : "bg-sabbia-2 text-tenue"}`}>{programmata ? "programmata" : n.stato}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
