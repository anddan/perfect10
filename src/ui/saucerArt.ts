// How the saucers of the shop look: a round glossy badge in the colour of the saucer with its sign in white (a clock for the slow one, a ball that is
// crossed out for the sparse one, a sparkle for the special one and a plus for the one that gives points), and the saucer itself with the badge on it.
import type {SaucerKind} from "../game/saucers";
import {drawShopCup} from "./cupArt";

const TAU = Math.PI * 2;

/** The colours of each saucer: its light edge, its middle and its dark edge. */
export const SAUCER_COLORS: Record<SaucerKind, {light: string; mid: string; dark: string}> = {
  slow: {light: "#d8ecff", mid: "#6aa8ea", dark: "#2f5f9e"},
  sparse: {light: "#d6f6df", mid: "#58c27a", dark: "#256f45"},
  special: {light: "#f0dcff", mid: "#b472e8", dark: "#6a2fa0"},
  points: {light: "#fff0b0", mid: "#f2b320", dark: "#8a5208"},
};

/** The badge of a saucer: (x, y) is its middle and r how big it is. */
export function drawSaucerBadge(ctx: CanvasRenderingContext2D, kind: SaucerKind, x: number, y: number, r: number): void {
  const c = SAUCER_COLORS[kind];
  ctx.save();
  ctx.translate(x, y);
  const k = r / 12;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(0.8 * k, 1.8 * k, r, 0, TAU);
  ctx.fill();
  const disc = ctx.createLinearGradient(0, -r, 0, r);
  disc.addColorStop(0, c.light);
  disc.addColorStop(0.45, c.mid);
  disc.addColorStop(1, c.dark);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.6 * k);
  ctx.strokeStyle = c.dark;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.5, r * 0.62, r * 0.3, 0, 0, TAU);
  ctx.fill();
  // The sign.
  ctx.scale(k, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  if (kind === "slow") {
    // A clock.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0.5, 7, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(0, -4);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(3.4, 2.4);
    ctx.stroke();
  } else if (kind === "sparse") {
    // A number (a ball) that is crossed out.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(6, -6);
    ctx.stroke();
  } else if (kind === "special") {
    // A sparkle.
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.quadraticCurveTo(0.8, -0.8, 9, 0);
    ctx.quadraticCurveTo(0.8, 0.8, 0, 9);
    ctx.quadraticCurveTo(-0.8, 0.8, -9, 0);
    ctx.quadraticCurveTo(-0.8, -0.8, 0, -9);
    ctx.closePath();
    ctx.fill();
  } else {
    // A plus.
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-6.5, 0);
    ctx.lineTo(6.5, 0);
    ctx.moveTo(0, -6.5);
    ctx.lineTo(0, 6.5);
    ctx.stroke();
  }
  ctx.restore();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * The bonus for two, three or four saucers of a kind shows as a glow under the saucer: `level` 1 for two of them (a soft glow), 2 for three (a bigger and
 * brighter one) and 3 for four (the brightest). (x, y) is the middle of the saucer, `s` how big it is, `time` seconds (the glow pulses a little).
 */
export function drawSetGlow(ctx: CanvasRenderingContext2D, kind: SaucerKind, x: number, y: number, s: number, level: number, time: number): void {
  if (level <= 0) return;
  const c = SAUCER_COLORS[kind];
  const pulse = 0.88 + 0.12 * Math.sin(time * 3.2);
  const reach = (48 + 16 * level) * s;
  const alpha = Math.min(0.95, (0.22 + 0.2 * level) * pulse);
  ctx.save();
  ctx.translate(x, y + 1 * s);
  ctx.scale(1, 0.4);
  const glow = ctx.createRadialGradient(0, 0, 6 * s, 0, 0, reach);
  glow.addColorStop(0, hexA(c.light, alpha));
  glow.addColorStop(0.5, hexA(c.mid, alpha * 0.55));
  glow.addColorStop(1, hexA(c.mid, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, reach, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Four saucers of a kind: a few small stars twinkle round the saucer, one after the other. */
export function drawSetStars(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number): void {
  for (let i = 0; i < 4; i++) {
    const life = Math.sin(Math.min(1, ((time * 0.9 + i / 4) % 1)) * Math.PI);
    if (life <= 0.02) continue;
    const a = i * 1.7 + 0.6 + time * 0.25;
    const sx = x + Math.cos(a) * 44 * s;
    const sy = y + Math.sin(a) * 13 * s - 5 * s;
    const r = (3.6 + (i % 2) * 1.4) * s * life;
    ctx.save();
    ctx.globalAlpha = life;
    ctx.fillStyle = "#fff6c4";
    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.quadraticCurveTo(sx, sy, sx + r, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + r);
    ctx.quadraticCurveTo(sx, sy, sx - r, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** A saucer on its own (the shop, and the four places under the cups): coloured, with its badge in the middle; none is an empty place with a dashed edge. */
export function drawSaucerPlate(ctx: CanvasRenderingContext2D, kind: SaucerKind | null, x: number, y: number, s = 1, cup = false, level = 0, time = 0): void {
  const rx = 40 * s;
  const ry = 12 * s;
  if (kind) drawSetGlow(ctx, kind, x, y, s, level, time);
  if (!kind) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(110,80,40,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (cup) drawShopCup(ctx, [], x, y - 1.5 * s, 0.69 * s, {cupColor: "porcelain", pattern: "none"});
    return;
  }
  const c = SAUCER_COLORS[kind];
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 3 * s, y + 4 * s, rx, ry, 0, 0, TAU);
  ctx.fill();
  const rim = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  rim.addColorStop(0, c.dark);
  rim.addColorStop(0.35, c.light);
  rim.addColorStop(1, c.mid);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y - 0.5 * s, rx * 0.68, ry * 0.6, 0, 0, TAU);
  ctx.fill();
  // (a natural cup stands on it, if it is shown with one; the saucers have no sign, only their colour)
  if (cup) drawShopCup(ctx, [], x, y - 1.5 * s, 0.69 * s, {cupColor: "porcelain", pattern: "none"});
  if (level >= 3) drawSetStars(ctx, x, y, s, time);
}
