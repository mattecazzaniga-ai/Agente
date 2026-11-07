import { getTranslations } from "next-intl/server";
import { sponsorAttivi, type Sponsor } from "@/lib/dati";

/**
 * Sponsor che scorrono da destra a sinistra, in continuo. Il passaggio del mouse (o il dito) ferma lo
 * scorrimento; con "riduci movimento" restano fermi e vanno a capo. Compare solo se ci sono sponsor.
 */
export default async function FasciaSponsor() {
  return <NastroSponsor sponsor={await sponsorAttivi()} />;
}

/** Solo il disegno della fascia, dati gli sponsor. */
export async function NastroSponsor({ sponsor }: { sponsor: Sponsor[] }) {
  const t = await getTranslations("sponsor");
  if (sponsor.length === 0) return null;
  // la lista si ripete finché riempie la fascia, poi si duplica per lo scorrimento senza salti
  const giro = Array.from({ length: Math.max(1, Math.ceil(8 / sponsor.length)) }, () => sponsor).flat();
  const voce = (s: Sponsor, k: string, nascosto = false) => {
    const logo = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.logo_url} alt={nascosto ? "" : s.nome} loading="lazy" className="h-10 w-auto max-w-[140px] object-contain grayscale transition duration-300 hover:grayscale-0 sm:h-12" />
    );
    return (
      <li key={k} className="flex shrink-0 items-center px-6" aria-hidden={nascosto || undefined}>
        {s.link ? (
          <a href={s.link} target="_blank" rel="noopener noreferrer sponsored" tabIndex={nascosto ? -1 : undefined} title={s.nome}>
            {logo}
          </a>
        ) : (
          logo
        )}
      </li>
    );
  };
  return (
    <section aria-label={t("titolo")} className="border-y border-linea bg-carta py-4">
      <p className="mx-auto mb-2 max-w-6xl px-4 text-xs font-semibold text-tenue">{t("titolo")}</p>
      <div className="fascia-sponsor overflow-hidden">
        <ul className="fascia-sponsor-nastro flex w-max">
          {giro.map((s, i) => voce(s, `a${i}`))}
          {giro.map((s, i) => voce(s, `b${i}`, true))}
        </ul>
      </div>
    </section>
  );
}
