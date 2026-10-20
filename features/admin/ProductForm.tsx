"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { drawLabel } from "@/components/3d/label";
import { saveProduct, type AdminState } from "./actions";

export type ProductFormData = {
  id?: string;
  slug: string;
  category: string;
  brand: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  shape: "tub" | "shaker" | "box";
  labelColor: string;
  accentColor: string;
  glbUrl: string;
  regulatoryRef: string;
  featured: boolean;
  active: boolean;
  variants: { id?: string; sku: string; flavorAr: string; flavorEn: string; sizeLabel: string; price: string; compareAt: string; stock: number; active: boolean }[];
};

const CATEGORIES = ["protein", "creatine", "pre_workout", "amino_acids", "vitamins", "gainers", "accessories"] as const;

function LabelPreview({ data, rtl }: { data: ProductFormData; rtl: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const v = data.variants[0];
    drawLabel(ref.current, {
      brand: data.brand || "BRAND",
      name: (rtl ? data.nameAr : data.nameEn) || "—",
      flavor: v ? (rtl ? v.flavorAr : v.flavorEn) : null,
      size: v?.sizeLabel ?? null,
      labelColor: /^#[0-9a-f]{6}$/i.test(data.labelColor) ? data.labelColor : "#14171D",
      accentColor: /^#[0-9a-f]{6}$/i.test(data.accentColor) ? data.accentColor : "#FF7D09",
      rtl,
    });
  }, [data, rtl]);
  return <canvas ref={ref} width={1024} height={512} className="w-full rounded-xl border border-hairline" aria-hidden />;
}

