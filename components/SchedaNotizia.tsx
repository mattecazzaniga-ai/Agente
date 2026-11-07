import { getLocale, getTranslations } from "next-intl/server";
import type { NotiziaMostrata } from "@/lib/dati";
import { NOMI_LINGUE } from "@/i18n/routing";
import { data } from "@/lib/formato";

/** Notizia: titolo e riassunto scritti da noi, fonte e link all'articolo originale. */
export default async function SchedaNotizia({ notizia: n }: { notizia: NotiziaMostrata }) {
  const t = await getTranslations();
  const lingua = await getLocale();
  return (
    <article className="pannello group relative p-4 transition hover:border-tenue">
      <p className="flex flex-wrap items-center gap-x-2 font-display text-[12px] font-bold uppercase tracking-wider text-tenue">
        <span className="text-lime">{n.fonte_nome}</span>
        {n.pubblicata_at && <span>{data(n.pubblicata_at, lingua)}</span>}
        {n.altraLingua && <span className="chip">{t("notizie.inLingua", { lingua: NOMI_LINGUE[n.lingua as keyof typeof NOMI_LINGUE] ?? n.lingua })}</span>}
      </p>
      <h3 className="mt-1.5 text-[17px] font-bold leading-snug">
        <a href={n.url_originale} target="_blank" rel="noopener noreferrer nofollow" className="after:absolute after:inset-0">
          {n.titolo}
        </a>
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-testo/75">{n.riassunto}</p>
      <p className="mt-3 font-display text-[13px] font-bold uppercase tracking-wider text-tenue transition group-hover:text-lime">{t("notizie.leggi")} →</p>
    </article>
  );
}
