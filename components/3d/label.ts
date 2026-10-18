/**
 * Procedural product label, drawn on a 2D canvas from product data.
 * Shared by the 3D CanvasTexture and the admin "label preview" — new products
 * look right with zero modelling work. No three.js import here on purpose.
 */
export type LabelData = {
  brand: string;
  name: string;
  flavor?: string | null;
  size?: string | null;
  labelColor: string;
  accentColor: string;
  rtl?: boolean;
};

function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function fontStack(varName: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/** Draws a label onto `canvas` (any size, 2:1 recommended). */
export function drawLabel(canvas: HTMLCanvasElement, d: LabelData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const dark = luminance(d.labelColor) < 0.35;
  const ink = dark ? "#F4F2EE" : "#07080A";
  const muted = dark ? "rgba(244,242,238,.6)" : "rgba(7,8,10,.6)";
  const latin = fontStack("--font-latin", "system-ui, sans-serif");
  const arabic = fontStack("--font-ar-display", "system-ui, sans-serif");
  const display = d.rtl ? `${arabic}` : `${latin}`;

  // Base + subtle vertical sheen
  ctx.fillStyle = d.labelColor;
  ctx.fillRect(0, 0, W, H);
  const sheen = ctx.createLinearGradient(0, 0, W, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.48, dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.25)");
  sheen.addColorStop(0.52, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // The label's "front" is the middle half of the wrap-around texture.
  const x0 = W * 0.27;
  const cw = W * 0.46;

  // Accent bands
  ctx.fillStyle = d.accentColor;
  ctx.fillRect(0, H * 0.08, W, H * 0.018);
  ctx.fillRect(0, H * 0.9, W, H * 0.018);
  ctx.fillRect(x0, H * 0.24, cw * 0.18, H * 0.012);

  ctx.textBaseline = "alphabetic";
  ctx.direction = d.rtl ? "rtl" : "ltr";
  ctx.textAlign = d.rtl ? "right" : "left";
  const tx = d.rtl ? x0 + cw : x0;

  // Brand (Latin, tracked)
  ctx.fillStyle = muted;
  ctx.font = `600 ${Math.round(H * 0.05)}px ${latin}`;
  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  const brand = d.brand.toUpperCase().split("").join(String.fromCharCode(8202));
  ctx.fillText(brand, x0, H * 0.2);
  ctx.restore();

  // Product name
  ctx.fillStyle = ink;
  const size = Math.round(H * 0.105);
  ctx.font = `800 ${size}px ${display}`;
  const lines = wrap(ctx, d.name, cw);
  lines.forEach((l, i) => ctx.fillText(l, tx, H * 0.38 + i * size * 1.15));

  // Flavor / size
  const meta = [d.flavor, d.size].filter(Boolean).join("  ·  ");
  if (meta) {
    ctx.fillStyle = d.accentColor;
    ctx.font = `600 ${Math.round(H * 0.055)}px ${d.rtl ? fontStack("--font-ar-body", "system-ui") : latin}`;
    ctx.fillText(meta, tx, H * 0.38 + lines.length * size * 1.15 + H * 0.04);
  }

  // GG mark (simple chamfer squares) bottom corner
  ctx.strokeStyle = muted;
  ctx.lineWidth = H * 0.008;
  const s = H * 0.06;
  const gx = d.rtl ? x0 : x0 + cw - s * 2.3;
  const gy = H * 0.76;
  for (let k = 0; k < 2; k++) {
    const ox = gx + k * s * 1.2;
    const c = s * 0.28;
    ctx.beginPath();
    ctx.moveTo(ox + c, gy);
    ctx.lineTo(ox + s - c, gy);
    ctx.lineTo(ox + s, gy + c);
    ctx.lineTo(ox + s, gy + s - c);
    ctx.lineTo(ox + s - c, gy + s);
    ctx.lineTo(ox + c, gy + s);
    ctx.lineTo(ox, gy + s - c);
    ctx.lineTo(ox, gy + c);
    ctx.closePath();
    ctx.stroke();
  }

  // Faint grain
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}
