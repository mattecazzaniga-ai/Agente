import type { Torneo } from "@/lib/tipi";
import { CATEGORIE_ITF } from "@/lib/tipi";
import CampoDataOra from "./CampoDataOra";

/** Campi del modulo torneo (nuovo o modifica). */
export default function CampiTorneo({ torneo }: { torneo?: Torneo }) {
  return (
    <>
      {torneo && <input type="hidden" name="id" value={torneo.id} />}
      <label className="block">
        <span className="etichetta">Nome</span>
        <input name="nome" required minLength={3} maxLength={120} defaultValue={torneo?.nome} placeholder="ITF BT400 Lignano" className="campo" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block">
          <span className="etichetta">Luogo</span>
          <input name="luogo" required minLength={2} maxLength={120} defaultValue={torneo?.luogo} className="campo" />
        </label>
        <label className="block">
          <span className="etichetta">Paese (ISO)</span>
          <input name="paese" maxLength={2} defaultValue={torneo?.paese ?? ""} placeholder="IT" className="campo" />
        </label>
      </div>
      <input type="hidden" name="circuito" value="ITF" />
      <label className="block">
        <span className="etichetta">Categoria ITF</span>
        <select name="categoria" defaultValue={torneo?.categoria ?? "BT400"} className="campo">
          {CATEGORIE_ITF.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="etichetta">Dal</span>
          <input type="date" name="data_inizio" required defaultValue={torneo?.data_inizio} className="campo" />
        </label>
        <label className="block">
          <span className="etichetta">Al</span>
          <input type="date" name="data_fine" required defaultValue={torneo?.data_fine} className="campo" />
        </label>
      </div>
      <CampoDataOra nome="inizio_at" valore={torneo?.inizio_at} etichetta="Primo incontro (chiude i pronostici su vincitore/finalista)" />
      <label className="block">
        <span className="etichetta">Stato</span>
        <select name="stato" defaultValue={torneo?.stato ?? "in_programma"} className="campo">
          <option value="in_programma">In programma</option>
          <option value="in_corso">In corso</option>
          <option value="concluso">Concluso (calcola i punti del torneo)</option>
        </select>
      </label>
    </>
  );
}
