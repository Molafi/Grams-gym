"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { updateProfile, type ProfileState } from "./actions";

export function ProfileForm({
  defaults,
  contactBonusDays = 0,
}: {
  defaults: { name: string; email: string; phone: string; locale: "ar" | "en" };
  /** > 0 while the member can still earn the one-time "email + phone" free days. */
  contactBonusDays?: number;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  const message = state.ok
    ? state.bonusDays
      ? t("contactBonusEarned", { days: tc("days", { count: state.bonusDays }) })
      : tc("saved")
    : state.error === "phoneTaken"
      ? t("phoneTaken")
      : state.error === "emailTaken"
        ? t("emailTaken")
        : state.error
          ? tc("error")
          : "";

  return (
    <form action={action} className="space-y-4">
      {contactBonusDays > 0 && !state.bonusDays ? (
        <p className="flex items-start gap-2 rounded-xl border border-ember/40 bg-ember/[.06] px-4 py-3 text-sm">
          <Gift className="mt-0.5 h-4 w-4 shrink-0 text-ember" aria-hidden />
          {t("contactBonusHint", { days: tc("days", { count: contactBonusDays }) })}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("name")}</span>
        <input name="name" defaultValue={defaults.name} required className="field" autoComplete="name" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("email")}</span>
        <input name="email" type="email" defaultValue={defaults.email} className="field" dir="ltr" autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("phone")}</span>
        <input name="phone" defaultValue={defaults.phone} type="tel" dir="ltr" className="field text-start" autoComplete="tel" placeholder="07X XXX XXXX" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("language")}</span>
        <select name="locale" defaultValue={defaults.locale} className="field">
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
          {message}
        </p>
      </div>
    </form>
  );
}
