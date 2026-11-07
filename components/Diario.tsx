import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bandiera } from "@/lib/formato";
import type { Coppia } from "@/lib/tipi";
import type { TipoVoce, VoceDiario } from "@/lib/diario";
import { IconaCoppa, IconaFulmine, IconaFuoco, IconaPodio, IconaStella } from "./Icone";

const nome = (c: Coppia | null) => (c ? `${c.g1.cognome}/${c.g2.cognome}` : "—");
const conBandiere = (c: Coppia | null) => (c ? `${bandiera(c.g1.paese)} ${c.g1.cognome} / ${bandiera(c.g2.paese)} ${c.g2.cognome}` : "—");

const STILE: Record<TipoVoce, { Icona: typeof IconaCoppa; colore: string }> = {
  campioni: { Icona: IconaCoppa, colore: "bg-sole text-inchiostro" },
  turno: { Icona: IconaPodio, colore: "bg-viola text-white" },
  imbattuti: { Icona: IconaFuoco, colore: "bg-inchiostro text-white" },
  sorpresa: { Icona: IconaFulmine, colore: "bg-corallo text-white" },
  long: { Icona: IconaStella, colore: "bg-sole-chiaro text-inchiostro" },
};

/** Le notizie dai campi: fatti presi dai tabelloni (risultati veri), ognuna porta al torneo. */
export default async function Diario({ voci, compatto = false }: { voci: VoceDiario[]; compatto?: boolean }) {
  if (!voci.length) return null;
  const [t, lingua] = await Promise.all([getTranslations(), getLocale()]);
  const data = (iso: string) => new Intl.DateTimeFormat(lingua, { day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(new Date(iso));
  return (
    <ul className={compatto ? "pannello divide-y divide-linea overflow-hidden" : "grid gap-3 sm:grid-cols-2"}>
      {voci.map((v, i) => {
        const { Icona, colore } = STILE[v.tipo];
        const turno = v.turno ? t(`turno.${v.turno}`) : "";
        const [a, b] = v.coppie;
        const titolo =
          v.tipo === "campioni"
            ? t("diario.campioni", { coppia: nome(a), torneo: v.torneo.nome })
            : v.tipo === "turno"
              ? t("diario.turno", { turno, torneo: v.torneo.nome })
              : v.tipo === "imbattuti"
                ? t("diario.imbattuti", { n: v.coppie.length, coppia: v.coppie.map(nome).join(", "), turno: turno.toLowerCase() })
                : v.tipo === "sorpresa"
                  ? t("diario.sorpresa", { n: v.testa ?? 0, perdente: nome(b), vincitore: nome(a) })
                  : t("diario.long", { coppia: nome(a), punteggio: v.punteggio?.split(" ").at(-1) ?? "" });
        const sotto =
          v.tipo === "campioni"
            ? t("diario.campioniSotto", { punteggio: v.punteggio ?? t("statistiche.ritiro"), altra: nome(b) })
            : v.tipo === "sorpresa" || v.tipo === "long"
              ? `${v.punteggio ?? t("statistiche.ritiro")} · ${turno}${v.tipo === "long" ? ` · ${t("diario.contro", { coppia: nome(b) })}` : ""}`
              : v.tipo === "imbattuti"
                ? v.torneo.nome
                : null;
        return (
          <li key={i} className={compatto ? "" : "pannello overflow-hidden"}>
            <Link href={`/tornei/${v.torneo.id}?tab=${v.genere}${v.turno ? `&turno=${v.turno}` : ""}`} className="flex gap-3 p-4 transition hover:bg-sabbia-2">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${colore}`}>
                <Icona className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-tenue">
                  {t(`diario.tipo.${v.tipo}`)} · {t(`genere.${v.genere}`)} · {data(v.quando)}
                </span>
                <span className="mt-0.5 block font-display text-[19px] font-bold leading-tight">{titolo}</span>
                {sotto && <span className="mt-0.5 block text-sm text-tenue">{sotto}</span>}
                {v.sfide && (
                  <span className="mt-1.5 block space-y-1 text-sm">
                    {v.sfide.map(([x, y], k) => (
                      <span key={k} className="block leading-snug">
                        {conBandiere(x)} <span className="text-tenue">vs</span> {conBandiere(y)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
