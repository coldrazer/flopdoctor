// The arc wheel: cards ride the rim of a big wheel whose hub sits off the left edge,
// so you see a gentle arc. The card on the "equator" lies flat. Motion runs in a rAF
// loop that writes transforms straight to the DOM (no React re-render per frame).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { Post } from "../../supabase/functions/_shared/types.ts";
import { Thumb } from "./Thumb.tsx";

export interface Geo {
  W: number;
  H: number;
  narrow: boolean;
  ex: number; // equator x (card center)
  cy: number; // equator y
  R: number;
  cardW: number;
  cardH: number;
  focusScale: number;
}

export interface WheelHandle {
  spin: (vStart?: number) => void;
  /** Decelerates smoothly and lands `ringIndex` on the equator. */
  stopAt: (ringIndex: number) => Promise<void>;
  setFocus: (on: boolean) => void;
}

interface Props {
  items: (Post | null)[]; // ring slots (≥14 so the wrap point stays off screen)
  onEquator?: (ringIndex: number) => void;
  onTick?: () => void;
  render?: (g: Geo) => ReactNode; // overlays positioned from the same geometry
}

const STEP_DEG = 14;
const CARD_W = 180;
const CARD_H = 320;
const FOCUS = 1.22;
const CRUISE = 2.6; // cards / second

export function geometry(W: number, H: number): Geo {
  const narrow = W < 1100;
  const small = W < 640; // phones: smaller cards so the header and info panel never cover them
  const cardW = small ? 124 : CARD_W;
  const cardH = small ? 220 : CARD_H;
  const ex = narrow ? Math.max(cardW * 0.8, W * 0.36) : W * 0.27;
  const cy = small ? Math.min(H * 0.38, 320) : narrow ? Math.min(H * 0.4, 360) : H / 2;
  return { W, H, narrow, ex, cy, R: small ? 720 : 1000, cardW, cardH, focusScale: FOCUS };
}

export const ArcWheel = forwardRef<WheelHandle, Props>(function ArcWheel({ items, onEquator, onTick, render }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const [size, setSize] = useState({ W: 1440, H: 900 });
  const s = useRef({
    offset: 0,
    v: 0.25,
    mode: "idle" as "idle" | "spin" | "stop" | "hold",
    spinStart: 0,
    vStart: 8,
    o0: 0,
    d: 0,
    T: 1,
    t0: 0,
    resolve: null as null | (() => void),
    fs: 1,
    dim: 0,
    focus: false,
    eq: -1,
  });
  const cb = useRef({ onEquator, onTick });
  cb.current = { onEquator, onTick };
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const N = items.length;
  const nRef = useRef(N);
  nRef.current = N;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ W: Math.round(r.width), H: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    spin(vStart = 8) {
      const st = s.current;
      if (st.resolve) { st.resolve(); st.resolve = null; }
      st.mode = "spin";
      st.spinStart = performance.now();
      st.vStart = vStart;
      st.v = vStart;
      st.focus = false;
    },
    stopAt(target) {
      const st = s.current;
      const n = nRef.current;
      const v = Math.max(st.v, 1.5);
      let t = Math.ceil(st.offset + (v * 1.8) / 3);
      while (((t % n) + n) % n !== ((target % n) + n) % n) t++;
      st.o0 = st.offset;
      st.d = t - st.offset;
      st.T = Math.min(4.2, Math.max(1.4, (3 * st.d) / v));
      st.t0 = performance.now();
      st.mode = "stop";
      return new Promise<void>((res) => { st.resolve = res; });
    },
    setFocus(on) {
      s.current.focus = on;
    },
  }), []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frame = (now: number) => {
      const st = s.current;
      const n = nRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (st.mode === "spin") {
        const k = Math.max(0, 1 - (now - st.spinStart) / 1400);
        st.v = CRUISE + (st.vStart - CRUISE) * k * k;
        st.offset += st.v * dt * (reduce ? 0.4 : 1);
      } else if (st.mode === "stop") {
        const p = Math.min(1, (now - st.t0) / 1000 / st.T);
        st.offset = st.o0 + st.d * (1 - Math.pow(1 - p, 3));
        if (p >= 1) {
          st.offset = st.o0 + st.d;
          st.mode = "hold";
          st.v = 0;
          const r = st.resolve;
          st.resolve = null;
          r?.();
        }
      } else if (st.mode === "idle") {
        st.offset += st.v * dt;
      }
      st.fs += ((st.focus ? FOCUS : 1) - st.fs) * Math.min(1, dt * 8);
      st.dim += ((st.focus ? 1 : 0) - st.dim) * Math.min(1, dt * 6);

      const g = geometry(sizeRef.current.W, sizeRef.current.H);
      const cx = g.ex - g.R;
      const eq = ((Math.round(st.offset) % n) + n) % n;
      for (let i = 0; i < n; i++) {
        const el = cardEls.current[i];
        if (!el) continue;
        let rel = (((i - st.offset) % n) + n) % n;
        if (rel > n / 2) rel -= n;
        const th = rel * STEP_DEG;
        const a = (th * Math.PI) / 180;
        const at = Math.abs(th);
        const x = cx + g.R * Math.cos(a);
        const y = g.cy + g.R * Math.sin(a);
        const isEq = i === eq && Math.abs(rel) < 0.5;
        const sc = (1 - Math.min(at / 45, 1) * 0.28) * (isEq ? st.fs : 1);
        let op = Math.max(0, Math.min(1, (75 - at) / 20));
        if (!isEq) op *= 1 - 0.65 * st.dim;
        el.style.transform = `translate(${(x - g.cardW / 2).toFixed(1)}px,${(y - g.cardH / 2).toFixed(1)}px) rotate(${th.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(isEq ? 150 : 100 - Math.round(Math.abs(rel) * 4));
      }
      if (eq !== st.eq) {
        st.eq = eq;
        cb.current.onEquator?.(eq);
        if (st.mode === "spin" || st.mode === "stop") cb.current.onTick?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const g = geometry(size.W, size.H);
  return (
    <div ref={rootRef} className="absolute inset-0">
      {items.map((p, i) => (
        <div
          key={i}
          ref={(el) => { cardEls.current[i] = el; }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ width: g.cardW, height: g.cardH, opacity: 0, transformOrigin: "50% 50%" }}
          aria-hidden="true"
        >
          <Thumb post={p} />
        </div>
      ))}
      {render?.(g)}
    </div>
  );
});
