// npm run screenshots
// Rebuilds the app, serves it, and captures every README image into docs/:
//   docs/screenshots/*.png (2x desktop, 3x phone) and docs/demo.gif (needs ffmpeg).
// One-time setup:  npm i -D playwright && npx playwright install chromium
// Uses the built-in sample patients, so no keys or network are needed.

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";

const PORT = 4179;
const URL = `http://localhost:${PORT}/#`;
const OUT = "docs/screenshots/";
const VID = "docs/.video/";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

execSync("npm run build", { stdio: "inherit" });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const shot = (page, name, opts = {}) => page.screenshot({ path: OUT + name, ...opts }).then(() => console.log("✓", name));

try {
  // Desktop
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await d.newPage();
  await p.goto(URL + "/");
  await p.waitForTimeout(1000);
  await p.fill("input", "noodle.lab");
  await shot(p, "01-intake.png");
  await p.click("button[type=submit]");
  await p.waitForSelector(".fd-stamp", { timeout: 20000 });
  await p.waitForTimeout(450);
  await shot(p, "03-diagnosing.png");
  await p.waitForSelector("aside[aria-label='Pulled video']", { timeout: 20000 });
  await p.waitForTimeout(1500);
  await shot(p, "04-pulled.png");

  await p.goto(URL + "/d/tiktok/noodle.lab");
  await p.waitForTimeout(900);
  await p.locator("button[aria-label^='Why your fried rice']").hover();
  await p.waitForTimeout(300);
  await shot(p, "05-diagnosis.png");
  await p.mouse.move(5, 5);
  await p.locator("section[aria-labelledby='patterns-h']").screenshot({ path: OUT + "06-patterns.png" });
  console.log("✓ 06-patterns.png");

  await p.goto(URL + "/rx/tiktok/noodle.lab");
  await p.waitForTimeout(900);
  await shot(p, "07-prescription.png");

  await p.goto(URL + "/d/tiktok/noodle.lab");
  await p.waitForTimeout(600);
  await p.click("button[aria-pressed]"); // Roast mode
  await p.waitForTimeout(400);
  await shot(p, "08-roast.png");
  await p.click("text=Make share card");
  await p.waitForTimeout(1200);
  await p.locator("main > div > div").screenshot({ path: OUT + "09-sharecard.png" });
  console.log("✓ 09-sharecard.png");
  await d.close();

  // Phone
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(URL + "/");
  await mp.waitForTimeout(800);
  await mp.fill("input", "liftfolio");
  await shot(mp, "10-mobile-intake.png");
  await mp.click("button[type=submit]");
  await mp.waitForSelector(".fd-stamp", { timeout: 20000 });
  await mp.waitForTimeout(450);
  await shot(mp, "11-mobile-wheel.png");
  await mp.waitForSelector("aside[aria-label='Pulled video']", { timeout: 20000 });
  await mp.waitForTimeout(900);
  await shot(mp, "11b-mobile-pulled.png");
  await mp.goto(URL + "/d/tiktok/liftfolio");
  await mp.waitForTimeout(900);
  await shot(mp, "12-mobile-chart.png");
  await m.close();

  // Demo recording → GIF
  rmSync(VID, { recursive: true, force: true });
  const v = await browser.newContext({ viewport: { width: 1280, height: 760 }, recordVideo: { dir: VID, size: { width: 1280, height: 760 } } });
  const vp = await v.newPage();
  await vp.goto(URL + "/");
  await vp.waitForTimeout(1200);
  await vp.click("input");
  await vp.keyboard.type("noodle.lab", { delay: 90 });
  await vp.waitForTimeout(500);
  await vp.click("button[type=submit]");
  await vp.waitForSelector("aside[aria-label='Pulled video']", { timeout: 25000 });
  await vp.waitForTimeout(3500);
  await vp.click("text=Next video");
  await vp.waitForSelector(".fd-stamp", { timeout: 25000 });
  await vp.waitForTimeout(2500);
  await v.close();

  const webm = readdirSync(VID).find((f) => f.endsWith(".webm"));
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    execSync(
      `ffmpeg -y -v error -ss 0.6 -t 23 -i ${VID}${webm} -vf "fps=12,scale=860:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" docs/demo.gif`,
      { stdio: "inherit" },
    );
    console.log("✓ docs/demo.gif");
    rmSync(VID, { recursive: true, force: true });
  } catch {
    if (webm) renameSync(VID + webm, "docs/demo.webm");
    rmSync(VID, { recursive: true, force: true });
    console.log("ffmpeg not found — saved docs/demo.webm instead of the GIF.");
  }
} finally {
  await browser.close();
  server.kill();
}
if (!existsSync(OUT + "01-intake.png")) process.exit(1);
