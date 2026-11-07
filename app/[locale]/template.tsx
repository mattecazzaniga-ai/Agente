/** Ogni cambio di pagina entra con una breve dissolvenza (si rimonta a ogni navigazione). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="entra">{children}</div>;
}
