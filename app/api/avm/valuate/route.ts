import { valorar, solicitudValoracion } from "@/lib/avm/valuate-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = solicitudValoracion.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Cuerpo no válido" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  if (parsed.data.channel === "landing") {
    const respuesta = await valorar(parsed.data, { admin: createAdminClient(), ip });
    return Response.json(respuesta.body, { status: respuesta.status });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const respuesta = await valorar(parsed.data, {
    admin: createAdminClient(),
    userDb: supabase,
    userId: user?.id ?? null,
    ip,
  });
  return Response.json(respuesta.body, { status: respuesta.status });
}
