// Indirizzo e chiave pubblica (anon) di Supabase: sono pubbliche per natura, la sicurezza la fa la RLS.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
