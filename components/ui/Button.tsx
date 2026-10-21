import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";

type Variant = "primary" | "glass" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color,border-color,box-shadow,color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] disabled:pointer-events-none disabled:opacity-45 active:scale-[.98] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-ember text-[#130800] shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_10px_30px_-12px_var(--color-ember-glow)] hover:bg-ember-soft hover:shadow-[inset_0_1px_0_rgb(255_255_255/.4),0_16px_40px_-12px_var(--color-ember-glow)]",
  glass: "glass text-ink hover:border-hairline-strong hover:bg-white/[.06]",
  ghost: "text-muted hover:text-ink",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.95rem]",
  lg: "h-14 px-8 text-base",
};

/** Same sizes for buttons whose label may wrap onto a second line (long labels in narrow boxes). */
const wrapSizes: Record<Size, string> = {
  sm: "min-h-9 px-4 py-1.5 text-sm",
  md: "min-h-11 px-5 py-2.5 text-[0.95rem]",
  lg: "min-h-14 px-6 py-3 text-base",
};
const wrapBase = base.replace("whitespace-nowrap", "whitespace-normal text-center leading-snug");

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "", wrap = false) {
  return `${wrap ? wrapBase : base} ${variants[variant]} ${(wrap ? wrapSizes : sizes)[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  wrap = false,
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; wrap?: boolean }) {
  return <button className={buttonClass(variant, size, className, wrap)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function ExternalButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"a"> & { variant?: Variant; size?: Size }) {
  return <a target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} {...props} />;
}
