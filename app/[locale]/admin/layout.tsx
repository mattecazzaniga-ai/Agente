import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { sessione } from "@/lib/dati";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

/** Il pannello esiste solo per gli admin (gli altri vedono "pagina non trovata"). Solo in italiano. */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const { profilo } = await sessione();
  if (!profilo?.is_admin) notFound();
  const voci = [
    ["/admin", "Cruscotto"],
    ["/admin/tornei", "Tornei"],
    ["/admin/giocatori", "Giocatori"],
    ["/admin/notizie", "Notizie"],
    ["/admin/premi-sponsor", "Premi, sponsor e stagioni"],
  ];
  return (
    <div lang="it">
      <p className=" text-sm font-semibold tracking-[.14em] text-viola">Admin</p>
      <nav className="-mx-4 mb-5 mt-2 flex gap-1 overflow-x-auto border-b border-linea px-4 sm:mx-0 sm:px-0">
        {voci.map(([href, nome]) => (
          <Link key={href} href={href} className="shrink-0 px-3 pb-2.5 text-[15px] font-semibold text-tenue hover:text-inchiostro">
            {nome}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
