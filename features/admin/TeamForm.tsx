"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createStaffAccount, type AdminState } from "./actions";
import { IssuedCredentials } from "./IssuedCredentials";

const ERRORS = ["invalid", "self", "protected", "emailExists", "phoneTaken"] as const;

/** Admins only: add another admin or front-desk staff account. */
export function TeamForm() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminState, FormData>(createStaffAccount, {});
  const errorText = state.error ? ((ERRORS as readonly string[]).includes(state.error) ? t(`teamErrors.${state.error as (typeof ERRORS)[number]}`) : tc("error")) : "";
  const roleLabel = (r: "STAFF" | "ADMIN") => (r === "ADMIN" ? t("roleAdmin") : t("roleStaff"));

  return (
    <div className="space-y-5">
      <form action={action} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input type="hidden" name="locale" value={locale} />
        <label>
          <span className="mb-1 block text-xs text-muted">{t("grantName")}</span>
          <input name="name" required minLength={2} maxLength={80} className="field" autoComplete="off" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{t("grantPhone")}</span>
          <input name="phone" type="tel" required className="field text-start" dir="ltr" placeholder="07X XXX XXXX" autoComplete="off" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{t("grantEmail")}</span>
          <input name="email" type="email" className="field" dir="ltr" autoComplete="off" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{t("role")}</span>
          <select name="role" defaultValue="STAFF" className="field">
            <option value="STAFF">{t("roleStaff")}</option>
            <option value="ADMIN">{t("roleAdmin")}</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            <UserPlus className="h-4 w-4" aria-hidden /> {pending ? tc("loading") : t("teamSubmit")}
          </Button>
        </div>
        <p aria-live="polite" className={`text-sm md:col-span-2 xl:col-span-5 ${state.error ? "text-danger" : "text-success"}`}>
          {state.ok ? (state.promoted ? t("teamPromoted", { name: state.name ?? "", number: state.memberNumber ?? "" }) : t("saved")) : errorText}
        </p>
      </form>

      {/* The phone belongs to an existing member: show who it is, and only give the role after a second click. */}
      {state.confirm ? (
        <form action={action} role="alertdialog" aria-live="polite" className="rounded-2xl border border-warning/50 bg-warning/10 p-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="phone" value={state.confirm.phone} />
          <input type="hidden" name="role" value={state.confirm.role} />
          <input type="hidden" name="confirmNumber" value={state.confirm.memberNumber} />
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            {t("teamConfirm", { name: state.confirm.name ?? "—", number: state.confirm.memberNumber, role: roleLabel(state.confirm.role) })}
          </p>
          <Button type="submit" size="sm" disabled={pending} className="mt-4">
            {t("teamConfirmYes", { role: roleLabel(state.confirm.role) })}
          </Button>
        </form>
      ) : null}

      {state.ok && state.tempPassword && state.memberNumber ? (
        <IssuedCredentials name={state.name ?? ""} memberNumber={state.memberNumber} tempPassword={state.tempPassword} />
      ) : null}
    </div>
  );
}
