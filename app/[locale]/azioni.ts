"use server";
// Azioni degli utenti (Server Actions). Ogni regola importante la controlla anche il database:
// qui si trasformano i dati del modulo e si traducono gli errori in messaggi chiari.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { routing } from "@/i18n/routing";
import { indirizzoSito } from "@/lib/sito";

export type Esito = { ok: true; messaggio?: string; dati?: Record<string, string> } | { ok: false; errore: string };

const lingua = (x: FormDataEntryValue | null) => (routing.locales as readonly string[]).includes(String(x)) ? String(x) : routing.defaultLocale;
const testo = (x: FormDataEntryValue | null) => (typeof x === "string" ? x.trim() : "");
const uuidOpz = (x: FormDataEntryValue | null) => {
  const v = testo(x);
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
};

/** Messaggio tradotto per gli errori più comuni del database. */
function chiaveErrore(messaggio: string): string {
  const m = messaggio.toLowerCase();
  if (m.includes("chiusi")) return "chiusi";
  if (m.includes("profili_nickname_unico") || m.includes("duplicate")) return "duplicato";
  if (m.includes("check")) return "nonValido";
  if (m.includes("codice lega non valido")) return "codiceLega";
  return "generico";
}

// ---------------------------------------------------------------------------
// Accesso
// ---------------------------------------------------------------------------

export async function inviaCodice(_: Esito | null, form: FormData): Promise<Esito> {
  const email = testo(form.get("email")).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, errore: "email" };
  const loc = lingua(form.get("lingua"));
  const dopo = testo(form.get("dopo"));
  const destinazione = dopo.startsWith("/") && !dopo.startsWith("//") ? dopo : `/${loc}`;
  // Se l'email contiene un link invece del codice (email standard di Supabase), il link porta i token
  // nel frammento dell'URL (flusso "implicit"): così funziona anche aperto in un altro browser o nell'app di posta.
  const ritorno = `${await indirizzoSito()}/${loc}/accedi/link?dopo=${encodeURIComponent(destinazione)}`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: ritorno, data: { lingua: loc } } });
  if (error) return { ok: false, errore: error.status === 429 ? "troppe" : "generico" };
  return { ok: true, dati: { email } };
}

export async function verificaCodice(_: Esito | null, form: FormData): Promise<Esito> {
  const email = testo(form.get("email")).toLowerCase();
  const token = testo(form.get("codice")).replace(/\s/g, "");
  const loc = lingua(form.get("lingua"));
  const dopo = testo(form.get("dopo"));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { ok: false, errore: "codice" };
  const { data: profilo } = await supabase.from("profili").select("profilo_completo").eq("id", data.user.id).single();
  const destinazione = dopo.startsWith("/") && !dopo.startsWith("//") ? dopo : `/${loc}`;
  redirect(profilo?.profilo_completo ? destinazione : `/${loc}/benvenuto?dopo=${encodeURIComponent(destinazione)}`);
}

export async function esci(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect(`/${lingua(form.get("lingua"))}`);
}

// ---------------------------------------------------------------------------
// Profilo
// ---------------------------------------------------------------------------

export async function salvaProfilo(_: Esito | null, form: FormData): Promise<Esito> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errore: "accesso" };
  const nickname = testo(form.get("nickname"));
  const paese = testo(form.get("paese")).toUpperCase() || null;
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(nickname)) return { ok: false, errore: "nonValido" };
  if (paese && !/^[A-Z]{2}$/.test(paese)) return { ok: false, errore: "nonValido" };
  const loc = lingua(form.get("lingua"));
  const { error } = await supabase.from("profili").update({ nickname, paese, lingua: loc, profilo_completo: true }).eq("id", user.id);
  if (error) return { ok: false, errore: chiaveErrore(error.message) };
  const dopo = testo(form.get("dopo"));
  if (dopo) redirect(dopo.startsWith("/") && !dopo.startsWith("//") ? dopo : `/${loc}`);
  revalidatePath(`/${loc}`, "layout");
  return { ok: true };
}

