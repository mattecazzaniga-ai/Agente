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

/** Logo: pallina gialla con le cuciture. */
export const Logo = ({ className = "h-8 w-8" }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <circle cx="16" cy="16" r="14" fill="#ffc83d" />
    <path d="M5.5 7.5c5 3.5 5 13.5 0 17M26.5 7.5c-5 3.5-5 13.5 0 17" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** Piccola scena da spiaggia per l'accoglienza: sole, mare, rete. */
export const Spiaggia = ({ className = "" }: P) => (
  <svg viewBox="0 0 360 140" className={className} aria-hidden preserveAspectRatio="xMidYMax slice">
    <circle cx="300" cy="42" r="26" fill="#ffc83d" />
    <circle cx="300" cy="42" r="38" fill="#ffc83d" opacity=".18" />
    <path d="M0 92c40-12 80-12 120 0s80 12 120 0 80-12 120 0v48H0z" fill="#5cc3e0" />
    <path d="M0 106c40-10 80-10 120 0s80 10 120 0 80-10 120 0v34H0z" fill="#0a7ea4" opacity=".85" />
    <path d="M0 122c60-8 120-8 180 0s120 8 180 0v18H0z" fill="#fbf1df" />
    <g stroke="#17323f" strokeWidth="2" opacity=".7">
      <path d="M70 122V78M150 122V78" />
      <path d="M70 80h80M70 92h80M70 80v12M90 80v12M110 80v12M130 80v12M150 80v12" strokeWidth="1.2" />
    </g>
    <circle cx="196" cy="62" r="7" fill="#ffc83d" stroke="#fff" strokeWidth="1.5" />
  </svg>
);