export function ProductForm({ initial, version }: { initial: ProductFormData; version: string }) {
  const t = useTranslations("admin");
  const tf = useTranslations("admin.productFields");
  const ts = useTranslations("shop.categories");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = useState(initial);
  // After a save the page re-renders with fresh data (new `version`). Reload the form from it
  // so typed stock values and the stock baseline (`stockOrig`) come from the same snapshot;
  // otherwise a second save would re-add units sold in between.
  const [syncedVersion, setSyncedVersion] = useState(version);
  if (version !== syncedVersion) {
    setSyncedVersion(version);
    setData(initial);
  }
  const [state, action, pending] = useActionState<AdminState, FormData>(saveProduct, {});
  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) => setData((d) => ({ ...d, [k]: v }));
  const setVariant = (i: number, patch: Partial<ProductFormData["variants"][number]>) =>
    setData((d) => ({ ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  const text = (k: "slug" | "brand" | "nameAr" | "nameEn" | "glbUrl" | "regulatoryRef", props: { dir?: "ltr" | "rtl"; required?: boolean } = {}) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{tf(k)}</span>
      <input name={k} value={data[k]} onChange={(e) => set(k, e.target.value)} className="field" {...props} />
    </label>
  );

  return (
    <form action={action} className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
      <input type="hidden" name="locale" value={locale} />
      {data.id ? <input type="hidden" name="id" value={data.id} /> : null}
      <input type="hidden" name="variantCount" value={data.variants.length} />

      <div className="space-y-6">
        <div className="card grid gap-4 p-6 md:grid-cols-2">
          {text("slug", { dir: "ltr", required: true })}
          {text("brand", { dir: "ltr", required: true })}
          {text("nameAr", { dir: "rtl", required: true })}
          {text("nameEn", { dir: "ltr", required: true })}
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{tf("category")}</span>
            <select name="category" value={data.category} onChange={(e) => set("category", e.target.value)} className="field">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ts(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{tf("shape")}</span>
            <select name="shape" value={data.shape} onChange={(e) => set("shape", e.target.value as ProductFormData["shape"])} className="field">
              <option value="tub">Tub</option>
              <option value="shaker">Shaker</option>
              <option value="box">Box</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-muted">{tf("descriptionAr")}</span>
            <textarea name="descriptionAr" dir="rtl" rows={3} value={data.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} className="field" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-muted">{tf("descriptionEn")}</span>
            <textarea name="descriptionEn" dir="ltr" rows={3} value={data.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} className="field" />
          </label>
          {text("glbUrl", { dir: "ltr" })}
          {text("regulatoryRef", { dir: "ltr" })}
          <div className="flex gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" checked={data.active} onChange={(e) => set("active", e.target.checked)} className="accent-[#ff7d09]" /> {t("active")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="featured" checked={data.featured} onChange={(e) => set("featured", e.target.checked)} className="accent-[#ff7d09]" /> {t("featured")}
            </label>
          </div>
        </div>

        <fieldset className="card space-y-4 p-6">
          <legend className="px-2 font-medium">{tf("variants")}</legend>
          {data.variants.map((v, i) => (
            <div key={v.id ?? `new-${i}`} className="grid gap-3 rounded-2xl border border-hairline p-4 md:grid-cols-4">
              {v.id ? <input type="hidden" name={`v${i}_id`} value={v.id} /> : null}
              {/* Stock as loaded: the server applies only the change, so sales made while this form is open aren't lost. */}
              {v.id ? <input type="hidden" name={`v${i}_stockOrig`} value={initial.variants.find((iv) => iv.id === v.id)?.stock ?? v.stock} /> : null}
              {(
                [
                  ["sku", "sku", "ltr"],
                  ["flavorAr", "flavorAr", "rtl"],
                  ["flavorEn", "flavorEn", "ltr"],
                  ["sizeLabel", "size", "ltr"],
                  ["price", "priceMajor", "ltr"],
                  ["compareAt", "compareAtMajor", "ltr"],
                ] as const
              ).map(([field, label, dir]) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-xs text-muted">{tf(label)}</span>
                  <input
                    name={`v${i}_${field === "sizeLabel" ? "size" : field}`}
                    value={v[field]}
                    onChange={(e) => setVariant(i, { [field]: e.target.value } as Partial<ProductFormData["variants"][number]>)}
                    className="field"
                    dir={dir}
                    inputMode={field === "price" || field === "compareAt" ? "decimal" : undefined}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs text-muted">{t("stock")}</span>
                <input name={`v${i}_stock`} type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} className="field" dir="ltr" />
              </label>
              <div className="flex items-end justify-between gap-2">
                <label className="flex items-center gap-2 pb-3 text-sm">
                  <input type="checkbox" name={`v${i}_active`} checked={v.active} onChange={(e) => setVariant(i, { active: e.target.checked })} className="accent-[#ff7d09]" /> {t("active")}
                </label>
                {data.variants.length > 1 ? (
                  <button type="button" onClick={() => setData((d) => ({ ...d, variants: d.variants.filter((_, j) => j !== i) }))} className="pb-3 text-muted hover:text-danger" aria-label={tc("delete")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={() => setData((d) => ({ ...d, variants: [...d.variants, { sku: "", flavorAr: "", flavorEn: "", sizeLabel: "", price: "", compareAt: "", stock: 0, active: true }] }))}
          >
            <Plus className="h-4 w-4" aria-hidden /> {tf("addVariant")}
          </Button>
        </fieldset>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-28 xl:h-fit">
        <div className="card space-y-4 p-6">
          <p className="font-medium">{t("labelPreview")}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{tf("labelColor")}</span>
              <input type="color" name="labelColor" value={data.labelColor} onChange={(e) => set("labelColor", e.target.value)} className="h-11 w-full rounded-xl border border-hairline bg-transparent" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{tf("accentColor")}</span>
              <input type="color" name="accentColor" value={data.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-11 w-full rounded-xl border border-hairline bg-transparent" />
            </label>
          </div>
          <LabelPreview data={data} rtl={false} />
          <LabelPreview data={data} rtl />
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? tc("loading") : tc("save")}
          </Button>
          <p aria-live="polite" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
            {state.ok ? t("saved") : state.error ? `${tc("error")} (${state.error})` : ""}
          </p>
        </div>
      </aside>
    </form>
  );
}
