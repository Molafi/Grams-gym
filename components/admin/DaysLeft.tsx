import { getTranslations } from "next-intl/server";
import type { Remaining } from "@/lib/membership";

const tones = {
  expired: { bar: "bg-white/10", text: "text-muted" },
  critical: { bar: "bg-danger", text: "text-danger" },
  soon: { bar: "bg-warning", text: "text-warning" },
  ok: { bar: "bg-success", text: "text-ink" },
} as const;

/** "Ends in 5 days" + a period-remaining bar, colour-coded by urgency. */
export async function DaysLeft({
  remaining,
  urgency,
  periodLeft,
  locale,
}: {
  remaining: Remaining;
  urgency: keyof typeof tones;
  periodLeft: number;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "admin" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const tone = tones[urgency];
  const days = tc("days", { count: remaining.days });
  const label =
    remaining.kind === "none"
      ? t("ended")
      : remaining.kind === "starts"
        ? t("startsIn", { days })
        : remaining.kind === "renews"
        ? t("renewsIn", { days })
        : remaining.kind === "grace"
          ? t("graceIn", { days })
          : remaining.kind === "trial"
            ? t("trialIn", { days })
            : t("endsIn", { days });

  return (
    <div className="min-w-[150px]">
      <div className="flex items-baseline gap-2">
        {remaining.kind !== "none" ? <span className={`display tabular text-xl ${tone.text}`}>{remaining.days}</span> : null}
        <span className={`text-xs ${remaining.kind === "none" ? "text-muted" : tone.text}`}>{label}</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[.06]" aria-hidden>
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.round(periodLeft * 100)}%` }} />
      </div>
    </div>
  );
}
