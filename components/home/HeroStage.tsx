"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { SceneSlot } from "@/components/3d/SceneSlot";
import { elementProgress, scrollStore } from "@/components/motion/scroll-store";
import Image from "next/image";
import { Logo } from "@/components/ui/Logo";

function HeroPoster({ logoSrc }: { logoSrc: string | null }) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(255,125,9,.18),transparent)] blur-2xl" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Logo src={logoSrc} className="aspect-square w-[78%] drop-shadow-[0_30px_60px_rgba(0,0,0,.6)]" />
      </div>
      <div className="absolute inset-x-[18%] bottom-[14%] h-6 rounded-[50%] bg-black/70 blur-xl" />
    </div>
  );
}

/** Hero layout: text column + 3D monogram column. Grid order mirrors automatically in RTL. */
export function HeroStage({ children, sceneLabel, bgSrc, logoSrc }: { children: ReactNode; sceneLabel: string; bgSrc: string | null; logoSrc: string | null }) {
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
      {bgSrc ? (
        // The gym's navy GG wall, dimmed so the headline stays readable (editable in /admin/media).
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
          <Image src={bgSrc} alt="" fill priority sizes="100vw" className="object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/40 to-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent rtl:bg-gradient-to-l" />
        </div>
      ) : null}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_120%,rgba(11,42,74,.5),transparent_70%)]" />
      <div className="mx-auto grid min-h-[100svh] max-w-[1320px] grid-cols-1 items-center gap-6 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:px-12">
        <div className="relative z-10">{children}</div>
        <SceneSlot
          scene={{ kind: "hero", dir: locale === "ar" ? "rtl" : "ltr" }}
          poster={<HeroPoster logoSrc={logoSrc} />}
          label={sceneLabel}
          className="order-first aspect-square w-full max-w-[640px] justify-self-center lg:order-none"
        />
      </div>
    </section>
  );
}
