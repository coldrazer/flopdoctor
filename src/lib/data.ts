// Data layer: one entry point (`runScan`) for both modes.
//  - fixture: sample patients, no network. Steps are replayed so the wheel has something to show.
//  - live:    calls the run-scan Edge Function, then follows the scans row until it's done.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { scorePosts } from "../../supabase/functions/_shared/scoring.ts";
import type { Platform, ScanStep, ScanView } from "../../supabase/functions/_shared/types.ts";
import { rowToView, type ScanRow } from "../../supabase/functions/_shared/view.ts";
import { liftfolio } from "../fixtures/liftfolio.ts";
import { noodleLab } from "../fixtures/noodleLab.ts";
import type { FixtureScan } from "../fixtures/types.ts";

export interface Sample {
  handle: string;
  platform: Platform;
  niche: string;
  view: ScanView;
}

export const scanKey = (platform: Platform, handle: string) => `${platform}:${handle.toLowerCase()}`;

export function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?(tiktok\.com\/@|instagram\.com\/)/i, "").replace(/[/?#].*$/, "");
}


export function fixtureToView(f: FixtureScan): ScanView {
  const { scored, baseline } = scorePosts(f.posts, Date.parse(f.nowISO));
  return {
    id: `fixture-${f.handle}`,
    platform: f.platform,
    handle: f.handle,
    status: "done",
    step: "done",
    source: "fixture",
    creator: f.creator,
    baseline,
    posts: scored,
    niche: f.niche,
    trending: f.trending,
    diagnosis: f.diagnosis,
    roastDiagnosis: f.roastDiagnosis,
    prescriptions: f.prescriptions,
  };
}

// Real scans you pre-cached with `deno task precache` + `deno task export-fixtures` land in
// src/fixtures/live/*.json and become instant, no-network demo patients (real data, no credits).
const exported = import.meta.glob<ScanView>("../fixtures/live/*.json", { eager: true, import: "default" });
const CACHED: Sample[] = Object.values(exported).map((v) => ({
  handle: v.handle,
  platform: v.platform,
  niche: v.niche?.label ?? "",
  view: { ...v, source: "cache", status: "done", step: "done" },
}));
const BUILTIN: Sample[] = [noodleLab, liftfolio].map((f) => ({ handle: f.handle, platform: f.platform, niche: f.niche.label, view: fixtureToView(f) }));
export const SAMPLES: Sample[] = [...CACHED, ...BUILTIN];

export function findSample(handle: string): Sample | undefined {
  const h = cleanHandle(handle).toLowerCase();
  return SAMPLES.find((s) => s.handle.toLowerCase() === h);
}

const env = import.meta.env;
let sb: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  if (sb) return sb;
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return null;
  sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  return sb;
}

export function isLive(): boolean {
  return env.VITE_DATA_MODE === "live" && supabase() !== null;
}

export interface RunOptions {
  platform: Platform;
  handle: string;
  onUpdate: (v: ScanView) => void;
}

/** Starts a scan and streams partial ScanViews. Returns a cancel function. */
export function runScan({ platform, handle, onUpdate }: RunOptions): () => void {
  const sample = findSample(handle);
  if (sample || !isLive()) return replayView(sample?.view ?? BUILTIN[0].view, onUpdate, !sample);
  return runLive(platform, handle, onUpdate);
}

/** Replays a finished scan step by step (≈10 s), the way a live scan fills in. */
function replayView(full: ScanView, onUpdate: (v: ScanView) => void, demoStandIn: boolean): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, step: ScanStep, patch: Partial<ScanView>) =>
    timers.push(setTimeout(() => onUpdate({ ...base, ...patch, step, status: step === "done" ? "done" : "running" }), ms));
  const base: ScanView = {
    id: full.id,
    platform: full.platform,
    handle: full.handle,
    status: "running",
    step: "profile",
    source: full.source,
    posts: [],
    error: demoStandIn ? "demo" : undefined,
  };
  onUpdate(base);
  at(900, "posts", { creator: full.creator });
  at(2000, "score", { creator: full.creator, posts: full.posts, baseline: full.baseline });
  const withPosts = { creator: full.creator, posts: full.posts, baseline: full.baseline };
  at(3600, "niche", { ...withPosts, niche: full.niche });
  at(5200, "trending", { ...withPosts, niche: full.niche, trending: full.trending });
  at(7800, "diagnose", { ...withPosts, niche: full.niche, trending: full.trending, diagnosis: full.diagnosis, roastDiagnosis: full.roastDiagnosis });
  at(10400, "done", { ...full, error: demoStandIn ? "demo" : undefined });
  return () => timers.forEach(clearTimeout);
}

function runLive(platform: Platform, handle: string, onUpdate: (v: ScanView) => void): () => void {
  const client = supabase()!;
  let stopped = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  let channel: ReturnType<SupabaseClient["channel"]> | undefined;

  const stop = () => {
    stopped = true;
    if (poll) clearInterval(poll);
    if (channel) client.removeChannel(channel);
  };
  const push = (row: ScanRow) => {
    if (stopped) return;
    const v = rowToView(row);
    onUpdate(v);
    if (v.status !== "running") stop();
  };

  onUpdate({ id: "pending", platform, handle, status: "running", step: "profile", source: "live", posts: [] });

  client.functions
    .invoke("run-scan", { body: { platform, handle } })
    .then(({ data, error }) => {
      if (stopped) return;
      if (error || !data?.scan_id) {
        onUpdate({ id: "error", platform, handle, status: "error", step: "profile", source: "live", posts: [], error: error?.message ?? "Could not start the scan." });
        return;
      }
      const id: string = data.scan_id;
      channel = client
        .channel(`scan-${id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scans", filter: `id=eq.${id}` }, (payload) => push(payload.new as ScanRow))
        .subscribe();
      // Polling backs up Realtime (large jsonb rows, flaky venue Wi-Fi).
      const tick = async () => {
        const { data: row } = await client.from("scans").select("*").eq("id", id).maybeSingle();
        if (row) push(row as ScanRow);
      };
      tick();
      poll = setInterval(tick, 2500);
    });

  return stop;
}
