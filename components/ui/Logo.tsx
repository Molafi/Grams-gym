import Image from "next/image";
import { GGMark } from "./GGMark";

/**
 * The GRAMS GYM logo (the real artwork, editable in /admin/media).
 * Falls back to the geometric GG monogram if no logo file is set.
 * `sizes` is the width it's shown at, so the browser loads a sharp enough version.
 */
export function Logo({ src, className = "h-10 w-10", alt = "", sizes = "128px" }: { src: string | null; className?: string; alt?: string; sizes?: string }) {
  if (!src) return <GGMark className={className} title={alt} />;
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-contain" />
    </span>
  );
}
