"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { resetMemberPassword, type AdminState } from "./actions";
import { IssuedCredentials } from "./IssuedCredentials";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminState, FormData>(resetMemberPassword, {});
  return (
    <div>
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(t("resetPasswordConfirm"))) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={pending} className="text-xs text-muted hover:text-ember">
          {pending ? tc("loading") : t("resetPassword")}
        </button>
      </form>
      {state.error ? <p className="mt-1 text-xs text-danger">{tc("error")}</p> : null}
      {state.ok && state.tempPassword && state.memberNumber ? (
        <div className="mt-3 min-w-[280px]">
          <IssuedCredentials name={state.name ?? ""} memberNumber={state.memberNumber} tempPassword={state.tempPassword} />
        </div>
      ) : null}
    </div>
  );
}
