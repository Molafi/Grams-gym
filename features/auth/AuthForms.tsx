"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { changePassword, registerMember, signInWithMemberNumber, type AuthFormState } from "./actions";

function ErrorLine({ state }: { state: AuthFormState }) {
  const t = useTranslations("auth.errors");
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {t(state.error)}
    </p>
  );
}

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInWithMemberNumber, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("memberNumber")}</span>
        <input name="memberNumber" required inputMode="text" autoComplete="username" placeholder="GG-00042" className="field" dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("password")}</span>
        <input name="password" type="password" required autoComplete="current-password" className="field" dir="ltr" />
      </label>
      <ErrorLine state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? tc("loading") : t("signIn")}
      </Button>
      <p className="text-center text-xs text-muted">{t("forgot")}</p>
    </form>
  );
}

/** `bonusHint`: the "add your email too and get a free day" line (empty when the reward is off). */
export function RegisterForm({ callbackUrl, bonusHint = "" }: { callbackUrl: string; bonusHint?: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerMember, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("name")}</span>
        <input name="name" required minLength={2} maxLength={80} autoComplete="name" className="field" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("phone")}</span>
        <input name="phone" type="tel" required autoComplete="tel" placeholder="07X XXX XXXX" className="field text-start" dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("emailOptional")}</span>
        <input name="email" type="email" autoComplete="email" className="field" dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("newPassword")}</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" dir="ltr" />
        <span className="mt-1 block text-xs text-muted">{t("passwordHint")}</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("confirmPassword")}</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("referrerOptional")}</span>
        <input name="referrer" maxLength={20} placeholder="GG-00042" autoComplete="off" className="field" dir="ltr" />
        <span className="mt-1 block text-xs text-muted">{t("referrerHint")}</span>
      </label>
      {bonusHint ? <p className="text-xs text-muted">{bonusHint}</p> : null}
      <ErrorLine state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? tc("loading") : t("createAccount")}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("currentPassword")}</span>
        <input name="current" type="password" required autoComplete="current-password" className="field" dir="ltr" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("newPassword")}</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" dir="ltr" />
        <span className="mt-1 block text-xs text-muted">{t("passwordHint")}</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{t("confirmPassword")}</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" dir="ltr" />
      </label>
      <ErrorLine state={state} />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : t("changePassword")}
        </Button>
        {state.ok ? (
          <p aria-live="polite" className="text-sm text-success">
            {t("passwordChanged")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
