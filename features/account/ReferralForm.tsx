"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { setReferrer, type ReferralState } from "./actions";

const KNOWN = ["notFound", "self", "already", "tooLate", "loop", "rate", "invalid"] as const;

/** "Who invited you?" — type the friend's membership number (once). */
export function ReferralForm() {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ReferralState, FormData>(setReferrer, {});
  const error = state.error && (KNOWN as readonly string[]).includes(state.error) ? t(`referErrors.${state.error}`) : state.error ? tc("error") : "";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">{t("referWhoLabel")}</span>
          <input name="referrer" required maxLength={20} placeholder="GG-00042" autoComplete="off" className="field" dir="ltr" />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : t("referWhoSubmit")}
        </Button>
      </div>
      <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
        {state.ok ? t("referSaved") : error}
      </p>
    </form>
  );
}
