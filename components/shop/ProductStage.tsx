"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, X } from "lucide-react";
import { SceneSlot } from "@/components/3d/SceneSlot";
import type { PackProps } from "@/components/3d/models";
import { PackArt } from "./PackArt";

const ProductViewer = dynamic(() => import("@/components/3d/ProductViewer"), { ssr: false });

/** Product page stage: poster → 3D turntable (shared canvas) + full-screen draggable viewer. */
export function ProductStage({ pack, name }: { pack: PackProps; name: string }) {
  const t = useTranslations("shop");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="card relative overflow-hidden">
      <div className="relative aspect-square bg-[radial-gradient(70%_60%_at_50%_35%,#1c2029,#07080a)]">
        <div className="absolute inset-0">
          <SceneSlot
            scene={{ kind: "pack", pack }}
            poster={<PackArt shape={pack.shape} labelColor={pack.labelColor} accentColor={pack.accentColor} brand={pack.brand} className="absolute inset-0 m-auto h-[70%] w-[70%] text-ink" />}
            label={t("modelLabel", { name })}
            className="h-full w-full"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass absolute bottom-4 end-4 z-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        >
          <Maximize2 className="h-4 w-4" aria-hidden /> {t("viewIn3d")}
        </button>
      </div>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label={t("modelLabel", { name })} className="fixed inset-0 z-[90] bg-[radial-gradient(70%_60%_at_50%_40%,#161a21,#050608)]" data-lenis-prevent>
          <ProductViewer pack={pack} />
          <p className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-sm text-muted">{t("dragHint")}</p>
          <button type="button" onClick={() => setOpen(false)} autoFocus className="glass absolute end-5 top-5 flex h-12 w-12 items-center justify-center rounded-full" aria-label={t("close3d")}>
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
