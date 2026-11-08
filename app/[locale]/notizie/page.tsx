import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Intestazione from "@/components/Intestazione";
import Vuoto from "@/components/Vuoto";
import { diarioRecente, notiziePubblicate } from "@/lib/dati";
import { CATEGORIE_NOTIZIE } from "@/lib/tipi";
import SchedaNotizia from "@/components/SchedaNotizia";
import Diario from "@/components/Diario";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("notizie.titolo"), description: t("notizie.sottotitoloPagina") };
}

/** Notizie: articolo principale, categorie, ricerca; poi il diario dei tornei (dai risultati veri). */
export default async function Notizie({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const categoria = CATEGORIE_NOTIZIE.find((c) => c === sp.categoria);
  const q = (sp.q ?? "").trim().slice(0, 60);
  const [t, tutte, diario] = await Promise.all([getTranslations(), notiziePubblicate(locale, 100, { categoria }), diarioRecente(16)]);
  const parole = q.toLowerCase().split(/\s+/).filter(Boolean);
  const notizie = parole.length ? tutte.filter((n) => parole.every((p) => `${n.titolo} ${n.riassunto} ${n.corpo ?? ""}`.toLowerCase().includes(p))) : tutte;
  const filtro = Boolean(categoria || q);
  const principale = filtro ? undefined : (notizie.find((n) => n.in_evidenza) ?? notizie.find((n) => n.immagine_url));
  const altre = notizie.filter((n) => n !== principale);
  const link = (c?: string) => `/notizie${c ? `?categoria=${c}` : ""}`;
  const pill = (attiva: boolean) => `inline-flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm font-semibold transition ${attiva ? "bg-viola text-white" : "text-tenue hover:text-inchiostro"}`;

  return (
    <div>
      <Intestazione titolo={t("notizie.titolo")} sotto={t("notizie.sottotitoloPagina")} />

      {tutte.length > 0 || filtro ? (
        <>
          <form action="" className="mt-4 flex gap-2">
            {categoria && <input type="hidden" name="categoria" value={categoria} />}
            <input name="q" defaultValue={q} placeholder={t("notizie.cerca")} aria-label={t("notizie.cerca")} className="campo" />
            <button className="bottone-secondario w-auto px-4">{t("notizie.cercaBtn")}</button>
          </form>
          <nav className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={t("notizie.categorie")}>
            <Link href={link()} className={pill(!categoria)}>
              {t("tornei.tutti")}
            </Link>
            {CATEGORIE_NOTIZIE.map((c) => (
              <Link key={c} href={link(c)} className={pill(categoria === c)}>
                {t(`categorie.${c}`)}
              </Link>
            ))}
          </nav>
          {principale && (
            <div className="mt-4">
              <SchedaNotizia notizia={principale} grande />
            </div>
          )}
          {altre.length > 0 && (
            <section>
              <h2 className="titolo-sezione">{filtro ? t("notizie.risultati", { n: notizie.length }) : t("notizie.ultime")}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {altre.map((n) => (
                  <SchedaNotizia key={n.id} notizia={n} />
                ))}
              </div>
            </section>
          )}
          {filtro && notizie.length === 0 && (
            <div className="mt-4">
              <Vuoto testo={t("notizie.nessunRisultato")} azione={t("notizie.tutte")} link="/notizie" />
            </div>
          )}
        </>
      ) : null}

      {!filtro && diario.length > 0 && (
        <section>
          <h2 className="titolo-sezione">{t("diario.titolo")}</h2>
          <p className="-mt-2 mb-3 text-sm text-tenue">{t("diario.sotto")}</p>
          <Diario voci={diario} />
          <p className="mt-3 px-1 text-xs text-tenue">{t("diario.fonteDati")}</p>
        </section>
      )}
      {!filtro && tutte.length === 0 && diario.length === 0 && (
        <div className="mt-4">
          <Vuoto testo={t("notizie.nessuna")} />
        </div>
      )}
    </div>
  );
}
