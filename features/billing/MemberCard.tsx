"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

/** Digital member card — flips to reveal the check-in QR. */
export function MemberCard({ name, planName, qrDataUrl, memberCode, memberNumber, validLabel, logoSrc }: { name: string; planName: string; qrDataUrl: string; memberCode: string; memberNumber: string; validLabel: string; logoSrc: string | null }) {
  const t = useTranslations("membership");
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  return (
    <div>
      <div className="[perspective:1400px]">
        <motion.button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={t("flipCard")}
          aria-pressed={flipped}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative block aspect-[1.586] w-full max-w-[420px] text-start"
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[22px] border border-white/10 p-6 [backface-visibility:hidden]"
            style={{ background: "linear-gradient(135deg,#1d2129 0%,#0e1014 45%,#0b2a4a 140%)" }}
          >
            <div aria-hidden className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-ember/20 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <Logo src={logoSrc} className="h-10 w-10" />
                <span className="font-mono text-xs tracking-[0.2em] text-muted" dir="ltr">
                  {memberNumber}
                </span>
              </div>
              <div className="mt-auto">
                <p className="display text-xl">{name}</p>
                <p className="mt-1 text-sm text-ember">{planName}</p>
                <p className="mt-3 text-xs text-muted">{validLabel}</p>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-5 rounded-[22px] border border-white/10 bg-[#f4f2ee] p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR, not optimisable */}
            <img src={qrDataUrl} alt="" className="aspect-square h-full max-h-[85%] rounded-lg" />
            <div className="text-[#07080a]">
              <p className="text-xs opacity-60">{t("memberCardHint")}</p>
              <p className="mt-2 break-all font-mono text-[10px] opacity-70" dir="ltr">
                {memberCode}
              </p>
            </div>
          </div>
        </motion.button>
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
        <RotateCcw className="h-3 w-3" aria-hidden /> {t("flipCard")}
      </p>
    </div>
  );
}
