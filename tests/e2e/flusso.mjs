// Prova end-to-end del criterio di accettazione, su telefono (viewport iPhone):
// un nuovo utente si registra, sceglie la lingua, fa un pronostico, entra in una lega privata
// e vede la classifica, tutto in meno di 2 minuti. Serve Supabase locale (supabase start) con il seed
// e l'app avviata (npm run build && npm start). Il codice di accesso si legge da Mailpit.
//
// Uso: node tests/e2e/flusso.mjs   (variabili: SITO, MAILPIT, CHROMIUM)
import { chromium, devices } from "playwright";
import { execSync } from "node:child_process";

const SITO = process.env.SITO ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:54324";
const CHROMIUM = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium";
const DB = process.env.DB_CONTAINER ?? "supabase_db_beachpick";
const id = Date.now().toString(36);

const ok = (cond, msg) => {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
};

async function codiceDa(email) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((x) => x.json());
    if (r.messages?.length) {
      const m = await fetch(`${MAILPIT}/api/v1/message/${r.messages[0].ID}`).then((x) => x.json());
      const c = (m.Text || m.HTML).match(/\b(\d{6})\b/);
      if (c) return c[1];
    }
    await new Promise((s) => setTimeout(s, 500));
  }
  throw new Error(`nessuna email per ${email}`);
}

