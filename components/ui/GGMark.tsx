import { ggSvgPath } from "@/lib/gg-geometry";

const PATH = ggSvgPath();

export function GGMark({ className, title = "GRAMS GYM" }: { className?: string; title?: string }) {
  const gradientId = "gg-silver";
  return (
    <svg viewBox="-1.12 -0.56 2.24 1.12" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8EAED" />
          <stop offset="100%" stopColor="#9BA1AB" />
        </linearGradient>
      </defs>
      <path d={PATH} fill={`url(#${gradientId})`} />
    </svg>
  );
}
