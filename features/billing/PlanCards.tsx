"use client";

import { useActionState, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { buttonClass } from "@/components/ui/Button";
import { startMembershipCheckout, type JoinState } from "./actions";

export type PlanCardData = {
  slug: string;
  name: string;
  tagline: string;
  features: string[];
  prices: { monthly: number; quarterly: number; yearly: number };
  currency: string;
  recommended: boolean;
};

type Interval = "monthly" | "quarterly" | "yearly";
const INTERVALS: Interval[] = ["monthly", "quarterly", "yearly"];
const TIER_MARK: Record<string, string> = { starter: "I", pro: "II", elite: "III" };

export function JoinButton({ plan, interval, label, primary }: { plan: string; interval: Interval; label: string; primary: boolean }) {
  const locale = useLocale();
  const t = useTranslations("packages");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<JoinState, FormData>(startMembershipCheckout, {});
  return (
    <form action={action} className="w-full">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" disabled={pending} className={buttonClass(primary ? "primary" : "glass", "lg", "w-full")}>
        {pending ? tc("loading") : label}
      </button>
      <p aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-danger">
        {state.error === "notConfigured" ? t("notConfigured") : state.error === "rateLimited" ? tc("rateLimited") : state.error ? tc("error") : ""}
      </p>
    </form>
  );
}

function PlanCard({ plan, interval, current }: { plan: PlanCardData; interval: Interval; current: boolean }) {
  const t = useTranslations("packages");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), { stiffness: 160, damping: 18 });
  const glowX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glowY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glow = useMotionTemplate`radial-gradient(400px circle at ${glowX} ${glowY}, rgba(255,255,255,.07), transparent 45%)`;
  const price = formatMoney(plan.prices[interval], plan.currency, locale);

  return (
    <div className="[perspective:1400px]">
      <motion.div
        ref={ref}
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse" || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
        style={{ rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry, transformStyle: "preserve-3d" }}
        className="relative"
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative min-h-[520px]"
        >
          {/* FRONT */}
          <div
            className={`card absolute inset-0 flex flex-col overflow-hidden p-8 [backface-visibility:hidden] ${
              plan.recommended ? "border-ember/50 shadow-[0_0_0_1px_rgba(255,125,9,.35),0_30px_80px_-30px_rgba(255,125,9,.45)]" : ""
            }`}
            style={{
              background: plan.recommended
                ? "linear-gradient(160deg, #1a1d24 0%, #0e1014 45%, #0b0c10 100%)"
                : "linear-gradient(160deg, #15181e 0%, #0e1014 50%, #090a0d 100%)",
            }}
            inert={flipped}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{ background: glow }}
            />
            {plan.recommended ? <div aria-hidden className="absolute inset-y-0 end-0 w-px bg-gradient-to-b from-transparent via-ember to-transparent" /> : null}
            <div className="flex items-start justify-between">
              <span className="text-silver display text-6xl" dir="ltr" aria-hidden>
                {TIER_MARK[plan.slug] ?? "·"}
              </span>
              {plan.recommended ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs text-ember">
                  <Sparkles className="h-3 w-3" aria-hidden /> {t("recommended")}
                </span>
              ) : current ? (
                <span className="rounded-full border border-success/40 px-3 py-1 text-xs text-success">{t("current")}</span>
              ) : null}
            </div>
            <h3 className="display mt-8 text-3xl">{plan.name}</h3>
            <p className="mt-2 text-muted">{plan.tagline}</p>
            <div className="mt-auto pt-10">
              <div className="flex items-baseline gap-2" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={price}
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="display tabular text-4xl"
                  >
                    {price}
                  </motion.span>
                </AnimatePresence>
                <span className="text-sm text-muted">{t(`per.${interval}`)}</span>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <JoinButton plan={plan.slug} interval={interval} label={t("join", { plan: plan.name })} primary={plan.recommended} />
                <button type="button" onClick={() => setFlipped(true)} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
                  {t("flip")}
                </button>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="card absolute inset-0 flex flex-col p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            inert={!flipped}
          >
            <h3 className="display text-2xl">{plan.name}</h3>
            <ul className="mt-6 space-y-4">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-ember" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <JoinButton plan={plan.slug} interval={interval} label={t("join", { plan: plan.name })} primary={plan.recommended} />
              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center justify-center gap-2 text-sm text-muted hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t("flipBack")}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function PlanCards({ plans, currentPlanSlug, initialInterval = "monthly" }: { plans: PlanCardData[]; currentPlanSlug?: string | null; initialInterval?: Interval }) {
  const t = useTranslations("packages");
  const [interval, setBillingInterval] = useState<Interval>(initialInterval);

  return (
    <div>
      <div role="radiogroup" aria-label={t("eyebrow")} className="glass mx-auto mb-12 flex w-fit rounded-full p-1">
        {INTERVALS.map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            onClick={() => setBillingInterval(i)}
            className={`relative rounded-full px-5 py-2 text-sm transition-colors duration-500 ${interval === i ? "text-[#130800]" : "text-muted hover:text-ink"}`}
          >
            {interval === i ? (
              <motion.span layoutId="interval-pill" className="absolute inset-0 rounded-full bg-ember" transition={{ type: "spring", stiffness: 300, damping: 32 }} />
            ) : null}
            <span className="relative">{t(`interval.${i}`)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.slug} plan={p} interval={interval} current={p.slug === currentPlanSlug} />
        ))}
      </div>
    </div>
  );
}
