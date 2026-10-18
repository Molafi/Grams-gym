import { describe, expect, it } from "vitest";
import { decimalsFor, formatMoney, lineTotal, rescaleMinor, sumMinor, toMajorString, toMinor } from "@/lib/money";

describe("money (integer minor units)", () => {
  it("JOD has 3 decimals", () => {
    expect(decimalsFor("JOD")).toBe(3);
    expect(decimalsFor("jod")).toBe(3);
    expect(decimalsFor("USD")).toBe(2);
  });

  it("parses decimal strings without float error", () => {
    expect(toMinor("35", "JOD")).toBe(35000);
    expect(toMinor("35.5", "JOD")).toBe(35500);
    expect(toMinor("0.001", "JOD")).toBe(1);
    expect(toMinor("19.99", "USD")).toBe(1999);
    expect(toMinor("0.1", "USD") + toMinor("0.2", "USD")).toBe(30);
  });

  it("rejects too many decimals and garbage", () => {
    expect(() => toMinor("1.0001", "JOD")).toThrow();
    expect(() => toMinor("1.001", "USD")).toThrow();
    expect(() => toMinor("abc", "JOD")).toThrow();
    expect(() => toMinor("1,5", "JOD")).toThrow();
  });

  it("round-trips to a major string", () => {
    expect(toMajorString(35000, "JOD")).toBe("35.000");
    expect(toMajorString(1, "JOD")).toBe("0.001");
    expect(toMajorString(-1500, "USD")).toBe("-15.00");
    expect(toMinor(toMajorString(123456, "JOD"), "JOD")).toBe(123456);
  });

  it("computes line totals and sums with integers only", () => {
    expect(lineTotal(32000, 3)).toBe(96000);
    expect(sumMinor([96000, 2000, 1])).toBe(98001);
    expect(() => lineTotal(10.5, 1)).toThrow();
    expect(() => lineTotal(100, -1)).toThrow();
    expect(() => lineTotal(100, 1.5)).toThrow();
  });

  it("formats JOD with 3 decimals in both locales", () => {
    const en = formatMoney(35500, "JOD", "en");
    const ar = formatMoney(35500, "JOD", "ar");
    expect(en).toMatch(/35\.500/);
    expect(ar).toMatch(/35[.,٫]500/);
  });

  it("rescales between currencies of different precision", () => {
    expect(rescaleMinor(35500, "JOD", "USD")).toBe(3550);
    expect(rescaleMinor(3550, "USD", "JOD")).toBe(35500);
    expect(rescaleMinor(100, "USD", "EUR")).toBe(100);
  });
});
