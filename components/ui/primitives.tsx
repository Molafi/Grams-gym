import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`eyebrow flex items-center gap-3 ${className}`}>
      <span aria-hidden className="inline-block h-px w-8 bg-ember" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className = "",
  as: Tag = "h2",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={`max-w-3xl ${className}`}>
      {eyebrow ? <Eyebrow className="mb-5">{eyebrow}</Eyebrow> : null}
      <Tag className={`display text-balance ${Tag === "h1" ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl"}`}>{title}</Tag>
      {subtitle ? <p className="mt-6 max-w-2xl text-lg text-muted text-pretty">{subtitle}</p> : null}
    </div>
  );
}

type Tone = "neutral" | "ember" | "success" | "warning" | "danger" | "navy";
const tones: Record<Tone, string> = {
  neutral: "border-hairline-strong text-muted",
  ember: "border-ember/40 text-ember bg-ember/[.08]",
  success: "border-success/40 text-success bg-success/[.08]",
  warning: "border-warning/40 text-warning bg-warning/[.08]",
  danger: "border-danger/40 text-danger bg-danger/[.08]",
  navy: "border-[#2a5c8f]/60 text-[#9cc3ea] bg-navy/40",
};

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}
