import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { importarSiNoExiste } from "../lib/captacion/encargos-db";
import { encargosDesdeXlsx, FUENTE_EXCEL_CAPTACION } from "../lib/captacion/importar-excel";

function cargarEntorno() {
  for (const archivo of [".env.local", ".env", "crawler/.env"]) {
    if (!existsSync(archivo)) continue;
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      const coincidencia = linea.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!coincidencia || process.env[coincidencia[1]]) continue;
      const valor = coincidencia[2].replace(/^['"]|['"]$/g, "");
      if (coincidencia[1] === "SUPABASE_URL" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = valor;
      }
      process.env[coincidencia[1]] = valor;
    }
  }
}

async function main() {
  cargarEntorno();
  const email = process.argv[2]?.trim();
  const ruta = process.argv[3]?.trim();
  if (!email || !ruta) {
    throw new Error("Uso: tsx scripts/importar-encargos-excel.ts correo ruta.xlsx");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan las variables de Supabase.");

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: destino, error: errorDestino } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (errorDestino || !destino) throw new Error("No está esa persona en el CRM.");
  const { data: quienEncarga } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "hugo@admin.com")
    .maybeSingle();
  if (!quienEncarga) throw new Error("No está el admin que encarga.");

  const leido = await encargosDesdeXlsx(readFileSync(ruta), { fuente: FUENTE_EXCEL_CAPTACION });
  if (leido.errores.length > 0) throw new Error(leido.errores.join(" "));
  const resultado = await importarSiNoExiste(admin, {
    asignadoA: destino.id,
    asignadoPor: quienEncarga.id,
    fuente: FUENTE_EXCEL_CAPTACION,
    encargos: leido.encargos,
  });
  console.log(JSON.stringify({ email: destino.email, leidos: leido.encargos.length, ...resultado }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se ha podido importar.");
  process.exit(1);
});
