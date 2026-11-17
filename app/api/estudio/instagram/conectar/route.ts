import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import { instagramConfigurado, urlAutorizacionInstagram } from "@/lib/estudio/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function origenDe(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const acceso = await exigirEquipoArchivo();
  const vuelta = new URL("/settings/publicacion", origenDe(req));
  if (acceso.error || !acceso.user) {
    vuelta.searchParams.set("instagram", "No autorizado.");
    return NextResponse.redirect(vuelta);
  }
  if (!instagramConfigurado()) {
    vuelta.searchParams.set("instagram", "Falta la app de Instagram en el servidor.");
    return NextResponse.redirect(vuelta);
  }
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("ig_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return NextResponse.redirect(urlAutorizacionInstagram(origenDe(req), state));
}
