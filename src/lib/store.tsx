import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Platform, ScanView } from "../../supabase/functions/_shared/types.ts";
import { findSample, scanKey } from "./data.ts";

interface Store {
  roast: boolean;
  setRoast: (v: boolean) => void;
  getScan: (platform: Platform, handle: string) => ScanView | undefined;
  putScan: (v: ScanView) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [roast, setRoast] = useState(false);
  const [scans, setScans] = useState<Record<string, ScanView>>({});

  const putScan = useCallback((v: ScanView) => setScans((s) => ({ ...s, [scanKey(v.platform, v.handle)]: v })), []);
  const getScan = useCallback(
    (platform: Platform, handle: string) => {
      const hit = scans[scanKey(platform, handle)];
      if (hit) return hit;
      return findSample(handle)?.view; // deep links to samples always work
    },
    [scans],
  );

  const value = useMemo(() => ({ roast, setRoast, getScan, putScan }), [roast, getScan, putScan]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
