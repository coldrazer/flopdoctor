// deno task check-handles [scripts/handles.txt]
// Which handles are demo-safe? For each handle × platform: indexed? how many videos, how fresh,
// transcripts present? Uses the exact same calls as a real scan, so everything it fetches is cached
// and the live demo for these handles costs zero credits.
import { scorePosts } from "../supabase/functions/_shared/scoring.ts";
import type { Platform } from "../supabase/functions/_shared/types.ts";
import { C, cacheHits, callsMade, creditsSpent, makeDeps, path, readHandles } from "./lib.ts";

const file = Deno.args[0] ?? path("scripts/handles.txt");
const { oriane } = makeDeps({ offline: true });
const rows: string[][] = [];

for (const { platform, handle } of readHandles(file)) {
  const platforms: Platform[] = platform === "both" ? ["tiktok", "instagram"] : [platform];
  for (const p of platforms) {
    try {
      const prof = await oriane.findProfile(p, handle);
      if (!prof) { rows.push([`@${handle}`, p, C.red("not indexed"), "-", "-", "-", "-"]); continue; }
      const posts = await oriane.searchPosts(p, { handle, limit: 40, sort: "publishedAt:desc", projection: "full" });
      const { scored } = scorePosts(posts);
      const newest = posts[0]?.publishedAt?.slice(0, 10) ?? "-";
      const withTx = posts.filter((x) => x.transcript).length;
      const ok = scored.length >= 8;
      rows.push([`@${handle}`, p, ok ? C.green("DEMO-SAFE") : C.yellow("thin"), String(prof.followers), `${posts.length} (${scored.length} usable)`, newest, `${withTx}/${posts.length}`]);
    } catch (e) {
      rows.push([`@${handle}`, p, C.red("error"), (e as Error).message.slice(0, 60), "", "", ""]);
    }
  }
}

const head = ["handle", "platform", "status", "followers", "videos", "newest", "transcripts"];
const strip = (s: string) => s.replace(/\x1b\[\d+m/g, "");
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => strip(r[i] ?? "").length)));
const line = (r: string[]) => r.map((c, i) => c + " ".repeat(widths[i] - strip(c).length)).join("  ");
console.log(C.bold(line(head)));
rows.forEach((r) => console.log(line(r)));
console.log(C.dim(`\nOriane calls: ${callsMade} new, ${cacheHits} from cache${creditsSpent ? ` · ${creditsSpent} credits` : ""}`));
