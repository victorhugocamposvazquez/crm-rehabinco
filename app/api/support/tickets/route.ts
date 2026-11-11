import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { inferirModuloPorRuta, getSupportProjectManifest } from "@/lib/support/project-manifest";
import { resolverEmailPreferidoUsuario } from "@/lib/support/mailer";
import {
  obtenerOCrearAjustesProyecto,
  obtenerUsuarioSesionSoporte,
  procesarTicketEnSegundoPlano,
} from "@/lib/support/service";
import { empresaTieneSoporteActivo, type SupportCategoria } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const modo = url.searchParams.get("modo");
  const estado = url.searchParams.get("estado");
  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);
  const evaluacion = empresaTieneSoporteActivo(settings);
  const activo = user.isSuperadmin || evaluacion.activo;

  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (!user.isSuperadmin || modo === "mios") {
    query = query.eq("user_id", user.id);
  }
  if (estado && estado !== "todos") {
    query = query.eq("estado", estado);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    activo,
    motivo: activo ? null : evaluacion.motivo,
    tickets: data ?? [],
  });
}

export async function POST(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);
  const evaluacion = empresaTieneSoporteActivo(settings);
  if (!user.isSuperadmin && !evaluacion.activo) {
    return NextResponse.json(
      {
        ok: false,
        error: evaluacion.motivo || "El plan de soporte de esta empresa no está activo.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    titulo?: string;
    descripcion?: string;
    categoria?: string;
    modulo?: string;
    contactEmail?: string;
    contexto?: { pathname?: string; viewport?: string; userAgent?: string; permisosActivos?: string[]; eventos?: unknown[] };
    adjuntos?: Array<{ path: string; nombre: string; mime?: string }>;
  } | null;

  const titulo = (body?.titulo || "").trim();
  const descripcion = (body?.descripcion || "").trim();
  if (titulo.length < 3 || descripcion.length < 5) {
    return NextResponse.json(
      { ok: false, error: "Escribe un asunto breve y cuéntanos qué ocurre." },
      { status: 400 }
    );
  }

  const categoriasValidas = new Set(["duda", "bug", "datos", "mejora"]);
  const categoria: SupportCategoria = categoriasValidas.has(body?.categoria || "")
    ? (body!.categoria as SupportCategoria)
    : "duda";

  const pathname = body?.contexto?.pathname || "/";
  const modulo = (body?.modulo || "").trim() || inferirModuloPorRuta(pathname);

  const admin = createAdminClient();
  const emailExplicito = (body?.contactEmail || "").trim();
  if (emailExplicito && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailExplicito)) {
    await admin.from("support_user_prefs").upsert(
      {
        user_id: user.id,
        alert_email: emailExplicito,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }
  const prefEmail = await resolverEmailPreferidoUsuario(user.id, user.email);
  const emailFinalTicket = emailExplicito || prefEmail.email || user.email;

  // Guardado atómico e indestructible del ticket y su mensaje inicial
  const { data: ticket, error: insertError } = await admin
    .from("support_tickets")
    .insert({
      project_key: manifest.projectKey,
      user_id: user.id,
      user_email: emailFinalTicket,
      user_role: user.role,
      titulo: titulo.slice(0, 180),
      descripcion: descripcion.slice(0, 6000),
      modulo,
      categoria,
      riesgo: "cero",
      estado: "nuevo",
      contexto: body?.contexto ?? { pathname },
      auto_merge_permitido: false,
    })
    .select("*")
    .single();

  if (insertError || !ticket) {
    return NextResponse.json(
      { ok: false, error: insertError?.message || "No se pudo registrar el ticket." },
      { status: 500 }
    );
  }

  const adjuntosLimpios = Array.isArray(body?.adjuntos)
    ? body!.adjuntos
        .filter((a) => a && typeof a.path === "string" && a.path.startsWith(`${user.id}/`))
        .slice(0, 4)
    : [];

  await admin.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    user_id: user.id,
    autor_tipo: "usuario",
    interno: false,
    cuerpo: descripcion.slice(0, 6000),
    adjuntos: adjuntosLimpios,
  });

  // Procesamiento asíncrono (triaje IA / alertas Brevo / posible motor): jamás bloquea al usuario
  waitUntil(procesarTicketEnSegundoPlano(ticket.id));

  return NextResponse.json({ ok: true, ticket });
}
