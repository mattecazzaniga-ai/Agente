import Image from "next/image";
import logoBeachPeck from "@/assets/brand/logo.png";

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
export const IconaSu = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} strokeWidth={2.5} className={className}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);
export const IconaGiu = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} strokeWidth={2.5} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconaIngranaggio = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
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

/** Marchio: pallina gialla con la cucitura. */
export const Logo = ({ className = "h-8 w-8" }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <circle cx="16" cy="16" r="15" fill="#e8f24a" stroke="#13293a" strokeWidth="1.2" />
    <path d="M4.2 9.5C10 12 10 20 4.2 22.5M27.8 9.5C22 12 22 20 27.8 22.5" fill="none" stroke="#13293a" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** Logo Beach Peck (immagine ufficiale), alto quanto serve: si adatta in larghezza. */
export const Marchio = ({ className = "h-11", priority = true }: P & { priority?: boolean }) => (
  <Image src={logoBeachPeck} alt="Beach Peck" priority={priority} sizes="160px" className={`w-auto ${className}`} />
);
export const IconaFuoco = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5 3.6-7.3.6 1.5 1.5 2.4 2.6 2.8C11.9 7.4 12.9 4.9 15 3c.3 3.4 3.5 5.6 3.5 10.6 0 4.4-2.7 7.4-6.5 7.4z" />
    <path d="M12 21c-1.6 0-2.8-1.2-2.8-2.9 0-1.8 1.6-2.7 2.3-4.1.9 1 3.3 2.3 3.3 4.3 0 1.6-1.2 2.7-2.8 2.7z" />
  </svg>
);
export const IconaBersaglio = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);
export const IconaFulmine = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" />
  </svg>
);
export const IconaStella = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
  </svg>
);
export const IconaGlobo = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z" />
  </svg>
);
export const IconaPallina = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M5.5 6.5c3 1.6 4.6 3.4 4.6 5.5s-1.6 3.9-4.6 5.5M18.5 6.5c-3 1.6-4.6 3.4-4.6 5.5s1.6 3.9 4.6 5.5" />
  </svg>
);
export const IconaMedaglia = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M8 3h8l-2.5 6h-3zM9.5 3 12 9M14.5 3 12 9" />
    <circle cx="12" cy="15" r="5.5" />
    <path d="m12 12.5.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2z" />
  </svg>
);
export const IconaCampanella = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4" />
  </svg>
);
