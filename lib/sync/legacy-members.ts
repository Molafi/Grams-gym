/**
 * Turns the mirrored tables of the old gym program (legacy_members, legacy_subscriptions,
 * legacy_subscriptionsx, legacy_programs, legacy_offers; see lib/sync/legacy-schema.ts) into the
 * rows the member import understands (lib/legacy-import.ts → features/admin/legacy-import.ts).
 * Pure: no database, so it is unit-tested.
 */
import { intervalFor, latinDigits, programMonths, ymdIso, type ImportRow, type Ymd } from "@/lib/legacy-import";
import { parseMemberNumber } from "@/lib/member-number";
import { phoneDigits } from "@/lib/phone";

/** Ids arrive as numbers, BigInts (Postgres bigint) or strings. */
type Id = number | bigint | string | null | undefined;
/** Dates arrive as Date (Postgres date → UTC midnight) or "YYYY-MM-DD" strings. */
type DateLike = Date | string | null | undefined;

export type MirrorMember = { src_id: Id; number: string | null; name: string | null; name_x?: string | null; gender: number | null; mobile: string | null; phone: string | null };
export type MirrorProgram = { src_id: Id; name: string | null };
export type MirrorOffer = { src_id: Id; name: string | null };
export type MirrorSubscription = {
  member_id: Id;
  program_id: Id;
  offer_id: Id;
  from_date: DateLike;
  to_date: DateLike;
  freezed: number | null;
  /** From the archive table (subscriptionsx). The live table wins when both have the same period. */
  archived?: boolean;
};

export type MirrorInput = { members: MirrorMember[]; programs: MirrorProgram[]; offers: MirrorOffer[]; subscriptions: MirrorSubscription[] };

export type MirrorResult = {
  rows: ImportRow[];
  /** Members left out: no usable membership number or no name. */
  skippedMembers: number;
  /** Periods left out: unknown member, missing or impossible dates, or older than a year and not the member's latest. */
  skippedPeriods: number;
};

/** Besides each member's latest period, periods that ended within this many days are copied. */
export const HISTORY_DAYS = 366;

function toId(v: Id): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

function validYmd(y: number, m: number, d: number): Ymd | null {
  if (y < 1990 || y > 2100) return null; // also rejects MySQL zero dates
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}

export function toYmd(v: DateLike): Ymd | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : validYmd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  return m ? validYmd(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

function addDays(v: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(v.y, v.m - 1, v.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const clip = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

type Period = { from: Ymd; to: Ymd; program: string | null; offer: string | null; frozen: boolean };

export function mirrorToImportRows(input: MirrorInput, today: Ymd): MirrorResult {
  const names = (list: { src_id: Id; name: string | null }[]) => {
    const out = new Map<number, string>();
    for (const r of list) {
      const id = toId(r.src_id);
      const name = clip(r.name, 120);
      if (id !== null && name) out.set(id, name);
    }
    return out;
  };
  const programs = names(input.programs);
  const offers = names(input.offers);

  type Member = Pick<ImportRow, "memberNumber" | "name" | "phone" | "phoneDigits" | "gender">;
  const members = new Map<number, Member>();
  let skippedMembers = 0;
  for (const m of input.members) {
    const id = toId(m.src_id);
    const memberNumber = parseMemberNumber(latinDigits(String(m.number ?? "")));
    const name = clip(m.name, 120) ?? clip(m.name_x, 120);
    if (id === null || !memberNumber || !name) {
      skippedMembers++;
      continue;
    }
    const phone = clip(latinDigits(m.mobile?.trim() ? m.mobile : (m.phone ?? "")), 30);
    const digits = phone ? phoneDigits(phone) : "";
    members.set(id, {
      memberNumber,
      name,
      phone,
      phoneDigits: digits.length >= 7 && digits.length <= 15 ? digits : null,
      gender: m.gender === 1 ? "male" : m.gender === 2 ? "female" : null,
    });
  }

  // One entry per (member, from, to). Archive rows first, so the live table's copy wins.
  const periods = new Map<number, Map<string, Period>>();
  let skippedPeriods = 0;
  const ordered = [...input.subscriptions.filter((s) => s.archived), ...input.subscriptions.filter((s) => !s.archived)];
  for (const s of ordered) {
    const memberId = toId(s.member_id);
    const from = toYmd(s.from_date);
    const to = toYmd(s.to_date);
    if (memberId === null || !members.has(memberId) || !from || !to || ymdIso(to) < ymdIso(from)) {
      skippedPeriods++;
      continue;
    }
    const programId = toId(s.program_id);
    const offerId = toId(s.offer_id);
    const list = periods.get(memberId) ?? new Map<string, Period>();
    const key = `${ymdIso(from)}:${ymdIso(to)}`;
    if (list.has(key)) skippedPeriods++; // the same period in both tables
    list.set(key, {
      from,
      to,
      program: programId === null ? null : (programs.get(programId) ?? null),
      offer: offerId === null ? null : (offers.get(offerId) ?? null),
      frozen: Boolean(Number(s.freezed ?? 0)),
    });
    periods.set(memberId, list);
  }

  const cutoff = ymdIso(addDays(today, -HISTORY_DAYS));
  const rows: ImportRow[] = [];
  let line = 0;
  for (const [id, member] of members) {
    const list = [...(periods.get(id)?.values() ?? [])].sort((a, b) => ymdIso(b.to).localeCompare(ymdIso(a.to)) || ymdIso(b.from).localeCompare(ymdIso(a.from)));
    if (list.length === 0) {
      rows.push({ line: ++line, ...member, program: null, from: null, to: null, frozen: false, offer: null, notes: null, interval: "monthly" });
      continue;
    }
    list.forEach((p, i) => {
      if (i > 0 && ymdIso(p.to) < cutoff) {
        skippedPeriods++;
        return;
      }
      rows.push({
        line: ++line,
        ...member,
        program: p.program,
        from: p.from,
        to: p.to,
        frozen: p.frozen,
        offer: p.offer,
        notes: null,
        interval: intervalFor(programMonths(p.program, p.from, p.to)),
      });
    });
  }
  return { rows, skippedMembers, skippedPeriods };
}