/** Ricorda la lingua scelta nel profilo (se collegato). */
export async function salvaLingua(loc: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && (routing.locales as readonly string[]).includes(loc)) await supabase.from("profili").update({ lingua: loc }).eq("id", user.id);
}

export async function eliminaAccount(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.rpc("elimina_account");
  await supabase.auth.signOut();
  redirect(`/${lingua(form.get("lingua"))}`);
}

// ---------------------------------------------------------------------------
// Pronostici
// ---------------------------------------------------------------------------

export async function salvaPronosticoTorneo(_: Esito | null, form: FormData): Promise<Esito> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errore: "accesso" };
  const tabellone_id = uuidOpz(form.get("tabellone_id"));
  const vincitore_id = uuidOpz(form.get("vincitore_id"));
  const finalista_id = uuidOpz(form.get("finalista_id"));
  if (!tabellone_id || !vincitore_id) return { ok: false, errore: "nonValido" };
  if (finalista_id && finalista_id === vincitore_id) return { ok: false, errore: "nonValido" };
  const { data: esistente } = await supabase.from("pronostici_torneo").select("id").eq("tabellone_id", tabellone_id).maybeSingle();
  const { data, error } = esistente
    ? await supabase.from("pronostici_torneo").update({ vincitore_id, finalista_id }).eq("id", esistente.id).select("id").single()
    : await supabase.from("pronostici_torneo").insert({ tabellone_id, vincitore_id, finalista_id }).select("id").single();
  if (error) return { ok: false, errore: chiaveErrore(error.message) };
  revalidatePath("/[locale]/tornei/[id]", "page");
  return { ok: true, dati: { id: data.id } };
}

export async function salvaPronosticoPartita(_: Esito | null, form: FormData): Promise<Esito> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errore: "accesso" };
  const partita_id = uuidOpz(form.get("partita_id"));
  const vincitore_id = uuidOpz(form.get("vincitore_id"));
  if (!partita_id || !vincitore_id) return { ok: false, errore: "nonValido" };
  const setTesto = testo(form.get("set")); // "2-0", "2-1" oppure ""
  const [sv, sp] = /^\d-\d$/.test(setTesto) ? setTesto.split("-").map(Number) : [null, null];
  const gameTesto = testo(form.get("game"));
  const totale_game = /^\d{1,2}$/.test(gameTesto) ? Number(gameTesto) : null;
  const campi = { vincitore_id, set_vincitore: sv, set_perdente: sp, totale_game };
  const { data: esistente } = await supabase.from("pronostici_partita").select("id").eq("partita_id", partita_id).maybeSingle();
  const { data, error } = esistente
    ? await supabase.from("pronostici_partita").update(campi).eq("id", esistente.id).select("id").single()
    : await supabase.from("pronostici_partita").insert({ partita_id, ...campi }).select("id").single();
  if (error) return { ok: false, errore: chiaveErrore(error.message) };
  revalidatePath("/[locale]", "layout");
  return { ok: true, dati: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Leghe
// ---------------------------------------------------------------------------

export async function creaLega(_: Esito | null, form: FormData): Promise<Esito> {
  const nome = testo(form.get("nome"));
  if (nome.length < 3 || nome.length > 40) return { ok: false, errore: "nonValido" };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("crea_lega", { p_nome: nome });
  if (error) return { ok: false, errore: chiaveErrore(error.message) };
  revalidatePath("/[locale]/leghe", "page");
  const lega = data as { codice: string; nome: string };
  return { ok: true, dati: { codice: lega.codice, nome: lega.nome } };
}

export async function uniscitiLega(_: Esito | null, form: FormData): Promise<Esito> {
  const codice = testo(form.get("codice")).toUpperCase();
  const loc = lingua(form.get("lingua"));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("unisciti_lega", { p_codice: codice });
  if (error) return { ok: false, errore: chiaveErrore(error.message) };
  redirect(`/${loc}/classifica?ambito=lega&lega=${data}`);
}

export async function esciLega(form: FormData) {
  const lega = uuidOpz(form.get("lega"));
  const supabase = await supabaseServer();
  if (lega) await supabase.rpc("esci_lega", { p_lega: lega });
  revalidatePath("/[locale]/leghe", "page");
}
