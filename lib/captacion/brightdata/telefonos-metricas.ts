import { createAdminClient } from "@/lib/supabase/admin";

function diaUtc(iso = new Date()): string {
  return iso.toISOString().slice(0, 10);
}

async function filaDia(fecha: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("captacion_telefono_diario").select("pedidos, obtenidos, fallidos").eq("dia", fecha).maybeSingle();
  return {
    pedidos: data?.pedidos ?? 0,
    obtenidos: data?.obtenidos ?? 0,
    fallidos: data?.fallidos ?? 0,
  };
}

export async function registrarPedidoTelefono(): Promise<void> {
  const supabase = createAdminClient();
  const dia = diaUtc();
  const prev = await filaDia(dia);
  await supabase.from("captacion_telefono_diario").upsert({ dia, pedidos: prev.pedidos + 1, obtenidos: prev.obtenidos, fallidos: prev.fallidos });
}

export async function registrarResultadoTelefono(obtenido: boolean): Promise<void> {
  const supabase = createAdminClient();
  const dia = diaUtc();
  const prev = await filaDia(dia);
  const obtenidos = prev.obtenidos + (obtenido ? 1 : 0);
  const fallidos = prev.fallidos + (obtenido ? 0 : 1);
  await supabase.from("captacion_telefono_diario").upsert({ dia, pedidos: prev.pedidos, obtenidos, fallidos });
  if (obtenidos + fallidos >= 5) {
    const tasa = obtenidos / (obtenidos + fallidos);
    if (tasa < 0.6) await pausarColaTelefonos("La tasa de éxito de teléfonos de hoy está por debajo del 60 %.");
  }
}

export async function telefonosColaPausada(): Promise<boolean> {
  const { data } = await createAdminClient().from("captacion_telefono_config").select("pausado").eq("id", 1).maybeSingle();
  return Boolean(data?.pausado);
}

export async function pausarColaTelefonos(motivo: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("captacion_telefono_config").select("pausado").eq("id", 1).maybeSingle();
  if (data?.pausado) return;
  await supabase.from("captacion_telefono_config").upsert({ id: 1, pausado: true, pausado_en: new Date().toISOString() });
  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "superadmin");
  const filas = ((admins ?? []) as Array<{ id?: string }>)
    .filter((f) => f.id)
    .map((f) => ({
      user_id: f.id,
      tipo: "telefonos_pausados",
      titulo: "Cola de teléfonos pausada",
      detalle: motivo,
    }));
  if (filas.length > 0) await supabase.from("captacion_notificaciones").insert(filas);
}

export async function metricasTelefonos(): Promise<{
  hoy: { pedidos: number; obtenidos: number; fallidos: number; tasa: number | null };
  sieteDias: { pedidos: number; obtenidos: number; fallidos: number; tasa: number | null };
  pausado: boolean;
}> {
  const supabase = createAdminClient();
  const hoy = diaUtc();
  const desde = diaUtc(new Date(Date.now() - 6 * 86400000));
  const { data: filas } = await supabase
    .from("captacion_telefono_diario")
    .select("dia, pedidos, obtenidos, fallidos")
    .gte("dia", desde)
    .lte("dia", hoy);
  const hoyRow = ((filas ?? []) as Array<{ dia: string; pedidos: number; obtenidos: number; fallidos: number }>).find((f) => f.dia === hoy) ?? {
    pedidos: 0,
    obtenidos: 0,
    fallidos: 0,
  };
  let ped7 = 0;
  let obt7 = 0;
  let fail7 = 0;
  for (const f of (filas ?? []) as Array<{ pedidos: number; obtenidos: number; fallidos: number }>) {
    ped7 += f.pedidos;
    obt7 += f.obtenidos;
    fail7 += f.fallidos;
  }
  const tasaHoy =
    hoyRow.obtenidos + hoyRow.fallidos > 0 ? hoyRow.obtenidos / (hoyRow.obtenidos + hoyRow.fallidos) : null;
  const tasa7 = obt7 + fail7 > 0 ? obt7 / (obt7 + fail7) : null;
  return {
    hoy: { pedidos: hoyRow.pedidos, obtenidos: hoyRow.obtenidos, fallidos: hoyRow.fallidos, tasa: tasaHoy },
    sieteDias: { pedidos: ped7, obtenidos: obt7, fallidos: fail7, tasa: tasa7 },
    pausado: await telefonosColaPausada(),
  };
}
