import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "crawl-raw";

export function rutaCruda(portalId: string, zona: string, body: string): string {
  const fecha = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
  const zonaSlug = zona.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  return `${portalId}/${zonaSlug}/${fecha}/${hash}.html`;
}

export async function guardarCrudo(
  supabase: SupabaseClient,
  path: string,
  body: string,
  contentType = "text/html"
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage crawl-raw: ${error.message}`);
}
