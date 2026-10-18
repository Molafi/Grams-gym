"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/primitives";
import { savePlan, type AdminState } from "./actions";

export type PlanFormData = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  featuresAr: string;
  featuresEn: string;
  priceMonthly: string;
  priceQuarterly: string;
  priceYearly: string;
  recommended: boolean;
  active: boolean;
  isPlaceholder: boolean;
  variants: { interval: string; set: boolean }[];
};

export function PlanForm({ plan }: { plan: PlanFormData }) {
  const t = useTranslations("admin");
  const tf = useTranslations("admin.planFields");
  const tp = useTranslations("admin.productFields");
  const tc = useTranslations("common");
  const tpk = useTranslations("packages");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AdminState, FormData>(savePlan, {});

  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-muted" dir="ltr">
          {plan.slug}
        </p>
        {plan.isPlaceholder ? <Badge tone="warning">{tc("placeholder")}</Badge> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs text-muted">{tp("nameAr")}</span>
          <input name="nameAr" defaultValue={plan.nameAr} className="field" dir="rtl" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{tp("nameEn")}</span>
          <input name="nameEn" defaultValue={plan.nameEn} className="field" dir="ltr" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{tf("taglineAr")}</span>
          <input name="taglineAr" defaultValue={plan.taglineAr} className="field" dir="rtl" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{tf("taglineEn")}</span>
          <input name="taglineEn" defaultValue={plan.taglineEn} className="field" dir="ltr" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{tf("features")} — AR</span>
          <textarea name="featuresAr" defaultValue={plan.featuresAr} rows={4} className="field" dir="rtl" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">{tf("features")} — EN</span>
          <textarea name="featuresEn" defaultValue={plan.featuresEn} rows={4} className="field" dir="ltr" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(["priceMonthly", "priceQuarterly", "priceYearly"] as const).map((k) => (
          <label key={k}>
            <span className="mb-1 block text-xs text-muted">{tf(k)}</span>
            <input name={k} defaultValue={plan[k]} inputMode="decimal" className="field tabular" dir="ltr" />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="recommended" defaultChecked={plan.recommended} className="accent-[#ff7d09]" /> {tpk("recommended")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={plan.active} className="accent-[#ff7d09]" /> {t("active")}
        </label>
        <span className="text-xs text-muted">
          {tf("variantStatus")}:{" "}
          {plan.variants.map((v) => (
            <Badge key={v.interval} tone={v.set ? "success" : "danger"} className="ms-1">
              {v.interval} {v.set ? tf("variantSet") : tf("variantMissing")}
            </Badge>
          ))}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
          {state.ok ? t("saved") : state.error ? tc("error") : ""}
        </p>
      </div>
    </form>
  );
}
