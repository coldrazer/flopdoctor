// The whole diagnosis, runtime-agnostic. The run-scan Edge Function and scripts/diagnose.ts
// both call this; they only differ in how they persist each step.

import type { LlmCall } from "./gmi.ts";
import { heuristicDiagnosis, heuristicRx } from "./heuristics.ts";
import type { Oriane } from "./oriane.ts";
import {
  diagnosisPrompt,
  nichePrompt,
  parseDiagnosis,
  parseNiche,
  parseRoast,
  parseRx,
  roastPrompt,
  rxPrompt,
} from "./prompts.ts";
import { scorePosts } from "./scoring.ts";
import type { Diagnosis, Niche, Platform, Post, ScanStep, ScanView } from "./types.ts";

export class NotIndexedError extends Error {}

export interface PipelineDeps {
  oriane: Oriane;
  llm?: LlmCall; // omit for offline (heuristics only)
  fastModel?: string;
  log?: (msg: string) => void;
  now?: number;
}

export type Emit = (step: ScanStep, patch: Partial<ScanView>) => Promise<void> | void;

const STOP = new Set("the a an and or to of in on for with my your this that is are it i you me we our at how why what".split(" "));

function fallbackNiche(posts: Post[]): Niche {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const words = [...p.hashtags.map((h) => h.replace(/^#/, "")), ...p.caption.toLowerCase().split(/[^a-z0-9]+/)];
    for (const w of words) if (w.length > 3 && !STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
  return { label: keywords.slice(0, 2).join(" ") || "your niche", keywords };
}

export async function runPipeline(deps: PipelineDeps, input: { platform: Platform; handle: string }, emit: Emit): Promise<ScanView> {
  const { oriane, llm, log = () => {} } = deps;
  const { platform } = input;
  const handle = input.handle.replace(/^@/, "").trim().toLowerCase();

  // 1 · profile
  const creator = await oriane.findProfile(platform, handle);
  if (!creator) throw new NotIndexedError(`@${handle} isn't in Oriane's index yet.`);
  await emit("posts", { creator });

  // 2 · posts
  const raw = await oriane.searchPosts(platform, { handle, limit: 40, sort: "publishedAt:desc", projection: "full" });
  if (!raw.length) throw new NotIndexedError(`No indexed videos for @${handle} yet.`);
  log(`posts: ${raw.length}`);

  // 3 · score
  const { scored, baseline } = scorePosts(raw, deps.now ?? Date.now());
  if (scored.length < 4) throw new NotIndexedError(`Only ${scored.length} videos older than 3 days — not enough for a baseline.`);
  await emit("score", { creator, posts: scored, baseline });
  const byId = new Map(scored.map((p) => [p.id, p]));
  const winners = baseline.winnerIds.map((id) => byId.get(id)!);
  const flops = baseline.flopIds.map((id) => byId.get(id)!);
  const gems = baseline.hiddenGemIds.map((id) => byId.get(id)!);

  // 4 · niche
  let niche: Niche;
  try {
    if (!llm) throw new Error("offline");
    const p = nichePrompt(handle, raw);
    niche = parseNiche(await llm(p.system, p.user, { temperature: 0.2, model: deps.fastModel }));
  } catch (e) {
    log(`niche fallback: ${(e as Error).message}`);
    niche = fallbackNiche(raw);
  }
  await emit("niche", { creator, posts: scored, baseline, niche });

  // 5 + 6 · trending and diagnosis in parallel
  const trendingP = (async () => {
    const seen = new Set<string>();
    const out: Post[] = [];
    const cutoff = (deps.now ?? Date.now()) - 21 * 86400e3;
    for (const kw of niche.keywords.slice(0, 2)) {
      try {
        const res = await oriane.searchPosts(platform, { caption: kw, limit: 30, sort: "engagementRatePerViews:desc", projection: "full" });
        for (const p of res) {
          if (seen.has(p.id) || p.handle.toLowerCase() === handle || Date.parse(p.publishedAt) < cutoff || p.views < 1000) continue;
          seen.add(p.id);
          out.push(p);
        }
      } catch (e) {
        log(`trending "${kw}" failed: ${(e as Error).message}`);
      }
    }
    return out.sort((a, b) => b.erViews * Math.log10(b.views) - a.erViews * Math.log10(a.views)).slice(0, 8);
  })();

  const diagnosisP = (async (): Promise<Diagnosis> => {
    if (llm) {
      try {
        const p = diagnosisPrompt(handle, platform, baseline, winners, flops, gems);
        return parseDiagnosis(await llm(p.system, p.user), new Set(scored.map((s) => s.id)));
      } catch (e) {
        log(`diagnosis fallback: ${(e as Error).message}`);
      }
    }
    return heuristicDiagnosis(scored, baseline);
  })();

  const trending = await trendingP;
  await emit("trending", { creator, posts: scored, baseline, niche, trending });
  const diagnosis = await diagnosisP;
  await emit("diagnose", { creator, posts: scored, baseline, niche, trending, diagnosis });

  // 7 · roast + prescriptions in parallel
  const roastP = (async (): Promise<Diagnosis | undefined> => {
    if (!llm) return undefined;
    try {
      const p = roastPrompt(diagnosis);
      return parseRoast(await llm(p.system, p.user, { temperature: 0.8 }), diagnosis);
    } catch (e) {
      log(`roast skipped: ${(e as Error).message}`);
      return undefined;
    }
  })();
  const rxP = (async () => {
    if (llm) {
      try {
        const p = rxPrompt(handle, winners, flops, diagnosis, niche, trending);
        const allowed = new Set([...scored.map((s) => s.id), ...trending.map((t) => t.id)]);
        return parseRx(await llm(p.system, p.user, { temperature: 0.6 }), allowed);
      } catch (e) {
        log(`rx fallback: ${(e as Error).message}`);
      }
    }
    return heuristicRx(scored, baseline, diagnosis);
  })();
  const [roastDiagnosis, prescriptions] = await Promise.all([roastP, rxP]);

  const view: ScanView = {
    id: "",
    platform,
    handle,
    status: "done",
    step: "done",
    source: "live",
    creator,
    baseline,
    posts: scored,
    niche,
    trending,
    diagnosis,
    roastDiagnosis,
    prescriptions,
  };
  await emit("done", view);
  return view;
}
