import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CrawlerEnv } from "./env.js";

let client: SupabaseClient | null = null;

export function getSupabase(env: CrawlerEnv): SupabaseClient {
  if (!client) {
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
