// Oriane client — works in Edge Functions (Deno), console scripts (Deno) and Node.
// Two transports:
//   firecrawl — Oriane via Firecrawl Alexandria (documented, known-good request shape)
//   direct    — Oriane's own API with the hackathon key. [CONFIRM at kickoff: base URL + path shape]
// Every call goes through a cache, so a handle is only ever paid for once.

import type { Creator, Platform, Post } from "./types.ts";

export type Capability = "profiles-search" | "posts-search" | "post-lookup" | "video-lookup" | "profile-lookup";
export type Projection = "basic" | "default" | "full";

export interface Cache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export const memoryCache = (): Cache => {
  const m = new Map<string, unknown>();
  return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v) };
};

export interface OrianeConfig {
  mode: "direct" | "firecrawl";
  apiKey?: string; // ORIANE_API_KEY (direct)
  baseUrl?: string; // ORIANE_BASE_URL (direct)
  pathTemplate?: string; // ORIANE_PATH_TEMPLATE, default "/v1/{platform}/{capability}"
  firecrawlKey?: string; // FIRECRAWL_API_KEY (firecrawl)
  cache?: Cache;
  fetchImpl?: typeof fetch;
  onCall?: (info: { capability: string; cached: boolean; credits?: number }) => void;
}

export interface SearchPostsOptions {
  handle?: string;
  caption?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  projection?: Projection;
}

function stableKey(capability: string, options: Record<string, unknown>): string {
  const sorted = Object.keys(options).sort().reduce<Record<string, unknown>>((o, k) => {
    if (options[k] !== undefined) o[k] = options[k];
    return o;
  }, {});
  return `oriane:${capability}:${JSON.stringify(sorted)}`;
}

/** Firecrawl wraps Oriane's response; Oriane wraps results. Dig until we find them. */
function unwrapList(x: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5 || x == null) return [];
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  if (typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results as Record<string, unknown>[];
    if ("data" in o) return unwrapList(o.data, depth + 1);
  }
  return [];
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" ? Number(v) || 0 : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Map one Oriane post/video object to our Post type. Field names from the published spec. */
export function normalizePost(r: Record<string, unknown>, platform: Platform): Post {
  // [CONFIRM] transcript field name under projection=full — try the likely ones.
  const t = r.transcript ?? r.transcription ?? r.transcriptText ?? (r.speech as Record<string, unknown> | undefined)?.text;
  const transcript = typeof t === "string" ? t : Array.isArray(t) ? (t as unknown[]).map((s) => (typeof s === "string" ? s : str((s as Record<string, unknown>)?.text))).join(" ") : undefined;
  const face = r.faceAppearsAt ?? r.firstFaceAt ?? r.faceAtSec; // [CONFIRM] only if visual analysis exposes it
  return {
    id: str(r.id),
    platform: (str(r.platform) as Platform) || platform,
    handle: str(r.profileHandle) || str(r.handle),
    publishedAt: str(r.publishedAt),
    views: num(r.viewsCount),
    likes: num(r.likesCount),
    comments: num(r.commentsCount),
    shares: num(r.sharesCount),
    interactions: num(r.interactionsCount),
    erViews: num(r.engagementRatePerViews),
    durationSec: num(r.duration),
    caption: str(r.caption),
    hashtags: Array.isArray(r.hashtags) ? (r.hashtags as unknown[]).map(str) : [],
    transcript: transcript || undefined,
    thumbnailUrl: str(r.thumbnailMediaUrl) || undefined,
    postUrl: str(r.postUrl) || undefined,
    faceAtSec: typeof face === "number" ? face : undefined,
  };
}

export function normalizeProfile(r: Record<string, unknown>, platform: Platform): Creator {
  return {
    id: str(r.id),
    platform: (str(r.platform) as Platform) || platform,
    handle: str(r.handle),
    displayName: str(r.displayName) || str(r.handle),
    followers: num(r.followersCount),
    postsCount: num(r.postsCount) || undefined,
    profileUrl: str(r.profileUrl),
    avatarUrl: str(r.avatarUrl) || str(r.profilePictureUrl) || undefined,
  };
}

export class OrianeError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function createOriane(cfg: OrianeConfig) {
  const cache = cfg.cache ?? memoryCache();
  const f = cfg.fetchImpl ?? fetch;

  async function call(platform: Platform, capability: Capability, options: Record<string, unknown>): Promise<unknown> {
    const fullCap = `${platform}/${capability}`;
    const key = stableKey(fullCap, options);
    const hit = await cache.get(key);
    if (hit !== undefined) {
      cfg.onCall?.({ capability: fullCap, cached: true });
      return hit;
    }

    let res: Response;
    if (cfg.mode === "firecrawl") {
      if (!cfg.firecrawlKey) throw new OrianeError("No Oriane key: set ORIANE_API_KEY + ORIANE_BASE_URL (direct) or FIRECRAWL_API_KEY with ORIANE_MODE=firecrawl");
      res = await f("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ alexandria: { provider: "oriane", capability: fullCap, options } }),
      });
    } else {
      if (!cfg.apiKey || !cfg.baseUrl) throw new OrianeError("ORIANE_API_KEY / ORIANE_BASE_URL are not set");
      const path = (cfg.pathTemplate ?? "/v1/{platform}/{capability}").replace("{platform}", platform).replace("{capability}", capability);
      res = await f(cfg.baseUrl.replace(/\/$/, "") + path, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new OrianeError(`Oriane ${fullCap} failed: HTTP ${res.status} ${body.slice(0, 200)}`, res.status);
    }
    const json = (await res.json()) as Record<string, unknown>;
    cfg.onCall?.({ capability: fullCap, cached: false, credits: num(json.creditsCost) || undefined });
    // Only cache non-empty results: an empty result may just mean "not indexed yet".
    if (unwrapList(json).length) await cache.set(key, json);
    return json;
  }

  return {
    async findProfile(platform: Platform, handle: string): Promise<Creator | null> {
      const json = await call(platform, "profiles-search", { handle: handle.replace(/^@/, ""), limit: 1, projection: "default" });
      const row = unwrapList(json)[0];
      return row ? normalizeProfile(row, platform) : null;
    },
    async searchPosts(platform: Platform, o: SearchPostsOptions): Promise<Post[]> {
      const json = await call(platform, "posts-search", {
        handle: o.handle?.replace(/^@/, ""),
        caption: o.caption,
        limit: o.limit ?? 40,
        offset: o.offset,
        sort: o.sort ?? "publishedAt:desc",
        projection: o.projection ?? "full",
      });
      return unwrapList(json).map((r) => normalizePost(r, platform)).filter((p) => p.id);
    },
  };
}

export type Oriane = ReturnType<typeof createOriane>;
