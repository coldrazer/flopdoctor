import type { Creator, Diagnosis, Niche, Platform, Post, Rx } from "../../supabase/functions/_shared/types.ts";

/** A sample patient: raw posts in, everything else as the pipeline would produce it.
 *  Scoring runs on load, so fixtures exercise the same code as live scans. */
export interface FixtureScan {
  handle: string;
  platform: Platform;
  nowISO: string;
  creator: Creator;
  posts: Post[];
  niche: Niche;
  trending: Post[];
  diagnosis: Diagnosis;
  roastDiagnosis: Diagnosis;
  prescriptions: Rx[];
}

/** [caption, log2 vs median, duration s, face at s, first words spoken, engagement %] */
export type RawRow = [string, number, number, number, string, number];

export function buildPosts(
  prefix: string,
  handle: string,
  platform: Platform,
  medianViews: number,
  startISO: string,
  everyDays: number,
  rows: RawRow[],
): Post[] {
  const start = Date.parse(startISO);
  // rows are written relative to the median; shift so the computed median lands on medianViews
  const sorted = rows.map((r) => r[1]).sort((a, b) => a - b);
  const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return rows.map(([caption, log2, dur, face, spoken, er], i) => {
    const views = Math.round(medianViews * 2 ** (log2 - mid));
    const interactions = Math.round((views * er) / 100);
    return {
      id: `${prefix}_${String(i + 1).padStart(2, "0")}`,
      platform,
      handle,
      publishedAt: new Date(start + i * everyDays * 86400e3 + 17 * 3600e3).toISOString(),
      views,
      likes: Math.round(interactions * 0.78),
      comments: Math.round(interactions * 0.09),
      shares: Math.round(interactions * 0.13),
      interactions,
      erViews: er,
      durationSec: dur,
      caption,
      hashtags: [],
      transcript: spoken,
      faceAtSec: face,
    };
  });
}

/** Roast keeps every fact and post id; only the verdict and pattern titles change. */
export function roastOf(d: Diagnosis, verdict: string, titles: string[]): Diagnosis {
  return { verdict, patterns: d.patterns.map((p, i) => ({ ...p, title: titles[i] ?? p.title })) };
}
