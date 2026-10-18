"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { SceneSlot } from "@/components/3d/SceneSlot";
import { elementProgress, scrollStore } from "@/components/motion/scroll-store";
import { CountUp } from "@/components/motion/CountUp";
import { site } from "@/config/site";

const STEPS = ["s1", "s2", "s3", "s4"] as const;

function StoryPoster() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="sp" cx=".5" cy=".4" r=".6">
          <stop offset="0" stopColor="#2a2f38" />
          <stop offset="1" stopColor="#07080a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="95" r="90" fill="url(#sp)" />
      <circle cx="100" cy="100" r="54" fill="#14171d" stroke="#2a2f38" strokeWidth="2" />
      <circle cx="100" cy="100" r="47" fill="none" stroke="#ff7d09" strokeWidth="1" />
      <circle cx="100" cy="100" r="11" fill="#cfd3d9" />
    </svg>
  );
}

/** Pinned scroll story: one object morphs 1 g → 20,000 g while the counter climbs. */
export function StorySection() {
  const t = useTranslations("home.story");
  const ts = useTranslations("home.stats");
  const ref = useRef<HTMLElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let lastStep = -1;
    const tick = () => {
      const p = elementProgress(el, "pinned");
      scrollStore.story = p;
      // Exponential climb: every gram counts, then they compound.
      const grams = Math.round(Math.pow(20000, p));
      if (counterRef.current) counterRef.current.textContent = grams.toLocaleString("en-US");
      if (barRef.current) barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      const s = Math.min(3, Math.floor(p * 4));
      if (s !== lastStep) {
        lastStep = s;
        setStep(s);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const key = STEPS[step]!;

  return (
    <section id="story" ref={ref} className="relative h-[420vh]" aria-labelledby="story-title">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_55%,rgba(11,42,74,.45),transparent_75%)]" />
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-center gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr_1fr] lg:px-12">
          <div className="relative z-10">
            <p className="eyebrow mb-5">{t("eyebrow")}</p>
            <h2 id="story-title" className="display text-4xl sm:text-5xl">
              {t("title")}
            </h2>
            <div className="mt-10 min-h-[140px]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="tabular text-sm text-ember" dir="ltr">
                    0{step + 1} / 04
                  </p>
                  <h3 className="display mt-2 text-2xl">{t(`steps.${key}.title`)}</h3>
                  <p className="mt-3 max-w-sm text-muted">{t(`steps.${key}.body`)}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <SceneSlot scene={{ kind: "story" }} poster={<StoryPoster />} label={t("sceneLabel")} className="mx-auto aspect-square w-full max-w-[560px]" />

          <div className="relative z-10 lg:text-end">
            <p className="display text-silver tabular text-[clamp(3.5rem,8vw,7rem)] leading-none" dir="ltr">
              <span ref={counterRef}>1</span>
              <span className="ms-2 text-[0.35em] text-muted">g</span>
            </p>
            <p className="mt-2 text-sm text-muted">{t("counterLabel")}</p>
            <div className="mt-6 h-px w-full overflow-hidden bg-hairline">
              <div ref={barRef} className="h-full w-full origin-left bg-ember rtl:origin-right" style={{ transform: "scaleX(0)" }} />
            </div>
            <dl className="mt-12 grid grid-cols-2 gap-6">
              <div className="flex flex-col-reverse">
                <dt className="mt-1 text-sm text-muted">{ts("years")}</dt>
                <dd className="display text-4xl" dir="ltr">
                  <CountUp to={site.stats.years} suffix="+" />
                </dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="mt-1 text-sm text-muted">{ts("members")}</dt>
                <dd className="display text-4xl" dir="ltr">
                  <CountUp to={site.stats.members} suffix="+" />
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
