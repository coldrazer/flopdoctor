// deno task diagnose @handle [--platform tiktok|instagram] [--offline] [--fixture path.json] [--roast]
// Runs the full pipeline in the terminal — the backup demo if the web app or venue Wi-Fi dies.
//   --offline   no LLM: heuristic diagnosis (Oriane data still fetched, or cached)
//   --fixture   no network at all: render a saved ScanView JSON (scripts/out/*.json or src/fixtures/live/*.json)
// Writes reports/<handle>.md and scripts/out/<platform>_<handle>.json.
import { fmtDur, fmtK, fmtRatio, postFindings } from "../supabase/functions/_shared/findings.ts";
import { runPipeline } from "../supabase/functions/_shared/pipeline.ts";
import type { Platform, ScanView } from "../supabase/functions/_shared/types.ts";
import { C, cacheHits, callsMade, creditsSpent, makeDeps, parseArgs, path } from "./lib.ts";

const { flags, pos } = parseArgs(Deno.args);
const handle = (pos[0] ?? "").replace(/^@/, "");
const platform = (flags.platform as Platform) ?? "tiktok";
if (!handle && !flags.fixture) {
  console.error("usage: deno task diagnose @handle [--platform tiktok|instagram] [--offline] [--fixture file.json] [--roast]");
  Deno.exit(1);
}

let view: ScanView;
if (typeof flags.fixture === "string") {
  view = JSON.parse(await Deno.readTextFile(flags.fixture));
} else {
  const deps = makeDeps({ offline: !!flags.offline });
  if (!deps.llm && !flags.offline) console.log(C.yellow("No GMI_API_KEY — running the heuristic (offline) diagnosis."));
  const t0 = Date.now();
  view = await runPipeline({ ...deps, log: (m) => console.log(C.dim(`  · ${m}`)) }, { platform, handle }, (step) => {
    console.log(C.dim(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${step}`));
  });
  Deno.mkdirSync(path("scripts/out"), { recursive: true });
  await Deno.writeTextFile(path(`scripts/out/${platform}_${view.handle}.json`), JSON.stringify({ ...view, id: `cache-${platform}-${view.handle}` }, null, 2));
}

const md = report(view, !!flags.roast);
console.log("\n" + md);
Deno.mkdirSync(path("reports"), { recursive: true });
await Deno.writeTextFile(path(`reports/${view.handle}.md`), md);
console.log(C.dim(`\nSaved reports/${view.handle}.md · Oriane calls: ${callsMade} new, ${cacheHits} cached${creditsSpent ? ` · ${creditsSpent} credits` : ""}`));

function report(v: ScanView, roast: boolean): string {
  const b = v.baseline!;
  const d = (roast && v.roastDiagnosis) || v.diagnosis!;
  const byId = new Map(v.posts.map((p) => [p.id, p]));
  const line = (id: string) => {
    const p = byId.get(id);
    return p ? `${fmtRatio(p.ratio)} · ${fmtK(p.views)} views · ${fmtDur(p.durationSec)} · ${p.caption.slice(0, 60)}` : id;
  };
  const out: string[] = [];
  out.push(`# Flop Doctor — @${v.handle} (${v.platform})`);
  out.push(`Baseline ${fmtK(b.medianViews)} views/video · ${b.postsAnalyzed} videos · ${b.dateRange[0].slice(0, 10)} → ${b.dateRange[1].slice(0, 10)} · confidence ${b.confidence}${v.niche ? ` · niche: ${v.niche.label}` : ""}`);
  out.push(`\n## ${roast ? "The roast" : "The verdict"}\n**${d.verdict}**`);
  out.push(`\n## Patterns`);
  d.patterns.forEach((p, i) => {
    out.push(`\n### ${i + 1}. ${p.title}  _(${p.confidence})_\n- Winners: ${p.winnersDo}\n- Flops: ${p.flopsDo}`);
    p.evidence.forEach((e) => out.push(`  - ${e.observation} — ${line(e.postId)}`));
  });
  out.push(`\n## Winners`);
  b.winnerIds.forEach((id) => out.push(`- ${line(id)}`));
  out.push(`\n## Flops`);
  b.flopIds.forEach((id) => {
    out.push(`- ${line(id)}`);
    const p = byId.get(id);
    if (p) postFindings(p, b).forEach((f) => out.push(`  - ${f.tone === "bad" ? "✗" : f.tone === "good" ? "✓" : "•"} ${f.text}`));
  });
  if (b.hiddenGemIds.length) {
    out.push(`\n## Hidden gems (low views, high engagement)`);
    b.hiddenGemIds.forEach((id) => out.push(`- ${line(id)}`));
  }
  out.push(`\n## Prescription`);
  (v.prescriptions ?? []).forEach((r, i) => {
    out.push(`\n### Rx #${i + 1} — ${r.title} (${r.format})\n> “${r.hook}”`);
    r.beats.forEach((bt) => out.push(`- ${bt.t ? bt.t + "  " : ""}${bt.text}`));
    out.push(`_Why:_ ${r.why}`);
  });
  return out.join("\n");
}
