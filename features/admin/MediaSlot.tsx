"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** One image slot in /admin/media: preview, replace, alt text, reset. Posts to /api/admin/media. */
export function MediaSlot({
  slotKey,
  label,
  src,
  custom,
  alt,
  altDefaults,
  contain = false,
}: {
  slotKey: string;
  label: string;
  src: string | null;
  custom: boolean;
  alt: { ar: string; en: string };
  altDefaults: { ar: string; en: string };
  contain?: boolean;
}) {
  const t = useTranslations("admin.media");
  const tc = useTranslations("common");
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "saved" | string>("idle");

  async function send(fd: FormData, form?: HTMLFormElement) {
    setStatus("busy");
    fd.set("key", slotKey);
    const res = await fetch("/api/admin/media", { method: "POST", body: fd });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setStatus(body.error ?? "error");
    setStatus("saved");
    setPreview(null);
    // Clear the chosen file so a later alt-text-only save doesn't upload it again.
    const input = form?.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.value = "";
    router.refresh();
  }

  return (
    <form
      className="card flex flex-col overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        void send(new FormData(e.currentTarget), e.currentTarget);
      }}
    >
      <div className={`relative aspect-[4/3] ${contain ? "bg-[#1a1d23]" : "bg-black/40"}`}>
        {preview || src ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview, incl. local blob: URLs
          <img src={preview ?? src!} alt="" className={`h-full w-full ${contain ? "object-contain p-6" : "object-cover"}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">{t("empty")}</div>
        )}
        <span className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-[11px] ${custom ? "bg-ember text-[#130800]" : "bg-black/60 text-muted"}`}>
          {custom ? t("custom") : t("default")}
        </span>
      </div>
      <div className="space-y-3 p-5">
        <p className="font-medium">{label}</p>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-hairline-strong px-3 py-2.5 text-sm text-muted hover:text-ink">
          <Upload className="h-4 w-4" aria-hidden />
          <span className="truncate">{preview ? t("ready") : t("choose")}</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
              setStatus("idle");
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{t("altAr")}</span>
          <input name="altAr" defaultValue={alt.ar} placeholder={altDefaults.ar} className="field !py-2 text-sm" dir="rtl" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{t("altEn")}</span>
          <input name="altEn" defaultValue={alt.en} placeholder={altDefaults.en} className="field !py-2 text-sm" dir="ltr" />
        </label>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" size="sm" disabled={status === "busy"}>
            {status === "busy" ? tc("loading") : tc("save")}
          </Button>
          {custom ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger"
              onClick={() => {
                if (!confirm(t("resetConfirm"))) return;
                const fd = new FormData();
                fd.set("action", "reset");
                void send(fd);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t("reset")}
            </button>
          ) : null}
          <span aria-live="polite" className={`text-xs ${status === "saved" ? "text-success" : "text-danger"}`}>
            {status === "saved" ? tc("saved") : status !== "idle" && status !== "busy" ? t(`errors.${status === "size" || status === "type" || status === "forbidden" ? status : "generic"}`) : ""}
          </span>
        </div>
        <p className="text-[11px] text-muted">{t("hint")}</p>
      </div>
    </form>
  );
}
