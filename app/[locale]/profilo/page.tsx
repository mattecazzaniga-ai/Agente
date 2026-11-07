import { redirect } from "next/navigation";
import Intestazione from "@/components/Intestazione";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sessione } from "@/lib/dati";
import { urlAccesso } from "@/lib/sito";
import { esci, eliminaAccount } from "../azioni";
import FormProfilo from "@/components/FormProfilo";
import FormPassword from "@/components/FormPassword";
import BottoneConferma from "@/components/BottoneConferma";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("profilo.titolo") };
}

export default async function Profilo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, profilo } = await sessione();
  if (!user || !profilo) redirect(urlAccesso(locale, `/${locale}/profilo`));
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Intestazione titolo={profilo.nickname} sotto={user.email ?? ""} />
      <h2 className="titolo-sezione">{t("profilo.titolo")}</h2>
      <div className="scheda">
        <FormProfilo nickname={profilo.nickname} paese={profilo.paese} testoBottone={t("profilo.salva")} />
      </div>
      <h2 className="titolo-sezione">{t("profilo.passwordTitolo")}</h2>
      <div className="scheda">
        <FormPassword />
      </div>
      <form action={esci}>
        <input type="hidden" name="lingua" value={locale} />
        <button className="bottone-secondario">{t("profilo.esci")}</button>
      </form>
      <form action={eliminaAccount} className="pt-6 text-center">
        <input type="hidden" name="lingua" value={locale} />
        <BottoneConferma messaggio={t("profilo.eliminaConferma")} className="text-sm font-semibold text-corallo underline-offset-2 hover:underline">
          {t("profilo.elimina")}
        </BottoneConferma>
      </form>
      <p className="text-center">
        <Link href="/privacy" className="text-xs text-tenue underline">
          {t("profilo.privacy")}
        </Link>
      </p>
    </div>
  );
}
