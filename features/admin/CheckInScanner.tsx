"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Camera, CameraOff, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { checkInMember, type CheckInResult } from "./actions";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

function detectorCtor(): DetectorCtor | undefined {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return undefined;
  return (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
}

/** Front-desk check-in: native BarcodeDetector camera scan when available, manual code entry always. */
export function CheckInScanner() {
  const t = useTranslations("admin.checkin");
  const locale = useLocale();
  const f = useFormatter();
  const [state, action, pending] = useActionState<CheckInResult | null, FormData>(checkInMember, null);
  const [scanning, setScanning] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!scanning) return;
    const Ctor = detectorCtor();
    if (!Ctor) return;
    const detector = new Ctor({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current || stopped) return;
        video.current.srcObject = stream;
        await video.current.play();
        const loop = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            const hit = codes.find((c) => c.rawValue.startsWith("GG:"));
            if (hit && input.current && form.current) {
              input.current.value = hit.rawValue;
              form.current.requestSubmit();
              setScanning(false);
              return;
            }
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setUnsupported(true);
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [scanning]);

  const tone = state?.result === "allowed" ? "border-success/50 bg-success/10 text-success" : state?.result === "denied" ? "border-danger/50 bg-danger/10 text-danger" : "border-hairline text-muted";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-5 p-6">
        <form ref={form} action={action} className="flex gap-3">
          <label className="flex-1">
            <span className="sr-only">{t("code")}</span>
            <input ref={input} name="code" placeholder={t("code")} className="field font-mono" dir="ltr" autoComplete="off" autoFocus />
          </label>
          <Button type="submit" disabled={pending}>
            {t("check")}
          </Button>
        </form>
        <Button
          type="button"
          variant="glass"
          onClick={() => {
            if (!scanning && !detectorCtor()) {
              setUnsupported(true);
              return;
            }
            setScanning((s) => !s);
          }}
        >
          {scanning ? <CameraOff className="h-4 w-4" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
          {scanning ? t("stopScan") : t("scan")}
        </Button>
        {unsupported ? <p className="text-sm text-warning">{t("noCamera")}</p> : null}
        {scanning ? <video ref={video} className="aspect-video w-full rounded-2xl bg-black object-cover" muted playsInline /> : null}
      </div>

      <div role="status" aria-live="assertive" className={`card flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center ${tone}`}>
        {!state ? (
          <p>{t("hint")}</p>
        ) : (
          <>
            {state.result === "allowed" ? <CheckCircle2 className="h-14 w-14" aria-hidden /> : state.result === "denied" ? <XCircle className="h-14 w-14" aria-hidden /> : <HelpCircle className="h-14 w-14" aria-hidden />}
            <p className="display text-2xl">{state.result === "allowed" ? t("allowed") : state.result === "denied" ? t("denied") : t("unknown")}</p>
            {state.name ? <p className="text-ink">{state.name}</p> : null}
            {state.plan ? (
              <p className="text-sm text-muted">
                {locale === "en" ? state.plan.en : state.plan.ar}
                {state.endsAt ? ` · ${f.dateTime(new Date(state.endsAt), { dateStyle: "medium" })}` : ""}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
