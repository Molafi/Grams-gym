/**
 * Turns a transparent logo image into outlines that can be extruded into a 3D model
 * (components/3d/logo-model.ts). Pure functions (no DOM, no three.js) so they are unit-testable.
 *
 * Coordinates are image pixels: x to the right, y down.
 */
export type Pt = [number, number];

/** One solid piece of the logo: its outline and the holes inside it (e.g. the inside of an "A"). */
export type Outline = { outer: Pt[]; holes: Pt[][] };

export type TraceOptions = {
  /** Alpha value (0–255) the outline follows. */
  level?: number;
  /** Largest distance (px) a simplified outline may stray from the traced one. */
  epsilon?: number;
  /** Pieces and holes smaller than this (px²) are dropped: stray specks in the artwork. */
  minArea?: number;
};

/** Signed area (shoelace). Positive for counter-clockwise in a y-up system. */
export function polygonArea(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j]![0] * pts[i]![1] - pts[i]![0] * pts[j]![1];
  return a / 2;
}

function pointInPolygon([x, y]: Pt, pts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ramer–Douglas–Peucker on an open polyline (first and last points kept). */
function simplifyOpen(pts: Pt[], eps: number): Pt[] {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const eps2 = eps * eps;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s]!;
    const [bx, by] = pts[e]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let worstD = eps2;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i]!;
      let d: number;
      if (len2 === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const cross = dx * (py - ay) - dy * (px - ax);
        d = (cross * cross) / len2;
      }
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([s, worst], [worst, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** RDP for a closed loop: split at the point farthest from the first one, simplify both halves. */
function simplifyClosed(pts: Pt[], eps: number): Pt[] {
  if (pts.length <= 4 || eps <= 0) return pts;
  let far = 0;
  let best = -1;
  const [x0, y0] = pts[0]!;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i]![0] - x0) ** 2 + (pts[i]![1] - y0) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = simplifyOpen(pts.slice(0, far + 1), eps);
  const b = simplifyOpen([...pts.slice(far), pts[0]!], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/**
 * Outlines of the opaque parts of an RGBA image (marching squares on the alpha channel, with
 * sub-pixel edges from the anti-aliasing), simplified, with every hole attached to the piece
 * around it. A piece inside a hole becomes its own outline.
 */
export function traceOutlines(rgba: ArrayLike<number>, w: number, h: number, opts: TraceOptions = {}): Outline[] {
  const level = opts.level ?? 127.5;
  const eps = opts.epsilon ?? 0.4;
  const minArea = opts.minArea ?? 8;

  // Samples sit at pixel centres, with a transparent border around the image:
  // sample (X, Y) is pixel (X - 1, Y - 1), at position (X - 0.5, Y - 0.5).
  const GW = w + 2;
  const GH = h + 2;
  const val = (X: number, Y: number) => (X < 1 || Y < 1 || X > w || Y > h ? 0 : rgba[((Y - 1) * w + (X - 1)) * 4 + 3]!);
  const HORIZONTAL = GW * GH; // vertical edge ids start after the horizontal ones

  // Crossing points (one per grid edge the outline crosses) and their two neighbours.
  const index = new Map<number, number>();
  const xs: number[] = [];
  const ys: number[] = [];
  const nb: number[] = [];
  const point = (id: number, x: number, y: number) => {
    let i = index.get(id);
    if (i === undefined) {
      i = xs.length;
      index.set(id, i);
      xs.push(x);
      ys.push(y);
      nb.push(-1, -1);
    }
    return i;
  };
  const cross = (v0: number, v1: number) => (level - v0) / (v1 - v0);
  const top = (X: number, Y: number) => point(Y * GW + X, X - 0.5 + cross(val(X, Y), val(X + 1, Y)), Y - 0.5);
  const bottom = (X: number, Y: number) => point((Y + 1) * GW + X, X - 0.5 + cross(val(X, Y + 1), val(X + 1, Y + 1)), Y + 0.5);
  const left = (X: number, Y: number) => point(HORIZONTAL + Y * GW + X, X - 0.5, Y - 0.5 + cross(val(X, Y), val(X, Y + 1)));
  const right = (X: number, Y: number) => point(HORIZONTAL + Y * GW + X + 1, X + 0.5, Y - 0.5 + cross(val(X + 1, Y), val(X + 1, Y + 1)));
  const link = (a: number, b: number) => {
    nb[2 * a] === -1 ? (nb[2 * a] = b) : (nb[2 * a + 1] = b);
    nb[2 * b] === -1 ? (nb[2 * b] = a) : (nb[2 * b + 1] = a);
  };

  for (let Y = 0; Y < GH - 1; Y++) {
    for (let X = 0; X < GW - 1; X++) {
      const tl = val(X, Y);
      const tr = val(X + 1, Y);
      const br = val(X + 1, Y + 1);
      const bl = val(X, Y + 1);
      const c = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const centreIn = (tl + tr + br + bl) / 4 > level;
      switch (c) {
        case 1:
        case 14:
          link(left(X, Y), bottom(X, Y));
          break;
        case 2:
        case 13:
          link(bottom(X, Y), right(X, Y));
          break;
        case 3:
        case 12:
          link(left(X, Y), right(X, Y));
          break;
        case 4:
        case 11:
          link(top(X, Y), right(X, Y));
          break;
        case 6:
        case 9:
          link(top(X, Y), bottom(X, Y));
          break;
        case 7:
        case 8:
          link(left(X, Y), top(X, Y));
          break;
        case 5: // top-right and bottom-left inside
          if (centreIn) {
            link(left(X, Y), top(X, Y));
            link(bottom(X, Y), right(X, Y));
          } else {
            link(top(X, Y), right(X, Y));
            link(left(X, Y), bottom(X, Y));
          }
          break;
        case 10: // top-left and bottom-right inside
          if (centreIn) {
            link(top(X, Y), right(X, Y));
            link(left(X, Y), bottom(X, Y));
          } else {
            link(left(X, Y), top(X, Y));
            link(bottom(X, Y), right(X, Y));
          }
          break;
      }
    }
  }

  // Walk the crossing points into closed loops.
  const visited = new Uint8Array(xs.length);
  const loops: Pt[][] = [];
  for (let start = 0; start < xs.length; start++) {
    if (visited[start]) continue;
    const loop: Pt[] = [];
    let prev = -1;
    let cur = start;
    let closed = false;
    while (cur >= 0 && !visited[cur]) {
      visited[cur] = 1;
      loop.push([xs[cur]!, ys[cur]!]);
      const a = nb[2 * cur]!;
      const b = nb[2 * cur + 1]!;
      const next = a !== prev ? a : b;
      prev = cur;
      cur = next;
      if (cur === start) closed = true;
    }
    if (!closed || loop.length < 3) continue;
    const simple = simplifyClosed(loop, eps);
    if (simple.length >= 3 && Math.abs(polygonArea(simple)) >= minArea) loops.push(simple);
  }

  // Nesting: biggest first; each loop's parent is the smallest bigger loop that contains it.
  const areas = loops.map((l) => Math.abs(polygonArea(l)));
  const boxes = loops.map((l) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of l) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1] as const;
  });
  const order = loops.map((_, i) => i).sort((i, j) => areas[j]! - areas[i]!);
  const parent = new Array<number>(loops.length).fill(-1);
  const depth = new Array<number>(loops.length).fill(0);
  for (let k = 0; k < order.length; k++) {
    const i = order[k]!;
    const bi = boxes[i]!;
    for (let m = k - 1; m >= 0; m--) {
      const j = order[m]!;
      const bj = boxes[j]!;
      if (bi[0] < bj[0] || bi[1] < bj[1] || bi[2] > bj[2] || bi[3] > bj[3]) continue;
      if (pointInPolygon(loops[i]![0]!, loops[j]!)) {
        parent[i] = j;
        depth[i] = depth[j]! + 1;
        break;
      }
    }
  }

  const outlines = new Map<number, Outline>();
  for (const i of order) if (depth[i]! % 2 === 0) outlines.set(i, { outer: loops[i]!, holes: [] });
  for (const i of order) if (depth[i]! % 2 === 1) outlines.get(parent[i]!)?.holes.push(loops[i]!);
  return [...outlines.values()];
}

/**
 * Gives every transparent pixel the colour of the nearest opaque ones (in place, `passes`
 * pixels deep) and makes the image fully opaque. Texture filtering then never blends the
 * logo's edges with black, and the extruded sides pick up the colour of their edge.
 */
export function bleedColors(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, passes: number, level = 127.5): void {
  let known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) known[i] = rgba[i * 4 + 3]! > level ? 1 : 0;
  for (let pass = 0; pass < passes; pass++) {
    const next = known.slice();
    let changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
            const j = yy * w + xx;
            if (!known[j]) continue;
            r += rgba[j * 4]!;
            g += rgba[j * 4 + 1]!;
            b += rgba[j * 4 + 2]!;
            n++;
          }
        }
        if (n > 0) {
          rgba[i * 4] = Math.round(r / n);
          rgba[i * 4 + 1] = Math.round(g / n);
          rgba[i * 4 + 2] = Math.round(b / n);
          next[i] = 1;
          changed = true;
        }
      }
    }
    known = next;
    if (!changed) break;
  }
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = 255;
}
