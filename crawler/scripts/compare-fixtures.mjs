import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(path.join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const supabase = createClient(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const bucketPath = "habitaclia/Girona-Capital/2026-09-17/72785d913e61856f.html";
const { data, error } = await supabase.storage.from("crawl-raw").download(bucketPath);
if (error) throw error;
const bucketHtml = await data.text();
const fixturePath = path.join(root, "tests/fixtures/habitaclia/undici-1789637963665.html");
writeFileSync(path.join(root, "tests/fixtures/habitaclia/worker-72785d913e61856f.html"), bucketHtml);

const sondeo = readFileSync(fixturePath, "utf8");
function vars(html) {
  return [...html.matchAll(/window\.(__INITIAL_[A-Z_]+__)\s*=/g)].map((m) => m[1]);
}
function title(html) {
  return html.match(/<title[^>]*>([^<]+)/)?.[1] ?? "";
}
console.log(JSON.stringify({
  bucketBytes: bucketHtml.length,
  sondeoBytes: sondeo.length,
  bucketVars: [...new Set(vars(bucketHtml))],
  sondeoVars: [...new Set(vars(sondeo))],
  bucketTitle: title(bucketHtml).slice(0, 120),
  sondeoTitle: title(sondeo).slice(0, 120),
  sameSize: bucketHtml.length === sondeo.length,
}, null, 2));
