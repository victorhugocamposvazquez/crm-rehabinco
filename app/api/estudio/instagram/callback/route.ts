import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import { cambiarPorTokenLargo, canjearCodigoInstagram, guardarCuentaInstagram, perfilInstagram } from "@/lib/estudio/instagram-publicar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function origenDe(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const origen = origenDe(req);
  const vuelta = new URL("/settings/publicacion", origen);
  const acceso = await exigirEquipoArchivo();
  if (acceso.error || !acceso.user) {
    vuelta.searchParams.set("instagram", "No autorizado.");
    return NextResponse.redirect(vuelta);
  }
  const url = new URL(req.url);
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) {
    vuelta.searchParams.set("instagram", "Instagram ha cancelado el enlace.");
    return NextResponse.redirect(vuelta);
  }
  const jar = await cookies();
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code || !state || state !== jar.get("ig_oauth_state")?.value) {
    vuelta.searchParams.set("instagram", "El enlace con Instagram no es válido. Vuelve a intentarlo.");
    return NextResponse.redirect(vuelta);
  }
  jar.delete("ig_oauth_state");
  try {
    const corto = await canjearCodigoInstagram(code, `${origen}/api/estudio/instagram/callback`);
    const largo = await cambiarPorTokenLargo(corto);
    const perfil = await perfilInstagram(largo.token);
    await guardarCuentaInstagram({
      ig_user_id: perfil.igUserId,
      username: perfil.username,
      access_token: largo.token,
      expires_at: new Date(Date.now() + largo.expiresIn * 1000).toISOString(),
    });
    vuelta.searchParams.set("instagram", "ok");
  } catch (causa) {
    vuelta.searchParams.set("instagram", causa instanceof Error ? causa.message : "No se ha podido enlazar Instagram.");
  }
  return NextResponse.redirect(vuelta);
}
