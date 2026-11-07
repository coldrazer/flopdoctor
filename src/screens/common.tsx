import { Link } from "react-router-dom";
import { FlameIcon } from "../components/Logo.tsx";
import { useStore } from "../lib/store.tsx";

export function RoastToggle() {
  const { roast, setRoast } = useStore();
  return (
    <button
      type="button"
      aria-pressed={roast}
      onClick={() => setRoast(!roast)}
      className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[10px] border px-4 text-sm font-semibold ${roast ? "border-accent bg-accent text-bg" : "border-[#3A3218] bg-transparent text-accent"}`}
    >
      <FlameIcon />
      {roast ? "Roast mode on" : "Roast mode"}
    </button>
  );
}

export function SampleTag() {
  return <span className="rounded-md border border-line2 px-2 py-0.5 font-mono text-[11px] tracking-wider text-muted">SAMPLE DATA</span>;
}

export function Missing({ handle }: { handle?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-ink">
      <span className="font-mono text-[13px] tracking-wider text-flat">NO CHART ON FILE</span>
      <h1 className="m-0 text-3xl font-bold">We haven't diagnosed @{handle ?? "this account"} yet.</h1>
      <p className="m-0 max-w-md text-muted">Run a diagnosis first — it takes about 30 seconds.</p>
      <Link to="/" className="inline-flex min-h-[48px] items-center rounded-xl bg-vital px-5 font-bold text-bg no-underline hover:text-bg">Start a diagnosis</Link>
    </div>
  );
}
