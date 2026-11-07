// deno task precache [scripts/handles.txt] [--offline]
// Runs the full diagnosis for every handle (Oriane + GMI) and saves each finished ScanView to
// scripts/out/. Then `deno task export-fixtures` turns them into instant demo patients in the app.
import { runPipeline } from "../supabase/functions/_shared/pipeline.ts";
import type { Platform } from "../supabase/functions/_shared/types.ts";
import { C, cacheHits, callsMade, creditsSpent, makeDeps, parseArgs, path, readHandles } from "./lib.ts";

const { flags, pos } = parseArgs(Deno.args);
const file = pos[0] ?? path("scripts/handles.txt");
const deps = makeDeps({ offline: !!flags.offline });
Deno.mkdirSync(path("scripts/out"), { recursive: true });

for (const { platform, handle } of readHandles(file)) {
  const platforms: Platform[] = platform === "both" ? ["tiktok", "instagram"] : [platform];
  for (const p of platforms) {
    const t0 = Date.now();
    try {
      const view = await runPipeline(deps, { platform: p, handle }, () => {});
      await Deno.writeTextFile(path(`scripts/out/${p}_${view.handle}.json`), JSON.stringify({ ...view, id: `cache-${p}-${view.handle}` }, null, 2));
      console.log(`${C.green("✓")} @${handle} ${p} — ${view.posts.length} videos, ${view.diagnosis?.patterns.length ?? 0} patterns, ${view.prescriptions?.length ?? 0} Rx ${C.dim(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`)}`);
    } catch (e) {
      console.log(`${C.red("✗")} @${handle} ${p} — ${(e as Error).message}`);
    }
  }
}
console.log(C.dim(`\nOriane calls: ${callsMade} new, ${cacheHits} cached${creditsSpent ? ` · ${creditsSpent} credits` : ""}. Next: deno task export-fixtures`));
