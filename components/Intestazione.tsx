/** Intestazione delle pagine principali: icona colorata, titolo e una riga di spiegazione. */
export default function Intestazione({ emoji, titolo, sotto, colore = "bg-onda" }: { emoji: string; titolo: string; sotto?: string; colore?: string }) {
  return (
    <header className="flex items-center gap-3 pt-1">
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-3xl shadow-[0_8px_20px_-12px_rgba(23,50,63,.5)] ${colore}`} aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0">
        <h1 className="text-[28px] font-black leading-tight tracking-tight">{titolo}</h1>
        {sotto && <p className="text-sm text-nebbia">{sotto}</p>}
      </div>
    </header>
  );
}
