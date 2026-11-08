import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sessione } from "@/lib/dati";
import { bandiera, meseIso, nomeMese } from "@/lib/formato";
import type { RigaClassifica } from "@/lib/tipi";
import { eliminaLega, esciLega, rimuoviMembro, rinominaLega } from "../../azioni";
import Invita from "@/components/Invita";
import BottoneConferma from "@/components/BottoneConferma";
import { IconaIndietro } from "@/components/Icone";
import { indirizzoSito, urlAccesso } from "@/lib/sito";
import FormLeghe from "@/components/FormLeghe";
import Avviso from "@/components/Avviso";
import { IconaAmici } from "@/components/Icone";

export const dynamic = "force-dynamic";

/**
 * Pagina di una lega. Per chi ne fa parte: classifica del mese, membri e (per chi l'ha creata) gestione.
 * Per tutti gli altri è la pagina del link d'invito: mostra la lega e fa entrare con un tocco.
 */
export default async function Invito({ params }: { params: Promise<{ locale: string; codice: string }> }) {
  const { locale, codice: grezzo } = await params;
  setRequestLocale(locale);
  const codice = grezzo.toUpperCase();
  const t = await getTranslations();
  const { supabase, user } = await sessione();
  const { data } = /^[A-Z2-9]{6}$/.test(codice) ? await supabase.rpc("lega_da_codice", { p_codice: codice }) : { data: null };
  const lega = (data as { id: string; nome: string; membri: number }[] | null)?.[0];
  if (!lega) {
    return (
      <div className="scheda mt-4 space-y-3 text-center">
        <p className="font-semibold">{t("leghe.invitoNonTrovato")}</p>
        <Link href="/leghe" className="bottone">
          {t("leghe.titolo")}
        </Link>
      </div>
    );
  }
  // Membro della lega: pagina completa
  const { data: membroDi } = user ? await supabase.from("leghe_membri").select("lega_id").eq("lega_id", lega.id).eq("utente_id", user.id).maybeSingle() : { data: null };
  if (user && membroDi) {
    const mese = meseIso();
    const [{ data: info }, { data: membri }, { data: righe }] = await Promise.all([
      supabase.from("leghe").select("id, nome, codice, creata_da, creato_at").eq("id", lega.id).single(),
      supabase.from("leghe_membri").select("utente_id, entrato_at, profilo:profili(nickname, paese)").eq("lega_id", lega.id).order("entrato_at"),
      supabase.rpc("classifica", { p_mese: mese, p_ambito: "lega", p_paese: null, p_lega: lega.id, p_limite: 200 }),
    ]);
    const l = info as { id: string; nome: string; codice: string; creata_da: string; creato_at: string };
    const elenco = (membri as unknown as { utente_id: string; entrato_at: string; profilo: { nickname: string; paese: string | null } | null }[]) ?? [];
    const classifica = (righe as RigaClassifica[] | null) ?? [];
    const sonoCapo = l.creata_da === user.id;
    const puntiDi = new Map(classifica.map((r) => [r.utente_id, r]));
    const totale = classifica.reduce((x, r) => x + Number(r.punti), 0);
    const pronostici = classifica.reduce((x, r) => x + Number(r.pronostici), 0);
    const sito = await indirizzoSito();
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/leghe" className="inline-flex items-center gap-1 text-sm font-semibold text-tenue hover:text-inchiostro">
          <IconaIndietro /> {t("leghe.titolo")}
        </Link>
        <header className="mt-3 rounded-xl bg-inchiostro px-5 py-5 text-white">
          <p className="text-sm font-semibold text-sole">{t("leghe.lega")}</p>
          <h1 className="mt-1 font-display text-[34px] font-bold leading-none">{l.nome}</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-white/75">
            <span className="inline-flex items-center gap-1">
              <IconaAmici className="h-4 w-4" /> {t("leghe.membriN", { n: elenco.length })}
            </span>
            <span>
              {t("leghe.codiceBreve")}: <span className="cifre tracking-[.2em] text-white">{l.codice}</span>
            </span>
          </p>
        </header>

        <dl className="pannello mt-4 grid grid-cols-3 divide-x divide-linea overflow-hidden text-center">
          {(
            [
              [String(elenco.length), t("leghe.membri")],
              [String(pronostici), t("leghe.pronosticiMese", { mese: nomeMese(mese, locale) })],
              [String(totale), t("leghe.puntiMese")],
            ] as [string, string][]
          ).map(([v, e]) => (
            <div key={e} className="flex flex-col px-2 py-3">
              <dt className="order-last mt-1 text-[11px] font-semibold leading-snug text-tenue">{e}</dt>
              <dd className="cifre text-2xl leading-none">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <Invita nome={l.nome} codice={l.codice} sito={sito} />
        </div>

        <h2 className="titolo-sezione">{t("leghe.classificaMese", { mese: nomeMese(mese, locale) })}</h2>
        <ol className="pannello divide-y divide-linea overflow-hidden">
          {[...elenco]
            .sort((a, b) => (puntiDi.get(a.utente_id)?.posizione ?? 9999) - (puntiDi.get(b.utente_id)?.posizione ?? 9999))
            .map((m) => {
              const r = puntiDi.get(m.utente_id);
              return (
                <li key={m.utente_id} className={`flex items-center gap-3 px-4 py-2.5 ${m.utente_id === user.id ? "bg-viola/10" : ""}`}>
                  <span className={`cifre w-6 text-lg ${r?.posizione === 1 ? "text-viola" : "text-tenue"}`}>{r ? r.posizione : "–"}</span>
                  <Link href={`/giocatore/${m.utente_id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-viola">
                    {bandiera(m.profilo?.paese ?? null)} {m.profilo?.nickname ?? "—"}
                    {m.utente_id === l.creata_da && <span className="chip ml-2 bg-sole-chiaro text-inchiostro">{t("leghe.capo")}</span>}
                  </Link>
                  <span className="cifre text-lg">{r?.punti ?? 0}</span>
                  {sonoCapo && m.utente_id !== user.id && (
                    <form action={rimuoviMembro}>
                      <input type="hidden" name="lega" value={l.id} />
                      <input type="hidden" name="utente" value={m.utente_id} />
                      <BottoneConferma messaggio={t("leghe.rimuoviConferma", { nome: m.profilo?.nickname ?? "" })} className="grid h-8 w-8 place-items-center rounded-md text-tenue hover:bg-corallo/10 hover:text-corallo" etichetta={t("leghe.rimuovi")}>
                        ✕
                      </BottoneConferma>
                    </form>
                  )}
                </li>
              );
            })}
        </ol>
        <p className="mt-2 px-1 text-xs text-tenue">
          <Link href={`/classifica?ambito=lega&lega=${l.id}`} className="font-semibold text-viola">
            {t("leghe.mesiPassati")} →
          </Link>
        </p>

        {sonoCapo ? (
          <section>
            <h2 className="titolo-sezione">{t("leghe.impostazioni")}</h2>
            <form action={rinominaLega} className="scheda flex items-end gap-2">
              <input type="hidden" name="lega" value={l.id} />
              <label className="min-w-0 flex-1">
                <span className="etichetta">{t("leghe.nome")}</span>
                <input name="nome" defaultValue={l.nome} required minLength={3} maxLength={40} className="campo" />
              </label>
              <button className="bottone w-auto px-4">{t("profilo.salva")}</button>
            </form>
            <form action={eliminaLega} className="mt-3 text-center">
              <input type="hidden" name="lega" value={l.id} />
              <input type="hidden" name="lingua" value={locale} />
              <BottoneConferma messaggio={t("leghe.eliminaConferma")} className="text-sm font-semibold text-corallo underline-offset-2 hover:underline">
                {t("leghe.elimina")}
              </BottoneConferma>
            </form>
          </section>
        ) : (
          <form action={esciLega} className="mt-6 text-center">
            <input type="hidden" name="lega" value={l.id} />
            <BottoneConferma messaggio={t("leghe.esciConferma")} className="text-sm text-tenue underline-offset-2 hover:text-corallo hover:underline">
              {t("leghe.esci")}
            </BottoneConferma>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 pt-2">
      <div className="border-b border-linea pb-4">
        <p className=" text-sm font-semibold tracking-[.14em] text-viola">{t("leghe.titolo")}</p>
        <h1 className="titolo-pagina mt-1">{t("leghe.invitoTitolo", { nome: lega.nome })}</h1>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-tenue">
          <IconaAmici className="h-4 w-4" /> {lega.membri}
        </p>
      </div>
      {user ? (
        <FormLeghe sito={await indirizzoSito()} codiceIniziale={codice} soloEntra />
      ) : (
        <a href={urlAccesso(locale, `/${locale}/leghe/${codice}`)} className="bottone">
          {t("leghe.entraOra")}
        </a>
      )}
      <Avviso grande />
    </div>
  );
}
