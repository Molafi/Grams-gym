import { describe, expect, it } from "vitest";
import { bleedColors, polygonArea, traceOutlines } from "@/lib/logo-trace";

/** RGBA image of `w × h` where `solid(x, y)` pixels are opaque white and the rest transparent. */
function image(w: number, h: number, solid: (x: number, y: number) => boolean) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) px.set([255, 255, 255, 255], (y * w + x) * 4);
  return px;
}
const inBox = (x: number, y: number, x0: number, y0: number, size: number) => x >= x0 && x < x0 + size && y >= y0 && y < y0 + size;
const area = (pts: [number, number][]) => Math.abs(polygonArea(pts));

describe("polygonArea", () => {
  it("is positive counter-clockwise (y up) and negative clockwise", () => {
    const ccw: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    expect(polygonArea(ccw)).toBe(4);
    expect(polygonArea([...ccw].reverse())).toBe(-4);
  });
});

describe("traceOutlines", () => {
  it("finds nothing in an empty image", () => {
    expect(traceOutlines(image(8, 8, () => false), 8, 8)).toEqual([]);
  });

  it("traces a square along the pixel edges", () => {
    const out = traceOutlines(image(20, 20, (x, y) => inBox(x, y, 5, 5, 10)), 20, 20);
    expect(out).toHaveLength(1);
    expect(out[0]!.holes).toHaveLength(0);
    // 10 × 10 px, minus the tiny corner cuts of marching squares.
    expect(area(out[0]!.outer)).toBeGreaterThan(99);
    expect(area(out[0]!.outer)).toBeLessThanOrEqual(100);
    for (const [x, y] of out[0]!.outer) {
      expect(x).toBeGreaterThanOrEqual(5 - 0.01);
      expect(x).toBeLessThanOrEqual(15 + 0.01);
      expect(y).toBeGreaterThanOrEqual(5 - 0.01);
      expect(y).toBeLessThanOrEqual(15 + 0.01);
    }
  });

  it("keeps a hole inside its piece (like the inside of an A)", () => {
    const out = traceOutlines(image(30, 30, (x, y) => inBox(x, y, 5, 5, 20) && !inBox(x, y, 12, 12, 6)), 30, 30);
    expect(out).toHaveLength(1);
    expect(out[0]!.holes).toHaveLength(1);
    expect(area(out[0]!.outer)).toBeGreaterThan(399);
    expect(area(out[0]!.holes[0]!)).toBeGreaterThan(35);
    expect(area(out[0]!.holes[0]!)).toBeLessThan(36.5);
  });

  it("returns separate pieces separately, and a piece inside a hole as its own piece", () => {
    const two = traceOutlines(image(30, 12, (x, y) => inBox(x, y, 1, 1, 10) || inBox(x, y, 18, 1, 10)), 30, 12);
    expect(two).toHaveLength(2);
    expect(two.every((o) => o.holes.length === 0)).toBe(true);

    const island = traceOutlines(image(40, 40, (x, y) => (inBox(x, y, 4, 4, 30) && !inBox(x, y, 11, 11, 16)) || inBox(x, y, 17, 17, 4)), 40, 40);
    expect(island).toHaveLength(2);
    const [ring, inner] = island;
    expect(ring!.holes).toHaveLength(1);
    expect(inner!.holes).toHaveLength(0);
    expect(area(inner!.outer)).toBeGreaterThan(15);
    expect(area(inner!.outer)).toBeLessThan(16.5);
  });

  it("handles pieces touching the image border", () => {
    const out = traceOutlines(image(6, 6, () => true), 6, 6);
    expect(out).toHaveLength(1);
    expect(area(out[0]!.outer)).toBeGreaterThan(35);
  });

  it("drops specks smaller than minArea", () => {
    const px = image(20, 20, (x, y) => inBox(x, y, 2, 2, 10) || (x === 16 && y === 16));
    expect(traceOutlines(px, 20, 20)).toHaveLength(1);
    expect(traceOutlines(px, 20, 20, { minArea: 0.1 })).toHaveLength(2);
  });

  it("follows anti-aliased edges between pixels", () => {
    // Column 5 is half transparent: the edge sits half-way into it.
    const px = image(12, 12, (x, y) => x >= 2 && x <= 5 && y >= 2 && y <= 9);
    for (let y = 2; y <= 9; y++) px[(y * 12 + 5) * 4 + 3] = 128;
    const xs = traceOutlines(px, 12, 12)[0]!.outer.map(([x]) => x);
    expect(Math.max(...xs)).toBeGreaterThan(5.4);
    expect(Math.max(...xs)).toBeLessThan(6);
  });
});

describe("bleedColors", () => {
  it("fills transparent pixels with the nearest opaque colour and makes everything opaque", () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
    bleedColors(px, 3, 1, 1);
    expect([...px.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    // Only one pixel deep after one pass; the third pixel keeps its colour but becomes opaque.
    expect([...px.slice(8, 12)]).toEqual([0, 0, 0, 255]);

    const deeper = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
    bleedColors(deeper, 3, 1, 2);
    expect([...deeper.slice(8, 12)]).toEqual([255, 0, 0, 255]);
  });
});
