import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import type { PageProps } from "@/lib/metadata";
import { legal, LEGAL_UPDATED, type LegalDoc } from "@/content/legal";
import { Container } from "@/components/ui/primitives";

const DOCS: LegalDoc[] = ["terms", "privacy", "refunds", "shipping"];
type Props = PageProps<{ doc: string }>;

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, doc } = await params;
  const d = DOCS.find((x) => x === doc);
  if (!d) return {};
  const t = await getTranslations({ locale: locale === "en" ? "en" : "ar", namespace: "legal" });
  return { title: t(d), alternates: { canonical: `/${locale}/legal/${d}`, languages: { ar: `/ar/legal/${d}`, en: `/en/legal/${d}` } } };
}

export default async function LegalPage({ params }: Props) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  const d = DOCS.find((x) => x === doc);
  if (!d) notFound();
  const t = await getTranslations({ locale, namespace: "legal" });
  const f = await getFormatter({ locale });
  const sections = legal[d][locale === "en" ? "en" : "ar"];

  return (
    <article className="pb-24 pt-36">
      <Container className="max-w-3xl">
        <p role="note" className="mb-10 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t("draft")}
        </p>
        <h1 className="display text-4xl sm:text-5xl">{t(d)}</h1>
        <p className="mt-3 text-sm text-muted">
          {t("updated")}: {f.dateTime(new Date(LEGAL_UPDATED), { dateStyle: "long" })}
        </p>
        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="display text-xl">{s.h}</h2>
              {s.p.map((p, i) => (
                <p key={i} className="mt-3 text-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Container>
    </article>
  );
}
