/**
 * Reads member / subscription lists from the old gym program: a table copied from its
 * screen (Ctrl+A, Ctrl+C → tab-separated) or an Excel/CSV export. Columns are found by
 * their titles (English or Arabic). Pure: no database, safe to unit-test.
 */
import { parseMemberNumber } from "./member-number";
import { phoneDigits } from "./phone";

export const IMPORT_FIELDS = ["number", "name", "gender", "phone", "program", "from", "to", "frozen", "offer", "notes"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export type Ymd = { y: number; m: number; d: number };
export type DateOrder = "dmy" | "mdy" | "ymd";
export type Interval = "monthly" | "quarterly" | "yearly";

export type ImportRow = {
  line: number;
  memberNumber: number;
  name: string;
  phone: string | null;
  phoneDigits: string | null;
  gender: "male" | "female" | null;
  program: string | null;
  from: Ymd | null;
  to: Ymd | null;
  frozen: boolean;
  offer: string | null;
  notes: string | null;
  interval: Interval;
};

export type ImportIssue = { line: number; reason: "noNumber" | "noName" | "badDate" | "endBeforeStart" };

export type ParseResult =
  | { ok: false; error: "empty" | "noHeader" }
  | {
      ok: true;
      columns: Partial<Record<ImportField, string>>;
      dateOrder: DateOrder;
      rows: ImportRow[];
      /** Rows not imported at all. */
      skipped: ImportIssue[];
      /** Rows imported as a member, but without a membership period. */
      warnings: ImportIssue[];
    };

/** Column titles, best match first. Compared after `norm()`. */
const ALIASES: Record<ImportField, string[]> = {
  number: ["member #", "member#", "member no", "member number", "membership number", "membership no", "member id", "no", "#", "code", "id", "رقم العضو", "رقم العضوية", "رقم المشترك", "الرقم", "رقم", "الكود", "كود"],
  name: ["member", "member name", "name", "full name", "customer", "client", "اسم العضو", "الاسم", "العضو", "المشترك", "اسم المشترك"],
  gender: ["gender", "sex", "الجنس", "النوع"],
  phone: ["mobile", "mobile no", "mobile number", "phone", "phone no", "phone number", "tel", "telephone", "الموبايل", "رقم الموبايل", "الهاتف", "رقم الهاتف", "الجوال", "رقم الجوال", "الخلوي", "موبايل", "هاتف"],
  program: ["program", "programme", "plan", "package", "subscription", "subscription type", "membership", "البرنامج", "الاشتراك", "نوع الاشتراك", "الباقة"],
  from: ["from", "start", "start date", "from date", "begin", "starts", "من", "من تاريخ", "تاريخ البداية", "البداية", "بداية الاشتراك", "تاريخ البدء"],
  to: ["to", "end", "end date", "to date", "until", "expiry", "expiry date", "expires", "ends", "الى", "إلى", "الي", "الى تاريخ", "إلى تاريخ", "تاريخ النهاية", "النهاية", "نهاية الاشتراك", "تاريخ الانتهاء"],
  frozen: ["frozen", "freeze", "مجمد", "تجميد"],
  offer: ["offer", "discount", "promo", "العرض", "عرض", "الخصم"],
  notes: ["notes", "note", "remarks", "comment", "comments", "ملاحظات", "ملاحظة"],
};

/** Arabic-Indic and Persian digits → 0-9. */
const latinDigits = (s: string) =>
  s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10));

/** Lower-case, no Arabic diacritics/tatweel, one space, no trailing ":" or ".". */
function norm(s: string): string {
  return latinDigits(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:.]+$/, "")
    .trim();
}

const ALIAS_INDEX = new Map<string, { field: ImportField; rank: number }>();
for (const field of IMPORT_FIELDS) {
  ALIASES[field].forEach((alias, rank) => ALIAS_INDEX.set(norm(alias), { field, rank }));
}

