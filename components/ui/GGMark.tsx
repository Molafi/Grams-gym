import { useId } from "react";
import { ggSvgPath } from "@/lib/gg-geometry";

const PATH = ggSvgPath();

/**
 * The GG monogram. Each instance gets its own gradient id: with a shared id, a copy inside
 * a hidden element (mobile menu, hero poster) can make every other logo on the page render
 * blank, because `url(#id)` resolves to the first element with that id in the document.
 */
export function GGMark({ className, title = "GRAMS GYM" }: { className?: string; title?: string }) {
  const gradientId = `gg-silver-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const decorative = title === "";
  return (
    <svg
      viewBox="-1.12 -0.56 2.24 1.12"
      className={className}
      {...(decorative ? { "aria-hidden": true, focusable: false } : { role: "img", "aria-label": title })}
    >
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
