"use client";

/** Bottone di invio che chiede conferma prima di un'azione irreversibile. */
export default function BottoneConferma({ messaggio, className, children }: { messaggio: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(messaggio)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
