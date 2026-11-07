import { useState } from "react";
import { fmtK, fmtRatio } from "../../supabase/functions/_shared/findings.ts";
import type { ScoredPost } from "../../supabase/functions/_shared/types.ts";

const TOP = 2.5; // log2 range shown
const BOTTOM = -2.25;
const COLOR = { winner: "#3CF2A0", normal: "#5B6573", flop: "#FF4D5E" } as const;
const pct = (v: number) => ((TOP - Math.max(BOTTOM, Math.min(TOP, v))) / (TOP - BOTTOM)) * 100;

/** Each dot is one video vs. the creator's own median (the flatline). */
export function VitalsChart({ posts, onPick, height = 380 }: { posts: ScoredPost[]; onPick?: (p: ScoredPost) => void; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = posts.length;
  const xs = posts.map((_, i) => 2 + (n > 1 ? (i / (n - 1)) * 96 : 48));
  const line = posts.map((p, i) => `${(xs[i] * 10).toFixed(1)},${pct(p.log2).toFixed(1)}`).join(" ");
  const grid = [
    { v: 2, label: "4×" },
    { v: 1, label: "2×" },
    { v: 0, label: "1×" },
    { v: -1, label: "0.5×" },
    { v: -2, label: "0.25×" },
  ];
  const hp = hover === null ? null : posts[hover];

  return (
    <div className="flex gap-3">
      <div aria-hidden="true" className="relative w-11 flex-none font-mono text-xs text-muted" style={{ height }}>
        {grid.map((g) => (
          <span key={g.v} className={`absolute right-0 -translate-y-1/2 ${g.v === 0 ? "text-ink" : ""}`} style={{ top: `${pct(g.v)}%` }}>{g.label}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1" style={{ height }}>
        {grid.map((g) => (
          <div key={g.v} aria-hidden="true" className={`absolute inset-x-0 ${g.v === 0 ? "border-t-2 border-solid border-line2" : "border-t border-dashed border-line"}`} style={{ top: `${pct(g.v)}%` }} />
        ))}
        <span aria-hidden="true" className="absolute right-0 font-mono text-[11px] tracking-wider text-muted" style={{ top: `calc(${pct(0)}% + 6px)` }}>FLATLINE · YOUR MEDIAN</span>
        <svg aria-hidden="true" viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <polyline points={line} fill="none" stroke="#3CF2A0" strokeOpacity="0.35" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {posts.map((p, i) => {
          const on = hover === i;
          const size = on ? 18 : 12;
          return (
            <button
              key={p.id}
              type="button"
              aria-label={`${p.caption}: ${fmtK(p.views)} views, ${fmtRatio(p.ratio)} your median`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onClick={() => onPick?.(p)}
              className="absolute z-[2] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
              style={{ left: `${xs[i]}%`, top: `${pct(p.log2)}%` }}
            >
              <span
                className="rounded-full transition-all duration-100"
                style={{
                  width: size,
                  height: size,
                  background: COLOR[p.label],
                  boxShadow: p.hiddenGem ? "0 0 0 3px #0B0D10, 0 0 0 5px #FFC845" : "0 0 0 3px #14171C",
                }}
              />
            </button>
          );
        })}
        {hp && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-[3] flex w-[240px] flex-col gap-1.5 rounded-xl border border-line2 bg-raised px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            style={{
              left: `${Math.min(Math.max(xs[hover], 12), 88)}%`,
              top: `${pct(hp.log2)}%`,
              transform: `translate(-50%, ${pct(hp.log2) < 35 ? "24px" : "calc(-100% - 20px)"})`,
            }}
          >
            <span className="font-mono text-xs text-muted">{new Date(hp.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{hp.hiddenGem ? " · hidden gem" : ""}</span>
            <span className="text-sm font-semibold leading-snug text-ink">{hp.caption}</span>
            <span className="font-mono text-[13px] text-ink">
              <span className="font-bold" style={{ color: hp.label === "normal" ? "#E8EAED" : COLOR[hp.label] }}>{fmtRatio(hp.ratio)}</span> · {fmtK(hp.views)} views
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
