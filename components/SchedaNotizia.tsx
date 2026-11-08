import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { NotiziaMostrata } from "@/lib/dati";
import { NOMI_LINGUE } from "@/i18n/routing";
import { data } from "@/lib/formato";

/**
 * Notizia in elenco. Articolo scritto qui: porta alla sua pagina. Segnalazione: porta alla fonte originale.
 * "grande" è l'articolo principale della pagina Notizie (foto larga sopra).
 */
export default async function SchedaNotizia({ notizia: n, grande = false }: { notizia: NotiziaMostrata; grande?: boolean }) {
  const t = await getTranslations();
  const lingua = await getLocale();
  const testa = (
    <p className="flex flex-wrap items-center gap-x-2 text-[12px] font-semibold text-tenue">
      <span className="text-viola">{t(`categorie.${n.categoria}`)}</span>
      {n.pubblicata_at && <span>{data(n.pubblicata_at, lingua)}</span>}
      {!n.articolo && n.fonte_nome && <span>· {n.fonte_nome}</span>}
      {n.altraLingua && <span className="chip">{t("notizie.inLingua", { lingua: NOMI_LINGUE[n.lingua as keyof typeof NOMI_LINGUE] ?? n.lingua })}</span>}
    </p>
  );
  const titolo = n.articolo ? (
    <Link href={`/notizie/${n.id}`} className="after:absolute after:inset-0">
      {n.titolo}
    </Link>
  ) : (
    <a href={n.url_originale ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="after:absolute after:inset-0">
      {n.titolo}
    </a>
  );
  return (
    <article className={`pannello solleva group relative overflow-hidden ${grande ? "" : "flex gap-3 p-3"}`}>
      {n.immagine_url &&
        (grande ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto caricate dall'admin (dominio di Supabase o esterno)
          <img src={n.immagine_url} alt="" loading="lazy" className="foto-zoom aspect-[16/9] w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- come sopra
          <img src={n.immagine_url} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-md object-cover" />
        ))}
      <div className={grande ? "p-4" : "min-w-0 flex-1 py-0.5"}>
        {testa}
        <h3 className={`mt-1 font-bold leading-snug ${grande ? "font-display text-[26px] leading-tight" : "text-[16px]"}`}>{titolo}</h3>
        <p className={`mt-1 text-sm leading-relaxed text-inchiostro/75 ${grande ? "line-clamp-3" : "line-clamp-2"}`}>{n.riassunto}</p>
        {grande && <p className="mt-3 text-[13px] font-semibold text-tenue transition group-hover:text-viola">{n.articolo ? t("notizie.leggiArticolo") : t("notizie.leggi")} →</p>}
      </div>
    </article>
  );
}
