import Image from "next/image";
import type { MediaItem } from "@/config/media";
import { GGMark } from "./GGMark";

const toneBg: Record<MediaItem["tone"], string> = {
  navy: "radial-gradient(120% 90% at 20% 0%, #123a63 0%, #0b2a4a 35%, #07080a 85%)",
  ember: "radial-gradient(120% 90% at 80% 10%, rgba(255,125,9,.28) 0%, #14171d 45%, #07080a 90%)",
  steel: "radial-gradient(120% 90% at 50% 0%, #2a2f38 0%, #14171d 45%, #07080a 90%)",
};

/**
 * Upgrades gracefully: renders an art-directed placeholder (brand gradient + GG
 * watermark + hairline grid) until a real `src` is registered in config/media.ts.
 */
export function Photo({
  item,
  locale,
  className = "",
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  pendingLabel,
}: {
  item: MediaItem;
  locale: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  pendingLabel?: string;
}) {
  const alt = locale === "en" ? item.alt.en : item.alt.ar;
  if (item.src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={item.src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative overflow-hidden ${className}`}
      style={{ background: toneBg[item.tone] }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <GGMark className="absolute inset-0 m-auto w-1/3 opacity-[.12]" title="" />
      {pendingLabel ? (
        <span className="absolute bottom-4 start-4 rounded-full border border-hairline-strong bg-black/40 px-3 py-1 text-[11px] text-muted">
          {pendingLabel}
        </span>
      ) : null}
    </div>
  );
}
