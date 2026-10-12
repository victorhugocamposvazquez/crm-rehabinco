/**
 * Carga catastro_municipios (~8.100) desde ObtenerProvincias + ObtenerMunicipios (Sede).
 * Cruce INE: ine_code = cpine (2) + cmc (3). name_ine opcional vía --ine-tsv.
 *
 * npx tsx scripts/catastro/load-municipios-espania.ts
 * npx tsx scripts/catastro/load-municipios-espania.ts --dry-run
 */
import { readFileSync } from "node:fs";
import { createCatastroClient } from "../../lib/catastro/client";
import { parsearMunicipios, parsearProvincias } from "../../lib/catastro/catalog";
import { esProvinciaForal, PROVINCIAS_CATASTRO } from "../../lib/catastro/provincias-espana";
import { adminClient } from "../env-load/_shared";

const SOURCE_LOADED = new Date().toISOString();

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function pad3(n: string): string {
  return n.replace(/\D/g, "").padStart(3, "0").slice(-3);
}

function cargarNombresIne(path: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const cols = t.split("\t");
    if (cols.length < 2) continue;
    const code = cols[0].replace(/\D/g, "").padStart(5, "0");
    const name = cols.slice(1).join("\t").trim();
    if (code.length === 5 && name) map.set(code, name);
  }
  return map;
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry-run");
  const ineTsv = arg("--ine-tsv");
  const nombresIne = ineTsv ? cargarNombresIne(ineTsv) : new Map<string, string>();

  const client = createCatastroClient({ minIntervalMs: 450, timeoutMs: 45_000 });
  const rawProv = await client.obtenerProvincias();
  const provincias = parsearProvincias(rawProv);
  const porNombre = new Map(PROVINCIAS_CATASTRO.map((p) => [p.name, p]));

  const filas: Record<string, unknown>[] = [];
  for (const prov of provincias) {
    const meta = porNombre.get(prov.name.toUpperCase()) ?? { code: prov.code.padStart(2, "0"), foral: esProvinciaForal(prov.code) };
    console.log(`Provincia ${prov.name} (${meta.code})…`);
    const rawMuni = await client.obtenerMunicipios(prov.name);
    const municipios = parsearMunicipios(rawMuni);
    for (const m of municipios) {
      const cmc = pad3(m.code);
      const ine = `${meta.code}${cmc}`;
      filas.push({
        ine_code: ine,
        province_code: meta.code,
        province_name: prov.name.toUpperCase(),
        name_catastro: m.name.toUpperCase(),
        name_ine: nombresIne.get(ine) ?? null,
        is_foral: meta.foral ?? esProvinciaForal(meta.code),
        catastro_cmc: cmc,
        loaded_at: SOURCE_LOADED,
      });
    }
  }

  console.log(`Municipios leídos: ${filas.length}`);
  if (dry) return;

  const db = await adminClient();
  const lote = 300;
  for (let i = 0; i < filas.length; i += lote) {
    const chunk = filas.slice(i, i + lote);
    const { error } = await db.from("catastro_municipios").upsert(chunk, { onConflict: "ine_code" });
    if (error) throw new Error(`${error.message} (lote ${i / lote})`);
    console.log(`  ${Math.min(i + lote, filas.length)} / ${filas.length}`);
  }
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
