// The look of the game: the typeface, the colours, and the building blocks every screen is made of
// (outlined text, titles, candy buttons that press down, panels, and the glossy number balls).
// Buttons also register where they are, so a tap can find the one under the finger.

export const FONT = '"Fredoka","Trebuchet MS","Segoe UI",system-ui,sans-serif';
export const TAU = Math.PI * 2;

/** The palette. Warm coffee browns and cream, with gold for what matters and green and red for plus and minus. */
export const CHALK = "#f3ecdd";
export const GOLD = "#ffd54a";
export const GOLD_DEEP = "#e0a114";
export const INK = "#3b2a1a";
export const DARK_OUTLINE = "rgba(24,12,6,0.9)";

// ---- Text -----------------------------------------------------------------------------

/** Bold text with an outline, so it can be read on anything. */
export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  outline: string = DARK_OUTLINE
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.115);
  ctx.strokeStyle = outline;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Plain writing (no outline), for text on paper. */
export function write(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  weight = 600
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** A big title: a gradient of light to deep colour, a thick dark outline, a drop shadow and a shine along the top. */
export function title(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  light = "#fff3b0",
  deep = GOLD_DEEP
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.lineJoin = "round";
  // Shadow, then the outline.
  ctx.lineWidth = size * 0.26;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(s, x, y + size * 0.09);
  ctx.strokeStyle = "#3a1d08";
  ctx.strokeText(s, x, y);
  // The face.
  const face = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  face.addColorStop(0, light);
  face.addColorStop(0.55, light);
  face.addColorStop(0.56, deep);
  face.addColorStop(1, deep);
  ctx.fillStyle = face;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** A number as it is written: with a real minus sign for the negative ones. */
export function signed(v: number): string {
  return v < 0 ? `−${-v}` : String(v);
}

import type {Bonus, Op} from "../game/types";
import type {Lang} from "./i18n";

// ---- Shapes ---------------------------------------------------------------------------

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A soft shadow under a shape: a few fading copies, since a canvas blur is slow on phones. */
export function softShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, spread = 6, alpha = 0.3): void {
  for (let i = spread; i >= 1; i--) {
    ctx.fillStyle = `rgba(8,4,12,${(alpha / spread) * (1 - (i - 1) / (spread + 1))})`;
    roundRect(ctx, x - i * 0.6, y - i * 0.2 + i * 0.9, w + i * 1.2, h + i * 1.2, r + i);
    ctx.fill();
  }
}

/** A small flag, with rounded corners and a little shine: (x, y) is its top left corner. */
export function drawFlag(ctx: CanvasRenderingContext2D, l: Lang, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, 0, 0, w, h, 3);
  ctx.clip();
  if (l === "sv") {
    ctx.fillStyle = "#006aa7";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fecc00";
    ctx.fillRect(w * 0.3 - h * 0.1, 0, h * 0.2, h);
    ctx.fillRect(0, h * 0.4, w, h * 0.2);
  } else if (l === "en") {
    ctx.fillStyle = "#012169";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "butt";
    for (const [color, width] of [["#ffffff", h * 0.22], ["#c8102e", h * 0.08]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h * 0.5 - h * 0.17, w, h * 0.34);
    ctx.fillRect(w * 0.5 - h * 0.17, 0, h * 0.34, h);
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(0, h * 0.5 - h * 0.1, w, h * 0.2);
    ctx.fillRect(w * 0.5 - h * 0.1, 0, h * 0.2, h);
  } else if (l === "es") {
    ctx.fillStyle = "#aa151b";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f1bf00";
    ctx.fillRect(0, h * 0.25, w, h * 0.5);
  } else {
    ctx.fillStyle = "#009246";
    ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = "#ce2b37";
    ctx.fillRect((w * 2) / 3, 0, w / 3 + 1, h);
  }
  const shine = ctx.createLinearGradient(0, 0, 0, h);
  shine.addColorStop(0, "rgba(255,255,255,0.32)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.04)");
  shine.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
  ctx.stroke();
}

// ---- Buttons --------------------------------------------------------------------------

/** Where a button is (game units). */
export interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The buttons drawn this frame, and which one has a finger on it. Rebuilt on every frame. */
export const ui = {
  /** The id of the button that is being pressed (it sinks), or null. */
  pressed: null as string | null,
  /** Pixels per game unit at the start of the frame, to turn drawing coordinates back into game units. */
  px: 1,
  /** The language drop-down is open, and when (game time) it was opened, for the way it slides down. */
  langOpen: false,
  langAt: 0,
  /** Off while a page is drawn into a picture for the page turn: the buttons on it cannot be tapped. */
  registering: true,
};
const hits: {id: string; b: Button}[] = [];

/** Call at the start of a frame, with the context in its base state (scaled to game units). */
export function beginUi(ctx: CanvasRenderingContext2D): void {
  ui.px = ctx.getTransform().a || 1;
  ui.registering = true;
  hits.length = 0;
}

/** Remembers that a rectangle (in the current drawing coordinates) is a button. */
export function registerHit(ctx: CanvasRenderingContext2D, id: string, b: Button): void {
  if (!ui.registering) return;
  const m = ctx.getTransform();
  const k = ui.px;
  hits.push({id, b: {x: (m.a * b.x + m.e) / k, y: (m.d * b.y + m.f) / k, w: (m.a * b.w) / k, h: (m.d * b.h) / k}});
}

/** The button under a point (the one drawn last, on top, wins). */
export function hitTest(x: number, y: number): string | null {
  for (let i = hits.length - 1; i >= 0; i--) {
    const {id, b} = hits[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return id;
  }
  return null;
}

export type ButtonKind = "primary" | "secondary" | "round";

const LOOKS: Record<ButtonKind, {top: string; bottom: string; lip: string; ink: string; outline: string}> = {
  primary: {top: "#ffe98f", bottom: "#f2b320", lip: "#9c610a", ink: "#43270a", outline: "rgba(255,246,206,0.75)"},
  secondary: {top: "#7a7396", bottom: "#4b4468", lip: "#2b2543", ink: "#f6efe0", outline: "rgba(14,8,24,0.85)"},
  round: {top: "#7a7396", bottom: "#4b4468", lip: "#2b2543", ink: "#f6efe0", outline: "rgba(14,8,24,0.85)"},
};

const DEPTH = 5;

/**
 * A candy button: it has a lip underneath that it sinks into when pressed, a glossy top, and an edge of light.
 * `pulse` (a time in seconds) makes it breathe gently, for the button that should be pressed next.
 * `draw` puts something in the middle instead of text (an icon).
 */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  id: string,
  b: Button,
  label: string,
  kind: ButtonKind = "primary",
  opts: {alpha?: number; pulse?: number; size?: number; draw?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string) => void} = {}
): void {
  const look = LOOKS[kind];
  const pressed = ui.pressed === id;
  const r = kind === "round" ? Math.min(b.w, b.h) / 2 : Math.min(b.h / 2, 26);
  const dy = pressed ? DEPTH - 1 : 0;
  const breathe = opts.pulse === undefined || pressed ? 1 : 1 + 0.025 * Math.sin(opts.pulse * 4);

  registerHit(ctx, id, b);

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(breathe, breathe);
  ctx.translate(-b.w / 2, -b.h / 2);

  softShadow(ctx, 0, DEPTH, b.w, b.h, r, 5, 0.34);
  // The lip, which is all that is left of the button's side when it is pressed.
  ctx.fillStyle = look.lip;
  roundRect(ctx, 0, DEPTH, b.w, b.h, r);
  ctx.fill();
  // The face.
  const face = ctx.createLinearGradient(0, dy, 0, dy + b.h);
  face.addColorStop(0, look.top);
  face.addColorStop(1, look.bottom);
  ctx.fillStyle = face;
  roundRect(ctx, 0, dy, b.w, b.h, r);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = look.lip;
  ctx.stroke();
  // An edge of light just inside, and a gloss over the top half.
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 1.5, dy + 1.5, b.w - 3, b.h - 3, Math.max(2, r - 1.5));
  ctx.stroke();
  ctx.save();
  roundRect(ctx, 0, dy, b.w, b.h, r);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, dy, 0, dy + b.h * 0.55);
  gloss.addColorStop(0, "rgba(255,255,255,0.5)");
  gloss.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(b.w / 2, dy + b.h * 0.02, b.w * 0.5, b.h * 0.52, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (opts.draw) opts.draw(ctx, b.w / 2, dy + b.h / 2, look.ink);
  if (label) text(ctx, label, b.w / 2, dy + b.h / 2 + 1, opts.size ?? 20, look.ink, "center", look.outline);
  ctx.restore();
}