function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { "\t": 0, ";": 0, ",": 0 };
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  // Ties prefer tab (copied tables), then ";" (Excel in some regions), then ",".
  return (["\t", ";", ","] as const).reduce((best, d) => ((counts[d] ?? 0) > (counts[best] ?? 0) ? d : best), "\t" as string);
}

/** CSV/TSV with quoted fields ("a, b" and "" escapes). */
function splitTable(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Header cell index for each field found (best alias wins when two columns match). */
function mapHeader(cells: string[]): Partial<Record<ImportField, number>> {
  const best: Partial<Record<ImportField, { index: number; rank: number }>> = {};
  cells.forEach((cell, index) => {
    const hit = ALIAS_INDEX.get(norm(cell));
    if (!hit) return;
    const current = best[hit.field];
    if (!current || hit.rank < current.rank) best[hit.field] = { index, rank: hit.rank };
  });
  const out: Partial<Record<ImportField, number>> = {};
  for (const f of IMPORT_FIELDS) if (best[f]) out[f] = best[f]!.index;
  return out;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const NUMERIC_DATE = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})/;
const NAMED_DATE = /^(\d{1,2})[\s\-/]+([a-z]{3,9})[\s\-/,]+(\d{2,4})/;

export function detectDateOrder(samples: string[]): DateOrder {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const raw of samples) {
    const m = NUMERIC_DATE.exec(latinDigits(raw.trim()));
    if (!m) continue;
    if (m[1]!.length === 4) return "ymd";
    if (Number(m[1]) > 12) firstOver12 = true;
    if (Number(m[2]) > 12) secondOver12 = true;
  }
  // Jordan writes day/month/year; only switch when the data can't be day-first.
  return secondOver12 && !firstOver12 ? "mdy" : "dmy";
}

function validYmd(y: number, m: number, d: number): Ymd | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}

export function parseDate(raw: string, order: DateOrder): Ymd | null {
  const s = latinDigits(raw.trim()).toLowerCase();
  if (!s) return null;
  const named = NAMED_DATE.exec(s);
  if (named) {
    const month = MONTHS[named[2]!.slice(0, 3)];
    return month ? validYmd(Number(named[3]), month, Number(named[1])) : null;
  }
  const m = NUMERIC_DATE.exec(s);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[1]!.length === 4) return validYmd(a, b, c);
  return order === "mdy" ? validYmd(c, a, b) : validYmd(c, b, a);
}

export const ymdIso = (v: Ymd) => `${v.y}-${String(v.m).padStart(2, "0")}-${String(v.d).padStart(2, "0")}`;

/** Midnight in Amman (UTC+3 all year since 2022) at the start of `v` + `plusDays`. */
export const startOfAmmanDay = (v: Ymd, plusDays = 0) => new Date(Date.UTC(v.y, v.m - 1, v.d + plusDays) - 3 * 3_600_000);

const MALE = new Set(["male", "m", "man", "ذكر", "رجل", "ذكور"]);
const FEMALE = new Set(["female", "f", "woman", "انثى", "أنثى", "انثي", "سيدة", "امرأة", "إناث", "اناث"]);
const YES = new Set(["yes", "y", "true", "1", "نعم", "مجمد", "✓", "✔", "x"]);

/** Months of a program from its name ("1 Month 100", "3 أشهر", "سنة") or from its dates. */
export function programMonths(program: string | null, from: Ymd | null, to: Ymd | null): number | null {
  if (program) {
    const p = norm(program);
    const months = /(\d+)\s*(?:months?|mon|mths?|شهر|شهور|أشهر|اشهر)/.exec(p);
    if (months) return Number(months[1]);
    const years = /(?:(\d+)\s*)?(?:years?|yrs?|سنة|سنه|سنوات|سنوي)/.exec(p);
    if (years) return 12 * (years[1] ? Number(years[1]) : 1);
    if (/monthly|شهري/.test(p)) return 1;
  }
  if (from && to) {
    const days = (startOfAmmanDay(to, 1).getTime() - startOfAmmanDay(from).getTime()) / 86_400_000;
    return Math.max(1, Math.round(days / 30.4));
  }
  return null;
}

