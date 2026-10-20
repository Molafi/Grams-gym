import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search } from "lucide-react";
import { firstParam, type PageProps } from "@/lib/metadata";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { flatten, LOCKED_NAMESPACES, namespaceOf, placeholders } from "@/lib/content-keys";
import { BUSINESS_FIELDS, getBusiness, businessDefaults } from "@/lib/business";
import { Link } from "@/lib/i18n/navigation";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { BusinessForm, ContentForm } from "@/features/admin/ContentForms";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

const AR = flatten(ar);
const EN = flatten(en);
const NAMESPACES = [...new Set(Object.keys(EN).map(namespaceOf))].filter((n) => !LOCKED_NAMESPACES.has(n));
const BUSINESS = "business";

const rowsFor = (len: number) => Math.min(8, Math.max(1, Math.ceil(len / 70)));

export default async function AdminContentPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, "ADMIN", `/${locale}/admin/content`);
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim().toLowerCase() ?? "";
  const nsParam = firstParam(sp.ns) ?? "home";
  const ns = nsParam === BUSINESS || NAMESPACES.includes(nsParam) ? nsParam : "home";
  const t = await getTranslations({ locale, namespace: "admin.content" });
  // Section/field labels are looked up by computed keys, which the typed translator can't check.
  const tl = t as unknown as ((key: string) => string) & { has: (key: string) => boolean };
  const nsLabel = (n: string) => (tl.has(`ns.${n}`) ? tl(`ns.${n}`) : n);

  const overrides = await db.contentOverride.findMany({ select: { locale: true, key: true, value: true } });
  const current = { ar: { ...AR }, en: { ...EN } };
  const edited = new Set<string>();
  for (const o of overrides) {
    if (o.key in current[o.locale]) {
      current[o.locale][o.key] = o.value;
      edited.add(o.key);
    }
  }
  const editedPerNs = new Map<string, number>();
  for (const k of edited) editedPerNs.set(namespaceOf(k), (editedPerNs.get(namespaceOf(k)) ?? 0) + 1);

  // A search looks across every section; otherwise show the selected one.
  const keys = Object.keys(EN).filter((k) =>
    q
      ? !LOCKED_NAMESPACES.has(namespaceOf(k)) &&
        [k, current.ar[k], current.en[k]].some((v) => v?.toLowerCase().includes(q))
      : namespaceOf(k) === ns,
  );
  const byNs = new Map<string, string[]>();
  for (const k of keys) byNs.set(namespaceOf(k), [...(byNs.get(namespaceOf(k)) ?? []), k]);

  const biz = ns === BUSINESS && !q ? await getBusiness() : null;
  const bizDefaults = businessDefaults();
  const bizValues: Record<string, string> = biz
    ? {
        phoneDisplay: biz.phone.display,
        addressAr: biz.address.ar,
        addressEn: biz.address.en,
        whatsappAr: biz.whatsapp.ar,
        whatsappEn: biz.whatsapp.en,
        ...Object.fromEntries(biz.hours.flatMap((h) => [[`hours.${h.key}.ar`, h.label.ar], [`hours.${h.key}.en`, h.label.en]])),
      }
    : {};

  const renderField = (k: string) => {
    const ph = placeholders(EN[k] ?? "");
    return (
      <div key={k} className="grid gap-3 border-b border-hairline py-5 last:border-0 lg:grid-cols-[220px_1fr_1fr]">
        <div className="text-xs">
          <p className="break-all font-mono text-muted" dir="ltr">
            {k}
          </p>
          {edited.has(k) ? <Badge tone="warning" className="mt-2">{t("edited")}</Badge> : null}
          {ph.length ? (
            <p className="mt-2 text-muted">
              {t("keep")}{" "}
              <span className="font-mono text-ink" dir="ltr">
                {ph.join(" ")}
              </span>
            </p>
          ) : null}
        </div>
        {(["ar", "en"] as const).map((l) => {
          const def = (l === "ar" ? AR : EN)[k] ?? "";
          const val = current[l][k] ?? "";
          return (
            <label key={l} className="block">
              <span className="mb-1 block text-xs text-muted">{l === "ar" ? "العربية" : "English"}</span>
              <textarea name={`${l}:${k}`} defaultValue={val} rows={rowsFor(Math.max(val.length, def.length))} dir={l === "ar" ? "rtl" : "ltr"} className="field resize-y text-sm" />
              {val !== def ? (
                <span className="mt-1 block text-[11px] text-muted" dir={l === "ar" ? "rtl" : "ltr"}>
                  {t("default")}: {def}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </div>

      <form method="get" className="flex gap-3" role="search">
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder={t("search")} className="field ps-11" />
        </label>
        <Button type="submit" variant="glass">
          {t("searchButton")}
        </Button>
      </form>

      <nav aria-label={t("sections")} className="flex flex-wrap gap-2">
        {[BUSINESS, ...NAMESPACES].map((n) => (
          <Link
            key={n}
            href={{ pathname: "/admin/content", query: { ns: n } }}
            aria-current={!q && n === ns ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${!q && n === ns ? "border-ember bg-ember/10 text-ink" : "border-hairline text-muted hover:text-ink"}`}
          >
            {nsLabel(n)}
            {editedPerNs.get(n) ? <span className="ms-1.5 text-ember">•{editedPerNs.get(n)}</span> : null}
          </Link>
        ))}
      </nav>

      {biz ? (
        <Card className="p-6">
          <h2 className="display mb-1 text-xl">{t("ns.business")}</h2>
          <p className="mb-4 text-sm text-muted">{t("businessIntro")}</p>
          <BusinessForm>
            {BUSINESS_FIELDS.map(({ key, dir }) => (
              <label key={key} className="grid gap-2 border-b border-hairline py-4 last:border-0 lg:grid-cols-[220px_1fr]">
                <span className="text-sm text-muted">{tl(`business.${key.replace(/\./g, "_")}`)}</span>
                <span>
                  <input name={key} defaultValue={bizValues[key]} placeholder={bizDefaults[key]} dir={dir} className="field text-sm" />
                </span>
              </label>
            ))}
          </BusinessForm>
        </Card>
      ) : keys.length === 0 ? (
        <p className="py-12 text-center text-muted">{t("nothing")}</p>
      ) : (
        [...byNs.entries()].map(([n, ks]) => (
          <Card key={n} className="px-6 pt-2">
            {q ? <h2 className="pt-4 font-medium">{nsLabel(n)}</h2> : null}
            <ContentForm ns={n}>
              {ks.map(renderField)}
            </ContentForm>
          </Card>
        ))
      )}
    </div>
  );
}
