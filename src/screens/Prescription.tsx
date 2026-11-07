import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fmtK, fmtRatio } from "../../supabase/functions/_shared/findings.ts";
import type { Platform, Post, Rx, ScoredPost } from "../../supabase/functions/_shared/types.ts";
import { TopBar } from "../components/Logo.tsx";
import { Thumb } from "../components/Thumb.tsx";
import { watchUrl } from "../lib/embed.ts";
import { useStore } from "../lib/store.tsx";
import { Missing, SampleTag } from "./common.tsx";

function shotList(rx: Rx[]): string {
  return rx
    .map((r, i) => `Rx #${i + 1} — ${r.title} (${r.format})\nHOOK: ${r.hook}\n${r.beats.map((b) => `${b.t}  ${b.text}`).join("\n")}`)
    .join("\n\n");
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export default function Prescription() {
  const { platform, handle } = useParams<{ platform: Platform; handle: string }>();
  const { getScan } = useStore();
  const scan = getScan(platform as Platform, handle ?? "");
  const [copied, setCopied] = useState<string | null>(null);
  if (!scan || !scan.prescriptions?.length) return <Missing handle={handle} />;

  const own = new Map<string, ScoredPost>(scan.posts.map((p) => [p.id, p]));
  const trend = new Map<string, Post>((scan.trending ?? []).map((p) => [p.id, p]));
  const base = `/${scan.platform}/${encodeURIComponent(scan.handle)}`;
  const flash = (key: string, text: string) => {
    copy(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar>
        <Link to={`/d${base}`} className="inline-flex min-h-[44px] items-center rounded-[10px] border border-line px-4 text-sm font-semibold text-ink no-underline hover:text-ink">← Back to chart</Link>
      </TopBar>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-9 px-6 pb-20 pt-10">
        <section className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex max-w-[760px] flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[13px] tracking-[0.14em] text-vital">PRESCRIPTION · @{scan.handle}</span>
              {scan.source === "fixture" && <SampleTag />}
            </div>
            <h1 className="m-0 text-[clamp(36px,5vw,52px)] font-extrabold leading-[1.05] tracking-[-0.03em]">Three videos to post this week</h1>
            <p className="m-0 text-lg leading-normal text-muted">
              Built from what your winners already do{scan.niche ? `, plus what's working in ${scan.niche.label} right now` : ""}. Hooks are written in your voice, from your own best openers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => flash("all", shotList(scan.prescriptions!))}
            className={`inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-xl border px-5 text-[15px] font-bold ${copied === "all" ? "border-[#1E3A2F] bg-[#1E3A2F] text-vital" : "border-vital bg-vital text-bg"}`}
          >
            {copied === "all" ? "Shot list copied ✓" : "Copy all as shot list"}
          </button>
        </section>

        <section aria-label="Prescriptions" className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
          {scan.prescriptions.map((r, i) => {
            const proofs = r.proofPostIds
              .map((id) => {
                const mine = own.get(id);
                if (mine) return { post: mine as Post, meta: `${fmtK(mine.views)} views · ${fmtRatio(mine.ratio)} your median`, tint: mine.label === "flop" ? "#FF4D5E" : "#3CF2A0", mine: true };
                const t = trend.get(id);
                if (t) return { post: t, meta: `@${t.handle} · ${fmtK(t.views)} views · ${t.erViews.toFixed(1)}% ER`, tint: "#FFC845", mine: false };
                return null;
              })
              .filter((x): x is NonNullable<typeof x> => x !== null);
            return (
              <article key={i} className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-vital">Rx #{i + 1}</span>
                  <span className="rounded-full bg-line px-3 py-1 text-xs font-semibold">{r.format}</span>
                </div>
                <h2 className="m-0 text-2xl font-bold leading-tight tracking-tight">{r.title}</h2>
                <div className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-bg p-[18px]">
                  <span className="font-mono text-[11px] tracking-[0.12em] text-muted">HOOK · FIRST LINE, ON CAMERA</span>
                  <p className="m-0 text-[22px] font-bold leading-[1.3]">“{r.hook}”</p>
                  <button
                    type="button"
                    aria-label={`Copy hook for ${r.title}`}
                    onClick={() => flash(`h${i}`, r.hook)}
                    className={`min-h-[40px] cursor-pointer self-start rounded-lg border px-3.5 text-[13px] font-semibold ${copied === `h${i}` ? "border-[#1E3A2F] bg-[#1E3A2F] text-vital" : "border-line2 bg-transparent text-ink"}`}
                  >
                    {copied === `h${i}` ? "Copied ✓" : "Copy hook"}
                  </button>
                </div>
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs text-muted">Beats</span>
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {r.beats.map((b, j) => (
                      <li key={j} className="flex gap-3 text-[15px] leading-snug">
                        <span className="w-11 flex-none pt-px font-mono text-[13px] text-vital">{b.t}</span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-col gap-2.5 border-t border-line pt-4">
                  <span className="text-xs text-muted">Why this works</span>
                  <p className="m-0 text-[15px] leading-normal">{r.why}</p>
                  {r.patternRef && (
                    <Link to={`/d${base}`} className="inline-flex min-h-[32px] items-center self-start rounded-lg border border-[#1E3A2F] bg-[#0F1A15] px-2.5 text-[13px] font-semibold text-vital no-underline">{r.patternRef}</Link>
                  )}
                </div>
                {proofs.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs text-muted">Proof</span>
                    {proofs.map(({ post, meta, tint }) => {
                      const href = watchUrl(post);
                      const inner = (
                        <>
                          <span aria-hidden="true" className="h-10 w-6 flex-none overflow-hidden rounded-[5px] border-2" style={{ borderColor: tint }}><Thumb post={post} showText={false} rounded={2} /></span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-[13px] font-semibold">{post.caption}</span>
                            <span className="font-mono text-xs text-muted">{meta}</span>
                          </span>
                        </>
                      );
                      const cls = "flex min-h-[52px] items-center gap-3 rounded-[10px] border border-line bg-bg py-1.5 pl-1.5 pr-3 text-ink no-underline hover:text-ink";
                      return href ? <a key={post.id} href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a> : <div key={post.id} className={cls}>{inner}</div>;
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] border border-line bg-surface p-7">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-2xl font-bold">Show your chart</h2>
            <span className="text-[15px] text-muted">A 1080×1350 card with your vitals, verdict and Rx #1 — ready for your story.</span>
          </div>
          <Link to={`/share${base}`} className="inline-flex min-h-[52px] items-center rounded-xl bg-vital px-6 font-bold text-bg no-underline hover:text-bg">Make share card →</Link>
        </section>
      </main>
    </div>
  );
}