/** Nearest of the site's intervals (1, 3, 12 months); only used for labels and the MRR estimate. */
export const intervalFor = (months: number | null): Interval => (months == null ? "monthly" : months >= 8 ? "yearly" : months >= 2 ? "quarterly" : "monthly");

const clip = (v: string | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

export function parseLegacyTable(input: string): ParseResult {
  const clean = input.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim() !== "");
  if (!firstLine) return { ok: false, error: "empty" };
  const table = splitTable(clean, detectDelimiter(firstLine));

  // The header is the first row (within the first 10) naming a member-number column plus one more known column.
  let headerAt = -1;
  let cols: Partial<Record<ImportField, number>> = {};
  for (let i = 0; i < Math.min(table.length, 10); i++) {
    const mapped = mapHeader(table[i]!);
    if (mapped.number !== undefined && Object.keys(mapped).length >= 2) {
      headerAt = i;
      cols = mapped;
      break;
    }
  }
  if (headerAt < 0) return { ok: false, error: "noHeader" };
  const header = table[headerAt]!;
  const cell = (row: string[], f: ImportField) => (cols[f] === undefined ? undefined : row[cols[f]!]);

  const body = table.slice(headerAt + 1).map((cells, i) => ({ cells, line: headerAt + i + 2 }));
  const dateSamples = body.flatMap(({ cells }) => [cell(cells, "from") ?? "", cell(cells, "to") ?? ""]).filter(Boolean);
  const dateOrder = detectDateOrder(dateSamples);

  const rows: ImportRow[] = [];
  const skipped: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  for (const { cells, line } of body) {
    if (cells.every((c) => c === "")) continue;
    if (cols.number !== undefined && norm(cells[cols.number] ?? "") === norm(header[cols.number] ?? "")) continue; // repeated header
    const memberNumber = parseMemberNumber(latinDigits(cell(cells, "number") ?? ""));
    if (!memberNumber) {
      skipped.push({ line, reason: "noNumber" });
      continue;
    }
    const name = clip(cell(cells, "name"), 120);
    if (!name) {
      skipped.push({ line, reason: "noName" });
      continue;
    }
    const phone = clip(latinDigits(cell(cells, "phone") ?? ""), 30);
    const digits = phone ? phoneDigits(phone) : "";
    const g = norm(cell(cells, "gender") ?? "");
    const fromRaw = cell(cells, "from") ?? "";
    const toRaw = cell(cells, "to") ?? "";
    let from = parseDate(fromRaw, dateOrder);
    let to = parseDate(toRaw, dateOrder);
    if ((fromRaw && !from) || (toRaw && !to)) {
      warnings.push({ line, reason: "badDate" });
      from = to = null;
    } else if (from && to && ymdIso(to) < ymdIso(from)) {
      warnings.push({ line, reason: "endBeforeStart" });
      from = to = null;
    } else if (!from || !to) {
      from = to = null; // a period needs both dates
    }
    const program = clip(cell(cells, "program"), 120);
    rows.push({
      line,
      memberNumber,
      name,
      phone,
      phoneDigits: digits.length >= 7 && digits.length <= 15 ? digits : null,
      gender: MALE.has(g) ? "male" : FEMALE.has(g) ? "female" : null,
      program,
      from,
      to,
      frozen: YES.has(norm(cell(cells, "frozen") ?? "")),
      offer: clip(cell(cells, "offer"), 120),
      notes: clip(cell(cells, "notes"), 300),
      interval: intervalFor(programMonths(program, from, to)),
    });
  }

  const columns: Partial<Record<ImportField, string>> = {};
  for (const f of IMPORT_FIELDS) if (cols[f] !== undefined) columns[f] = header[cols[f]!] ?? "";
  return { ok: true, columns, dateOrder, rows, skipped, warnings };
}
