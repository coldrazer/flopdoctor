// S1 + S2: white prompt → fades into the arc wheel of the creator's last 20 videos.
// While the scan runs, "Dr. Flop" keeps stopping the wheel, diagnosing a screen grab
// and pulling the video. When the full diagnosis is ready, the chart is one click away.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import { fmtDur, fmtK, fmtRatio, postFindings, rxLine, type Finding } from "../../supabase/functions/_shared/findings.ts";
import { SCAN_STEPS, type Platform, type ScanView, type ScoredPost } from "../../supabase/functions/_shared/types.ts";
import { ArcWheel, type Geo, type WheelHandle } from "../components/ArcWheel.tsx";
import { Logo } from "../components/Logo.tsx";
import { Thumb } from "../components/Thumb.tsx";
import { SAMPLES, cleanHandle, runScan } from "../lib/data.ts";
import { embedUrl, watchUrl } from "../lib/embed.ts";
import { useStore } from "../lib/store.tsx";

const RING = 20;
type Doc = "scanning" | "stopping" | "diagnose" | "pull" | "notfound";
const TONE: Record<Finding["tone"], string> = { good: "#3CF2A0", bad: "#FF4D5E", mid: "#FFC845" };
const LABEL_COLOR = { winner: "#3CF2A0", flop: "#FF4D5E", normal: "#8A93A0" } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function WheelIntake() {
  const { putScan } = useStore();
  const [phase, setPhase] = useState<"intake" | "leaving" | "stage">("intake");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [draft, setDraft] = useState("");
  const [scan, setScan] = useState<ScanView | null>(null);
  const [doc, setDoc] = useState<Doc>("scanning");
  const [ringPick, setRingPick] = useState(0);
  const [found, setFound] = useState(0);
  const [eqRing, setEqRing] = useState(0);
  const [stay, setStay] = useState(false);
  const wheel = useRef<WheelHandle>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<(() => void) | null>(null);
  const stayRef = useRef(false);
  stayRef.current = stay;

  // Ring = most recent 20 scored videos (repeated if the account has fewer).
  // Keyed on ids so live polling (new arrays every 2.5 s) doesn't restart the doctor.
  const postsKey = (scan?.posts ?? []).map((p) => p.id).join(",");
  const postsRef = useRef(scan?.posts ?? []);
  postsRef.current = scan?.posts ?? [];
  const ring: (ScoredPost | null)[] = useMemo(() => {
    const posts = [...postsRef.current].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, RING);
    if (!posts.length) return Array(RING).fill(null);
    return Array.from({ length: RING }, (_, i) => posts[i % posts.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postsKey]);
  const hasPosts = ring[0] !== null;
  const ringRef = useRef(ring);
  ringRef.current = ring;

  // Order the doctor visits: worst flop, best winner, next flop, hidden gem, …
  const visitOrder = useMemo(() => {
    if (!hasPosts) return [];
    const firstIdx = new Map<string, number>();
    ring.forEach((p, i) => p && !firstIdx.has(p.id) && firstIdx.set(p.id, i));
    const uniq = [...firstIdx.keys()].map((id) => ring[firstIdx.get(id)!]!);
    const flops = uniq.filter((p) => p.label === "flop").sort((a, b) => a.log2 - b.log2);
    const wins = uniq.filter((p) => p.label === "winner").sort((a, b) => b.log2 - a.log2);
    const gems = uniq.filter((p) => p.hiddenGem);
    const rest = uniq.filter((p) => p.label === "normal" && !p.hiddenGem);
    const order: ScoredPost[] = [];
    const push = (p?: ScoredPost) => p && !order.includes(p) && order.push(p);
    for (let k = 0; k < uniq.length; k++) {
      push(flops[k]); push(wins[k]); if (k === 0) push(gems[0]); push(gems[k + 1]); push(rest[k]);
    }
    return order.map((p) => firstIdx.get(p.id)!);
  }, [ring, hasPosts]);

  // Start / follow the scan.
  const [target, setTarget] = useState<{ platform: Platform; handle: string } | null>(null);
  useEffect(() => {
    if (!target) return;
    return runScan({
      ...target,
      onUpdate: (v) => {
        setScan(v);
        if (v.status === "done") putScan(v);
      },
    });
  }, [target, putScan]);

  const notFound = scan?.status === "error" || (scan?.status === "done" && scan.posts.length === 0);

  // The doctor loop.
  useEffect(() => {
    if (phase !== "stage" || !hasPosts || notFound) return;
    let cancelled = false;
    (async () => {
      setDoc("scanning");
      await sleep(1800);
      for (let k = 0; !cancelled; k++) {
        const order = visitOrder.length ? visitOrder : [0];
        const idx = order[k % order.length];
        setDoc("stopping");
        await wheel.current?.stopAt(idx);
        if (cancelled) return;
        wheel.current?.setFocus(true);
        setRingPick(idx);
        setFound(0);
        setDoc("diagnose");
        for (let f = 1; f <= 4; f++) {
          await sleep(f === 1 ? 500 : 600);
          if (cancelled) return;
          setFound(f);
        }
        await sleep(900);
        if (cancelled) return;
        setDoc("pull");
        setStay(false);
        await new Promise<void>((res) => {
          nextRef.current = res;
          const started = Date.now();
          const t = setInterval(() => {
            if (cancelled) { clearInterval(t); res(); return; }
            if (!stayRef.current && Date.now() - started > 11000) { clearInterval(t); res(); }
          }, 250);
        });
        nextRef.current = null;
        if (cancelled) return;
        wheel.current?.setFocus(false);
        wheel.current?.spin(7);
        setDoc("scanning");
        await sleep(2000);
      }
    })();
    return () => { cancelled = true; nextRef.current?.(); };
  }, [phase, hasPosts, notFound, visitOrder]);

  useEffect(() => {
    if (notFound && phase === "stage") {
      wheel.current?.setFocus(false);
      setDoc("notfound");
    }
  }, [notFound, phase]);

  const start = useCallback((handle: string, plat: Platform) => {
    setPlatform(plat);
    setScan(null);
    setDoc("scanning");
    setFound(0);
    setTarget({ platform: plat, handle });
    setPhase("leaving");
    setTimeout(() => {
      setPhase("stage");
      wheel.current?.spin(10);
    }, 480);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const h = cleanHandle(draft);
    if (!h) { inputRef.current?.focus(); return; }
    start(h, platform);
  };

  const reset = () => {
    setTarget(null);
    setScan(null);
    setPhase("intake");
    setDoc("scanning");
    wheel.current?.setFocus(false);
  };

  const onTick = useCallback(() => {
    const pe = pointer.current;
    if (!pe) return;
    pe.style.transition = "none";
    pe.style.transform = "rotate(-18deg)";
    requestAnimationFrame(() => {
      pe.style.transition = "transform 220ms cubic-bezier(.2,1.6,.4,1)";
      pe.style.transform = "rotate(0deg)";
    });
  }, []);

  const light = phase !== "stage";
  const pick = doc === "diagnose" || doc === "pull" ? ring[ringPick] : ring[eqRing];
  const done = scan?.status === "done" && !notFound;
  const shownHandle = scan?.handle ?? target?.handle ?? "";
  const stepIdx = SCAN_STEPS.findIndex((s) => s.key === scan?.step);
  const stepLabel = done ? "Diagnosis ready" : stepIdx >= 0 ? SCAN_STEPS[stepIdx].label : "Checking in";
  const progress = done ? 1 : Math.max(0.06, (stepIdx + 0.5) / SCAN_STEPS.length);
  const chartHref = `/d/${scan?.platform ?? platform}/${encodeURIComponent(shownHandle)}`;

  return (
    <div className="relative h-full min-h-[640px] w-full overflow-hidden font-sans transition-colors duration-[900ms]" style={{ background: light ? "#FFFFFF" : "#0B0D10" }}>
      {/* header */}
      <header className="absolute inset-x-0 top-0 z-[400] flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Logo className={light ? "text-bg" : "text-ink"} />
        {!light && (
          <>
            <div className="flex min-w-[220px] flex-col items-center gap-1.5">
              <span className="font-mono text-[13px] text-muted">@{shownHandle} · {platform === "tiktok" ? "TikTok" : "Instagram"} · last {RING} videos</span>
              <span className="h-1 w-56 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className="block h-full rounded-full bg-vital transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
              </span>
            </div>
            {done ? (
              <Link to={chartHref} className="inline-flex min-h-[44px] items-center rounded-xl bg-vital px-4 text-sm font-bold text-bg no-underline hover:text-bg">
                Diagnosis ready · see chart →
              </Link>
            ) : (
              <span role="status" className="rounded-full border border-line px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-accent">{stepLabel}</span>
            )}
          </>
        )}
      </header>

      {scan?.error === "demo" && !light && (
        <p className="absolute left-1/2 top-[84px] z-[400] -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-center text-[13px] text-muted">
          Demo mode — no live data connected, so this is sample patient <span className="font-mono text-ink">@{scan.handle}</span>
        </p>
      )}

      {/* intake */}
      {light && (
        <div
          className="absolute inset-0 z-[300] flex items-center justify-center px-4 transition-all duration-[450ms]"
          style={phase === "leaving" ? { opacity: 0, transform: "translateY(-14px) scale(.98)" } : { opacity: 1 }}
        >
          <form onSubmit={submit} className="flex w-full max-w-[600px] flex-col items-center gap-5">
            <div className="flex h-[72px] w-full items-center gap-2 rounded-full border-[1.5px] border-[#DADDE2] bg-white pl-[26px] pr-2 shadow-[0_10px_30px_rgba(11,13,16,0.08)] focus-within:border-bg focus-within:shadow-[0_0_0_4px_rgba(60,242,160,0.35)]">
              <span aria-hidden="true" className="font-mono text-[22px] text-normal">@</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Your TikTok or Instagram handle"
                placeholder="yourhandle"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className="h-[60px] min-w-0 flex-1 border-0 bg-transparent font-mono text-[22px] text-bg outline-none placeholder:text-[#9AA1AC] focus-visible:outline-none"
              />
              <button type="submit" className="flex h-14 flex-none cursor-pointer items-center gap-2.5 rounded-full border-0 bg-bg px-[26px] text-base font-bold text-white">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vital" />
                Run diagnosis
              </button>
            </div>
            <div role="group" aria-label="Platform" className="flex gap-1.5">
              {(["tiktok", "instagram"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={platform === p}
                  onClick={() => setPlatform(p)}
                  className={`min-h-[40px] cursor-pointer rounded-full border px-4 text-sm font-semibold ${platform === p ? "border-bg bg-bg text-white" : "border-[#DADDE2] bg-transparent text-normal"}`}
                >
                  {p === "tiktok" ? "TikTok" : "Instagram"}
                </button>
              ))}
            </div>
            <p className="m-0 flex flex-wrap items-center justify-center gap-2 text-sm text-normal">
              or try a sample patient:
              {SAMPLES.map((s) => (
                <button
                  key={s.handle}
                  type="button"
                  onClick={() => { setDraft(s.handle); start(s.handle, s.platform); }}
                  className="min-h-[36px] cursor-pointer rounded-full border border-[#DADDE2] bg-white px-3 font-mono text-[13px] text-bg hover:border-bg"
                >
                  @{s.handle}
                </button>
              ))}
            </p>
          </form>
        </div>
      )}

      {/* stage */}
      <div className="absolute inset-0 transition-opacity delay-150 duration-700" style={{ opacity: light ? 0 : 1 }} aria-hidden={light}>
        <ArcWheel
          ref={wheel}
          items={ring}
          onEquator={setEqRing}
          onTick={onTick}
          render={(g) => (
            <Overlays
              g={g}
              doc={doc}
              found={found}
              pick={pick}
              scan={scan}
              pointerRef={pointer}
              done={done}
              chartHref={chartHref}
              stepLabel={stepLabel}
              stay={stay}
              onStay={() => setStay(true)}
              onNext={() => nextRef.current?.()}
              onReset={reset}
              onSample={(h, p) => start(h, p)}
            />
          )}
        />
      </div>
    </div>
  );
}

interface OverlayProps {
  g: Geo;
  doc: Doc;
  found: number;
  pick: ScoredPost | null;
  scan: ScanView | null;
  pointerRef: RefObject<HTMLSpanElement>;
  done: boolean;
  chartHref: string;
  stepLabel: string;
  stay: boolean;
  onStay: () => void;
  onNext: () => void;
  onReset: () => void;
  onSample: (handle: string, p: Platform) => void;
}

function Overlays({ g, doc, found, pick, scan, pointerRef, done, chartHref, stepLabel, stay, onStay, onNext, onReset, onSample }: OverlayProps) {
  const fw = g.cardW * g.focusScale;
  const fh = g.cardH * g.focusScale;
  const frameRight = g.ex + fw / 2;
  const diag = doc === "diagnose" || doc === "pull";
  const findings = pick && scan?.baseline ? postFindings(pick, scan.baseline) : [];
  const color = pick ? LABEL_COLOR[pick.label] : "#3CF2A0";

  if (doc === "notfound") {
    return (
      <div className="absolute inset-0 z-[300] flex items-center justify-center bg-bg/80 px-4">
        <div className="flex max-w-[520px] flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center">
          <span className="font-mono text-[13px] tracking-wider text-flat">PATIENT NOT FOUND</span>
          <h2 className="m-0 text-2xl font-bold text-ink">@{scan?.handle} isn't in our records yet.</h2>
          <p className="m-0 text-[15px] leading-relaxed text-muted">
            {scan?.error && scan.error !== "demo" ? scan.error : "We only see public accounts that are already indexed. Check the spelling and platform, or try a sample patient."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SAMPLES.map((s) => (
              <button key={s.handle} type="button" onClick={() => onSample(s.handle, s.platform)} className="min-h-[44px] cursor-pointer rounded-full border border-line bg-bg px-4 font-mono text-sm text-ink">
                @{s.handle}
              </button>
            ))}
          </div>
          <button type="button" onClick={onReset} className="min-h-[44px] cursor-pointer rounded-xl border-0 bg-vital px-5 font-bold text-bg">Try another handle</button>
        </div>
      </div>
    );
  }

  const speech =
    doc === "scanning" ? (scan?.posts.length ? "let me look through these…" : "pulling your videos…")
    : doc === "stopping" ? "hold on…"
    : doc === "diagnose" && found < 4 ? "hold on — let me look at this one."
    : doc === "diagnose" ? (pick?.label === "flop" ? "found it. Here's why this one flopped." : pick?.label === "winner" ? "this one worked. Here's why." : pick?.hiddenGem ? "people loved this one. Not enough saw it." : "average. Close, though.")
    : "pulling the clip so you can watch it.";

  const infoLeft = frameRight + 96;
  const infoWidth = Math.max(260, Math.min(380, g.W - 380 - infoLeft));
  const embed = pick ? embedUrl(pick) : null;
  // Player fits short laptop screens too.
  const playerH = g.narrow ? 320 : Math.max(280, Math.min(480, g.H - 430));
  const playerW = Math.round((playerH * 9) / 16);
  const watch = pick ? watchUrl(pick) : null;

  return (
    <>
      {diag && (
        <div
          className="pointer-events-none absolute z-[200] rounded-[20px] border-2 shadow-[0_0_0_6px_rgba(11,13,16,0.6)]"
          style={{ left: g.ex - fw / 2, top: g.cy - fh / 2, width: fw, height: fh, borderColor: found >= 4 ? color : "#3CF2A0" }}
        >
          {doc === "diagnose" && found < 4 && (
            <div className="fd-scan absolute inset-x-0 h-[3px] bg-vital shadow-[0_0_18px_4px_rgba(60,242,160,0.55)]" />
          )}
          {found >= 4 && pick && (
            <span className="fd-stamp absolute -right-7 -top-5 whitespace-nowrap rounded-[10px] border-[3px] bg-bg px-3.5 py-2 font-mono text-xl font-bold tracking-wide" style={{ borderColor: color, color }}>
              {pick.hiddenGem ? "HIDDEN GEM" : pick.label.toUpperCase()} {fmtRatio(pick.ratio)}
            </span>
          )}
        </div>
      )}

      <div className="absolute z-[210] flex items-center gap-0.5" style={{ left: frameRight + 14, top: g.cy - 28 }}>
        <span
          ref={pointerRef}
          aria-hidden="true"
          className="h-0 w-0 border-y-[10px] border-r-[14px] border-y-transparent border-r-vital"
          style={{ transformOrigin: "100% 50%" }}
        />
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-vital bg-surface" title="Dr. Flop">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3CF2A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M10 12v3a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="12" r="2" />
          </svg>
        </span>
      </div>

      <div
        className={g.narrow ? "absolute inset-x-4 bottom-4 z-[210] flex flex-col gap-1.5 rounded-2xl border border-line bg-bg/95 p-4" : "absolute z-[210] flex flex-col gap-1.5"}
        style={g.narrow ? undefined : { left: infoLeft, top: g.cy - 150, width: infoWidth }}
      >
        <span role="status" className="font-mono text-[13px] tracking-wide text-vital">Dr. Flop: {speech}</span>
        {pick ? (
          <>
            <span className={`${g.narrow ? "text-xl" : "text-[26px]"} font-extrabold leading-tight tracking-tight text-ink`}>{pick.caption}</span>
            <span className="font-mono text-[13px] text-muted">{fmtK(pick.views)} views · {fmtDur(pick.durationSec)} · {new Date(pick.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </>
        ) : (
          <span className={`${g.narrow ? "text-xl" : "text-[26px]"} font-extrabold leading-tight tracking-tight text-muted`}>{stepLabel}…</span>
        )}
        {diag && (
          <ul className="m-0 mt-2 flex list-none flex-col gap-2.5 p-0">
            {findings.slice(0, Math.min(found, 3)).map((f, i) => (
              <li key={i} className={`fd-up flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 ${g.narrow ? "py-2" : "py-3"}`}>
                <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full" style={{ background: TONE[f.tone] }} />
                <span className={`${g.narrow ? "text-sm" : "text-[15px]"} leading-snug text-ink`}>{f.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {doc === "pull" && pick && (
        <aside
          aria-label="Pulled video"
          className={g.narrow ? "fd-pull absolute inset-x-0 bottom-0 top-[156px] z-[220] flex flex-col gap-3 overflow-y-auto border-t border-line bg-bg px-4 pb-4 pt-3" : "fd-pull absolute z-[220] flex w-[300px] flex-col gap-3.5"}
          style={g.narrow ? undefined : { left: g.W - 364, top: 84 }}
        >
          <span className="font-mono text-xs tracking-[0.12em] text-muted">PULLED FROM {pick.platform === "tiktok" ? "TIKTOK" : "INSTAGRAM"}</span>
          <div className="relative overflow-hidden rounded-[18px] shadow-[0_24px_60px_rgba(0,0,0,0.6)]" style={{ width: g.narrow ? 180 : playerW, height: playerH }}>
            {embed ? (
              <iframe src={embed} title={`Video: ${pick.caption}`} className="h-full w-full border-0" allow="encrypted-media; picture-in-picture" />
            ) : (
              <>
                <Thumb post={pick} showText={false} rounded={18} />
                <span className="absolute left-3.5 top-3.5 rounded-md bg-black/45 px-2 py-0.5 font-mono text-xs text-white">0:00 / {fmtDur(pick.durationSec)}</span>
                <span className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50">
                  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="#FFFFFF" /></svg>
                </span>
                <span className="absolute inset-x-0 bottom-0 h-[30%] bg-black/45" />
                <span className="absolute bottom-6 left-3.5 right-3.5 text-[15px] font-bold leading-tight text-white">{pick.caption}</span>
                <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25"><span className="fd-prog block h-1 bg-white" /></span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">First words spoken</span>
            <span className="text-[15px] leading-snug text-ink">“{pick.hook || "(no speech)"}”</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-3" style={{ borderLeft: `3px solid ${color}` }}>
            <span className="font-mono text-[11px] tracking-[0.12em] text-muted">RX</span>
            <span className="text-sm leading-snug text-ink">{rxLine(pick)}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={onNext} className="min-h-[44px] cursor-pointer rounded-[10px] border border-line2 bg-transparent px-4 text-sm font-semibold text-ink">Next video</button>
            {!stay && (
              <button type="button" onClick={onStay} className="min-h-[44px] cursor-pointer rounded-[10px] border border-line bg-transparent px-4 text-sm font-semibold text-muted">Stay on this one</button>
            )}
            {done ? (
              <Link to={chartHref} className="inline-flex min-h-[44px] items-center rounded-[10px] bg-vital px-4 text-sm font-bold text-bg no-underline hover:text-bg">Full chart →</Link>
            ) : (
              <span className="inline-flex min-h-[44px] items-center px-1 text-[13px] text-muted">Full chart: {stepLabel.toLowerCase()}…</span>
            )}
            {watch && (
              <a href={watch} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center px-1 text-[13px]">Open original ↗</a>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
