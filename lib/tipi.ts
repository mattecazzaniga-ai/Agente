// Tipi delle righe del database (vedi supabase/migrations). Scritti a mano: lo schema è piccolo.
/** Solo tornei ITF (nel database restano i valori storici dell'enum, ma un vincolo accetta solo ITF). */
export type Circuito = "ITF";
export type StatoTorneo = "in_programma" | "in_corso" | "concluso";
export type Genere = "maschile" | "femminile" | "misto";
export type Turno = "R64" | "R32" | "R16" | "QF" | "SF" | "F";
export type StatoPartita = "in_programma" | "in_corso" | "conclusa" | "annullata";

export const TURNI: Turno[] = ["R64", "R32", "R16", "QF", "SF", "F"];
export const CIRCUITI: Circuito[] = ["ITF"];
/** Categorie dei tornei ITF di beach tennis. */
export const CATEGORIE_ITF = ["BT10", "BT50", "BT100", "BT200", "BT400", "Finals"] as const;
export const GENERI: Genere[] = ["maschile", "femminile", "misto"];

export interface Giocatore {
  id: string;
  nome: string;
  cognome: string;
  paese: string | null;
  sesso?: "M" | "F" | null;
}

export interface Coppia {
  id: string;
  tabellone_id: string;
  testa_di_serie: number | null;
  g1: Giocatore;
  g2: Giocatore;
}

export interface Partita {
  id: string;
  tabellone_id: string;
  turno: Turno;
  ordine: number;
  coppia_a_id: string | null;
  coppia_b_id: string | null;
  inizio_at: string;
  set_per_vincere: 1 | 2;
  stato: StatoPartita;
  game_a: number[] | null;
  game_b: number[] | null;
  ritiro: boolean;
  vincitore_id: string | null;
}

export interface Tabellone {
  id: string;
  torneo_id: string;
  genere: Genere;
  coppie: Coppia[];
  partite: Partita[];
}

export interface Torneo {
  id: string;
  nome: string;
  luogo: string;
  paese: string | null;
  circuito: Circuito;
  categoria: string | null;
  data_inizio: string;
  data_fine: string;
  inizio_at: string;
  stato: StatoTorneo;
}

export interface Profilo {
  id: string;
  nickname: string;
  paese: string | null;
  lingua: string;
  profilo_completo: boolean;
  is_admin: boolean;
}

export interface PronosticoTorneo {
  id: string;
  tabellone_id: string;
  vincitore_id: string;
  finalista_id: string | null;
  punti: number | null;
}

export interface PronosticoPartita {
  id: string;
  partita_id: string;
  vincitore_id: string;
  set_vincitore: number | null;
  set_perdente: number | null;
  totale_game: number | null;
  punti: number | null;
}

export interface Voto {
  coppia_id: string;
  voti: number;
  percentuale: number;
  punti_in_palio: number;
}

export interface RigaClassifica {
  posizione: number;
  utente_id: string;
  nickname: string;
  paese: string | null;
  punti: number;
  pronostici: number;
}

export interface Notizia {
  id: string;
  fonte_nome: string;
  url_originale: string;
  pubblicata_at: string | null;
  stato: "bozza" | "pubblicata";
  notizie_traduzioni: { lingua: string; titolo: string; riassunto: string }[];
}
