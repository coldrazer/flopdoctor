// Prompts + output validators. Validators never trust the model: unknown post ids are dropped,
// counts are clamped, missing fields fail the call (which triggers a retry or the fallback).

import { featureTable } from "./scoring.ts";
import type { Baseline, Confidence, Diagnosis, Niche, Pattern, Post, Rx, ScoredPost } from "./types.ts";

// ---------- niche ----------
export function nichePrompt(handle: string, posts: Post[]) {
  return {
    system: "You label a short-form video creator's niche from their captions.",
    user: `Captions from @${handle}'s recent videos:\n${posts.slice(0, 30).map((p) => `- ${p.caption.slice(0, 140).replace(/\s+/g, " ")}`).join("\n")}

Return JSON: {"label": "2-4 word niche, lowercase", "keywords": ["3-5 short search keywords other creators in this niche would put in captions"]}`,
  };
}

export function parseNiche(x: unknown): Niche {
  const o = x as Record<string, unknown>;
  const label = typeof o?.label === "string" ? o.label.slice(0, 40) : "";
  const keywords = Array.isArray(o?.keywords) ? (o.keywords as unknown[]).filter((k): k is string => typeof k === "string").slice(0, 5) : [];
  if (!label || !keywords.length) throw new Error("bad niche");
  return { label, keywords };
}

// ---------- diagnosis ----------
export function diagnosisPrompt(handle: string, platform: string, b: Baseline, winners: ScoredPost[], flops: ScoredPost[], gems: ScoredPost[]) {
  return {
    system: `You are Flop Doctor, a blunt short-form video analyst. You compare a creator's best-performing videos against their worst, using ONLY the data provided. Every claim must cite post ids from the input. No generic advice ("be authentic", "post consistently", "use trending audio"). Prefer concrete, checkable differences: the opening seconds, the first words spoken, length, format, topic type, posting time. If evidence for a pattern is weak, mark confidence low or medium.`,
    user: `Creator: @${handle} · ${platform} · median ${b.medianViews} views/video · ${b.postsAnalyzed} videos
Each row: ratio vs median, features, hook = first words spoken, caption. face_at = seconds until a face appears (when known).

WINNERS:
${featureTable(winners)}

FLOPS:
${featureTable(flops)}

HIDDEN GEMS (below-median views, unusually high engagement):
${gems.length ? featureTable(gems) : "(none)"}

Return JSON:
{
  "verdict": "one sentence, max 20 words, the single biggest difference, addressed to the creator as 'you'",
  "patterns": [
    {
      "title": "max 8 words",
      "winnersDo": "1 sentence",
      "flopsDo": "1 sentence",
      "evidence": [{"postId": "an id from the tables above", "observation": "max 12 words"}],
      "confidence": "high | medium | low"
    }
  ]
}
Give 3 to 5 patterns, strongest first, each with 2-3 evidence items mixing winners and flops.`,
  };
}

const CONF: Confidence[] = ["high", "medium", "low"];

export function parseDiagnosis(x: unknown, allowedIds: Set<string>): Diagnosis {
  const o = x as Record<string, unknown>;
  const verdict = typeof o?.verdict === "string" ? o.verdict.trim() : "";
  const raw = Array.isArray(o?.patterns) ? (o.patterns as Record<string, unknown>[]) : [];
  const patterns: Pattern[] = raw
    .map((p) => ({
      title: String(p.title ?? "").trim(),
      winnersDo: String(p.winnersDo ?? p.winners_do ?? "").trim(),
      flopsDo: String(p.flopsDo ?? p.flops_do ?? "").trim(),
      confidence: (CONF.includes(p.confidence as Confidence) ? p.confidence : "medium") as Confidence,
      evidence: (Array.isArray(p.evidence) ? (p.evidence as Record<string, unknown>[]) : [])
        .map((e) => ({ postId: String(e.postId ?? e.post_id ?? ""), observation: String(e.observation ?? "").trim() }))
        .filter((e) => allowedIds.has(e.postId) && e.observation) // anti-hallucination
        .slice(0, 3),
    }))
    .filter((p) => p.title && p.winnersDo && p.flopsDo && p.evidence.length)
    .slice(0, 5);
  if (!verdict || patterns.length < 2) throw new Error("bad diagnosis");
  return { verdict, patterns };
}

