"use client";

import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";

/** Shown once after creating a member / resetting a password, for staff to hand over. */
export function IssuedCredentials({ name, memberNumber, tempPassword }: { name: string; memberNumber: string; tempPassword: string }) {
  const t = useTranslations("admin");
  return (
    <div role="status" className="rounded-2xl border border-ember/50 bg-ember/[.06] p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-ember">
        <KeyRound className="h-4 w-4" aria-hidden /> {t("issuedTitle", { name })}
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{t("memberNumber")}</dt>
          <dd className="display tabular mt-1 text-2xl" dir="ltr">
            {memberNumber}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("tempPassword")}</dt>
          <dd className="mt-1 select-all font-mono text-2xl" dir="ltr">
            {tempPassword}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted">{t("issuedNote")}</p>
    </div>
  );
}
