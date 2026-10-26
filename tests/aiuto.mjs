// Supporto ai test: carica i dati reali da disco, come fa il browser con fetch.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { caricaDati } from "../js/data.js";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function dati() {
  return caricaDati(async (rel) => JSON.parse(await readFile(path.join(radice, rel), "utf8")));
}
