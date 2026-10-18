"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updateProfile, type ProfileState } from "./actions";

export function ProfileForm({ defaults }: { defaults: { name: string; email: string; phone: string; locale: "ar" | "en" } }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("name")}</span>
        <input name="name" defaultValue={defaults.name} required className="field" autoComplete="name" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("email")}</span>
        <input value={defaults.email} readOnly disabled className="field opacity-60" dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("phone")}</span>
        <input name="phone" defaultValue={defaults.phone} type="tel" dir="ltr" className="field text-start" autoComplete="tel" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("language")}</span>
        <select name="locale" defaultValue={defaults.locale} className="field">
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </label>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
          {state.ok ? tc("saved") : state.error ? tc("error") : ""}
        </p>
      </div>
    </form>
  );
}
