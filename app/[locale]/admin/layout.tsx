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
  ];
  return (
    <div lang="it">
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {voci.map(([href, nome]) => (
          <Link key={href} href={href} className="shrink-0 rounded-full bg-sole px-3.5 py-1.5 text-sm font-bold text-inchiostro">
            {nome}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
