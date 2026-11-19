import { describe, expect, it } from "vitest";
import {
  bannersForPlacement,
  dateToLocalInput,
  isBannerImagePath,
  isBannerLink,
  isBannerLive,
  localInputToDate,
  type BannerLike,
} from "@/lib/banners";

const HOUR = 3_600_000;
const now = new Date("2026-11-19T12:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * HOUR);
const banner = (o: Partial<BannerLike>): BannerLike => ({
  id: "b1",
  placement: "top_bar",
  active: true,
  startsAt: null,
  endsAt: null,
  dismissible: true,
  sortOrder: 0,
  createdAt: at(-24),
  ...o,
});

describe("isBannerLive", () => {
  it("active with no dates is live; inactive never is", () => {
    expect(isBannerLive(banner({}), now)).toBe(true);
    expect(isBannerLive(banner({ active: false }), now)).toBe(false);
    expect(isBannerLive(banner({ active: false, startsAt: at(-1), endsAt: at(1) }), now)).toBe(false);
  });

  it("starts at startsAt (inclusive)", () => {
    expect(isBannerLive(banner({ startsAt: at(1) }), now)).toBe(false);
    expect(isBannerLive(banner({ startsAt: now }), now)).toBe(true);
    expect(isBannerLive(banner({ startsAt: at(-1) }), now)).toBe(true);
  });

  it("ends at endsAt (exclusive)", () => {
    expect(isBannerLive(banner({ endsAt: at(1) }), now)).toBe(true);
    expect(isBannerLive(banner({ endsAt: now }), now)).toBe(false);
    expect(isBannerLive(banner({ endsAt: at(-1) }), now)).toBe(false);
  });

  it("an end before the start is never live", () => {
    expect(isBannerLive(banner({ startsAt: at(1), endsAt: at(-1) }), now)).toBe(false);
  });
});

describe("bannersForPlacement", () => {
  const list = [
    banner({ id: "late", sortOrder: 2 }),
    banner({ id: "first", sortOrder: 0, createdAt: at(-48) }),
    banner({ id: "newer", sortOrder: 0, createdAt: at(-1) }),
    banner({ id: "shop", placement: "shop" }),
    banner({ id: "off", active: false }),
    banner({ id: "future", startsAt: at(2) }),
    banner({ id: "ended", endsAt: at(-2) }),
    banner({ id: "fixed", sortOrder: 1, dismissible: false }),
  ];
  const ids = (bs: BannerLike[]) => bs.map((b) => b.id);

  it("returns only live banners of that placement, in the admin's order, newest first on ties", () => {
    expect(ids(bannersForPlacement(list, "top_bar", now))).toEqual(["newer", "first", "fixed", "late"]);
    expect(ids(bannersForPlacement(list, "shop", now))).toEqual(["shop"]);
    expect(bannersForPlacement(list, "packages", now)).toEqual([]);
  });

  it("picks up scheduled banners as time passes", () => {
    expect(ids(bannersForPlacement(list, "top_bar", at(3)))).toContain("future");
    expect(ids(bannersForPlacement(list, "top_bar", at(-3)))).toContain("ended");
  });

  it("hides dismissed banners, but only dismissible ones", () => {
    expect(ids(bannersForPlacement(list, "top_bar", now, { dismissed: ["newer", "fixed"] }))).toEqual(["first", "fixed", "late"]);
  });

  it("limits the count and leaves the input untouched", () => {
    const before = ids(list);
    expect(ids(bannersForPlacement(list, "top_bar", now, { limit: 1 }))).toEqual(["newer"]);
    expect(bannersForPlacement(list, "top_bar", now, { limit: 0 })).toEqual([]);
    expect(ids(list)).toEqual(before);
  });
});

describe("banner links and images", () => {
  it("allows site paths and https links", () => {
    expect(isBannerLink("/packages")).toBe(true);
    expect(isBannerLink("/ar/shop?category=protein")).toBe(true);
    expect(isBannerLink("https://wa.me/962795556818")).toBe(true);
  });

  it("rejects anything that could open another site or run script", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "/\t/evil.example", "http://example.com", "javascript:alert(1)", "packages", "", "https://"]) {
      expect(isBannerLink(bad), bad).toBe(false);
    }
  });

  it("images must be uploads or files on this site", () => {
    expect(isBannerImagePath("/media/banner-x-desktop/abc")).toBe(true);
    expect(isBannerImagePath("/images/hero.jpg")).toBe(true);
    for (const bad of ["https://cdn.example/x.jpg", "/api/admin/export", "//cdn.example/x.jpg", "/images"]) {
      expect(isBannerImagePath(bad), bad).toBe(false);
    }
  });
});

describe("schedule times (Amman wall clock)", () => {
  it("reads the form value as Amman time (UTC+3)", () => {
    expect(localInputToDate("2026-12-01T09:00")?.toISOString()).toBe("2026-12-01T06:00:00.000Z");
    expect(localInputToDate("2026-12-01T00:30")?.toISOString()).toBe("2026-11-30T21:30:00.000Z");
  });

  it("round-trips for the admin form", () => {
    expect(dateToLocalInput(new Date("2026-12-01T06:00:00Z"))).toBe("2026-12-01T09:00");
    expect(dateToLocalInput(localInputToDate("2027-03-31T23:59")!)).toBe("2027-03-31T23:59");
  });

  it("follows daylight-saving time in zones that have it", () => {
    expect(localInputToDate("2026-07-01T12:00", "America/New_York")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(localInputToDate("2026-01-15T12:00", "America/New_York")?.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("rejects values that aren't a real date and time", () => {
    for (const bad of ["", "2026-12-01", "2026-12-01 09:00", "2026-02-30T10:00", "2026-13-01T10:00", "2026-12-01T24:00"]) {
      expect(localInputToDate(bad), bad).toBeNull();
    }
  });
});
