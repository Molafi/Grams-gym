/**
 * Lightweight SVG rendition of a product pack. Used in the grid (no WebGL there,
 * by design) and as the poster under 3D views. Driven by the same product data
 * as the 3D label so both always match.
 */
export function PackArt({
  shape,
  labelColor,
  accentColor,
  brand,
  className = "",
}: {
  shape: "tub" | "shaker" | "box";
  labelColor: string;
  accentColor: string;
  brand: string;
  className?: string;
}) {
  const id = `${shape}-${labelColor.replace("#", "")}-${accentColor.replace("#", "")}`;
  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sheen-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".45" />
          <stop offset=".35" stopColor="#fff" stopOpacity=".10" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".7" stopColor="#000" stopOpacity=".05" />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </linearGradient>
        <radialGradient id={`floor-${id}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#000" stopOpacity=".7" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="222" rx="70" ry="9" fill={`url(#floor-${id})`} />
      {shape === "tub" ? (
        <g>
          <rect x="44" y="62" width="112" height="150" rx="10" fill={labelColor} />
          <rect x="44" y="62" width="112" height="150" rx="10" fill={`url(#sheen-${id})`} />
          <rect x="40" y="44" width="120" height="26" rx="8" fill="#101217" />
          <rect x="40" y="66" width="120" height="3" fill={accentColor} />
          <rect x="60" y="110" width="22" height="3" fill={accentColor} />
          <text x="60" y="100" fontSize="9" fill={accentColor} fontFamily="var(--font-latin)" letterSpacing="2">
            {brand.slice(0, 16)}
          </text>
          <rect x="60" y="124" width="80" height="10" rx="2" fill="currentColor" opacity=".18" />
          <rect x="60" y="140" width="56" height="10" rx="2" fill="currentColor" opacity=".12" />
        </g>
      ) : shape === "shaker" ? (
        <g>
          <path d="M66 72 L134 72 L128 212 Q100 218 72 212 Z" fill="#0d0f13" />
          <path d="M66 72 L134 72 L128 212 Q100 218 72 212 Z" fill={`url(#sheen-${id})`} />
          <rect x="68" y="120" width="64" height="44" fill={labelColor} opacity=".95" />
          <rect x="62" y="50" width="76" height="24" rx="6" fill={accentColor} />
          <rect x="104" y="36" width="18" height="16" rx="4" fill="#0d0f13" />
          <text x="76" y="146" fontSize="10" fontWeight="700" fill={accentColor} fontFamily="var(--font-latin)">
            GG
          </text>
        </g>
      ) : (
        <g>
          <rect x="52" y="50" width="96" height="162" rx="6" fill={labelColor} />
          <rect x="52" y="50" width="96" height="162" rx="6" fill={`url(#sheen-${id})`} />
          <rect x="52" y="64" width="96" height="4" fill={accentColor} />
          <rect x="52" y="194" width="96" height="4" fill={accentColor} />
          <text x="64" y="92" fontSize="8" fill={accentColor} fontFamily="var(--font-latin)" letterSpacing="2">
            {brand.slice(0, 14)}
          </text>
          <rect x="64" y="104" width="64" height="10" rx="2" fill="currentColor" opacity=".18" />
          <rect x="64" y="120" width="44" height="10" rx="2" fill="currentColor" opacity=".12" />
        </g>
      )}
    </svg>
  );
}
