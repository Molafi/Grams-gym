import { describe, expect, it } from "vitest";
import { addMonths, hasActiveMembership, membershipRemaining, normaliseLsStatus, urgency, type MembershipLike } from "@/lib/membership";

const DAY = 86_400_000;
const now = new Date("2026-10-18T12:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * DAY);
const sub = (o: Partial<MembershipLike>): MembershipLike => ({ status: "active", provider: "lemonsqueezy", renewsAt: at(20), endsAt: null, ...o });

describe("hasActiveMembership", () => {
  it("active and on_trial grant access", () => {
    expect(hasActiveMembership(sub({ status: "active" }), now, 3)).toBe(true);
    expect(hasActiveMembership(sub({ status: "on_trial" }), now, 3)).toBe(true);
  });

  it("cancelled keeps access until endsAt", () => {
    expect(hasActiveMembership(sub({ status: "cancelled", endsAt: at(1) }), now, 3)).toBe(true);
    expect(hasActiveMembership(sub({ status: "cancelled", endsAt: at(-1) }), now, 3)).toBe(false);
    expect(hasActiveMembership(sub({ status: "cancelled", endsAt: null }), now, 3)).toBe(false);
  });

  it("past_due keeps access only inside the grace period", () => {
    expect(hasActiveMembership(sub({ status: "past_due", pastDueSince: at(-2) }), now, 3)).toBe(true);
    expect(hasActiveMembership(sub({ status: "past_due", pastDueSince: at(-4) }), now, 3)).toBe(false);
    expect(hasActiveMembership(sub({ status: "past_due", pastDueSince: at(-2) }), now, 0)).toBe(false);
    // falls back to renewsAt when pastDueSince is unknown
    expect(hasActiveMembership(sub({ status: "past_due", renewsAt: at(-1), pastDueSince: null }), now, 3)).toBe(true);
  });

  it("paused, unpaid and expired deny access", () => {
    for (const status of ["paused", "unpaid", "expired"] as const) {
      expect(hasActiveMembership(sub({ status }), now, 3)).toBe(false);
    }
  });

  it("manual (front-desk) memberships end at endsAt", () => {
    expect(hasActiveMembership(sub({ provider: "manual", renewsAt: null, endsAt: at(5) }), now, 3)).toBe(true);
    expect(hasActiveMembership(sub({ provider: "manual", renewsAt: null, endsAt: at(-0.01) }), now, 3)).toBe(false);
  });

  it("null subscription denies", () => {
    expect(hasActiveMembership(null, now, 3)).toBe(false);
  });
});

describe("membershipRemaining (admin days-left)", () => {
  it("counts whole days up for manual memberships", () => {
    const r = membershipRemaining(sub({ provider: "manual", renewsAt: null, endsAt: at(4.2) }), now, 3);
    expect(r).toMatchObject({ kind: "ends", days: 5 });
    expect(urgency(r)).toBe("soon");
  });

  it("marks auto-renewing card subscriptions as renews (never urgent)", () => {
    const r = membershipRemaining(sub({ renewsAt: at(2) }), now, 3);
    expect(r).toMatchObject({ kind: "renews", days: 2 });
    expect(urgency(r)).toBe("ok");
  });

  it("cancelled shows days until endsAt and is critical when ≤ 3", () => {
    const r = membershipRemaining(sub({ status: "cancelled", endsAt: at(2.5) }), now, 3);
    expect(r).toMatchObject({ kind: "ends", days: 3 });
    expect(urgency(r)).toBe("critical");
  });

  it("past_due counts down the grace window", () => {
    const r = membershipRemaining(sub({ status: "past_due", pastDueSince: at(-1) }), now, 3);
    expect(r).toMatchObject({ kind: "grace", days: 2 });
  });

  it("expired returns none / 0", () => {
    const r = membershipRemaining(sub({ status: "expired", endsAt: at(-10) }), now, 3);
    expect(r.kind).toBe("none");
    expect(r.days).toBe(0);
    expect(urgency(r)).toBe("expired");
  });
});

describe("helpers", () => {
  it("addMonths clamps to the end of shorter months", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonths(new Date("2028-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2027-03-15");
  });

  it("normalises Lemon Squeezy statuses", () => {
    expect(normaliseLsStatus("on_trial")).toBe("on_trial");
    expect(normaliseLsStatus("past_due")).toBe("past_due");
    expect(normaliseLsStatus("something_new")).toBe("expired");
  });
});
