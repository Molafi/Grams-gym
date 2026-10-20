"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/*
 * Reveal animations that never leave content invisible.
 *
 * The old versions rendered every block hidden in the server HTML and only showed it once
 * JavaScript had loaded and seen it on screen. On a slow load, images and text stayed
 * blank or half-wiped ("stuck"). Now everything renders visible. After hydration, blocks
 * that are still below the fold are hidden (off screen, so nobody sees it) and animate in
 * when scrolled to. Blocks already on screen simply stay as they are.
 */
const belowFold = (el: HTMLElement) => el.getBoundingClientRect().top > window.innerHeight;

/**
 * Masked line reveal for headings at the top of a page. Pure CSS, so it plays as soon as
 * the page paints instead of waiting for JavaScript.
 */
export function RevealText({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <span className={`reveal-mask ${className}`}>
      <span className="reveal-line block" style={{ "--reveal-delay": `${delay}s` } as CSSProperties}>
        {children}
      </span>
    </span>
  );
}

/** Fade + rise for blocks; children can be staggered by passing `index`. */
export function Reveal({
  children,
  index = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const armed = useRef(false);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    if (!armed.current && !inView && belowFold(el)) {
      armed.current = true;
      void animate(el, { opacity: 0, y: 28 }, { duration: 0 });
    } else if (armed.current && inView) {
      armed.current = false;
      void animate(el, { opacity: 1, y: 0 }, { duration: 0.9, ease: EASE, delay: index * 0.08 });
    }
  }, [inView, reduce, index]);

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        ref.current = el;
      }}
      className={className}
    >
      {children}
    </Tag>
  );
}

/** Image reveal: a curtain wipes away while the photo settles from a slight zoom. */
export function RevealImage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const armed = useRef(false);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  useEffect(() => {
    const el = ref.current;
    const zoom = inner.current;
    if (!el || !zoom || reduce) return;
    if (!armed.current && !inView && belowFold(el)) {
      armed.current = true;
      void animate(el, { clipPath: "inset(0 0 100% 0)" }, { duration: 0 });
      void animate(zoom, { scale: 1.15 }, { duration: 0 });
    } else if (armed.current && inView) {
      armed.current = false;
      void animate(el, { clipPath: "inset(0 0 0% 0)" }, { duration: 1.4, ease: EASE });
      void animate(zoom, { scale: 1 }, { duration: 1.8, ease: EASE });
    }
  }, [inView, reduce]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <div ref={inner} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
