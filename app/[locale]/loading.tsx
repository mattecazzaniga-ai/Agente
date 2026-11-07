/** Mentre la pagina arriva: la sua forma in grigio, così non si vede mai uno schermo vuoto. */
export default function Caricamento() {
  const blocco = "animate-pulse rounded-xl bg-carta";
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">…</span>
      <div className={`${blocco} -mx-4 -mt-5 h-44 rounded-none sm:mx-0 sm:mt-0 sm:rounded-xl`} />
      <div className="h-4 w-40 animate-pulse rounded bg-sabbia-2" />
      <div className="pannello divide-y divide-linea">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="h-9 w-11 animate-pulse rounded bg-sabbia-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-sabbia-2" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-sabbia-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
