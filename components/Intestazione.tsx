/** Intestazione delle pagine: titolo condensato, una riga di contesto, eventuale azione a destra. */
export default function Intestazione({ titolo, sotto, destra }: { titolo: string; sotto?: string; destra?: React.ReactNode }) {
  return (
    <header className="entra flex items-end justify-between gap-3 border-b border-linea pb-4">
      <div className="min-w-0">
        <h1 className="titolo-pagina">{titolo}</h1>
        {sotto && <p className="mt-1.5 text-sm text-tenue">{sotto}</p>}
      </div>
      {destra}
    </header>
  );
}
