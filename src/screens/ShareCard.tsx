import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fmtK } from "../../supabase/functions/_shared/findings.ts";
import type { Platform } from "../../supabase/functions/_shared/types.ts";
import { LogoMark, TopBar } from "../components/Logo.tsx";
import { useStore } from "../lib/store.tsx";
import { Missing, RoastToggle } from "./common.tsx";

const W = 1080;
const H = 1350;
const COLOR = { winner: "#3CF2A0", normal: "#5B6573", flop: "#FF4D5E" } as const;

export default function ShareCard() {
  const { platform, handle } = useParams<{ platform: Platform; handle: string }>();
  const { getScan, roast } = useStore();
  const scan = getScan(platform as Platform, handle ?? "");
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!scan || !scan.baseline || !scan.diagnosis) return <Missing handle={handle} />;
  const dx = (roast ? scan.roastDiagnosis : undefined) ?? scan.diagnosis;
  const accent = roast ? "#FFC845" : "#3CF2A0";
  const rx1 = scan.prescriptions?.[0];
  const base = `/${scan.platform}/${encodeURIComponent(scan.handle)}`;

  const download = async () => {
    if (!card.current) return;
    setBusy(true);
    try {
      const url = await toPng(card.current, { width: W, height: H, pixelRatio: 1, style: { transform: "none" }, cacheBust: true });
      // Some hosts (sandboxed previews) block script-started downloads, so also show the image
      // in an overlay where it can be saved with right-click / long-press.
      setPng(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flop-doctor-${scan.handle}${roast ? "-roast" : ""}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar>
        <RoastToggle />
        <Link to={`/d${base}`} className="inline-flex min-h-[44px] items-center rounded-[10px] border border-line px-4 text-sm font-semibold text-ink no-underline hover:text-ink">← Back to chart</Link>
        <button type="button" onClick={download} disabled={busy} className="inline-flex min-h-[44px] cursor-pointer items-center rounded-[10px] border-0 bg-vital px-4 text-sm font-bold text-bg disabled:opacity-60">
          {busy ? "Rendering…" : "Download PNG"}
        </button>
      </TopBar>
      <main className="mx-auto max-w-[760px] px-6 py-8">
        <div ref={wrap} className="w-full" style={{ height: H * scale }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <div ref={card} className="relative flex flex-col gap-11 overflow-hidden bg-bg p-[72px] font-sans text-ink" style={{ width: W, height: H }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5" style={{ color: accent }}>
                  <LogoMark size={44} />
                  <span className="text-[30px] font-extrabold tracking-tight text-ink">Flop Doctor</span>
                </div>
                <span className="rounded-full border-2 px-[18px] py-2.5 font-mono text-xl font-bold tracking-[0.1em]" style={{ borderColor: accent, color: accent }}>
                  {roast ? "ROAST MODE" : "DIAGNOSIS"}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="font-mono text-[22px] tracking-[0.12em] text-muted">PATIENT</span>
                <span className="font-mono text-[40px] font-bold">@{scan.handle}</span>
                <span className="text-[22px] text-muted">
                  {scan.platform === "tiktok" ? "TikTok" : "Instagram"} · {scan.baseline.postsAnalyzed} videos · baseline {fmtK(scan.baseline.medianViews)} views
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <span className="font-mono text-[22px] tracking-[0.12em]" style={{ color: accent }}>{roast ? "THE ROAST" : "THE VERDICT"}</span>
                <p className="m-0 text-[58px] font-extrabold leading-[1.08] tracking-[-0.03em]">{dx.verdict}</p>
              </div>
              <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface px-8 py-7">
                <div className="flex justify-between font-mono text-lg text-muted">
                  <span>VITALS · last {scan.posts.length} videos</span>
                  <span><span className="text-vital">■</span> winner <span className="text-flat">■</span> flop</span>
                </div>
                <div aria-hidden="true" className="relative flex h-[200px] items-center gap-2">
                  <div className="absolute inset-x-0 top-[100px] h-0.5 bg-line2" />
                  {scan.posts.map((p) => {
                    const h = Math.max(4, Math.round(Math.min(2.3, Math.abs(p.log2)) * 42));
                    return <div key={p.id} className="relative flex-1 rounded" style={{ height: h, background: COLOR[p.label], [p.log2 >= 0 ? "marginBottom" : "marginTop"]: h }} />;
                  })}
                </div>
              </div>
              {rx1 && (
                <div className="flex flex-col gap-3.5 pl-7" style={{ borderLeft: `6px solid ${accent}` }}>
                  <span className="font-mono text-[22px] tracking-[0.12em] text-muted">RX #1 · POST THIS WEEK</span>
                  <p className="m-0 text-[40px] font-bold leading-[1.2]">“{rx1.hook}”</p>
                </div>
              )}
              <div className="mt-auto flex items-center justify-between font-mono text-[22px] text-muted">
                <span>Get your diagnosis → flopdoctor</span>
                <span>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      {png && (
        <div role="dialog" aria-modal="true" aria-label="Share card image" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/95 p-6">
          <img src={png} alt={`Flop Doctor share card for @${scan.handle}`} className="max-h-[75vh] w-auto max-w-full rounded-xl border border-line" />
          <p className="m-0 text-center text-sm text-muted">If the download didn't start, right-click or long-press the image and choose Save.</p>
          <button type="button" onClick={() => setPng(null)} className="min-h-[44px] cursor-pointer rounded-[10px] border border-line2 bg-transparent px-5 font-semibold text-ink">Close</button>
        </div>
      )}
    </div>
  );
}
