import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fmtDur, fmtK, fmtRatio } from "../../supabase/functions/_shared/findings.ts";
import type { Platform, ScoredPost } from "../../supabase/functions/_shared/types.ts";
import { FlameIcon, TopBar } from "../components/Logo.tsx";
import { Thumb } from "../components/Thumb.tsx";
import { VitalsChart } from "../components/VitalsChart.tsx";
import { watchUrl } from "../lib/embed.ts";
import { useStore } from "../lib/store.tsx";
import { Missing, RoastToggle, SampleTag } from "./common.tsx";

const LABEL = { winner: "#3CF2A0", flop: "#FF4D5E", normal: "#8A93A0" } as const;

export default function Diagnosis() {
  const { platform, handle } = useParams<{ platform: Platform; handle: string }>();
  const { getScan, roast } = useStore();
  const scan = getScan(platform as Platform, handle ?? "");
  const [tab, setTab] = useState<"winners" | "flops">("winners");
  const [flash, setFlash] = useState<string | null>(null);

  const byId = useMemo(() => new Map((scan?.posts ?? []).map((p) => [p.id, p])), [scan?.posts]);
  if (!scan || !scan.baseline || !scan.creator) return <Missing handle={handle} />;

  const b = scan.baseline;
  const c = scan.creator;
  const dx = (roast ? scan.roastDiagnosis : undefined) ?? scan.diagnosis;
  const winners = b.winnerIds.map((id) => byId.get(id)!).filter(Boolean);
  const flops = b.flopIds.map((id) => byId.get(id)!).filter(Boolean);
  const accent = roast ? "#FFC845" : "#3CF2A0";
  const range = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const base = `/${scan.platform}/${encodeURIComponent(scan.handle)}`;

  const jumpTo = (p: ScoredPost) => {
    if (p.label === "winner") setTab("winners");
    if (p.label === "flop") setTab("flops");
    setFlash(p.id);
    setTimeout(() => document.getElementById(`clip-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setTimeout(() => setFlash(null), 1800);
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar>
        <RoastToggle />
        <Link to="/" className="inline-flex min-h-[44px] items-center rounded-[10px] border border-line px-4 text-sm font-semibold text-ink no-underline hover:text-ink">New diagnosis</Link>
      </TopBar>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pb-20 pt-8">
        <section aria-label="Patient" className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] border border-line bg-surface px-6 py-5">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1E3A2F] text-lg font-bold text-vital">
              {c.displayName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 font-mono text-2xl font-bold">@{c.handle}</h1>
                {scan.source === "fixture" && <SampleTag />}
              </div>
              <span className="text-sm text-muted">{c.displayName} · {c.platform === "tiktok" ? "TikTok" : "Instagram"}{scan.niche ? ` · ${scan.niche.label}` : ""}</span>
            </div>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-x-9 gap-y-2 sm:grid-cols-4">
            {[
              ["Followers", fmtK(c.followers)],
              ["Baseline", `${fmtK(b.medianViews)}`, "views/video"],
              ["Analyzed", `${b.postsAnalyzed} videos`],
              ["Window", `${range(b.dateRange[0])} – ${range(b.dateRange[1])}`],
            ].map(([k, v, unit]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="m-0 font-mono text-xl font-bold">{v} {unit && <span className="text-[13px] font-normal text-muted">{unit}</span>}</dd>
              </div>
            ))}
          </dl>
        </section>

        {dx && (
          <section aria-labelledby="verdict" className="flex flex-col gap-3 py-2">
            <span id="verdict" className="font-mono text-[13px] tracking-[0.14em]" style={{ color: accent }}>{roast ? "THE ROAST" : "THE VERDICT"}</span>
            <p className="m-0 max-w-[980px] text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.12] tracking-[-0.03em]">{dx.verdict}</p>
          </section>
        )}

        <section aria-labelledby="vitals-h" className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="vitals-h" className="m-0 text-xl font-bold">Vitals</h2>
              <span className="text-sm text-muted">Each dot is a video, measured against your own median. Hover for details, click to see the clip.</span>
            </div>
            <div className="flex flex-wrap gap-4 text-[13px] text-muted">
              <Legend color="#3CF2A0" label="Winner ≥1.75×" />
              <Legend color="#5B6573" label="Normal" />
              <Legend color="#FF4D5E" label="Flop ≤0.57×" />
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-accent" />Hidden gem</span>
            </div>
          </div>
          <VitalsChart posts={scan.posts} onPick={jumpTo} />
          {b.hiddenGemIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#3A3218] bg-[#1A1810] px-4 py-3.5">
              <span className="font-mono text-xs font-bold tracking-wider text-accent">{b.hiddenGemIds.length} HIDDEN GEM{b.hiddenGemIds.length > 1 ? "S" : ""}</span>
              <span className="text-sm text-ink">Low views, but unusually high engagement. That's a distribution problem, not a content problem — repost these with a new hook.</span>
            </div>
          )}
        </section>

        {dx && (
          <section aria-labelledby="patterns-h" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="patterns-h" className="m-0 text-[28px] font-bold tracking-tight">What your winners do that your flops don't</h2>
              <span className="text-sm text-muted">Every finding cites your own clips</span>
            </div>
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))" }}>
              {dx.patterns.map((p, i) => (
                <article key={i} className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-baseline gap-3.5">
                      <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="m-0 text-[22px] font-bold leading-tight tracking-tight">{p.title}</h3>
                    </div>
                    <span className={`flex-none rounded-md border px-2 py-1 font-mono text-[11px] font-bold tracking-wider ${p.confidence === "high" ? "border-[#1E3A2F] bg-[#0F1A15] text-vital" : "border-[#3A3218] bg-[#1A1810] text-accent"}`}>
                      {p.confidence.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 rounded-xl border border-[#1E3A2F] bg-[#0F1A15] p-3.5">
                      <span className="font-mono text-[11px] tracking-[0.1em] text-vital">YOUR WINNERS</span>
                      <span className="text-[15px] leading-normal">{p.winnersDo}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 rounded-xl border border-[#3A1A1F] bg-[#1C1113] p-3.5">
                      <span className="font-mono text-[11px] tracking-[0.1em] text-flat">YOUR FLOPS</span>
                      <span className="text-[15px] leading-normal">{p.flopsDo}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted">Evidence</span>
                    <div className="flex flex-wrap gap-2">
                      {p.evidence.map((e) => {
                        const post = byId.get(e.postId);
                        if (!post) return null; // never show a citation we can't back up
                        const col = LABEL[post.label];
                        return (
                          <button key={e.postId + e.observation} type="button" onClick={() => jumpTo(post)} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-bg py-1.5 pl-1.5 pr-3 text-left text-ink">
                            <span aria-hidden="true" className="h-8 w-5 flex-none overflow-hidden rounded border-2" style={{ borderColor: col }}><Thumb post={post} showText={false} rounded={2} /></span>
                            <span className="font-mono text-[13px] font-bold" style={{ color: col }}>{fmtRatio(post.ratio)}</span>
                            <span className="text-[13px]">{e.observation}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="clips-h" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="clips-h" className="m-0 text-[28px] font-bold tracking-tight">The clips</h2>
            <div role="tablist" aria-label="Winners or flops" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
              {(["winners", "flops"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] cursor-pointer rounded-lg border-0 px-[18px] text-sm font-semibold ${tab === t ? "bg-line text-ink" : "bg-transparent text-muted"}`}>
                  {t === "winners" ? `Winners · ${winners.length}` : `Flops · ${flops.length}`}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel" className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
            {(tab === "winners" ? winners : flops).map((p) => {
              const col = LABEL[p.label];
              const href = watchUrl(p);
              const body = (
                <>
                  <div className="relative aspect-[9/16] rounded-[14px] border-2 transition-shadow" style={{ borderColor: col, boxShadow: flash === p.id ? `0 0 0 4px ${col}` : "none" }}>
                    <Thumb post={p} showText={false} rounded={12} />
                    <span className="absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 font-mono text-sm font-bold text-bg" style={{ background: col }}>{fmtRatio(p.ratio)}</span>
                    <span className="absolute bottom-2.5 right-2.5 rounded-md bg-bg/80 px-1.5 py-0.5 font-mono text-xs text-ink">{fmtDur(p.durationSec)}</span>
                  </div>
                  <span className="text-sm font-medium leading-snug">{p.caption}</span>
                  <span className="font-mono text-[13px] text-muted">{fmtK(p.views)} views</span>
                </>
              );
              return href ? (
                <a key={p.id} id={`clip-${p.id}`} href={href} target="_blank" rel="noreferrer" className="flex flex-col gap-2.5 text-ink no-underline hover:text-ink">{body}</a>
              ) : (
                <div key={p.id} id={`clip-${p.id}`} className="flex flex-col gap-2.5">{body}</div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] border border-line bg-surface p-7">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-2xl font-bold">Your prescription is ready</h2>
            <span className="text-[15px] text-muted">3 videos to post this week, hooks written in your voice.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`/share${base}`} className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border border-line2 px-5 font-semibold text-ink no-underline hover:text-ink">
              {roast && <FlameIcon />} Make share card
            </Link>
            <Link to={`/rx${base}`} className="inline-flex min-h-[52px] items-center rounded-xl bg-vital px-6 font-bold text-bg no-underline hover:text-bg">See your Rx →</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
