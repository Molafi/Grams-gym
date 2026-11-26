import { describe, expect, it } from "vitest";
import { mirrorToImportRows, toYmd, type MirrorInput } from "@/lib/sync/legacy-members";
import { canUseDefaultPassword, isDefaultPassword } from "@/lib/auth/default-password";
import { formatMemberNumber, parseMemberNumber } from "@/lib/member-number";

const today = { y: 2026, m: 11, d: 26 };
const base = (o: Partial<MirrorInput> = {}): MirrorInput => ({
  members: [{ src_id: 1n, number: "03664", name: "عمرو بسام راشد", gender: 1, mobile: "0795757237", phone: null }],
  programs: [
    { src_id: 1n, name: "1 Month 40" },
    { src_id: 2n, name: "1 Year 320" },
  ],
  offers: [{ src_id: 1n, name: "20%" }],
  subscriptions: [],
  ...o,
});
const sub = (o: Partial<MirrorInput["subscriptions"][number]>) => ({ member_id: 1n, program_id: 1n, offer_id: null, from_date: "2026-11-01", to_date: "2026-12-01", freezed: 0, ...o });

describe("membership numbers", () => {
  it("are shown as five digits, without GG-", () => {
    expect(formatMemberNumber(3664)).toBe("03664");
    expect(formatMemberNumber(42)).toBe("00042");
    expect(formatMemberNumber(50000)).toBe("50000");
  });

  it("are read with or without leading zeros and the old GG- prefix", () => {
    expect(parseMemberNumber("03664")).toBe(3664);
    expect(parseMemberNumber("3664")).toBe(3664);
    expect(parseMemberNumber("GG-03664")).toBe(3664);
    expect(parseMemberNumber("abc")).toBeNull();
  });
});

describe("default password (first sign-in of imported members)", () => {
  const member = { passwordHash: null, importedAt: new Date(), role: "MEMBER", isTestAccount: false, isGuest: false };

  it("is the membership number, with or without leading zeros", () => {
    expect(isDefaultPassword("03664", 3664)).toBe(true);
    expect(isDefaultPassword(" 3664 ", 3664)).toBe(true);
    expect(isDefaultPassword("٠٣٦٦٤", 3664)).toBe(true);
    expect(isDefaultPassword("03665", 3664)).toBe(false);
    expect(isDefaultPassword("GG-03664", 3664)).toBe(false);
    expect(isDefaultPassword("", 3664)).toBe(false);
  });

  it("only works for imported members who haven't set a password", () => {
    expect(canUseDefaultPassword(member)).toBe(true);
    expect(canUseDefaultPassword({ ...member, passwordHash: "scrypt$..." })).toBe(false);
    expect(canUseDefaultPassword({ ...member, importedAt: null })).toBe(false);
  });

  it("never works for staff, admins, test or guest accounts", () => {
    expect(canUseDefaultPassword({ ...member, role: "ADMIN" })).toBe(false);
    expect(canUseDefaultPassword({ ...member, role: "STAFF" })).toBe(false);
    expect(canUseDefaultPassword({ ...member, isTestAccount: true })).toBe(false);
    expect(canUseDefaultPassword({ ...member, isGuest: true })).toBe(false);
  });
});

