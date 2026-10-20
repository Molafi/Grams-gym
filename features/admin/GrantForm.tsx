"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { grantMembership, type AdminState } from "./actions";
import { IssuedCredentials } from "./IssuedCredentials";

export function GrantForm({ plans }: { plans: { slug: string; name: string }[] }) {
  const t = useTranslations("admin");
  const tp = useTranslations("packages");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminState, FormData>(grantMembership, {});
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const today = new Date().toISOString().slice(0, 10);
  const errorText =
    state.error === "phoneExists"
      ? t("grantErrors.phoneExists", { number: state.memberNumber ?? "" })
      : state.error && ["notFound", "newMember", "emailExists"].includes(state.error)
        ? t(`grantErrors.${state.error as "notFound" | "newMember" | "emailExists"}`)
        : state.error
          ? tc("error")
          : "";

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label={t("grantWho")} className="inline-flex rounded-full border border-hairline p-1 text-sm">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 ${mode === m ? "bg-white/10 text-ink" : "text-muted"}`}
          >
            {t(m === "existing" ? "grantExisting" : "grantNew")}
          </button>
        ))}
      </div>

      <form action={action} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <input type="hidden" name="locale" value={locale} />
        {mode === "existing" ? (
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs text-muted">{t("memberNumber")}</span>
            <input name="memberNumber" required placeholder="GG-00042" className="field" dir="ltr" />
          </label>
        ) : (
          <>
            <label>
              <span className="mb-1 block text-xs text-muted">{t("grantName")}</span>
              <input name="name" required minLength={2} className="field" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">{t("grantPhone")}</span>
              <input name="phone" type="tel" required className="field text-start" dir="ltr" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted">{t("grantEmail")}</span>
              <input name="email" type="email" className="field" dir="ltr" />
            </label>
          </>
        )}
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
        <div className="flex items-center gap-4 md:col-span-3 xl:col-span-6">
          <Button type="submit" disabled={pending}>
            {pending ? tc("loading") : t("grantSubmit")}
          </Button>
          <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
            {state.ok ? t("saved") : errorText}
          </p>
        </div>
      </form>

      {state.ok && state.tempPassword && state.memberNumber ? (
        <IssuedCredentials name={state.name ?? ""} memberNumber={state.memberNumber} tempPassword={state.tempPassword} />
      ) : null}
    </div>
  );
}
