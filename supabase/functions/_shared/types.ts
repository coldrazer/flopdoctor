// Shared types for Flop Doctor.
// Pure TypeScript with no imports — used by the React app, the Edge Functions (Deno)
// and the offline console scripts (Deno).

export type Platform = "tiktok" | "instagram";
export type Label = "winner" | "normal" | "flop";
export type Confidence = "high" | "medium" | "low";
export type ScanStatus = "running" | "done" | "error";
export type ScanSource = "live" | "cache" | "fixture";

export type ScanStep =
  | "profile"
  | "posts"
  | "score"
  | "niche"
  | "trending"
  | "diagnose"
  | "prescribe"
  | "done";

export const SCAN_STEPS: { key: ScanStep; label: string }[] = [
  { key: "profile", label: "Checking in" },
  { key: "posts", label: "Pulling your last videos" },
  { key: "score", label: "Taking vitals" },
  { key: "niche", label: "Reading your niche" },
  { key: "trending", label: "Scanning what works right now" },
  { key: "diagnose", label: "Comparing winners and flops" },
  { key: "prescribe", label: "Writing your prescription" },
];

export interface Creator {
  id: string;
  platform: Platform;
  handle: string;
  displayName: string;
  followers: number;
  postsCount?: number;
  profileUrl: string;
  avatarUrl?: string;
}

/** One video, normalized from Oriane's response (both direct API and Firecrawl wrapper). */
export interface Post {
  id: string;
  platform: Platform;
  handle: string;
  publishedAt: string; // ISO
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
  erViews: number; // engagementRatePerViews, percent
  durationSec: number;
  caption: string;
  hashtags: string[];
  transcript?: string;
  thumbnailUrl?: string;
  postUrl?: string;
  /** Seconds until a face first appears, when visual analysis provides it. */
  faceAtSec?: number;
}

export interface ScoredPost extends Post {
  ratio: number; // views / creator median
  log2: number; // log2(ratio)
  label: Label;
  hiddenGem: boolean;
  hook: string; // first words spoken (or caption fallback)
}

export interface Baseline {
  medianViews: number;
  postsAnalyzed: number;
  dateRange: [string, string];
  confidence: Confidence;
  winnerIds: string[];
  flopIds: string[];
  hiddenGemIds: string[];
  winnerAvgSec: number;
  flopAvgSec: number;
}

export interface Evidence {
  postId: string;
  observation: string;
}

export interface Pattern {
  title: string;
  winnersDo: string;
  flopsDo: string;
  evidence: Evidence[];
  confidence: Confidence;
}

export interface Diagnosis {
  verdict: string;
  patterns: Pattern[];
}

export interface Beat {
  t: string; // "0:03"
  text: string;
}

export interface Rx {
  title: string;
  format: string;
  hook: string;
  beats: Beat[];
  why: string;
  patternRef: string;
  proofPostIds: string[];
}

export interface Niche {
  label: string;
  keywords: string[];
}

/** Everything the frontend needs for one diagnosis. Same shape for fixture, cache and live. */
export interface ScanView {
  id: string;
  platform: Platform;
  handle: string;
  status: ScanStatus;
  step: ScanStep;
  source: ScanSource;
  error?: string;
  creator?: Creator;
  baseline?: Baseline;
  posts: ScoredPost[];
  niche?: Niche;
  trending?: Post[];
  diagnosis?: Diagnosis;
  roastDiagnosis?: Diagnosis;
  prescriptions?: Rx[];
}
