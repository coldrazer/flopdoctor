import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" stroke="currentColor" strokeWidth="2" />
      <polyline points="5,17 11,17 13,11 16,23 19,8 21,17 27,17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 no-underline transition-colors duration-700 ${className}`}>
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight">Flop Doctor</span>
    </Link>
  );
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Logo className="text-ink" />
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </header>
  );
}

export function FlameIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c.6 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 .9-3.4 2-4.3.2 1.6 1 2.6 2 2.8-.6-3 .1-5.8.5-8z" />
    </svg>
  );
}
