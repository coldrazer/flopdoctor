// Shared bits for the offline console scripts (Deno). Same _shared modules as the Edge Functions.
import { createLlm } from "../supabase/functions/_shared/gmi.ts";
import { createOriane, type Cache } from "../supabase/functions/_shared/oriane.ts";
import type { Platform } from "../supabase/functions/_shared/types.ts";

const ROOT = new URL("..", import.meta.url).pathname;
export const path = (p: string) => ROOT + p;

/** Reads scripts/.env (KEY=value lines) without overriding real env vars. */
export function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of Deno.readTextFileSync(path("scripts/.env")).split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env — fine */ }
  for (const k of Object.keys(out)) {
    const real = Deno.env.get(k);
    if (real) out[k] = real;
  }
  for (const k of ["ORIANE_MODE", "ORIANE_API_KEY", "ORIANE_BASE_URL", "ORIANE_PATH_TEMPLATE", "FIRECRAWL_API_KEY", "GMI_API_KEY", "GMI_MODEL", "GMI_MODEL_FAST", "GMI_BASE_URL"]) {
    const real = Deno.env.get(k);
    if (real) out[k] = real;
  }
  return out;
}

async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** On-disk Oriane cache in scripts/cache/ — re-running a script never re-spends credits. */
export function fileCache(): Cache {
  const dir = path("scripts/cache");
  Deno.mkdirSync(dir, { recursive: true });
  return {
    async get(key) {
      try {
        return JSON.parse(await Deno.readTextFile(`${dir}/${await sha(key)}.json`)).response;
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      await Deno.writeTextFile(`${dir}/${await sha(key)}.json`, JSON.stringify({ key, fetchedAt: new Date().toISOString(), response: value }));
    },
  };
}

export let creditsSpent = 0;
export let callsMade = 0;
export let cacheHits = 0;

export function makeDeps(opts: { offline?: boolean } = {}) {
  const env = loadEnv();
  const oriane = createOriane({
    mode: (env.ORIANE_MODE as "direct" | "firecrawl") || (env.ORIANE_API_KEY ? "direct" : "firecrawl"),
    apiKey: env.ORIANE_API_KEY,
    baseUrl: env.ORIANE_BASE_URL,
    pathTemplate: env.ORIANE_PATH_TEMPLATE,
    firecrawlKey: env.FIRECRAWL_API_KEY,
    cache: fileCache(),
    onCall: ({ cached, credits }) => {
      if (cached) cacheHits++;
      else { callsMade++; creditsSpent += credits ?? 0; }
    },
  });
  const llm = !opts.offline && env.GMI_API_KEY
    ? createLlm({ apiKey: env.GMI_API_KEY, model: env.GMI_MODEL || "zai-org/GLM-5.1-FP8", baseUrl: env.GMI_BASE_URL })
    : undefined;
  return { oriane, llm, fastModel: env.GMI_MODEL_FAST || undefined };
}

/** handles.txt lines: "@handle", "tiktok @handle", "instagram handle". # comments allowed. */
export function readHandles(file: string): { platform: Platform | "both"; handle: string }[] {
  return Deno.readTextFileSync(file)
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/\s+/);
      if (parts.length >= 2 && /^(tiktok|instagram)$/i.test(parts[0])) return { platform: parts[0].toLowerCase() as Platform, handle: parts[1].replace(/^@/, "") };
      return { platform: "both" as const, handle: parts[0].replace(/^@/, "") };
    });
}

export function parseArgs(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags[k] = v;
      else if (args[i + 1] && !args[i + 1].startsWith("--") && ["platform", "out", "fixture"].includes(k)) flags[k] = args[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { flags, pos };
}

export const C = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
