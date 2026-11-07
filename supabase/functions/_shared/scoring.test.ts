import { describe, expect, it } from "vitest";
import { scorePosts, median, hookOf } from "./scoring.ts";
import { hookKind, postFindings } from "./findings.ts";
import type { Post } from "./types.ts";

const now = Date.parse("2026-11-05T12:00:00Z");
const mk = (i: number, views: number, er = 4, extra: Partial<Post> = {}): Post => ({
  id: `p${i}`, platform: "tiktok", handle: "t", publishedAt: new Date(now - (i + 4) * 86400e3).toISOString(),
  views, likes: 0, comments: 0, shares: 0, interactions: 0, erViews: er, durationSec: 30,
  caption: `cap ${i}`, hashtags: [], transcript: "Why is this a test?", ...extra,
});

describe("scoring", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("labels against the creator's own median", () => {
    const views = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 4000, 4000, 4000, 200, 200, 200];
    const { scored, baseline } = scorePosts(views.map((v, i) => mk(i, v)), now);
    expect(baseline.medianViews).toBe(1000);
    expect(scored.filter((p) => p.label === "winner")).toHaveLength(3);
    expect(scored.filter((p) => p.label === "flop")).toHaveLength(3);
  });
  it("drops posts younger than 72h", () => {
    const fresh = { ...mk(0, 999999), publishedAt: new Date(now - 3600e3).toISOString() };
    const { scored } = scorePosts([fresh, mk(1, 10), mk(2, 20)], now);
    expect(scored.find((p) => p.id === "p0")).toBeUndefined();
  });
  it("flags hidden gems", () => {
    const posts = Array.from({ length: 12 }, (_, i) => mk(i, 1000 + i * 10, 4));
    posts.push(mk(20, 700, 12));
    const { baseline } = scorePosts(posts, now);
    expect(baseline.hiddenGemIds).toContain("p20");
  });
  it("hooks", () => {
    expect(hookOf({ transcript: "", caption: "Hello there. More" })).toBe("Hello there");
    expect(hookKind("Today I'm making noodles")).toBe("announce");
    expect(hookKind("Why is rice mushy?")).toBe("question");
    expect(hookKind("")).toBe("silent");
  });
  it("findings return three lines", () => {
    const { scored, baseline } = scorePosts(Array.from({ length: 10 }, (_, i) => mk(i, 1000 * (i + 1), 4, { faceAtSec: 0 })), now);
    expect(postFindings(scored[0], baseline)).toHaveLength(3);
  });
});
