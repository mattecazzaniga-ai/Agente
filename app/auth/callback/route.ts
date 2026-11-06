import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Ritorno dal login con Google o dal link nell'email: crea la sessione, poi onboarding o destinazione. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const codice = url.searchParams.get("code");
  const lingua = url.searchParams.get("lingua") ?? "it";
  const dopoGrezzo = url.searchParams.get("dopo") ?? `/${lingua}`;
  const dopo = dopoGrezzo.startsWith("/") && !dopoGrezzo.startsWith("//") ? dopoGrezzo : `/${lingua}`;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type");
  if (codice || tokenHash) {
    const supabase = await supabaseServer();
    const { data } = codice
      ? await supabase.auth.exchangeCodeForSession(codice)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: tipo === "signup" ? "signup" : "email" });
    if (data.user) {
      const { data: profilo } = await supabase.from("profili").select("profilo_completo").eq("id", data.user.id).single();
      if (!profilo?.profilo_completo) return NextResponse.redirect(new URL(`/${lingua}/benvenuto?dopo=${encodeURIComponent(dopo)}`, url.origin));
      return NextResponse.redirect(new URL(dopo, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/${lingua}/accedi`, url.origin));
}
