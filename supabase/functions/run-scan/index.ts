// POST { platform, handle } → { scan_id }
// Inserts a scans row, returns at once, then runs the pipeline in the background,
// writing each step to the row (the app follows it via Realtime + polling).

import { runPipeline, NotIndexedError } from "../_shared/pipeline.ts";
import { admin, cors, deps, json } from "../_shared/edge.ts";
import type { Platform, ScanStep, ScanView } from "../_shared/types.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const REUSE_HOURS = 6; // a finished scan this fresh is reused — saves credits, demo-safe

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { platform?: string; handle?: string; fresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const platform = body.platform === "instagram" ? "instagram" : body.platform === "tiktok" ? "tiktok" : null;
  const handle = (body.handle ?? "").replace(/^@/, "").trim().toLowerCase();
  if (!platform || !/^[a-z0-9._]{1,40}$/.test(handle)) return json({ error: "Need platform (tiktok|instagram) and a valid handle" }, 400);

  const db = admin();

  if (!body.fresh) {
    const since = new Date(Date.now() - REUSE_HOURS * 3600e3).toISOString();
    const { data: recent } = await db
      .from("scans")
      .select("id")
      .eq("platform", platform)
      .eq("handle", handle)
      .eq("status", "done")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) return json({ scan_id: recent.id, reused: true });
  }

  const { data: row, error } = await db.from("scans").insert({ platform, handle, status: "running", step: "profile" }).select("id").single();
  if (error || !row) return json({ error: error?.message ?? "insert failed" }, 500);
  const id: string = row.id;

  const update = async (step: ScanStep, patch: Partial<ScanView>) => {
    const cols: Record<string, unknown> = { step };
    if (patch.creator) cols.creator = patch.creator;
    if (patch.baseline) cols.baseline = patch.baseline;
    if (patch.posts) cols.posts = patch.posts;
    if (patch.niche) cols.niche = patch.niche;
    if (patch.trending) cols.trending = patch.trending;
    if (patch.diagnosis) cols.diagnosis = patch.diagnosis;
    if (patch.roastDiagnosis) cols.roast_diagnosis = patch.roastDiagnosis;
    if (patch.prescriptions) cols.prescriptions = patch.prescriptions;
    if (step === "done") {
      cols.status = "done";
      cols.finished_at = new Date().toISOString();
    }
    await db.from("scans").update(cols).eq("id", id);
  };

  const work = (async () => {
    try {
      const view = await runPipeline({ ...deps(db), log: (m) => console.log(`[${id}] ${m}`) }, { platform: platform as Platform, handle }, update);
      // Keep normalized copies for later analysis.
      if (view.creator) {
        await db.from("creators").upsert({
          id: view.creator.id, platform, handle, display_name: view.creator.displayName,
          followers: view.creator.followers, posts_count: view.creator.postsCount ?? null, profile_url: view.creator.profileUrl,
        });
        await db.from("posts").upsert(
          [...view.posts, ...(view.trending ?? []).map((p) => ({ ...p, niche: true }))].map((p) => ({
            id: p.id, creator_id: "niche" in p ? null : view.creator!.id, platform, handle: p.handle,
            published_at: p.publishedAt, views: p.views, likes: p.likes, comments: p.comments, shares: p.shares,
            interactions: p.interactions, er_views: p.erViews, duration_s: p.durationSec, caption: p.caption,
            hashtags: p.hashtags, transcript: p.transcript ?? null, thumbnail_url: p.thumbnailUrl ?? null,
            post_url: p.postUrl ?? null, is_niche: "niche" in p,
          })),
        );
      }
    } catch (e) {
      const msg = e instanceof NotIndexedError ? e.message : `Scan failed: ${(e as Error).message}`;
      console.error(`[${id}]`, e);
      await db.from("scans").update({ status: "error", error: msg, finished_at: new Date().toISOString() }).eq("id", id);
    }
  })();

  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return json({ scan_id: id });
});
