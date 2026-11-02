import { notFound } from "next/navigation";

// Ogni indirizzo sconosciuto mostra la pagina "non trovata" nella lingua giusta.
export default function Resto() {
  notFound();
}
