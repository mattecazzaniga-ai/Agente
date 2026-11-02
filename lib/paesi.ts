// Paesi proposti nel profilo (codici ISO 3166-1): prima quelli dove il beach tennis è più diffuso.
export const PAESI_PRINCIPALI = ["IT", "BR", "ES", "FR", "PT", "AR", "US", "RU", "DE", "NL", "BE", "CH", "AT", "GR", "AW", "MX", "UY", "CL", "PY", "VE", "JP", "CN", "MA", "RE", "PL", "HU", "CZ", "SI", "HR", "GB"];

// Da codice a 3 lettere (come nelle entry list: ITA, BRA…) a codice ISO a 2 lettere.
export const DA_ISO3: Record<string, string> = {
  ITA: "IT", BRA: "BR", ESP: "ES", FRA: "FR", POR: "PT", PRT: "PT", ARG: "AR", USA: "US", RUS: "RU", GER: "DE", DEU: "DE", NED: "NL", NLD: "NL",
  BEL: "BE", SUI: "CH", CHE: "CH", AUT: "AT", GRE: "GR", GRC: "GR", ARU: "AW", ABW: "AW", MEX: "MX", URU: "UY", URY: "UY", CHI: "CL", CHL: "CL",
  PAR: "PY", PRY: "PY", VEN: "VE", JPN: "JP", CHN: "CN", MAR: "MA", REU: "RE", POL: "PL", HUN: "HU", CZE: "CZ", SLO: "SI", SVN: "SI", CRO: "HR",
  HRV: "HR", GBR: "GB", RSA: "ZA", ZAF: "ZA", CAN: "CA", AUS: "AU", ROU: "RO", ROM: "RO", SRB: "RS", SMR: "SM", MLT: "MT", CYP: "CY", TUR: "TR",
  UKR: "UA", BUL: "BG", BGR: "BG", COL: "CO", PER: "PE", ECU: "EC", BOL: "BO", CRC: "CR", CRI: "CR", PUR: "PR", PRI: "PR", DOM: "DO", CUB: "CU",
  KOR: "KR", IND: "IN", THA: "TH", EGY: "EG", TUN: "TN", ISR: "IL", LUX: "LU", MON: "MC", MCO: "MC", DEN: "DK", DNK: "DK", SWE: "SE", NOR: "NO", FIN: "FI",
};
