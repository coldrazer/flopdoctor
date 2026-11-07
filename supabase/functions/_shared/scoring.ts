// Scoring: each creator is measured against their OWN median.
// Pure functions, no I/O — shared by the app, Edge Functions and console scripts.

import type { Baseline, Confidence, Label, Post, ScoredPost } from "./types.ts";

export const WINNER_LOG2 = 0.8; // ~1.75x the creator's median
export const FLOP_LOG2 = -0.8; // ~0.57x
export const MIN_AGE_HOURS = 72; // younger posts are still collecting views
export const MAX_EXAMPLES = 6; // winners / flops handed to the LLM

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** First words actually spoken; falls back to the caption's first sentence. */
export function hookOf(p: Pick<Post, "transcript" | "caption">, words = 20): string {
  const src = (p.transcript && p.transcript.trim()) || (p.caption || "").split(/[\n.!?]/)[0] || "";
  const parts = src.trim().split(/\s+/).filter(Boolean);
  const cut = parts.slice(0, words).join(" ");
  return parts.length > words ? cut + "…" : cut;
}

export interface ScoreResult {
  scored: ScoredPost[];
  baseline: Baseline;
}

export function scorePosts(posts: Post[], nowMs: number = Date.now()): ScoreResult {
  const minAgeMs = MIN_AGE_HOURS * 3600 * 1000;
  const usable = posts
    .filter((p) => p.views > 0 && nowMs - Date.parse(p.publishedAt) >= minAgeMs)
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));

  const med = median(usable.map((p) => p.views)) || 1;

  let scored: ScoredPost[] = usable.map((p) => {
    const ratio = p.views / med;
    const log2 = Math.log2(ratio);
    const label: Label = log2 >= WINNER_LOG2 ? "winner" : log2 <= FLOP_LOG2 ? "flop" : "normal";
    return { ...p, ratio, log2, label, hiddenGem: false, hook: hookOf(p) };
  });

  // Fallback for very consistent accounts: use top / bottom 20% instead of fixed thresholds.
  const nW = scored.filter((p) => p.label === "winner").length;
  const nF = scored.filter((p) => p.label === "flop").length;
  if ((nW < 3 || nF < 3) && scored.length >= 8) {
    const k = Math.max(2, Math.round(scored.length * 0.2));
    const byRatio = [...scored].sort((a, b) => b.log2 - a.log2);
    const top = new Set(byRatio.slice(0, k).map((p) => p.id));
    const bottom = new Set(byRatio.slice(-k).map((p) => p.id));
    scored = scored.map((p) => ({
      ...p,
      label: top.has(p.id) ? "winner" : bottom.has(p.id) ? "flop" : "normal",
    }));
  }

  // Hidden gems: below-median views but unusually high engagement → a distribution problem.
  const ers = scored.map((p) => p.erViews);
  const erMean = mean(ers);
  const erSd = stdev(ers) || 1;
  const gems = scored
    .filter((p) => p.log2 < 0 && (p.erViews - erMean) / erSd >= 1)
    .sort((a, b) => b.erViews - a.erViews)
    .slice(0, 3)
    .map((p) => p.id);
  const gemSet = new Set(gems);
  scored = scored.map((p) => ({ ...p, hiddenGem: gemSet.has(p.id) }));

  const winners = scored.filter((p) => p.label === "winner").sort((a, b) => b.log2 - a.log2);
  const flops = scored.filter((p) => p.label === "flop").sort((a, b) => a.log2 - b.log2);

  const confidence: Confidence = scored.length >= 15 ? "high" : scored.length >= 8 ? "medium" : "low";
  const first = scored[0]?.publishedAt ?? "";
  const last = scored[scored.length - 1]?.publishedAt ?? "";

  const baseline: Baseline = {
    medianViews: Math.round(med),
    postsAnalyzed: scored.length,
    dateRange: [first, last],
    confidence,
    winnerIds: winners.slice(0, MAX_EXAMPLES).map((p) => p.id),
    flopIds: flops.slice(0, MAX_EXAMPLES).map((p) => p.id),
    hiddenGemIds: gems,
    winnerAvgSec: Math.round(mean(winners.map((p) => p.durationSec))),
    flopAvgSec: Math.round(mean(flops.map((p) => p.durationSec))),
  };

  return { scored, baseline };
}

/** Compact fact table handed to the LLM so it reasons over data, not vibes. */
export function featureTable(posts: ScoredPost[]): string {
  return posts
    .map((p) => {
      const d = new Date(p.publishedAt);
      return [
        `id=${p.id}`,
        `ratio=${p.ratio.toFixed(2)}x`,
        `views=${p.views}`,
        `er=${p.erViews.toFixed(1)}%`,
        `dur=${Math.round(p.durationSec)}s`,
        `posted=${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCHours()}h UTC`,
        `hashtags=${p.hashtags.length}`,
        p.faceAtSec !== undefined ? `face_at=${p.faceAtSec}s` : "",
        `hook="${p.hook.replace(/"/g, "'")}"`,
        `caption="${p.caption.slice(0, 120).replace(/\s+/g, " ").replace(/"/g, "'")}"`,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
}
