"use client";

import { useActionState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { saveBusiness, saveContent, type ContentState } from "./content-actions";

function Footer({ state, pending }: { state: ContentState; pending: boolean }) {
  const t = useTranslations("admin.content");
  const tc = useTranslations("common");
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-bg/90 p-4 backdrop-blur">
      <Button type="submit" disabled={pending}>
        {pending ? tc("loading") : tc("save")}
      </Button>
      <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
        {state.ok ? tc("saved") : state.error ? t("invalid", { keys: (state.badKeys ?? []).join(", ") }) : ""}
      </p>
    </div>
  );
}

/** Wraps the server-rendered text fields of one section. */
export function ContentForm({ ns, children }: { ns: string; children: ReactNode }) {
  const locale = useLocale();
  const [state, action, pending] = useActionState<ContentState, FormData>(saveContent, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ns" value={ns} />
      <input type="hidden" name="locale" value={locale} />
      {children}
      <Footer state={state} pending={pending} />
    </form>
  );
}

export function BusinessForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState<ContentState, FormData>(saveBusiness, {});
  return (
    <form action={action} className="space-y-4">
      {children}
      <Footer state={state} pending={pending} />
    </form>
  );
}
