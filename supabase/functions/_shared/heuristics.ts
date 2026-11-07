// No-LLM diagnosis: used by `diagnose.ts --offline` and as the fallback when the model fails twice.
// Counts real differences between winners and flops; every pattern cites real post ids.

import { fmtDur, hookKind } from "./findings.ts";
import type { Baseline, Diagnosis, Pattern, Rx, ScoredPost } from "./types.ts";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function heuristicDiagnosis(posts: ScoredPost[], b: Baseline): Diagnosis {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const W = b.winnerIds.map((id) => byId.get(id)!).filter(Boolean);
  const F = b.flopIds.map((id) => byId.get(id)!).filter(Boolean);
  const patterns: (Pattern & { score: number })[] = [];
  const pct = (xs: ScoredPost[], f: (p: ScoredPost) => boolean) => (xs.length ? xs.filter(f).length / xs.length : 0);
  const ev = (p: ScoredPost | undefined, obs: string) => (p ? [{ postId: p.id, observation: obs }] : []);

  // Question hooks
  const isQ = (p: ScoredPost) => hookKind(p.hook) === "question";
  const isA = (p: ScoredPost) => ["announce", "silent"].includes(hookKind(p.hook));
  const qW = pct(W, isQ), qF = pct(F, isQ);
  if (qW - qF >= 0.3) {
    patterns.push({
      title: "Ask a question, don't announce",
      winnersDo: `${Math.round(qW * 100)}% of your winners open with a question.`,
      flopsDo: `${Math.round(pct(F, isA) * 100)}% of your flops announce the plan or open silent.`,
      confidence: qW - qF >= 0.5 ? "high" : "medium",
      evidence: [...ev(W.find(isQ), `“${W.find(isQ)?.hook.slice(0, 40)}”`), ...ev(F.find(isA), `“${(F.find(isA)?.hook || "no speech").slice(0, 40)}”`)],
      score: qW - qF,
    });
  }

  // Length
  const lw = avg(W.map((p) => p.durationSec)), lf = avg(F.map((p) => p.durationSec));
  if (lf > lw * 1.5) {
    const short = [...W].sort((a, c) => a.durationSec - c.durationSec)[0];
    const long = [...F].sort((a, c) => c.durationSec - a.durationSec)[0];
    patterns.push({
      title: `Stay under ${Math.max(30, Math.ceil((lw * 1.2) / 10) * 10)} seconds`,
      winnersDo: `Average length ${fmtDur(lw)}.`,
      flopsDo: `Average length ${fmtDur(lf)} — ${(lf / lw).toFixed(1)}× longer.`,
      confidence: lf > lw * 2 ? "high" : "medium",
      evidence: [...ev(short, `${fmtDur(short?.durationSec ?? 0)}, no wasted beat`), ...ev(long, `${fmtDur(long?.durationSec ?? 0)} runtime`)],
      score: Math.min(1, lf / lw - 1),
    });
  }

  // Face first (only if visual data exists)
  const known = (p: ScoredPost) => p.faceAtSec !== undefined;
  if (W.some(known) && F.some(known)) {
    const early = (p: ScoredPost) => (p.faceAtSec ?? 99) <= 1;
    const fw = pct(W.filter(known), early), ff = pct(F.filter(known), early);
    if (fw - ff >= 0.3) {
      patterns.push({
        title: "Face first, then everything else",
        winnersDo: `${Math.round(fw * 100)}% of your winners show your face in the first second.`,
        flopsDo: `${Math.round((1 - ff) * 100)}% of your flops open on B-roll first.`,
        confidence: fw - ff >= 0.5 ? "high" : "medium",
        evidence: [...ev(W.find(early), "Face on camera at 0:00"), ...ev(F.find((p) => !early(p)), `No face until ${fmtDur(F.find((p) => !early(p))?.faceAtSec ?? 0)}`)],
        score: fw - ff + 0.05,
      });
    }
  }

  // Posting time
  const hourW = avg(W.map((p) => new Date(p.publishedAt).getUTCHours()));
  const hourF = avg(F.map((p) => new Date(p.publishedAt).getUTCHours()));
  if (Math.abs(hourW - hourF) >= 4) {
    patterns.push({
      title: "Your timing matters",
      winnersDo: `Winners go up around ${Math.round(hourW)}:00 UTC.`,
      flopsDo: `Flops go up around ${Math.round(hourF)}:00 UTC.`,
      confidence: "low",
      evidence: [...ev(W[0], "Posted in your strong window"), ...ev(F[0], "Posted off-window")],
      score: 0.1,
    });
  }

  patterns.sort((a, c) => c.score - a.score);
  const top = patterns[0];
  const verdict = top
    ? `Your winners ${top.winnersDo.charAt(0).toLowerCase() + top.winnersDo.slice(1).replace(/\.$/, "")}; your flops don't.`
    : "Your winners and flops look alike on paper — the difference is inside the videos.";
  return { verdict, patterns: patterns.map(({ score: _s, ...p }) => p) };
}

export function heuristicRx(posts: ScoredPost[], b: Baseline, d: Diagnosis): Rx[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const W = b.winnerIds.map((id) => byId.get(id)!).filter(Boolean);
  const F = b.flopIds.map((id) => byId.get(id)!).filter(Boolean);
  const out: Rx[] = [];
  if (W[0]) {
    out.push({
      title: `${W[0].caption.slice(0, 28)} — part 2`,
      format: `Sequel · ~${Math.round(W[0].durationSec)} s`,
      hook: W[0].hook,
      beats: [{ t: "0:00", text: "Same opening shape as the original." }, { t: "0:05", text: "One new angle on the same problem." }, { t: "0:20", text: "Point back to part 1." }],
      why: `Your best video ran at ${W[0].ratio.toFixed(1)}× your median. Sequels inherit the original's audience.`,
      patternRef: d.patterns[0]?.title ?? "",
      proofPostIds: [W[0].id],
    });
  }
  if (F[0]) {
    out.push({
      title: `${F[0].caption.slice(0, 28)}, re-hooked`,
      format: "Remake · ~30 s",
      hook: "[Rewrite as a question your viewer is already asking]",
      beats: [{ t: "0:00", text: "Face to camera. Ask the question." }, { t: "0:04", text: `Cut the original ${fmtDur(F[0].durationSec)} down to its best 25 seconds.` }, { t: "0:28", text: "End on the payoff." }],
      why: `This one ran at ${F[0].ratio.toFixed(2)}×. Same topic with the fixes applied is a clean test.`,
      patternRef: d.patterns[0]?.title ?? "",
      proofPostIds: [F[0].id],
    });
  }
  return out;
}
