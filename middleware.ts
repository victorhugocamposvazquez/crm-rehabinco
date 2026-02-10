import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const dashboardPrefix = "/";
const publicPaths = ["/login"];

function isPublic(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isDashboard(pathname: string) {
  return pathname === dashboardPrefix || pathname.startsWith("/clientes") || pathname.startsWith("/facturas");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "lax" | "strict" | "none" }) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: { path?: string }) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isDashboard(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get("redirect") || "/";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
