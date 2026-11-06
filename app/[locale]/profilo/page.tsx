import { redirect } from "next/navigation";
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
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight">{t("profilo.titolo")}</h1>
      <p className="text-sm text-nebbia">{user.email}</p>
      <div className="scheda">
        <FormProfilo nickname={profilo.nickname} paese={profilo.paese} testoBottone={t("profilo.salva")} />
      </div>
      <div className="scheda">
        <h2 className="mb-3 font-extrabold">{t("profilo.passwordTitolo")}</h2>
        <FormPassword />
      </div>
      <form action={esci}>
        <input type="hidden" name="lingua" value={locale} />
        <button className="bottone-secondario">{t("profilo.esci")}</button>
      </form>
      <form action={eliminaAccount} className="pt-6 text-center">
        <input type="hidden" name="lingua" value={locale} />
        <BottoneConferma messaggio={t("profilo.eliminaConferma")} className="text-sm font-semibold text-corallo underline">
          {t("profilo.elimina")}
        </BottoneConferma>
      </form>
      <p className="text-center">
        <Link href="/privacy" className="text-xs text-nebbia underline">
          {t("profilo.privacy")}
        </Link>
      </p>
    </div>
  );
}
