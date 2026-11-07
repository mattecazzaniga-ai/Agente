// Fotografie reali di beach tennis da Wikimedia Commons, licenza CC BY-SA 4.0 (attribuzione obbligatoria:
// autore, licenza e link alla fonte compaiono nel sito accanto alla foto o nei crediti).
import play from "@/foto/play.jpg";
import marchezini from "@/foto/marchezini.jpg";
import duello from "@/foto/duello.jpg";
import squadre from "@/foto/squadre.jpg";

export interface Foto {
  src: typeof duello;
  alt: string;
  autore: string;
  fonte: string;
  licenza: "CC BY-SA 4.0";
  urlLicenza: string;
}

const CC = "https://creativecommons.org/licenses/by-sa/4.0/";

export const FOTO = {
  torneo: {
    src: play,
    alt: "Partita di doppio di beach tennis su un campo in sabbia, in pieno giorno",
    autore: "Kashtanskaya",
    fonte: "https://commons.wikimedia.org/wiki/File:Beach_Tennis_Play.jpg",
    licenza: "CC BY-SA 4.0",
    urlLicenza: CC,
  },
  giocatrice: {
    src: marchezini,
    alt: "Vitória Marchezini in salto per uno smash, Follow The Beach 2025",
    autore: "Felipe.bzra",
    fonte: "https://commons.wikimedia.org/wiki/File:Vitoria_Marchezini_Follow_The_Beach_2025.jpg",
    licenza: "CC BY-SA 4.0",
    urlLicenza: CC,
  },
  duello: {
    src: duello,
    alt: "Ninny Valentini e Joana Cortez in campo durante la stessa partita, Follow The Beach 2025",
    autore: "Felipe.bzra",
    fonte: "https://commons.wikimedia.org/wiki/File:Ninny_Valentini_vs_Joana_Cortez_Follow_The_Beach_2025.jpg",
    licenza: "CC BY-SA 4.0",
    urlLicenza: CC,
  },
  squadre: {
    src: squadre,
    alt: "Le squadre nazionali con le loro bandiere ai World Team Championships 2015 di beach tennis",
    autore: "Kashtanskaya",
    fonte: "https://commons.wikimedia.org/wiki/File:World_team_championships_2015.jpg",
    licenza: "CC BY-SA 4.0",
    urlLicenza: CC,
  },
} satisfies Record<string, Foto>;
