/**
 * Directorio de centros de la Xunta (registro que alimenta el RECD) → environment_layers.
 * npx tsx scripts/env-load/recd.ts /tmp/centros-acoruna.csv
 */
import { readFileSync } from "node:fs";
import { clasificarCentroDocente } from "../../lib/avm/centros-docentes";
import { adminClient, borrarCapa, insertarLotes, puntoWkt, type LayerRow } from "./_shared";

const SOURCE = "Registro Estatal de Centros Docentes";

function partirCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let celda = "";
  let fila: string[] = [];
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
      continue;
    }
    if (c === '"') comillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n") {
      fila.push(celda.replace(/\r$/, ""));
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda || fila.length) {
    fila.push(celda.replace(/\r$/, ""));
    if (fila.some((x) => x.trim())) filas.push(fila);
  }
  return filas;
}

function coord(x: string, y: string): { lat: number; lng: number } | null {
  const a = Number(x);
  const b = Number(y);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const lat = Math.abs(a) > 20 ? a : b;
  const lng = Math.abs(a) > 20 ? b : a;
  if (lat < 35 || lat > 45 || lng < -12 || lng > 5) return null;
  return { lat, lng };
}

export function filasDesdeCsv(texto: string, loadedAt: string): LayerRow[] {
  const tabla = partirCsv(texto);
  const cab = tabla[0] ?? [];
  const idx = (nombre: string) => cab.findIndex((c) => c.trim().toLowerCase() === nombre.toLowerCase());
  const iTipo = idx("Tipo de centro");
  const iNome = idx("Nome");
  const iX = idx("COORDENADA_X");
  const iY = idx("COORDENADA_Y");
  const iTit = idx("TITULARIDADE");
  const iConc = idx("ENSINO_CONCERTADO");
  const iCod = idx("Código");
  const iConcello = idx("Concello");
  const out: LayerRow[] = [];
  for (const fila of tabla.slice(1)) {
    const tipo = fila[iTipo] ?? "";
    const nombre = fila[iNome] ?? "";
    const clase = clasificarCentroDocente(tipo, nombre);
    if (!clase) continue;
    const c = coord(fila[iX] ?? "", fila[iY] ?? "");
    if (!c) continue;
    out.push({
      layer: "school",
      category: clase,
      name: nombre.trim() || null,
      sense: "positive",
      props: {
        tipo: tipo.trim(),
        titularidade: (fila[iTit] ?? "").trim(),
        concertado: /^s[ií]$/i.test((fila[iConc] ?? "").trim()),
        codigo: (fila[iCod] ?? "").trim(),
        concello: (fila[iConcello] ?? "").trim(),
        fuente: "Xunta de Galicia, centros educativos",
      },
      geom: puntoWkt(c.lng, c.lat),
      source: SOURCE,
      loaded_at: loadedAt,
    });
  }
  return out;
}

async function main(): Promise<void> {
  const archivos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!archivos.length) throw new Error("Pasa uno o varios CSV de centros.");
  const loadedAt = new Date().toISOString();
  const filas = archivos.flatMap((f) => filasDesdeCsv(readFileSync(f, "utf8"), loadedAt));
  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE });
  const n = await insertarLotes(db, filas);
  const porTipo = new Map<string, number>();
  for (const f of filas) porTipo.set(String(f.props.tipo), (porTipo.get(String(f.props.tipo)) ?? 0) + 1);
  console.log(`RECD: ${n} centros`);
  for (const [k, c] of [...porTipo.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${c}`);
}

if (process.argv[1]?.includes("recd.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
