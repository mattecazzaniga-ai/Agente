import { Link } from "@/i18n/navigation";
import { caricaTornei } from "@/lib/dati";
import { bandiera } from "@/lib/formato";
import { salvaTorneo } from "../azioni";
import FormAdmin from "@/components/admin/FormAdmin";
import Pannello from "@/components/admin/Pannello";
import CampiTorneo from "@/components/admin/CampiTorneo";

export default async function AdminTornei() {
  const tornei = await caricaTornei(undefined, 200);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Tornei</h1>
      <Pannello titolo={<>+ Nuovo torneo</>} aperto={tornei.length === 0}>
        <div className="mt-3">
          <FormAdmin azione={salvaTorneo} bottone="Crea torneo">
            <CampiTorneo />
          </FormAdmin>
        </div>
      </Pannello>
      <ul className="scheda divide-y divide-sabbia p-0">
        {tornei.length === 0 && <li className="p-4 text-sm text-nebbia">Nessun torneo.</li>}
        {tornei.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/tornei/${t.id}`} className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden>{bandiera(t.paese)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.nome}</span>
                <span className="block text-xs text-nebbia">
                  {t.data_inizio} · {t.circuito} · {t.stato.replace("_", " ")}
                </span>
              </span>
              <span className="text-mare">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
