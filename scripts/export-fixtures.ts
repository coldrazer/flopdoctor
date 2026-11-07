// deno task export-fixtures
// Copies finished scans from scripts/out/*.json into src/fixtures/live/ — the app picks them up
// as instant demo patients (real data, no network, no credits). Rebuild/redeploy the app after.
import type { ScanView } from "../supabase/functions/_shared/types.ts";
import { C, path } from "./lib.ts";

const src = path("scripts/out");
const dst = path("src/fixtures/live");
Deno.mkdirSync(dst, { recursive: true });
let n = 0;
for await (const f of Deno.readDir(src)) {
  if (!f.name.endsWith(".json")) continue;
  const v: ScanView = JSON.parse(await Deno.readTextFile(`${src}/${f.name}`));
  if (v.status !== "done" || !v.diagnosis || !v.posts?.length) {
    console.log(`${C.yellow("skip")} ${f.name} (incomplete)`);
    continue;
  }
  await Deno.writeTextFile(`${dst}/${f.name}`, JSON.stringify(v));
  console.log(`${C.green("✓")} ${f.name} → src/fixtures/live/`);
  n++;
}
console.log(C.dim(`\n${n} demo patient(s) exported. Run npm run build (or let Lovable redeploy).`));
