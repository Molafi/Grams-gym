"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { SceneSlot } from "@/components/3d/SceneSlot";
import { elementProgress, scrollStore } from "@/components/motion/scroll-store";
import { GGMark } from "@/components/ui/GGMark";

function HeroPoster() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(255,125,9,.18),transparent)] blur-2xl" />
      <GGMark className="absolute inset-0 m-auto w-[62%] drop-shadow-[0_30px_60px_rgba(0,0,0,.6)]" title="" />
      <div className="absolute inset-x-[18%] bottom-[14%] h-6 rounded-[50%] bg-black/70 blur-xl" />
    </div>
  );
}

/** Hero layout: text column + 3D monogram column. Grid order mirrors automatically in RTL. */
export function HeroStage({ children, sceneLabel }: { children: ReactNode; sceneLabel: string }) {
  const ref = useRef<HTMLElement>(null);
  const locale = useLocale();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      scrollStore.hero = elementProgress(el, "exit");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section ref={ref} className="atmosphere relative isolate min-h-[100svh] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_120%,rgba(11,42,74,.5),transparent_70%)]" />
      <div className="mx-auto grid min-h-[100svh] max-w-[1320px] grid-cols-1 items-center gap-6 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:px-12">
        <div className="relative z-10">{children}</div>
        <SceneSlot
          scene={{ kind: "hero", dir: locale === "ar" ? "rtl" : "ltr" }}
          poster={<HeroPoster />}
          label={sceneLabel}
          className="order-first aspect-square w-full max-w-[640px] justify-self-center lg:order-none"
        />
      </div>
    </section>
  );
}
