"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";

/**
 * "Confirming your payment…" — access is granted ONLY by the webhook, so we poll
 * until it has landed, then refresh the server-rendered membership page.
 */
export function CheckoutConfirming() {
  const t = useTranslations("billing");
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    const poll = async () => {
      if (stopped) return;
      attempts += 1;
      try {
        const res = await fetch("/api/membership/status", { cache: "no-store" });
        const data = (await res.json()) as { active?: boolean };
        if (data.active) {
          router.replace("/account/membership");
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
      if (attempts === 20) setSlow(true);
      window.setTimeout(poll, attempts < 20 ? 1500 : 6000);
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [router]);

  return (
    <div role="status" aria-live="polite" className="card flex items-start gap-4 border-ember/40 p-6">
      <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-ember" aria-hidden />
      <div>
        <p className="font-medium">{t("confirming")}</p>
        <p className="mt-1 text-sm text-muted">{slow ? t("timeout") : t("confirmingBody")}</p>
      </div>
    </div>
  );
}
