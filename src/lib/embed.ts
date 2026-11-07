import type { Post } from "../../supabase/functions/_shared/types.ts";

/** Builds an official embed URL so the "pulled" video actually plays.
 *  Uses postUrl when present, else the id inside Oriane's thumbnail path
 *  (…/tiktok/<videoId>/thumbnail.webp, …/instagram/<shortcode>/thumbnail.webp). */
export function embedUrl(p: Post): string | null {
  const src = `${p.postUrl ?? ""} ${p.thumbnailUrl ?? ""}`;
  if (p.platform === "tiktok") {
    const m = src.match(/\/video\/(\d{8,})/) ?? src.match(/\/tiktok\/(\d{8,})\//);
    return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null;
  }
  const m = src.match(/\/(?:reel|p)\/([A-Za-z0-9_-]{5,})/) ?? src.match(/\/instagram\/([A-Za-z0-9_-]{5,})\//);
  return m ? `https://www.instagram.com/reel/${m[1]}/embed` : null;
}

export function watchUrl(p: Post): string | null {
  if (p.postUrl) return p.postUrl;
  const e = embedUrl(p);
  if (!e) return null;
  if (p.platform === "tiktok") return `https://www.tiktok.com/@${p.handle}/video/${e.split("/").pop()}`;
  return e.replace(/\/embed$/, "/");
}
