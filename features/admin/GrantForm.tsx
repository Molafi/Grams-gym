"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { grantMembership, type AdminState } from "./actions";

export function GrantForm({ plans }: { plans: { slug: string; name: string }[] }) {
  const t = useTranslations("admin");
  const tp = useTranslations("packages");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminState, FormData>(grantMembership, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
      <input type="hidden" name="locale" value={locale} />
      <label className="xl:col-span-2">
        <span className="mb-1 block text-xs text-muted">{t("grantEmail")}</span>
        <input name="email" type="email" required className="field" dir="ltr" />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">{t("grantName")}</span>
        <input name="name" className="field" />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">{t("grantPhone")}</span>
        <input name="phone" type="tel" className="field" dir="ltr" />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">{t("plan")}</span>
        <select name="plan" className="field" required>
          {plans.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">{t("interval")}</span>
        <select name="interval" className="field" defaultValue="monthly">
          {(["monthly", "quarterly", "yearly"] as const).map((i) => (
            <option key={i} value={i}>
              {tp(`interval.${i}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">{t("grantStart")}</span>
        <input name="start" type="date" defaultValue={today} className="field" dir="ltr" />
      </label>
      <div className="flex items-center gap-4 md:col-span-3 xl:col-span-7">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : t("grantSubmit")}
        </Button>
        <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
          {state.ok ? t("saved") : state.error ? tc("error") : ""}
        </p>
      </div>
    </form>
  );
}
