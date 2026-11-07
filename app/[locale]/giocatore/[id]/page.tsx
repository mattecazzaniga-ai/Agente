import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { podiMesiChiusi, podiTornei, schedaGiocatore, sessione, type PartitaConCoppie } from "@/lib/dati";
import { bandiera, nomeMese } from "@/lib/formato";
import { calcolaTrofei, medagliePerUtente } from "@/lib/trofei";
import { statistichePersonali } from "@/lib/statistiche";
import { Bacheca, MedaglieMese } from "@/components/Trofei";
import RigaPartita from "@/components/RigaPartita";
import Vuoto from "@/components/Vuoto";
import { IconaIndietro } from "@/components/Icone";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = /^[0-9a-f-]{36}$/i.test(id) ? await schedaGiocatore(id) : null;
  return { title: s?.profilo.nickname ?? "—" };
}

/** Scheda pubblica di un giocatore: mesi, tornei, trofei e pronostici sulle partite già chiuse. */
export default async function Giocatore({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s, { user }, podi, podiT, t] = await Promise.all([schedaGiocatore(id), sessione(), podiMesiChiusi(), podiTornei(), getTranslations()]);
  if (!s) notFound();
  const { profilo, mesi, voci } = s;
  const nessuna = { oro: 0, argento: 0, bronzo: 0 };
  const medMesi = medagliePerUtente(podi).get(id) ?? nessuna;
  const medTornei = medagliePerUtente([podiT]).get(id) ?? nessuna;
  const trofei = calcolaTrofei(voci, medMesi, medTornei);
  const st = statistichePersonali(voci);
  const puntiTotali = mesi.reduce((x, m) => x + Number(m.punti), 0);
  const migliorPosto = mesi.length ? Math.min(...mesi.map((m) => Number(m.posizione))) : null;
  const maxMese = Math.max(1, ...mesi.map((m) => Number(m.punti)));
  const link = (p: PartitaConCoppie) => `/tornei/${p.tabellone.torneo.id}?${new URLSearchParams({ tab: p.tabellone.genere, turno: p.turno })}#p-${p.id}`;

  // tornei giocati: punti e, se è finito tra i primi tre, il posto
  const tornei = new Map<string, { nome: string; punti: number; pronostici: number; posto?: number }>();
  for (const { partita: p, mio } of voci) {
    const x = tornei.get(p.tabellone.torneo.id) ?? { nome: p.tabellone.torneo.nome, punti: 0, pronostici: 0 };
    x.punti += mio.punti ?? 0;
    x.pronostici++;
    tornei.set(p.tabellone.torneo.id, x);
  }
  for (const r of podiT.filter((r) => r.utente_id === id)) {
    const x = tornei.get(r.torneo_id);
    if (x) x.posto = Number(r.posizione);
  }
  const numeri: [string, string][] = [
    [String(puntiTotali), t("giocatore.puntiTotali")],
    [migliorPosto ? `${migliorPosto}°` : "—", t("giocatore.migliorPosto")],
    [String(voci.length), t("giocatore.pronosticiChiusi")],
    [st.valutati ? `${Math.round((st.vincitori / st.valutati) * 100)}%` : "—", t("giocatore.vincitori")],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/classifica" className="inline-flex items-center gap-1 text-sm font-semibold text-tenue hover:text-inchiostro">
        <IconaIndietro /> {t("classifica.titolo")}
      </Link>

      <header className="mt-3 rounded-xl bg-inchiostro px-5 py-6 text-white">
        <p className="text-sm font-semibold text-sole">{user?.id === id ? t("giocatore.tuoPubblico") : t("giocatore.giocatore")}</p>
        <h1 className="mt-1 font-display text-[40px] font-bold leading-none">
          <span aria-hidden className="mr-2">{bandiera(profilo.paese)}</span>
          {profilo.nickname}
          <MedaglieMese m={medMesi} titolo={t("trofei.medaglie")} />
        </h1>
        <p className="mt-2 text-sm text-white/75">{t("giocatore.dal", { mese: nomeMese(profilo.creato_at.slice(0, 7) + "-01", locale) })}</p>
      </header>

      <dl className="pannello mt-4 grid grid-cols-2 overflow-hidden sm:grid-cols-4 [&>div]:border-linea [&>div:nth-child(odd)]:border-r sm:[&>div]:border-r sm:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b sm:[&>div:nth-child(-n+2)]:border-b-0">
        {numeri.map(([v, e]) => (
          <div key={e} className="flex flex-col p-4">
            <dt className="order-last mt-1 text-xs font-semibold leading-snug text-tenue">{e}</dt>
            <dd className="cifre text-3xl leading-none">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <Bacheca trofei={trofei} titolo={t("giocatore.trofei")} />
      </div>

      <h2 className="titolo-sezione">{t("giocatore.mesi")}</h2>
      {mesi.length === 0 ? (
        <Vuoto testo={t("giocatore.nessunMese")} />
      ) : (
        <ul className="pannello divide-y divide-linea overflow-hidden">
          {mesi.map((m) => (
            <li key={m.mese} className="flex items-center gap-3 px-4 py-3">
              <span className="w-28 shrink-0 text-sm font-semibold capitalize">{nomeMese(m.mese, locale)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-linea">
                <span className="block h-full rounded-full bg-viola" style={{ width: `${(Number(m.punti) / maxMese) * 100}%` }} />
              </span>
              <span className="w-24 shrink-0 text-right">
                <span className="cifre text-lg">{m.punti}</span> <span className="text-xs text-tenue">pt</span>
                <span className="block text-xs text-tenue">{t("giocatore.posto", { posizione: m.posizione, totale: m.partecipanti })}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {tornei.size > 0 && (
        <>
          <h2 className="titolo-sezione">{t("giocatore.tornei")}</h2>
          <ul className="pannello divide-y divide-linea overflow-hidden">
            {[...tornei.entries()].map(([tid, x]) => (
              <li key={tid}>
                <Link href={`/tornei/${tid}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-sabbia-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{x.nome}</span>
                    <span className="block text-xs text-tenue">{t("giocatore.pronosticiN", { n: x.pronostici })}</span>
                  </span>
                  {x.posto && <span className="chip bg-sole-chiaro text-inchiostro">{t("giocatore.postoTorneo", { n: x.posto })}</span>}
                  <span className="cifre text-xl text-viola">{x.punti}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="titolo-sezione">{t("giocatore.ultimi")}</h2>
      {voci.length === 0 ? (
        <Vuoto testo={t("giocatore.nessunPronostico")} />
      ) : (
        <>
          <ul className="pannello divide-y divide-linea overflow-hidden">
            {voci.slice(0, 20).map(({ partita: p, mio }) => (
              <li key={p.id}>
                <RigaPartita partita={p} a={p.coppia_a} b={p.coppia_b} mio={mio} href={link(p)} sopra={`${p.tabellone.torneo.nome} · ${t(`turno.${p.turno}`)}`} />
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-xs text-tenue">{t("giocatore.privacy")}</p>
        </>
      )}
    </div>
  );
}
