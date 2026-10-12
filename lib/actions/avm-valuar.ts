"use server";

import { solicitudValoracion, valorar } from "@/lib/avm/valuate-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function valorarInmueble(body: unknown) {
  const parsed = solicitudValoracion.safeParse(body);
  if (!parsed.success) return { status: 400 as const, body: { error: "Cuerpo no válido" } };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return valorar({ ...parsed.data, channel: "crm" }, {
    admin: createAdminClient(),
    userDb: supabase,
    userId: user?.id ?? null,
  });
}
