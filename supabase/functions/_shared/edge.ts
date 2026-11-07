// Edge-only helpers (Deno + Supabase). Not imported by the app.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Cache } from "./oriane.ts";
import { createOriane } from "./oriane.ts";
import { createLlm } from "./gmi.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** api_cache table as the Oriane cache — survives restarts, shared by every scan. */
export function pgCache(db: SupabaseClient): Cache {
  return {
    async get(key) {
      const { data } = await db.from("api_cache").select("response").eq("key", key).maybeSingle();
      return data?.response ?? undefined;
    },
    async set(key, value) {
      await db.from("api_cache").upsert({ key, response: value, fetched_at: new Date().toISOString() });
    },
  };
}

export function deps(db: SupabaseClient) {
  const env = (k: string) => Deno.env.get(k) ?? undefined;
  const oriane = createOriane({
    mode: (env("ORIANE_MODE") as "direct" | "firecrawl") ?? "direct",
    apiKey: env("ORIANE_API_KEY"),
    baseUrl: env("ORIANE_BASE_URL"),
    pathTemplate: env("ORIANE_PATH_TEMPLATE"),
    firecrawlKey: env("FIRECRAWL_API_KEY"),
    cache: pgCache(db),
  });
  const gmiKey = env("GMI_API_KEY");
  const llm = gmiKey ? createLlm({ apiKey: gmiKey, model: env("GMI_MODEL") ?? "zai-org/GLM-5.1-FP8", baseUrl: env("GMI_BASE_URL") }) : undefined;
  return { oriane, llm, fastModel: env("GMI_MODEL_FAST") };
}
