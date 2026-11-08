import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notiziaPubblicata, notiziePubblicate } from "@/lib/dati";
import { indirizzoSito } from "@/lib/sito";
import { data } from "@/lib/formato";
import SchedaNotizia from "@/components/SchedaNotizia";
import Condividi from "@/components/Condividi";
import { IconaIndietro } from "@/components/Icone";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const n = /^[0-9a-f-]{36}$/i.test(id) ? await notiziaPubblicata(id, locale) : null;
  if (!n) return { title: "—" };
  return { title: n.titolo, description: n.riassunto, openGraph: { title: n.titolo, description: n.riassunto, type: "article", ...(n.immagine_url ? { images: [n.immagine_url] } : {}) } };
}

/** Pagina di un articolo: titolo, sottotitolo, foto, testo, autore, data, fonte, torneo collegato e correlati. */
export default async function Articolo({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const n = await notiziaPubblicata(id, locale);
  if (!n) notFound();
  if (!n.articolo && n.url_originale) redirect(n.url_originale); // segnalazione senza testo: si va alla fonte
  const [t, sito, perTorneo, perCategoria] = await Promise.all([
    getTranslations(),
    indirizzoSito(),
    n.torneo ? notiziePubblicate(locale, 3, { torneo: n.torneo.id, escludi: n.id }) : Promise.resolve([]),
    notiziePubblicate(locale, 3, { categoria: n.categoria, escludi: n.id }),
  ]);
  const correlati = [...perTorneo, ...perCategoria.filter((x) => !perTorneo.some((y) => y.id === x.id))].slice(0, 3);
  const paragrafi = (n.corpo ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/notizie" className="inline-flex items-center gap-1 text-sm font-semibold text-tenue hover:text-inchiostro">
        <IconaIndietro /> {t("notizie.titolo")}
      </Link>
      <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-tenue">
        <Link href={`/notizie?categoria=${n.categoria}`} className="text-viola">
          {t(`categorie.${n.categoria}`)}
        </Link>
        {n.pubblicata_at && <span>{data(n.pubblicata_at, locale, { day: "numeric", month: "long", year: "numeric" })}</span>}
        {n.autore && <span>· {n.autore}</span>}
      </p>
      <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.05] sm:text-[44px]">{n.titolo}</h1>
      <p className="mt-3 text-lg leading-snug text-tenue">{n.riassunto}</p>
      {n.immagine_url && (
        <figure className="-mx-4 mt-5 sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto caricata dall'admin */}
          <img src={n.immagine_url} alt="" className="aspect-[16/9] w-full object-cover sm:rounded-xl" />
          {n.credito_immagine && <figcaption className="mt-1.5 px-4 text-xs text-tenue sm:px-0">{n.credito_immagine}</figcaption>}
        </figure>
      )}
      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-inchiostro/90">
        {paragrafi.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
      {(n.fonte_nome || n.torneo) && (
        <div className="mt-6 space-y-2 border-t border-linea pt-4 text-sm">
          {n.fonte_nome && n.url_originale && (
            <p>
              <span className="text-tenue">{t("notizie.fonteLabel")}</span>{" "}
              <a href={n.url_originale} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-viola underline-offset-2 hover:underline">
                {n.fonte_nome}
              </a>
            </p>
          )}
          {n.torneo && (
            <Link href={`/tornei/${n.torneo.id}`} className="pannello solleva flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-xs font-semibold text-tenue">{t("notizie.torneoCollegato")}</span>
                <span className="block font-semibold">{n.torneo.nome}</span>
              </span>
              <span className="text-sm font-semibold text-viola">{t("notizie.vaiTorneo")} →</span>
            </Link>
          )}
        </div>
      )}
      <div className="mt-6">
        <Condividi testo={n.titolo} url={`${sito}/${locale}/notizie/${n.id}`} etichetta={t("condividi.condividi")} />
      </div>
      {correlati.length > 0 && (
        <section>
          <h2 className="titolo-sezione">{t("notizie.correlati")}</h2>
          <div className="space-y-3">
            {correlati.map((c) => (
              <SchedaNotizia key={c.id} notizia={c} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
