import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Ritorno dal login con Google: scambia il codice con la sessione, poi onboarding o destinazione. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const codice = url.searchParams.get("code");
  const lingua = url.searchParams.get("lingua") ?? "it";
  const dopoGrezzo = url.searchParams.get("dopo") ?? `/${lingua}`;
  const dopo = dopoGrezzo.startsWith("/") && !dopoGrezzo.startsWith("//") ? dopoGrezzo : `/${lingua}`;
  if (codice) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.exchangeCodeForSession(codice);
    if (data.user) {
      const { data: profilo } = await supabase.from("profili").select("profilo_completo").eq("id", data.user.id).single();
      if (!profilo?.profilo_completo) return NextResponse.redirect(new URL(`/${lingua}/benvenuto?dopo=${encodeURIComponent(dopo)}`, url.origin));
      return NextResponse.redirect(new URL(dopo, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/${lingua}/accedi`, url.origin));
}