/** A rounded panel: dark glass (for the screen) or paper (for the book). */
export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 18, kind: "glass" | "card" = "glass"): void {
  softShadow(ctx, x, y + 3, w, h, r, 8, 0.4);
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  if (kind === "glass") {
    fill.addColorStop(0, "rgba(58,48,76,0.94)");
    fill.addColorStop(1, "rgba(30,24,44,0.96)");
  } else {
    fill.addColorStop(0, "#5a4636");
    fill.addColorStop(1, "#3a2c22");
  }
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,225,160,0.35)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  roundRect(ctx, x - 1, y - 1, w + 2, h + 2, r + 1);
  ctx.stroke();
  // A line of light along the top edge.
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, y, 0, y + 26);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, 26);
  ctx.restore();
}

/** A ribbon with a title on it, for the top of a card. */
export function drawRibbon(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, label: string, light: string, deep: string): void {
  const h = 50;
  const x = cx - w / 2;
  softShadow(ctx, x, y + 3, w, h, 10, 6, 0.4);
  // The folded ends.
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 12);
  ctx.lineTo(x + 14, y + 12);
  ctx.lineTo(x + 14, y + h + 8);
  ctx.lineTo(x - 16, y + h + 8);
  ctx.lineTo(x - 6, y + h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w + 16, y + 12);
  ctx.lineTo(x + w - 14, y + 12);
  ctx.lineTo(x + w - 14, y + h + 8);
  ctx.lineTo(x + w + 16, y + h + 8);
  ctx.lineTo(x + w + 6, y + h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  // The band.
  const band = ctx.createLinearGradient(0, y, 0, y + h);
  band.addColorStop(0, light);
  band.addColorStop(1, deep);
  ctx.fillStyle = band;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(30,12,4,0.65)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, x + 3, y + 3, w - 6, h * 0.42, 8);
  ctx.fill();
  text(ctx, label, cx, y + h / 2 + 1, 28, "#ffffff", "center", "rgba(40,12,4,0.8)");
}

