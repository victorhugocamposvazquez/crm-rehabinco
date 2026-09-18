import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(
  path.join(root, "tests/fixtures/habitaclia/undici-1789637963665.html"),
  "utf8"
);

function extraerProps(html) {
  const marker = "window.__INITIAL_PROPS__ = JSON.parse(";
  const idx = html.indexOf(marker);
  let i = idx + marker.length + 1;
  const chunks = [];
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === "\\") {
      const n = html[++i];
      if (n === "n") chunks.push("\n");
      else if (n === "r") chunks.push("\r");
      else if (n === "t") chunks.push("\t");
      else if (n === '"') chunks.push('"');
      else if (n === "\\") chunks.push("\\");
      else if (n === "u") {
        chunks.push(String.fromCharCode(parseInt(html.slice(i + 1, i + 5), 16)));
        i += 4;
      } else chunks.push(n ?? "");
      continue;
    }
    if (c === '"') break;
    chunks.push(c);
  }
  return JSON.parse(chunks.join(""));
}

const items =
  extraerProps(html).initialSearchResultsPage.initialSearchContext.results.items;
const mapped = items.map((it) => ({
  externo_id: it.legacyNumericId,
  url: `https://www.habitaclia.com${it.navigationUrl ?? `/i${it.legacyNumericId}.htm`}`,
  titulo: it.summary?.title,
  operacion: it.transaction?.type === "rent" ? "alquiler" : "venta",
  precio: it.transaction?.price?.amount,
  superficie: it.property?.builtSurface,
  habitaciones: it.property?.rooms,
  banos: it.property?.bathrooms,
  municipio: it.summary?.location?.municipality,
}));

writeFileSync("/tmp/hc-mapped.json", JSON.stringify(mapped));
console.log(mapped.length);
