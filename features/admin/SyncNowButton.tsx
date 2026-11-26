"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { syncMembersNow, type SyncNowState } from "./sync-actions";

export function SyncNowButton() {
  const t = useTranslations("admin.import.sync");
  const ta = useTranslations("admin");
  const locale = useLocale();
  const [state, action, pending] = useActionState<SyncNowState, FormData>(syncMembersNow, {});
  const message = state.ok
    ? t("result", { created: state.created ?? 0, updated: state.updated ?? 0, periods: state.periods ?? 0 })
    : state.error === "readOnly"
      ? ta("guestBlocked")
      : state.error === "noMirror"
        ? t("noMirror")
        : state.error
          ? t("failed")
          : "";
  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" disabled={pending}>
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden /> {pending ? t("running") : t("runNow")}
      </Button>
      <p aria-live="polite" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>
        {message}
      </p>
    </form>
  );
}
