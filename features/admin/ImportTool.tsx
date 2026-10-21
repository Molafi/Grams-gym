"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Eye, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DateOrder, ImportField, ImportIssue } from "@/lib/legacy-import";
import { formatMemberNumber } from "@/lib/member-number";

type Preview = {
  columns: Partial<Record<ImportField, string>>;
  dateOrder: DateOrder;
  rows: number;
  members: number;
  periods: number;
  active: number;
  sample: { line: number; number: string; name: string; phone: string | null; gender: string | null; program: string | null; from: string | null; to: string | null; frozen: boolean }[];
  skipped: ImportIssue[];
  skippedCount: number;
  warnings: ImportIssue[];
  warningsCount: number;
};

type Summary = {
  members: number;
  membersCreated: number;
  membersUpdated: number;
  membersUnchanged: number;
  subscriptionsCreated: number;
  subscriptionsExisting: number;
  conflicts: number[];
  sharedPhones: number[];
  renumberedDemo: number;
};

const ERRORS = ["empty", "noHeader", "tooBig", "noPlan", "readOnly", "forbidden", "generic"] as const;
type ErrorCode = (typeof ERRORS)[number];
const asError = (v: unknown): ErrorCode => (ERRORS as readonly unknown[]).includes(v) ? (v as ErrorCode) : "generic";

const FIELDS: ImportField[] = ["number", "name", "phone", "gender", "program", "from", "to", "frozen", "offer", "notes"];

export function ImportTool({ plans }: { plans: { slug: string; name: string }[] }) {
  const t = useTranslations("admin.import");
  const [text, setText] = useState("");
  const [plan, setPlan] = useState(plans[0]?.slug ?? "");
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function send(mode: "preview" | "import") {
    if (!text.trim()) return setError("empty");
    setBusy(mode);
    setError(null);
    if (mode === "preview") setSummary(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, plan: plan || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; summary?: Summary } & Partial<Preview>;
      if (!res.ok || !body.ok) return setError(asError(body.error));
      if (mode === "preview") setPreview(body as Preview);
      else setSummary(body.summary ?? null);
    } catch {
      setError("generic");
    } finally {
      setBusy(null);
    }
  }

  async function readFile(file: File) {
    // Excel "CSV UTF-8" reads fine; a plain Arabic-Windows CSV is windows-1256.
    let s = await file.text();
    if (s.includes("\uFFFD")) s = new TextDecoder("windows-1256").decode(await file.arrayBuffer());
    setText(s);
    setPreview(null);
    setSummary(null);
    setError(null);
  }

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h2 className="font-medium">{t("howTitle")}</h2>
        <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-muted">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
          <li>{t("how4")}</li>
        </ol>
      </section>

      <section className="card space-y-4 p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">{t("pasteLabel")}</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
              setSummary(null);
            }}
            rows={10}
            dir="auto"
            spellCheck={false}
            placeholder={t("pastePlaceholder")}
            className="field resize-y font-mono text-xs"
          />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-hairline-strong px-3 py-2.5 text-sm text-muted hover:text-ink">
            <FileUp className="h-4 w-4" aria-hidden /> {t("file")}
            <input
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
          <label className="min-w-[220px]">
            <span className="mb-1 block text-xs text-muted">{t("plan")}</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="field">
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="glass" onClick={() => void send("preview")} disabled={busy !== null}>
            <Eye className="h-4 w-4" aria-hidden /> {busy === "preview" ? "…" : t("preview")}
          </Button>
        </div>
        <p className="text-xs text-muted">{t("planHint")}</p>
        {error ? (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {t(`errors.${error}`)}
          </p>
        ) : null}
      </section>

      {preview ? (
        <section className="card space-y-5 p-6">
          <dl className="grid gap-4 sm:grid-cols-4">
            {(["rows", "members", "periods", "active"] as const).map((k) => (
              <div key={k}>
                <dt className="text-xs text-muted">{t(k === "active" ? "activeNow" : k)}</dt>
                <dd className="display tabular mt-1 text-3xl">{preview[k]}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-sm font-medium">{t("columns")}</h3>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {FIELDS.map((f) => (
                <li key={f} className={`rounded-full border px-3 py-1 ${preview.columns[f] ? "border-hairline-strong" : "border-hairline text-muted"}`}>
                  {t(`fields.${f}`)}: <span dir="auto">{preview.columns[f] ?? t("notFound")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {t("dateOrder")}: {t(`orders.${preview.dateOrder}`)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <h3 className="mb-2 text-sm font-medium">{t("sample")}</h3>
            <table className="w-full text-start text-xs">
              <thead className="text-muted">
                <tr>
                  {(["number", "name", "phone", "gender", "program", "from", "to"] as const).map((f) => (
                    <th key={f} className="py-1.5 pe-4 text-start font-normal">
                      {t(`fields.${f}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.line} className="border-t border-hairline">
                    <td className="py-1.5 pe-4 font-mono" dir="ltr">
                      {r.number}
                    </td>
                    <td className="py-1.5 pe-4" dir="auto">
                      {r.name}
                    </td>
                    <td className="py-1.5 pe-4 font-mono" dir="ltr">
                      {r.phone ?? "—"}
                    </td>
                    <td className="py-1.5 pe-4">{r.gender ?? "—"}</td>
                    <td className="py-1.5 pe-4" dir="auto">
                      {r.program ?? "—"}
                    </td>
                    <td className="py-1.5 pe-4 font-mono" dir="ltr">
                      {r.from ?? "—"}
                    </td>
                    <td className="py-1.5 pe-4 font-mono" dir="ltr">
                      {r.to ?? "—"}
                      {r.frozen ? ` (${t("fields.frozen")})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(["skipped", "warnings"] as const).map((k) => {
            const count = k === "skipped" ? preview.skippedCount : preview.warningsCount;
            return count > 0 ? (
              <div key={k} className="text-xs">
                <h3 className="text-sm font-medium">
                  {t(k)} ({count})
                </h3>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {(k === "skipped" ? preview.skipped : preview.warnings).map((i) => (
                    <li key={`${k}-${i.line}`}>
                      {t("line", { line: i.line })}: {t(`reasons.${i.reason}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}
          <Button type="button" onClick={() => void send("import")} disabled={busy !== null || preview.members === 0}>
            <Upload className="h-4 w-4" aria-hidden /> {busy === "import" ? "…" : t("import", { count: preview.members })}
          </Button>
        </section>
      ) : null}

      {summary ? (
        <section role="status" className="card space-y-4 border-success/40 p-6">
          <h2 className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden /> {t("done")}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-5">
            {(
              [
                ["created", summary.membersCreated],
                ["updated", summary.membersUpdated],
                ["unchanged", summary.membersUnchanged],
                ["subsCreated", summary.subscriptionsCreated],
                ["subsExisting", summary.subscriptionsExisting],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{t(k)}</dt>
                <dd className="display tabular mt-1 text-2xl">{v}</dd>
              </div>
            ))}
          </dl>
          {summary.conflicts.length ? (
            <p className="text-sm text-warning">{t("conflicts", { numbers: summary.conflicts.map(formatMemberNumber).join(", ") })}</p>
          ) : null}
          {summary.sharedPhones.length ? (
            <p className="text-sm text-muted">{t("sharedPhones", { numbers: summary.sharedPhones.map(formatMemberNumber).join(", ") })}</p>
          ) : null}
          {summary.renumberedDemo ? <p className="text-sm text-muted">{t("renumbered", { count: summary.renumberedDemo })}</p> : null}
          <p className="text-sm text-muted">{t("next")}</p>
        </section>
      ) : null}
    </div>
  );
}