/** A star, filled gold or empty. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.46;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  if (filled) {
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, "#fff0a0");
    g.addColorStop(1, "#f0a914");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
  }
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.strokeStyle = filled ? "#8a5208" : "rgba(255,255,255,0.18)";
  ctx.stroke();
}

// ---- The bonus ball -------------------------------------------------------------------

/**
 * A bonus ball: a ball with a gold border instead of silver, a soft golden glow that pulses, and a picture on it:
 * a heart (a dead cup comes back), a star (points) or an hourglass (slow motion).
 */
export function drawBonusBall(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Bonus, scale = 1, time = 0): void {
  const R = 21;
  const r = R - 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // The glow.
  const k = 0.5 + 0.5 * Math.sin(time * 5);
  const aura = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 2.2);
  aura.addColorStop(0, `rgba(255,214,90,${0.5 + 0.3 * k})`);
  aura.addColorStop(1, "rgba(255,214,90,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, R * 2.2, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();

  // The gold border.
  const gold = ctx.createLinearGradient(-R, -R, R, R);
  gold.addColorStop(0, "#fff6c0");
  gold.addColorStop(0.3, "#d99a14");
  gold.addColorStop(0.55, "#fff0a0");
  gold.addColorStop(1, "#8f5a08");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(60,30,0,0.55)";
  ctx.stroke();

  // The face, in a colour for what it does.
  const face = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  if (kind === "life") {
    face.addColorStop(0, "#ff9bb0");
    face.addColorStop(0.5, "#e0304e");
    face.addColorStop(1, "#7a0f26");
  } else if (kind === "points") {
    face.addColorStop(0, "#d7b3ff");
    face.addColorStop(0.5, "#8a4fe0");
    face.addColorStop(1, "#3f1a8a");
  } else {
    face.addColorStop(0, "#b8f1ff");
    face.addColorStop(0.5, "#35b7e8");
    face.addColorStop(1, "#0f5f8a");
  }
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();
  const gloss = ctx.createLinearGradient(0, -r, 0, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0.6)");
  gloss.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.52, r * 0.78, r * 0.44, 0, 0, TAU);
  ctx.fill();

  // The picture.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (kind === "life") {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-15, -2, -9, -12, 0, -5);
    ctx.bezierCurveTo(9, -12, 15, -2, 0, 8);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#7a0f26";
    ctx.stroke();
  } else if (kind === "points") {
    drawStar(ctx, 0, 1, 12, true);
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(7, -10);
    ctx.lineTo(1, 0);
    ctx.lineTo(7, 10);
    ctx.lineTo(-7, 10);
    ctx.lineTo(-1, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#0b4a6b";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.lineTo(9, -10);
    ctx.moveTo(-9, 10);
    ctx.lineTo(9, 10);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- The number ball ------------------------------------------------------------------

/**
 * A round glossy ball with a silver border: green for plus, red for minus, blue for multiplication and yellow for division,
 * with the number on it.
 * `time` and `phase` only move the glint that sweeps across now and then.
 */
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, v: number, scale = 1, time = 0, phase = 0, op: Op = "add"): void {
  const R = 20;
  const r = R - 3.5;
  const minus = v < 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();

  // Silver border.
  const silver = ctx.createLinearGradient(-R, -R, R, R);
  silver.addColorStop(0, "#fbfcfd");
  silver.addColorStop(0.3, "#aeb4bc");
  silver.addColorStop(0.55, "#f0f2f5");
  silver.addColorStop(1, "#7d848c");
  ctx.fillStyle = silver;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.stroke();

  // The coloured face.
  const face = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  if (op === "mul") {
    face.addColorStop(0, "#a9d4ff");
    face.addColorStop(0.45, "#2f7fe6");
    face.addColorStop(1, "#10408f");
  } else if (op === "div") {
    face.addColorStop(0, "#fff2a6");
    face.addColorStop(0.45, "#f0b81c");
    face.addColorStop(1, "#a8690a");
  } else if (minus) {
    face.addColorStop(0, "#ff8f86");
    face.addColorStop(0.45, "#df2f28");
    face.addColorStop(1, "#8a110d");
  } else {
    face.addColorStop(0, "#82f2a4");
    face.addColorStop(0.45, "#22b058");
    face.addColorStop(1, "#0d6633");
  }
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();

  // Gloss: a bright curve over the top half, and a glint that sweeps across now and then.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, -r, 0, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0.7)");
  gloss.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.52, r * 0.78, r * 0.46, 0, 0, TAU);
  ctx.fill();
  const sweep = ((time * 0.5 + phase * 0.37) % 2.2) - 0.6; // most of the time out of view
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect((sweep * 2 - 1) * r * 1.4, -r * 1.6, 5, r * 3.2);
  ctx.restore();

  if (op === "mul") text(ctx, `\u00D7${v}`, 0, 1, 21, "#ffffff", "center", "rgba(5,30,80,0.9)");
  else if (op === "div") text(ctx, `\u00F7${v}`, 0, 1, 21, "#ffffff", "center", "rgba(90,50,0,0.9)");
  else text(ctx, signed(v), 0, 1, 22, "#ffffff", "center", minus ? "rgba(90,8,5,0.9)" : "rgba(5,60,28,0.9)");
  ctx.restore();
}

