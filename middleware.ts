import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOST_CRM, decisionHost, hostDe } from "@/lib/web/dominio";

const CABECERA_SITIO = "x-rehabinco-sitio";

let dominioCache: { valor: string | null; hasta: number } | null = null;

async function dominioGuardado(): Promise<string | null> {
  if (dominioCache && dominioCache.hasta > Date.now()) return dominioCache.valor;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return dominioCache?.valor ?? null;
  try {
    const respuesta = await fetch(`${url}/rest/v1/rpc/web_dominio`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const dato: unknown = respuesta.ok ? await respuesta.json() : null;
    const valor = typeof dato === "string" && dato.trim() ? dato.trim().toLowerCase() : null;
    dominioCache = { valor, hasta: Date.now() + 30_000 };
    return valor;
  } catch {
    return dominioCache?.valor ?? null;
  }
}

function conCookies(desde: NextResponse, hacia: NextResponse): NextResponse {
  desde.cookies.getAll().forEach((cookie) => {
    hacia.cookies.set(cookie);
  });
  return hacia;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options ?? {})
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  const host = hostDe(request.headers.get("host"));
  const dominio = await dominioGuardado();
  const decision = decisionHost(host, request.nextUrl.pathname, dominio);
  if (decision.tipo === "crm") return response;

  if (decision.tipo === "al-crm") {
    const destino = request.nextUrl.clone();
    destino.protocol = "https:";
    destino.host = HOST_CRM;
    destino.pathname = decision.pathname;
    return conCookies(response, NextResponse.redirect(destino));
  }

  if (decision.tipo === "canonical") {
    const destino = request.nextUrl.clone();
    destino.pathname = decision.pathname;
    return conCookies(response, NextResponse.redirect(destino));
  }

  const destino = request.nextUrl.clone();
  destino.pathname = decision.pathname;
  const cabeceras = new Headers(request.headers);
  cabeceras.set(CABECERA_SITIO, "publico");
  return conCookies(response, NextResponse.rewrite(destino, { request: { headers: cabeceras } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