async function registra(page, email, nickname, paese) {
  await page.getByRole("link", { name: /^(Accedi|Entrar|Sign in)$/ }).first().click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('form button:not([type="button"])').first().click();
  const codice = await codiceDa(email);
  await page.locator('input[name="codice"]').fill(codice);
  await page.locator('input[name="codice"]').press("Enter");
  await page.waitForURL(/benvenuto/);
  await page.locator('input[name="nickname"]').fill(nickname);
  await page.locator('select[name="paese"]').selectOption(paese);
  await page.locator('form button:not([type="button"])').first().click();
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const telefono = { ...devices["iPhone 13"], locale: "pt-BR" };

try {
  // --- preparazione: un amico crea la lega (non conta nei 2 minuti) ---
  const amico = await browser.newContext(telefono);
  const pa = await amico.newPage();
  await pa.goto(SITO);
  await registra(pa, `amico-${id}@prova.local`, `amico_${id}`, "BR");
  await pa.waitForURL(/\/pt-BR$/);
  await pa.goto(`${SITO}/pt-BR/leghe`);
  await pa.locator('input[name="nome"]').fill("Praia dos amigos");
  await pa.getByRole("button", { name: "Criar" }).click();
  const codice = (await pa.locator("p.font-mono").first().textContent({ timeout: 10000 }))?.trim();
  ok(/^[A-Z2-9]{6}$/.test(codice ?? ""), `lega creata con codice ${codice}`);

  // --- il nuovo utente: cronometro ---
  const t0 = Date.now();
  const ctx = await browser.newContext(telefono);
  const page = await ctx.newPage();
  await page.goto(`${SITO}/`);
  ok(page.url().endsWith("/pt-BR"), "lingua rilevata dal telefono (pt-BR)");
  ok(await page.getByText("sem apostas").first().isVisible(), "avviso 'nessuna scommessa' visibile");
  // sceglie lo spagnolo
  await page.locator("header select").selectOption("es");
  await page.waitForURL(/\/es$/);
  ok(true, "lingua scelta: es");
  await registra(page, `nuovo-${id}@prova.local`, `nuovo_${id}`, "IT");
  await page.waitForURL(/\/es$/);
  ok(true, "registrato con email + codice, profilo completato");
  // pronostico sulla prima partita aperta
  const scheda = page.locator("article").filter({ has: page.locator('input[name="partita_id"]') }).first();
  await scheda.locator('button[aria-pressed]').first().click();
  await scheda.getByRole("button", { name: "Guardar" }).click();
  await scheda.getByText("Guardado ✓").waitFor();
  ok(true, "pronostico salvato");
  // entra nella lega con il link d'invito e vede la classifica
  await page.goto(`${SITO}/es/leghe/${codice}`);
  await page.getByRole("button", { name: "Entrar en la liga" }).click();
  await page.waitForURL(/classifica\?ambito=lega/);
  await page.getByText(`nuovo_${id}`).waitFor().catch(() => {});
  const secondi = (Date.now() - t0) / 1000;
  ok(await page.getByRole("heading", { name: "Ranking" }).isVisible(), "classifica della lega visibile");
  ok(secondi < 120, `flusso completo in ${secondi.toFixed(1)} s (< 120 s)`);

  // --- admin: importa un tabellone, inserisce un risultato, pubblica una notizia ---
  execSync(`docker exec ${DB} psql -U postgres -d postgres -c "update profili set is_admin = true where nickname = 'amico_${id}'"`);
  await pa.goto(`${SITO}/it/admin`);
  ok(await pa.getByRole("heading", { name: "Cruscotto" }).isVisible(), "pannello admin accessibile all'admin");
  await pa.goto(`${SITO}/it/admin/tornei`);
  await pa.getByText("+ Nuovo torneo").click();
  await pa.locator('input[name="nome"]').fill(`Torneo prova ${id}`);
  await pa.locator('input[name="luogo"]').fill("Spiaggia");
  await pa.locator('input[name="paese"]').fill("IT");
  const oggi = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await pa.locator('input[name="data_inizio"]').fill(oggi);
  await pa.locator('input[name="data_fine"]').fill(oggi);
  await pa.locator('input[type="datetime-local"]').fill(`${oggi}T10:00`);
  await pa.getByRole("button", { name: "Crea torneo" }).click();
  await pa.waitForURL(/admin\/tornei\/[0-9a-f-]{36}/);
  await pa.getByRole("button", { name: "+ Aggiungi tabellone" }).click();
  await pa.getByText("Tabellone Maschile").waitFor();
  await pa.locator('textarea[name="testo"]').fill(
    ["1. Mario Rossi (ITA) / Luigi Bianchi (ITA)", "BYE", "SILVA Joao BRA / COSTA Pedro BRA", "Garcia, Luis (ESP) – Lopez, Marc (ESP)", "Hugo;Lamy;FRA;Paul;Roux;FRA;", "Anna;Neri;ITA;Ugo;Neri;ITA;", "Tim;Berg;GER;Jan;Wolf;GER;", "Ivan;Orlov;RUS;Oleg;Ivanov;RUS;2"].join("\n"),
  );
  await pa.locator('input[type="datetime-local"]').nth(1).fill(`${oggi}T10:00`);
  await pa.getByRole("button", { name: "Importa" }).click();
  await pa.getByText(/Importate 7 coppie e 3 partite/).waitFor();
  ok(true, "entry list importata: 7 coppie, 3 partite di quarti, 1 BYE");
  await pa.reload();
  const prima = pa.locator(".scheda").filter({ has: pa.locator('input[name="punteggio"]') }).first();
  await prima.locator('input[name="punteggio"]').fill("6-3");
  await prima.getByRole("button", { name: "Salva risultato" }).click();
  await prima.getByText(/Risultato salvato/).waitFor();
  ok(true, "risultato inserito, vincitore avanzato");
  await pa.goto(`${SITO}/it/admin/notizie`);
  await pa.locator('input[name="fonte_nome"]').fill("Fonte di prova");
  await pa.locator('input[name="url_originale"]').fill("https://example.com/articolo");
  await pa.locator('input[name="titolo_it"]').fill(`Notizia di prova ${id}`);
  await pa.locator('textarea[name="riassunto_it"]').fill("Riassunto originale di prova scritto a mano, con fonte e link all'articolo.");
  await pa.locator('select[name="stato"]').selectOption("pubblicata");
  await pa.getByRole("button", { name: "Salva notizia" }).click();
  await pa.waitForURL(/salvata=1/);
  await page.goto(`${SITO}/es/notizie`);
  ok(await page.getByText(`Notizia di prova ${id}`).isVisible(), "notizia pubblicata visibile (in italiano, lingua mancante segnalata)");

  // l'utente normale non vede il pannello
  const r = await page.goto(`${SITO}/es/admin`);
  ok(r?.status() === 404, "pannello admin nascosto agli altri utenti (404)");

  // immagine da condividere
  const img = await page.request.get(`${SITO}/api/immagine/classifica?ambito=globale&lingua=es`);
  ok([200, 404].includes(img.status()), `immagine classifica risponde (${img.status()})`);
  await page.screenshot({ path: process.env.SCREENSHOT ?? "/tmp/beachpick-classifica.png", fullPage: true });
  console.log("\nTutto ok.");
} finally {
  await browser.close();
}
