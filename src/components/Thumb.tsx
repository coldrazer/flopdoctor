import { fmtK } from "../../supabase/functions/_shared/findings.ts";
import type { Post } from "../../supabase/functions/_shared/types.ts";

const TINTS = ["#9A3412", "#0F766E", "#B45309", "#1D4ED8", "#7C2D12", "#4D7C0F", "#155E75", "#A16207", "#3F6212", "#B91C1C"];

export function tintFor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** A video "screen grab": the real thumbnail when we have one, otherwise a drawn stand-in
 *  (person in frame when the face shows up early, B-roll + text overlay when it doesn't). */
export function Thumb({ post, showText = true, rounded = 16 }: { post: Post | null; showText?: boolean; rounded?: number }) {
  if (!post) {
    return <div className="h-full w-full animate-pulse bg-raised" style={{ borderRadius: rounded }} aria-hidden="true" />;
  }
  const face = post.faceAtSec === undefined ? true : post.faceAtSec <= 1.5;
  return (
    <div
      className="relative h-full w-full overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      style={{ borderRadius: rounded, background: tintFor(post.id) }}
    >
      {post.thumbnailUrl ? (
        <img src={post.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" crossOrigin="anonymous" loading="lazy" />
      ) : face ? (
        <>
          <span className="absolute left-1/2 top-[16%] h-[21%] w-[37%] -translate-x-1/2 rounded-full bg-white/80" />
          <span className="absolute left-1/2 top-[38%] h-[25%] w-[69%] -translate-x-1/2 rounded-t-full bg-white/80" />
        </>
      ) : (
        <>
          <span className="absolute left-[15%] top-[10%] h-[4.5%] w-[70%] rounded bg-black/35" />
          <span className="absolute left-1/2 top-[26%] aspect-square w-[66%] -translate-x-1/2 rounded-full border-[10px] border-white/40 bg-white/15" />
        </>
      )}
      <span className="absolute right-2.5 top-[46%] flex flex-col gap-3" aria-hidden="true">
        <span className="h-5 w-5 rounded-full bg-white/55" />
        <span className="h-5 w-5 rounded-full bg-white/55" />
        <span className="h-5 w-5 rounded-full bg-white/55" />
      </span>
      {showText && (
        <>
          <span className="absolute inset-x-0 bottom-0 h-[34%] bg-black/45" />
          <span className="absolute bottom-[34px] left-3 right-10 line-clamp-3 text-[13px] font-bold leading-tight text-white">{post.caption}</span>
          <span className="absolute bottom-3 left-3 font-mono text-[11px] text-white">▶ {fmtK(post.views)}</span>
        </>
      )}
    </div>
  );
}