describe("mirrorToImportRows", () => {
  it("maps a member and a membership period", () => {
    const { rows, skippedMembers, skippedPeriods } = mirrorToImportRows(base({ subscriptions: [sub({ program_id: 2n, offer_id: 1n, from_date: "2026-07-28", to_date: "2027-07-23" })] }), today);
    expect(skippedMembers).toBe(0);
    expect(skippedPeriods).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      memberNumber: 3664,
      name: "عمرو بسام راشد",
      phone: "0795757237",
      phoneDigits: "0795757237",
      gender: "male",
      program: "1 Year 320",
      offer: "20%",
      from: { y: 2026, m: 7, d: 28 },
      to: { y: 2027, m: 7, d: 23 },
      frozen: false,
      interval: "yearly",
    });
  });

  it("keeps members without any membership (they still get an account)", () => {
    const { rows } = mirrorToImportRows(base(), today);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ memberNumber: 3664, from: null, to: null });
  });

  it("skips members without a usable number or name", () => {
    const { rows, skippedMembers } = mirrorToImportRows(
      base({
        members: [
          { src_id: 1, number: "", name: "No number", gender: 1, mobile: null, phone: null },
          { src_id: 2, number: "00042", name: "  ", gender: 1, mobile: null, phone: null },
          { src_id: 3, number: "٠٠٠٤٣", name: null, name_x: "Khair Aldeen Abaza", gender: 2, mobile: null, phone: "+962 79 111 2233" },
        ],
      }),
      today,
    );
    expect(skippedMembers).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ memberNumber: 43, name: "Khair Aldeen Abaza", gender: "female", phoneDigits: "0791112233" });
  });

  it("marks frozen periods and reads Postgres dates (UTC midnight) and BigInt ids", () => {
    const { rows } = mirrorToImportRows(base({ subscriptions: [sub({ from_date: new Date("2026-11-01T00:00:00Z"), to_date: new Date("2027-02-01T00:00:00Z"), freezed: 1 })] }), today);
    expect(rows[0]).toMatchObject({ frozen: true, from: { y: 2026, m: 11, d: 1 }, to: { y: 2027, m: 2, d: 1 }, interval: "monthly" });
  });

  it("drops periods with missing, impossible or reversed dates, or of unknown members", () => {
    const { rows, skippedPeriods } = mirrorToImportRows(
      base({
        subscriptions: [
          sub({ from_date: null }),
          sub({ to_date: "0000-00-00" }),
          sub({ from_date: "2026-12-01", to_date: "2026-11-01" }),
          sub({ member_id: 99n }),
          sub({}),
        ],
      }),
      today,
    );
    expect(skippedPeriods).toBe(4);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ from: { y: 2026, m: 11, d: 1 } });
  });

  it("copies the latest period plus those that ended within the last year", () => {
    const { rows, skippedPeriods } = mirrorToImportRows(
      base({
        subscriptions: [
          sub({ from_date: "2023-01-01", to_date: "2023-02-01" }),
          sub({ from_date: "2025-12-01", to_date: "2026-01-01" }),
          sub({ from_date: "2026-11-01", to_date: "2026-12-01" }),
        ],
      }),
      today,
    );
    expect(rows.map((r) => r.to)).toEqual([
      { y: 2026, m: 12, d: 1 },
      { y: 2026, m: 1, d: 1 },
    ]);
    expect(skippedPeriods).toBe(1);

    // Someone who stopped coming years ago still gets their last membership.
    const old = mirrorToImportRows(base({ subscriptions: [sub({ from_date: "2019-01-01", to_date: "2019-02-01" })] }), today);
    expect(old.rows).toHaveLength(1);
    expect(old.rows[0]).toMatchObject({ to: { y: 2019, m: 2, d: 1 } });
  });

  it("counts a period in both the live and the archive table once, using the live copy", () => {
    const { rows, skippedPeriods } = mirrorToImportRows(
      base({
        subscriptions: [sub({ freezed: 0 }), sub({ freezed: 1, archived: true })],
      }),
      today,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.frozen).toBe(false);
    expect(skippedPeriods).toBe(1);
  });
});

describe("toYmd", () => {
  it("accepts dates and ISO strings, rejects zero and impossible dates", () => {
    expect(toYmd("2026-02-28")).toEqual({ y: 2026, m: 2, d: 28 });
    expect(toYmd("2026-02-30")).toBeNull();
    expect(toYmd("0000-00-00")).toBeNull();
    expect(toYmd(new Date("2026-05-17T00:00:00Z"))).toEqual({ y: 2026, m: 5, d: 17 });
    expect(toYmd(null)).toBeNull();
  });
});
