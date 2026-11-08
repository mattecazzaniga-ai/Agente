"use client";

/** Bottone di invio che chiede conferma prima di un'azione irreversibile. */
export default function BottoneConferma({ messaggio, className, children, etichetta }: { messaggio: string; className?: string; children: React.ReactNode; etichetta?: string }) {
  return (
    <button
      className={className}
      aria-label={etichetta}
      onClick={(e) => {
        if (!window.confirm(messaggio)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