// ---------- roast ----------
export function roastPrompt(d: Diagnosis) {
  return {
    system: `Rewrite the verdict and the pattern titles as a playful roast of the creator's CONTENT choices. Never mention appearance, body, voice, identity, family, money or anything personal. Funny, not cruel. Keep the meaning of each line.`,
    user: `Verdict: ${d.verdict}
Titles:
${d.patterns.map((p, i) => `${i + 1}. ${p.title}`).join("\n")}

Return JSON: {"verdict": "max 20 words", "titles": ["one per input title, same order, max 9 words each"]}`,
  };
}

export function parseRoast(x: unknown, d: Diagnosis): Diagnosis {
  const o = x as Record<string, unknown>;
  const titles = Array.isArray(o?.titles) ? (o.titles as unknown[]).map(String) : [];
  if (typeof o?.verdict !== "string" || titles.length !== d.patterns.length) throw new Error("bad roast");
  return { verdict: o.verdict, patterns: d.patterns.map((p, i) => ({ ...p, title: titles[i] || p.title })) };
}

// ---------- prescription ----------
export function rxPrompt(handle: string, winners: ScoredPost[], flops: ScoredPost[], d: Diagnosis, niche: Niche | undefined, trending: ScoredPost[] | Post[]) {
  return {
    system: `You write short-form video concepts. Hooks must sound like this creator — copy their vocabulary, sentence length and energy from their winning hooks. Each concept must apply the diagnosed patterns. Keep every video under 40 seconds unless their winners say otherwise.`,
    user: `Creator: @${handle}
Their winning hooks (voice samples):
${winners.map((w) => `- [${w.id}] "${w.hook}"`).join("\n")}

Their worst flops (one concept should remake one of these with the fixes):
${flops.slice(0, 3).map((f) => `- [${f.id}] ${f.caption.slice(0, 80)} (${Math.round(f.durationSec)}s, hook "${f.hook}")`).join("\n")}

Diagnosis: ${d.verdict}
Patterns:
${d.patterns.map((p) => `- ${p.title}: winners ${p.winnersDo} / flops ${p.flopsDo}`).join("\n")}

What's working in their niche${niche ? ` (${niche.label})` : ""} right now:
${trending.length ? trending.slice(0, 8).map((t) => `- [${t.id}] @${t.handle} ${t.views} views, er ${t.erViews.toFixed(1)}%: "${(t.transcript || t.caption).slice(0, 90).replace(/\s+/g, " ")}"`).join("\n") : "(no niche data — rely on their own winners)"}

Return JSON:
{"prescriptions": [
  {
    "title": "max 6 words",
    "format": "e.g. 'Talking head · ~28 s'",
    "hook": "first spoken line, max 15 words, in their voice",
    "beats": [{"t": "0:00", "text": "short beat"}],
    "why": "1-2 sentences naming a pattern and a proof post",
    "patternRef": "one pattern title from above, verbatim",
    "proofPostIds": ["ids from the winners, flops or niche lists"]
  }
]}
Exactly 3 prescriptions, 3-5 beats each.`,
  };
}

export function parseRx(x: unknown, allowedIds: Set<string>): Rx[] {
  const o = x as Record<string, unknown>;
  const list = Array.isArray(o?.prescriptions) ? (o.prescriptions as Record<string, unknown>[]) : [];
  const out: Rx[] = list
    .map((r) => ({
      title: String(r.title ?? "").trim(),
      format: String(r.format ?? "").trim(),
      hook: String(r.hook ?? "").trim(),
      beats: (Array.isArray(r.beats) ? (r.beats as unknown[]) : [])
        .map((b) => (typeof b === "string" ? { t: "", text: b } : { t: String((b as Record<string, unknown>).t ?? ""), text: String((b as Record<string, unknown>).text ?? "") }))
        .filter((b) => b.text)
        .slice(0, 6),
      why: String(r.why ?? "").trim(),
      patternRef: String(r.patternRef ?? r.pattern_ref ?? "").trim(),
      proofPostIds: (Array.isArray(r.proofPostIds) ? (r.proofPostIds as unknown[]).map(String) : []).filter((id) => allowedIds.has(id)).slice(0, 3),
    }))
    .filter((r) => r.title && r.hook && r.beats.length)
    .slice(0, 3);
  if (!out.length) throw new Error("bad prescriptions");
  return out;
}
