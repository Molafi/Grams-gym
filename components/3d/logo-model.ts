"use client";

import { CanvasTexture, ExtrudeGeometry, Path, Shape, ShapeUtils, SRGBColorSpace, Vector2 } from "three";
import { bleedColors, traceOutlines, type Pt } from "@/lib/logo-trace";

/** The logo as a solid: material groups 0 = front (the artwork), 1 = sides, 2 = back. */
export type LogoBuild = { geometry: ExtrudeGeometry; texture: CanvasTexture; width: number; height: number };

/** Bigger images are scaled down first: finer detail isn't visible at the size the logo is shown. */
const MAX_SIDE = 1024;
/** A logo with more outline points than this is too intricate to extrude: the drawn GG is used. */
const MAX_POINTS = 20_000;
/** The default logo file is 447 px; detail settings scale from there. */
const BASE_SIDE = 447;
/** Thickness and edge rounding, as a share of the image's longest side. */
const DEPTH = 0.06;
const BEVEL_THICKNESS = 0.006;
const BEVEL_SIZE = 0.0025;

/**
 * Builds the 3D logo from a logo image with a transparent background: the outline of every
 * opaque piece (G letters, arms, "GRAMS GYM" letters) is extruded, and the image itself is the
 * front face, so the model looks exactly like the logo. Null when the image can't be cut out
 * (no transparent background, e.g. a JPG) or is too intricate.
 */
export function buildLogo(img: HTMLImageElement): LogoBuild | null {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;
  const k = Math.min(1, MAX_SIDE / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));
  const side = Math.max(w, h);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);

  let clear = 0;
  for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i]! < 128) clear++;
  const clearShare = clear / (w * h);
  if (clearShare < 0.05 || clearShare > 0.98) return null;

  const unit = side / BASE_SIDE;
  const outlines = traceOutlines(pixels.data, w, h, { epsilon: 0.45 * unit, minArea: 8 * unit * unit });
  const points = outlines.reduce((n, o) => n + o.outer.length + o.holes.reduce((m, hole) => m + hole.length, 0), 0);
  if (outlines.length === 0 || points > MAX_POINTS) return null;

  // Image pixels (y down) → model units (longest side = 1, y up).
  const toModel = (pts: Pt[]) => pts.map(([x, y]) => new Vector2(x / side, (h - y) / side));
  const shapes = outlines.map((o) => {
    const outer = toModel(o.outer);
    // three.js expects outlines clockwise and holes counter-clockwise.
    if (!ShapeUtils.isClockWise(outer)) outer.reverse();
    const shape = new Shape(outer);
    shape.holes = o.holes.map((hole) => {
      const pts = toModel(hole);
      if (ShapeUtils.isClockWise(pts)) pts.reverse();
      return new Path(pts);
    });
    return shape;
  });

  // Every vertex samples the image at its own position: the front shows the artwork, and the
  // sides (just outside the outline, where bleedColors copied the edge colour) match their edge.
  const uv = (v: ArrayLike<number>, i: number) => new Vector2((v[i * 3]! * side) / w, (v[i * 3 + 1]! * side) / h);
  const geometry = new ExtrudeGeometry(shapes, {
    depth: DEPTH,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelSegments: 2,
    UVGenerator: {
      generateTopUV: (_g, v, a, b, c) => [uv(v, a), uv(v, b), uv(v, c)],
      generateSideWallUV: (_g, v, a, b, c, d) => [uv(v, a), uv(v, b), uv(v, c), uv(v, d)],
    },
  });

  // ExtrudeGeometry gives each shape one group for both lids (back and front, same size) and
  // one for the sides. Split the lids so the back can be plain while the front shows the logo.
  const position = geometry.getAttribute("position");
  const groups = geometry.groups.map((g) => ({ ...g }));
  geometry.clearGroups();
  for (const g of groups) {
    if (g.materialIndex !== 0) {
      geometry.addGroup(g.start, g.count, 1);
      continue;
    }
    const half = g.count / 2;
    const firstIsBack = position.getZ(g.start) < position.getZ(g.start + half);
    geometry.addGroup(g.start, half, firstIsBack ? 2 : 0);
    geometry.addGroup(g.start + half, half, firstIsBack ? 0 : 2);
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);

  bleedColors(pixels.data, w, h, 6);
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  return { geometry, texture, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
}

const builds = new Map<string, Promise<LogoBuild | null>>();

/** Loads and builds the 3D logo once per image URL (pages share it). Null = use the drawn GG. */
export function loadLogo(src: string): Promise<LogoBuild | null> {
  let build = builds.get(src);
  if (!build) {
    build = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`couldn't load ${src}`));
      img.src = src;
    })
      .then(buildLogo)
      .catch((e: unknown) => {
        console.warn("[3d] logo:", e instanceof Error ? e.message : e);
        return null;
      });
    builds.set(src, build);
  }
  return build;
}
