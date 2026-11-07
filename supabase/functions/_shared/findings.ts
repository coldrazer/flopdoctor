// Per-video findings for the wheel's "doctor" — computed from data, no LLM needed.
// Pure, shared by the app and the console scripts.

import type { Baseline, ScoredPost } from "./types.ts";

export type Tone = "good" | "bad" | "mid";
export interface Finding {
  tone: Tone;
  text: string;
}

export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function fmtRatio(r: number): string {
  return `${r >= 1 ? r.toFixed(1) : r.toFixed(2)}×`;
}

const QUESTION_START =
  /^(why|how|what|is|are|can|could|do|does|did|should|would|will|ever|have|has|which|who|where|when)\b/i;
const ANNOUNCE_START =
  /^(today|so\b|this (week|weekend|sunday|morning)|okay|ok\b|welcome|hey guys|hi guys|here'?s (how|my)|let'?s|i'?m (going|gonna) to|in this video)/i;

export function hookKind(hook: string): "question" | "announce" | "statement" | "silent" {
  const h = hook.trim().replace(/^[“"']/, "");
  if (!h || /^\(no speech/i.test(h)) return "silent";
  if (h.includes("?") || QUESTION_START.test(h)) return "question";
  if (ANNOUNCE_START.test(h)) return "announce";
  return "statement";
}

export function postFindings(p: ScoredPost, b: Baseline): Finding[] {
  const out: Finding[] = [];

  // 1 · Opening frame (needs visual analysis; skipped when unknown)
  if (p.faceAtSec !== undefined) {
    if (p.faceAtSec <= 0.5) out.push({ tone: "good", text: "Your face is on camera at 0:00." });
    else if (p.faceAtSec <= 1.5) out.push({ tone: "mid", text: `Face shows up at ${fmtDur(p.faceAtSec)} — close, but not first.` });
    else out.push({ tone: "bad", text: `No face until ${fmtDur(p.faceAtSec)} — it opens on B-roll.` });
  }

  // 2 · Hook
  const kind = hookKind(p.hook);
  const quoted = `“${p.hook.replace(/^[“"]|[”"]$/g, "")}”`;
  if (kind === "question") out.push({ tone: "good", text: `Opens with a question: ${quoted}` });
  else if (kind === "announce") out.push({ tone: "bad", text: `The hook announces instead of asking: ${quoted}` });
  else if (kind === "silent") out.push({ tone: "bad", text: "No words in the opening seconds — nothing to stop the scroll." });
  else out.push({ tone: "mid", text: `Statement hook: ${quoted}` });

  // 3 · Length vs. this creator's winners
  const wAvg = b.winnerAvgSec || 35;
  if (p.durationSec <= Math.max(40, wAvg * 1.15)) {
    out.push({ tone: "good", text: `Tight at ${fmtDur(p.durationSec)} — no dead beats.` });
  } else if (p.durationSec >= wAvg * 2) {
    const x = Math.round((p.durationSec / wAvg) * 10) / 10;
    out.push({ tone: "bad", text: `Runs ${fmtDur(p.durationSec)} — ${x}× longer than your winners.` });
  } else {
    out.push({ tone: "mid", text: `Length is fine at ${fmtDur(p.durationSec)}.` });
  }

  // 4 · Hidden gem
  if (p.hiddenGem) {
    out.push({ tone: "mid", text: `Engagement is ${p.erViews.toFixed(1)}% — people who saw it loved it. Repost with a new hook.` });
  }

  return out.slice(0, 3);
}

export function rxLine(p: ScoredPost): string {
  if (p.hiddenGem) return "Repost it with a question hook — the content already works.";
  if (p.label === "flop") return "Re-shoot it: open on your face with a question and cut it to 30 seconds.";
  if (p.label === "winner") return "Make the sequel this week. Same hook shape, new topic.";
  return "Swap the opener for a question — this one is one change away.";
}
