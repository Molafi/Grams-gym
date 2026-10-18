/**
 * Geometric rebuild of the GG monogram: two chamfered-octagon "G" letters,
 * the second mirrored (as on the gym wall / logo). Unit square per letter,
 * centred at the origin, y-up. Shared by the inline SVG mark and the 3D extrusion.
 *
 * NOTE: the flexed-arm detail inside the letters is not reproduced — a clean
 * vector logo from the owner is listed in docs/OWNER-TODO.md.
 */
export type Pt = readonly [number, number];

const c = 0.25; // outer chamfer
const t = 0.2; // stroke thickness
const a = 0.5 - t; // inner half-size
const ci = 0.15; // inner chamfer
const bar = 0.1; // crossbar half-thickness

/** Single closed outline of the left "G" (opening on the right). */
export const G_OUTLINE: Pt[] = [
  [0.5 - c, 0.5],
  [-0.5 + c, 0.5],
  [-0.5, 0.5 - c],
  [-0.5, -0.5 + c],
  [-0.5 + c, -0.5],
  [0.5 - c, -0.5],
  [0.5, -0.5 + c],
  [0.5, bar],
  [0.0, bar],
  [0.0, -bar],
  [a, -bar],
  [a, -a + ci],
  [a - ci, -a],
  [-a + ci, -a],
  [-a, -a + ci],
  [-a, a - ci],
  [-a + ci, a],
  [0.5 - c - (0.5 - a), a], // arm terminal follows the outer chamfer angle
];

export const GG_GAP = 0.12;
export const GG_OFFSET = 0.5 + GG_GAP / 2;

/** Both letters, positioned. Right letter is mirrored (x → -x) with reversed winding. */
export function ggLetters(): Pt[][] {
  const left = G_OUTLINE.map(([x, y]) => [x - GG_OFFSET, y] as const);
  const right = [...G_OUTLINE].reverse().map(([x, y]) => [-x + GG_OFFSET, y] as const);
  return [left, right];
}

/** SVG path data in a viewBox of "-1.1 -0.55 2.2 1.1" (y flipped for SVG). */
export function ggSvgPath(): string {
  return ggLetters()
    .map((pts) => "M" + pts.map(([x, y]) => `${x.toFixed(3)} ${(-y).toFixed(3)}`).join(" L") + " Z")
    .join(" ");
}
