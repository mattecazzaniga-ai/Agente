import { getTranslations } from "next-intl/server";
import { bandiera } from "@/lib/formato";
import type { Coppia } from "@/lib/tipi";
import type { StatisticheTorneo, Tappa } from "@/lib/statistiche";

const cognomi = (c: Coppia | null) => (c ? `${c.g1.cognome}/${c.g2.cognome}` : "—");

/** Il cammino delle due coppie fin qui: per capire chi arriva in forma (o stanco) a questa partita. */
export async function Cammino({ a, b, tappeA, tappeB }: { a: Coppia | null; b: Coppia | null; tappeA: Tappa[]; tappeB: Tappa[] }) {
  if (!tappeA.length && !tappeB.length) return null;
  const t = await getTranslations();
  const riga = (c: Coppia | null, tappe: Tappa[]) => (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold">
        <span aria-hidden className="mr-1">{c ? bandiera(c.g1.paese) : ""}</span>
        {cognomi(c)}
      </p>
      {tappe.length === 0 ? (
        <p className="text-xs text-tenue">{t("statistiche.primoTurno")}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1">
          {tappe.map((x, i) => (
            <li
              key={i}
              title={`${t(`turno.${x.turno}`)} · ${cognomi(x.avversario)}`}
              className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${x.vinta ? "bg-viola/10 text-viola" : "bg-sabbia-2 text-tenue"}`}
            >
              <span className="mr-1 text-[10px] uppercase tracking-wide opacity-75">{t(`statistiche.turnoBreve.${x.turno}`)}</span>
              <span className="cifre text-[13px]">{x.ritiro ? t("statistiche.ritiro") : x.punteggio}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="border-b border-linea bg-sabbia-2/50 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tenue">{t("statistiche.cammino")}</p>
      <div className="grid grid-cols-2 gap-3">
        {riga(a, tappeA)}
        {riga(b, tappeB)}
      </div>
    </div>
  );
}

/** I numeri del torneo: come stanno finendo le partite e chi ha fatto saltare il pronostico. */
export async function NumeriTorneo({ s }: { s: StatisticheTorneo }) {
  if (s.giocate < 3) return null;
  const t = await getTranslations();
  const due = s.dueZero + s.dueUno;
  const perc = (n: number) => (due ? `${Math.round((n / due) * 100)}%` : "—");
  const caselle: [string, string][] = [
    [String(s.giocate), t("statistiche.giocate")],
    [perc(s.dueZero), t("statistiche.dueZero")],
    [perc(s.dueUno), t("statistiche.alLong")],
    [s.gameMedi != null ? String(s.gameMedi).replace(".", ",") : "—", t("statistiche.gameMedi")],
  ];
  return (
    <section className="pannello mt-6 overflow-hidden">
      <h2 className="border-b border-linea px-4 py-3 text-[15px] font-semibold">{t("statistiche.titoloTorneo")}</h2>
      <dl className="grid grid-cols-2 [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(odd)]:border-r [&>div]:border-linea">
        {caselle.map(([v, e]) => (
          <div key={e} className="flex flex-col px-4 py-3">
            <dt className="order-last mt-1 text-xs font-semibold leading-snug text-tenue">{e}</dt>
            <dd className="cifre text-3xl leading-none">{v}</dd>
          </div>
        ))}
      </dl>
      {s.longPiuLungo && (
        <p className="border-t border-linea px-4 py-3 text-sm">
          <span className="font-semibold">{t("statistiche.longPiuLungo")}</span> <span className="cifre text-lg text-viola">{s.longPiuLungo.punteggio}</span>
        </p>
      )}
      {s.sorprese.length > 0 && (
        <div className="border-t border-linea px-4 py-3">
          <p className="text-sm font-semibold">{t("statistiche.sorprese")}</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {s.sorprese.slice(0, 4).map((x, i) => (
              <li key={i} className="leading-snug">
                <span className="text-xs font-semibold text-seme">{t("statistiche.testa", { n: x.perdente.testa_di_serie ?? 0 })}</span> {cognomi(x.perdente)}{" "}
                <span className="text-tenue">{t("statistiche.battutaDa")}</span> {cognomi(x.vincitore)} <span className="text-xs text-tenue">· {t(`turno.${x.turno}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.ritiri > 0 && <p className="border-t border-linea px-4 py-2 text-xs text-tenue">{t("statistiche.ritiri", { n: s.ritiri })}</p>}
    </section>
  );
}