/**
 * A block of ice round a number ball (drawn over the ball). `hits` is how many taps are left to break it: with one left
 * the ice is cracked.
 */
export function drawIce(ctx: CanvasRenderingContext2D, x: number, y: number, hits: number, scale = 1, time = 0, phase = 0): void {
  const S = 25; // half the width of the block
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const block = () => {
    ctx.beginPath();
    ctx.moveTo(-S + 9, -S);
    ctx.lineTo(S - 7, -S);
    ctx.quadraticCurveTo(S, -S, S, -S + 8);
    ctx.lineTo(S, S - 9);
    ctx.quadraticCurveTo(S, S, S - 9, S);
    ctx.lineTo(-S + 7, S);
    ctx.quadraticCurveTo(-S, S, -S, S - 8);
    ctx.lineTo(-S, -S + 9);
    ctx.quadraticCurveTo(-S, -S, -S + 9, -S);
    ctx.closePath();
  };
  // The ice: see-through blue-white, brighter towards the top left.
  const body = ctx.createLinearGradient(-S, -S, S, S);
  body.addColorStop(0, "rgba(235,248,255,0.78)");
  body.addColorStop(0.5, "rgba(170,215,245,0.5)");
  body.addColorStop(1, "rgba(110,170,225,0.62)");
  ctx.fillStyle = body;
  block();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(235,250,255,0.95)";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(70,130,190,0.55)";
  roundRect(ctx, -S + 3, -S + 3, 2 * S - 6, 2 * S - 6, 8);
  ctx.stroke();
  // Gloss, and a glint that sweeps across now and then.
  ctx.save();
  block();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(-S, -S);
  ctx.lineTo(S * 0.15, -S);
  ctx.lineTo(-S, S * 0.15);
  ctx.closePath();
  ctx.fill();
  const sweep = ((time * 0.45 + phase * 0.31) % 2.4) - 0.7;
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect((sweep * 2 - 1) * S * 1.5, -S * 1.6, 6, S * 3.2);
  ctx.restore();
  // Cracked: white cracks run across the block.
  if (hits <= 1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const crack = (w: number, c: string) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(-S + 2, -S * 0.55);
      ctx.lineTo(-S * 0.4, -S * 0.2);
      ctx.lineTo(-S * 0.1, -S * 0.35);
      ctx.lineTo(S * 0.15, 0.05 * S);
      ctx.lineTo(S * 0.5, -0.02 * S);
      ctx.lineTo(S - 2, S * 0.3);
      ctx.moveTo(S * 0.15, 0.05 * S);
      ctx.lineTo(S * 0.05, S * 0.5);
      ctx.lineTo(S * 0.3, S - 2);
      ctx.moveTo(-S * 0.4, -S * 0.2);
      ctx.lineTo(-S * 0.55, S * 0.3);
      ctx.stroke();
    };
    crack(3, "rgba(60,110,170,0.5)");
    crack(1.4, "rgba(255,255,255,0.95)");
  }
  ctx.restore();
}

