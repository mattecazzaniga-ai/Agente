// Icone disegnate a tratto (niente emoji nell'interfaccia principale): stesse dimensioni, colore dal testo.
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true };

export const IconaCasa = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1z" />
  </svg>
);
export const IconaCoppa = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0z" />
    <path d="M17 5h2.5a2.5 2.5 0 0 1-2.6 4M7 5H4.5a2.5 2.5 0 0 0 2.6 4" />
  </svg>
);
export const IconaPodio = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 21V8h6v13M3 21v-8h6M15 21v-5h6v5M2 21h20" />
  </svg>
);
export const IconaAmici = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 6.3" />
  </svg>
);
export const IconaNotizie = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M7 9h10M7 13h10M7 17h6" />
  </svg>
);
export const IconaOrologio = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconaSpunta = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} strokeWidth={3} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconaLucchetto = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const IconaCondividi = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
export const IconaFreccia = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconaIndietro = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconaCalendario = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const IconaPersona = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IconaInfo = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </svg>
);
export const IconaPiu = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconaMeno = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14" />
  </svg>
);

/** Marchio: pallina lime con la cucitura, su fondo scuro. */
export const Logo = ({ className = "h-8 w-8" }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <circle cx="16" cy="16" r="15" fill="#d4f53c" />
    <path d="M4.2 9.5C10 12 10 20 4.2 22.5M27.8 9.5C22 12 22 20 27.8 22.5" fill="none" stroke="#0b1018" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

/** Logo completo: marchio + "BEACH PECK" in condensato. */
export const Marchio = ({ className = "" }: P) => (
  <span className={`inline-flex items-center gap-2 font-display text-[22px] font-extrabold uppercase leading-none tracking-tight ${className}`}>
    <Logo className="h-7 w-7" />
    <span>
      Beach <span className="text-lime">Peck</span>
    </span>
  </span>
);
