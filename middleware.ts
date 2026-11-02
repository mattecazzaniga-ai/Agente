import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/env";

const intl = createIntlMiddleware(routing);

/** Lingua (next-intl) + rinnovo della sessione Supabase nei cookie a ogni richiesta. */
export async function middleware(request: NextRequest) {
  const risposta = request.nextUrl.pathname.startsWith("/auth/") ? NextResponse.next() : intl(request);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value, options } of lista) risposta.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return risposta;
}

export const config = {
  // tutto tranne file statici, immagini generate e service worker
  matcher: ["/((?!api|_next|_vercel|sw\\.js|manifest\\.webmanifest|icone|.*\\..*).*)"],
};
