/**
 * Sincroniza carto_tipos_via desde lib/avm/carto-via-catastro.ts
 * npx tsx scripts/catastro/sync-carto-tipos-via.ts
 */
import { CARTO_VIA_A_CATASTRO } from "../../lib/avm/carto-via-catastro";
import { adminClient } from "../env-load/_shared";

async function main(): Promise<void> {
  const filas = Object.entries(CARTO_VIA_A_CATASTRO).map(([carto_label, catastro_sigla]) => ({
    carto_label,
    catastro_sigla,
  }));
  const db = await adminClient();
  const { error } = await db.from("carto_tipos_via").upsert(filas, { onConflict: "carto_label" });
  if (error) throw new Error(error.message);
  console.log(`${filas.length} tipos de vía Carto → Catastro`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