/** The back of a ghost number that has turned over: the same silver border, a dark misty face and a question mark. */
export function drawGhostBack(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1, time = 0, phase = 0): void {
  const R = 20;
  const r = R - 3.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();
  const silver = ctx.createLinearGradient(-R, -R, R, R);
  silver.addColorStop(0, "#fbfcfd");
  silver.addColorStop(0.3, "#aeb4bc");
  silver.addColorStop(0.55, "#f0f2f5");
  silver.addColorStop(1, "#7d848c");
  ctx.fillStyle = silver;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.stroke();
  const face = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  face.addColorStop(0, "#9a93c4");
  face.addColorStop(0.5, "#4b4478");
  face.addColorStop(1, "#1d1940");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, -r, 0, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0.45)");
  gloss.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.52, r * 0.78, r * 0.46, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  text(ctx, "?", 0, 1 + Math.sin(time * 3 + phase) * 1.2, 24, "rgba(235,230,255,0.95)", "center", "rgba(20,12,60,0.9)");
  ctx.restore();
}

/**
 * The chain between two numbers: small steel links that hang in a curve while the numbers are close, and pull straight
 * when they are far apart. `length` is how far apart the numbers can be before the chain is straight.
 */
export function drawChain(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, length: number, time = 0): void {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const slack = Math.sqrt(Math.max(0, length * length - dist * dist)) * 0.5 * (1 + Math.sin(time * 3) * 0.05);
  // A curve that sags below the straight line between the two numbers.
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 + slack * 2;
  const at = (k: number): [number, number] => {
    const u = 1 - k;
    return [u * u * ax + 2 * u * k * cx + k * k * bx, u * u * ay + 2 * u * k * cy + k * k * by];
  };
  const links = Math.max(4, Math.round((dist + slack * 1.4) / 8));
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i <= links; i++) {
    const k = i / links;
    const [px, py] = at(k);
    const [qx, qy] = at(Math.min(1, k + 0.02));
    const [ox, oy] = at(Math.max(0, k - 0.02));
    const ang = Math.atan2(qy - oy, qx - ox);
    ctx.save();
    ctx.translate(px, py + 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, 3.2, ang, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    // Every other link is seen from the side.
    const ry = i % 2 === 0 ? 3.2 : 1.5;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#3d434b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, ry, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = i % 2 === 0 ? "#e4e8ee" : "#aeb4bc";
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
