import { getLocale, getTranslations } from "next-intl/server";
import type { NotiziaMostrata } from "@/lib/dati";
import { NOMI_LINGUE } from "@/i18n/routing";
import { data } from "@/lib/formato";

/** Notizia: titolo e riassunto scritti da noi, fonte e link all'articolo originale. */
export default async function SchedaNotizia({ notizia: n }: { notizia: NotiziaMostrata }) {
  const t = await getTranslations();
  const lingua = await getLocale();
  return (
    <article className="scheda space-y-2">
      <h3 className="text-lg font-extrabold leading-snug">{n.titolo}</h3>
      <p className="line-clamp-3 text-sm text-inchiostro/85">{n.riassunto}</p>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-nebbia">
        <span className="font-semibold text-inchiostro/70">{t("notizie.fonte", { fonte: n.fonte_nome })}</span>
        {n.pubblicata_at && <span>· {data(n.pubblicata_at, lingua)}</span>}
        {n.altraLingua && <span className="chip">{t("notizie.inLingua", { lingua: NOMI_LINGUE[n.lingua as keyof typeof NOMI_LINGUE] ?? n.lingua })}</span>}
      </p>
      <a href={n.url_originale} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-full bg-onda px-3 py-1.5 text-sm font-bold text-mare">
        {t("notizie.leggi")} ↗
      </a>
    </article>
  );
}
