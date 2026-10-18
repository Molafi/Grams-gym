"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { detectTier, type QualityTier } from "./quality";
import { pointerStore } from "./pointer-store";

const SharedCanvas = dynamic(() => import("./SharedCanvas"), { ssr: false });

type Ctx = {
  /** "off" until idle + capability check; then the chosen tier. */
  tier: QualityTier;
  register: (id: string) => () => void;
  setVisible: (id: string, visible: boolean) => void;
  canvasReady: boolean;
  setCanvasReady: (v: boolean) => void;
};

const SceneContext = createContext<Ctx | null>(null);

export function useScene() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used inside <SceneProvider>");
  return ctx;
}

/**
 * One WebGL context for the whole site. The canvas is NOT part of the critical
 * path: it is mounted after the browser is idle, only if some page region asked
 * for a scene, and only on capable devices. Rendering pauses when no scene is visible.
 */
export function SceneProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<QualityTier>("off");
  const [slots, setSlots] = useState(0);
  const [anyVisible, setAnyVisible] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const visible = useRef(new Set<string>());

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const run = () => setTier(detectTier());
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 1200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerStore.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerStore.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const register = useCallback((id: string) => {
    setSlots((n) => n + 1);
    return () => {
      visible.current.delete(id);
      setAnyVisible(visible.current.size > 0);
      setSlots((n) => n - 1);
    };
  }, []);

  const setVisible = useCallback((id: string, v: boolean) => {
    if (v) visible.current.add(id);
    else visible.current.delete(id);
    setAnyVisible(visible.current.size > 0);
  }, []);

  const value = useMemo(() => ({ tier, register, setVisible, canvasReady, setCanvasReady }), [tier, register, setVisible, canvasReady]);

  return (
    <SceneContext.Provider value={value}>
      {children}
      {tier !== "off" && slots > 0 ? <SharedCanvas tier={tier} active={anyVisible} onReady={() => setCanvasReady(true)} /> : null}
    </SceneContext.Provider>
  );
}
