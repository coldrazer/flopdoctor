// Maps a `scans` table row (snake_case jsonb columns) to the ScanView the app renders.
// Pure — used by the get-scan Edge Function and by the app when it reads the row directly.

import type { ScanView } from "./types.ts";

export interface ScanRow {
  id: string;
  platform: ScanView["platform"];
  handle: string;
  status: ScanView["status"];
  step: ScanView["step"] | null;
  source: ScanView["source"] | null;
  error: string | null;
  creator: ScanView["creator"] | null;
  baseline: ScanView["baseline"] | null;
  posts: ScanView["posts"] | null;
  niche: ScanView["niche"] | null;
  trending: ScanView["trending"] | null;
  diagnosis: ScanView["diagnosis"] | null;
  roast_diagnosis: ScanView["roastDiagnosis"] | null;
  prescriptions: ScanView["prescriptions"] | null;
}

export function rowToView(r: ScanRow): ScanView {
  return {
    id: r.id,
    platform: r.platform,
    handle: r.handle,
    status: r.status,
    step: r.step ?? "profile",
    source: r.source ?? "live",
    error: r.error ?? undefined,
    creator: r.creator ?? undefined,
    baseline: r.baseline ?? undefined,
    posts: r.posts ?? [],
    niche: r.niche ?? undefined,
    trending: r.trending ?? undefined,
    diagnosis: r.diagnosis ?? undefined,
    roastDiagnosis: r.roast_diagnosis ?? undefined,
    prescriptions: r.prescriptions ?? undefined,
  };
}
