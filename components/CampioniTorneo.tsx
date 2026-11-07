import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bandiera } from "@/lib/formato";
import type { RigaClassificaTorneo } from "@/lib/dati";
import { IconaCoppa } from "./Icone";

const MEDAGLIA: Record<number, string> = { 1: "bg-sole text-inchiostro", 2: "bg-[#c9cfdb] text-inchiostro", 3: "bg-[#d9965b] text-white" };

/**
 * Chi ha pronosticato meglio in questo torneo. A torneo concluso diventano i campioni (podio 1-2-3);
 * durante il torneo è la classifica provvisoria. Si conta tutto: partite e vincitore del tabellone.
 */
export default async function CampioniTorneo({ righe, concluso, io }: { righe: RigaClassificaTorneo[]; concluso: boolean; io?: string }) {
  const t = await getTranslations("campioni");
  if (!righe.length) return null;
  const podio = righe.filter((r) => r.posizione <= 3 && r.punti > 0);
  const mia = io ? righe.find((r) => r.utente_id === io) : undefined;

  if (concluso && podio.length) {
    // ordine sul podio: 2° a sinistra, 1° al centro più alto, 3° a destra
    const ordine = [podio.find((r) => r.posizione === 2), podio.find((r) => r.posizione === 1), podio.find((r) => r.posizione === 3)];
    return (
      <section className="mt-4 overflow-hidden rounded-xl bg-inchiostro text-white">
        <div className="flex items-center gap-2 px-4 pt-4">
          <IconaCoppa className="h-5 w-5 text-sole" />
          <h2 className="font-display text-xl font-bold">{t("titoloConcluso")}</h2>
        </div>
        <p className="px-4 text-sm text-white/70">{t("sottoConcluso")}</p>
        <ol className="mt-4 grid grid-cols-3 items-end gap-2 px-3">
          {ordine.map((r, i) =>
            r ? (
              <li key={r.utente_id} className="text-center">
                <Link href={`/giocatore/${r.utente_id}`} className="block">
                  <span className={`cifre mx-auto flex h-10 w-10 items-center justify-center rounded-full text-xl ${MEDAGLIA[r.posizione]}`}>{r.posizione}</span>
                  <span className="mt-1.5 block truncate text-sm font-semibold">
                    {bandiera(r.paese)} {r.nickname}
                  </span>
                  <span className="cifre block text-lg text-sole">{r.punti} pt</span>
                  <span className={`mt-1 block rounded-t-lg bg-white/10 ${i === 1 ? "h-16" : i === 0 ? "h-10" : "h-6"}`} />
                </Link>
              </li>
            ) : (
              <li key={i} />
            ),
          )}
        </ol>
        {mia && mia.posizione > 3 && (
          <p className="border-t border-white/10 px-4 py-2.5 text-sm text-white/80">{t("tuaPosizione", { posizione: mia.posizione, punti: mia.punti })}</p>
        )}
      </section>
    );
  }

  return (
    <section className="pannello mt-6 overflow-hidden">
      <div className="border-b border-linea px-4 py-3">
        <h2 className="text-[15px] font-semibold">{t("titoloInCorso")}</h2>
        <p className="text-xs text-tenue">{t("sottoInCorso")}</p>
      </div>
      <ol className="divide-y divide-linea">
        {righe.slice(0, 10).map((r) => (
          <li key={r.utente_id}>
            <Link href={`/giocatore/${r.utente_id}`} className={`flex items-center gap-3 px-4 py-2.5 transition hover:bg-sabbia-2 ${r.utente_id === io ? "bg-viola/10" : ""}`}>
              <span className={`cifre flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${MEDAGLIA[r.posizione] ?? "text-tenue"}`}>{r.posizione}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {bandiera(r.paese)} {r.nickname}
              </span>
              <span className="cifre text-lg">{r.punti}</span>
            </Link>
          </li>
        ))}
      </ol>
      {mia && mia.posizione > 10 && <p className="border-t border-linea px-4 py-2.5 text-sm text-tenue">{t("tuaPosizione", { posizione: mia.posizione, punti: mia.punti })}</p>}
    </section>
  );
}
