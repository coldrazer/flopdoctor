// deno task test:backend — runs the real pipeline against a fake Oriane (Firecrawl response shape)
// and a fake LLM. No network, no keys.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { noodleLab } from "../../../src/fixtures/noodleLab.ts";
import type { LlmCall } from "./gmi.ts";
import { createOriane } from "./oriane.ts";
import { NotIndexedError, runPipeline } from "./pipeline.ts";
import type { Post } from "./types.ts";

const NOW = Date.parse(noodleLab.nowISO);

// Our Post → Oriane's raw post fields (as in the published spec).
const toOriane = (p: Post) => ({
  id: p.id, platform: p.platform, profileHandle: p.handle, publishedAt: p.publishedAt,
  viewsCount: p.views, likesCount: p.likes, commentsCount: p.comments, sharesCount: p.shares,
  interactionsCount: p.interactions, engagementRatePerViews: p.erViews, duration: p.durationSec,
  caption: p.caption, hashtags: p.hashtags, transcript: p.transcript, thumbnailMediaUrl: null, postUrl: null,
});

function fakeFetch(opts: { indexed?: boolean } = {}): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const { capability, options } = body.alexandria;
    let data: unknown;
    if (capability.endsWith("profiles-search")) {
      data = { data: opts.indexed === false ? [] : [{ id: "prf_x", platform: "tiktok", handle: options.handle, displayName: "Noodle Lab", followersCount: 48200, postsCount: 212, profileUrl: "https://www.tiktok.com/@noodle.lab" }] };
    } else if (options.handle) {
      data = { data: { results: noodleLab.posts.map(toOriane) } };
    } else {
      data = { data: { results: noodleLab.trending.map((p) => ({ ...toOriane(p), publishedAt: new Date(NOW - 2 * 86400e3).toISOString() })) } };
    }
    return new Response(JSON.stringify({ success: true, provider: "oriane", capability, creditsCost: 50, data }), { status: 200 });
  }) as typeof fetch;
}

const goodLlm: LlmCall = async (system, user) => {
  if (system.includes("niche")) return { label: "weeknight cooking", keywords: ["fried rice", "noodles"] };
  if (system.includes("roast")) return { verdict: "Roasted.", titles: noodleLab.diagnosis.patterns.map((_, i) => `Roast ${i}`) };
  if (system.includes("concepts")) {
    return { prescriptions: [{ title: "T", format: "Talking head", hook: "Why?", beats: [{ t: "0:00", text: "go" }], why: "w", patternRef: "p", proofPostIds: ["nl_07", "made_up_id"] }] };
  }
  assert(user.includes("WINNERS"));
  // include one hallucinated id — it must be dropped
  return { ...noodleLab.diagnosis, patterns: noodleLab.diagnosis.patterns.map((p) => ({ ...p, evidence: [...p.evidence, { postId: "cnt_fake", observation: "made up" }] })) };
};

Deno.test("full pipeline with LLM", async () => {
  const steps: string[] = [];
  const oriane = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: fakeFetch() });
  const v = await runPipeline({ oriane, llm: goodLlm, now: NOW }, { platform: "tiktok", handle: "@Noodle.Lab" }, (s) => void steps.push(s));
  assertEquals(steps, ["posts", "score", "niche", "trending", "diagnose", "done"]);
  assertEquals(v.handle, "noodle.lab");
  assertEquals(v.posts.length, 30);
  assertEquals(v.baseline!.winnerIds.length, 6);
  assert(v.diagnosis!.patterns.every((p) => p.evidence.every((e) => e.postId !== "cnt_fake")), "hallucinated evidence dropped");
  assertEquals(v.prescriptions![0].proofPostIds, ["nl_07"]);
  assertEquals(v.roastDiagnosis!.verdict, "Roasted.");
  assert(v.trending!.length > 0);
});

Deno.test("falls back to heuristics when the LLM fails", async () => {
  const oriane = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: fakeFetch() });
  const bad: LlmCall = async () => ({ nonsense: true });
  const v = await runPipeline({ oriane, llm: bad, now: NOW }, { platform: "tiktok", handle: "noodle.lab" }, () => {});
  assert(v.diagnosis!.patterns.length >= 2, "heuristic patterns");
  assert(v.prescriptions!.length >= 1);
  assertEquals(v.roastDiagnosis, undefined);
});

Deno.test("offline (no LLM) still diagnoses", async () => {
  const oriane = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: fakeFetch() });
  const v = await runPipeline({ oriane, now: NOW }, { platform: "tiktok", handle: "noodle.lab" }, () => {});
  const titles = v.diagnosis!.patterns.map((p) => p.title);
  assert(titles.some((t) => t.includes("question")), titles.join(" | "));
  assert(titles.some((t) => t.startsWith("Stay under")), titles.join(" | "));
  assert(!titles.some((t) => t.startsWith("Face first")), "no face pattern without visual data");
});

Deno.test("face pattern appears when visual analysis provides face timing", async () => {
  const withFace = ((u: string, i?: RequestInit) =>
    fakeFetch()(u, i).then(async (r) => {
      const j = await r.json();
      const res = j.data?.data?.results;
      if (Array.isArray(res)) {
        for (const x of res) x.faceAppearsAt = noodleLab.posts.find((p) => p.id === x.id)?.faceAtSec;
      }
      return new Response(JSON.stringify(j));
    })) as typeof fetch;
  const oriane = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: withFace });
  const v = await runPipeline({ oriane, now: NOW }, { platform: "tiktok", handle: "noodle.lab" }, () => {});
  assert(v.diagnosis!.patterns.some((p) => p.title.startsWith("Face first")));
});

Deno.test("not indexed → NotIndexedError", async () => {
  const oriane = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: fakeFetch({ indexed: false }) });
  await assertRejects(() => runPipeline({ oriane, now: NOW }, { platform: "tiktok", handle: "nobody" }, () => {}), NotIndexedError);
});

Deno.test("cache: second run makes no network calls", async () => {
  let calls = 0;
  const inner = fakeFetch();
  const counting = ((u: string, i?: RequestInit) => { calls++; return inner(u, i); }) as typeof fetch;
  const { memoryCache } = await import("./oriane.ts");
  const cache = memoryCache();
  const o1 = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: counting, cache });
  await runPipeline({ oriane: o1, now: NOW }, { platform: "tiktok", handle: "noodle.lab" }, () => {});
  const first = calls;
  const o2 = createOriane({ mode: "firecrawl", firecrawlKey: "x", fetchImpl: counting, cache });
  await runPipeline({ oriane: o2, now: NOW }, { platform: "tiktok", handle: "noodle.lab" }, () => {});
  assertEquals(calls, first);
});
