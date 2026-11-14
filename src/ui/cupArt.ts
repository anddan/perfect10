// The look of the cups of the shop: their colours (used for the cups on the desk too), and a small picture of a cup for the shop and the perks.
import {CUP_H} from "../game/constants";
import type {CupKind} from "../game/types";
import {ui} from "./draw";

const TAU = Math.PI * 2;

/** The colours of the cups of the shop (the body from left to right, the rim, and the handle: dark, then its lit edge). An ordinary cup is white. */
export const CUP_COLORS: Record<Exclude<CupKind, "plain">, {body: string[]; rim: string[]; handle: [string, string]}> = {
  gold: {body: ["#a8791c", "#f3d36a", "#fff0a8", "#e2b43c", "#8a5e10"], rim: ["#c9992a", "#fff3b8", "#a07414"], handle: ["#a07414", "#f7dc82"]},
  thermos: {body: ["#5b7aa0", "#a9c4e0", "#e6f1fb", "#8eaed0", "#3f5878"], rim: ["#6f8fb3", "#eaf4ff", "#4a6788"], handle: ["#4a6788", "#cfe1f4"]},
  magnet: {body: ["#9a2a2a", "#e06060", "#ffb0a8", "#c24545", "#6e1818"], rim: ["#b13838", "#ffc4bc", "#7e2020"], handle: ["#7e2020", "#f0a49c"]},
  laser: {body: ["#5a2d8c", "#a07be0", "#e1d2ff", "#8660c8", "#3a1a62"], rim: ["#6e3fa6", "#efe4ff", "#46237a"], handle: ["#46237a", "#cdb5f5"]},
  big: {body: ["#2e7d6b", "#69c7ae", "#c8f2e4", "#4fa890", "#1d5646"], rim: ["#3c9582", "#d8fbef", "#256b5b"], handle: ["#256b5b", "#a8e6d2"]},
};

type Palette = {body: string[]; rim: string[]; handle: [string, string]};

/** The colours of an ordinary cup that has been given a colour in the shop (the cups with a power keep the colour of the power). */
export const STYLE_COLORS: Record<string, Palette> = {
  sky: {body: ["#4f86b8", "#9fd0f5", "#e8f6ff", "#7fb6e3", "#34608a"], rim: ["#6aa0d0", "#eef9ff", "#4a7aa6"], handle: ["#4a7aa6", "#cbe8fb"]},
  rose: {body: ["#b85c78", "#f5a8bd", "#ffe6ee", "#e48aa4", "#8a3550"], rim: ["#d0728c", "#fff0f4", "#a04862"], handle: ["#a04862", "#fbd0dc"]},
  mint: {body: ["#4aa88a", "#9fe6cd", "#e8fff6", "#74d0b0", "#2f6f5a"], rim: ["#62bda0", "#f0fffa", "#3f8670"], handle: ["#3f8670", "#c9f3e4"]},
  midnight: {body: ["#2a2f55", "#4f5a9a", "#8a95d8", "#414b86", "#14172e"], rim: ["#3a4275", "#a9b4ee", "#20254a"], handle: ["#20254a", "#7a86c8"]},
  sunset: {body: ["#c4572a", "#ffa468", "#ffe0c4", "#f08048", "#8a3412"], rim: ["#d9683a", "#fff0e4", "#a24420"], handle: ["#a24420", "#ffc9a2"]},
};

/** The outline of the body of a cup (the origin is the middle of its base). */
function bodyOutline(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-32, -CUP_H + 2);
  ctx.bezierCurveTo(-32, -CUP_H * 0.35, -25, -3, -13, 0);
  ctx.quadraticCurveTo(0, 5, 13, 0);
  ctx.bezierCurveTo(25, -3, 32, -CUP_H * 0.35, 32, -CUP_H + 2);
  ctx.closePath();
}

/** A pattern over the body of a cup (dots, stripes or stars), in white on a coloured cup and in a warm brown on a white one. */
export function cupPattern(ctx: CanvasRenderingContext2D, pattern: string, onColor: boolean): void {
  if (pattern === "none") return;
  ctx.save();
  bodyOutline(ctx);
  ctx.clip();
  ctx.fillStyle = onColor ? "rgba(255,255,255,0.5)" : "rgba(140,100,60,0.38)";
  if (pattern === "dots") {
    for (let row = 0; row < 5; row++) {
      for (let col = -3; col <= 3; col++) {
        ctx.beginPath();
        ctx.arc(col * 10 + (row % 2 ? 5 : 0), -46 + row * 10, 2.3, 0, TAU);
        ctx.fill();
      }
    }
  } else if (pattern === "stripes") {
    for (let y = -50; y < 0; y += 11) ctx.fillRect(-34, y, 68, 5);
  } else {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const x = -28 + col * 14 + (row % 2 ? 7 : 0);
        const y = -42 + row * 15;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 === 0 ? 4.4 : 1.9;
          if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function mixHex(colors: string[]): string {
  const rgb = colors.map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const avg = [0, 1, 2].map((k) => Math.round(rgb.reduce((s, c) => s + c[k], 0) / rgb.length));
  return "#" + avg.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * The colours of a cup with these properties: none is an ordinary white cup (null), one is the colour of that property, and several
 * are mixed (every colour of the cup is the average of the ones of the properties).
 */
export function cupPalette(kinds: readonly CupKind[], cupColor: string = ui.look.cupColor): Palette | null {
  const list = kinds.filter((k): k is Exclude<CupKind, "plain"> => k !== "plain");
  if (list.length === 0) return STYLE_COLORS[cupColor] ?? null;
  const mix = (pick: (p: Palette) => string[]): string[] => pick(CUP_COLORS[list[0]]).map((_, i) => mixHex(list.map((k) => pick(CUP_COLORS[k])[i])));
  const handle = mix((p) => p.handle);
  return {body: mix((p) => p.body), rim: mix((p) => p.rim), handle: [handle[0], handle[1]]};
}

/** A cup with its coffee, seen from the side and a little above: (x, y) is the middle of its base. */
export function drawShopCup(ctx: CanvasRenderingContext2D, kinds: readonly CupKind[], x: number, y: number, scale = 1, look?: {cupColor?: string; pattern?: string; badges?: "body" | "below"}): void {
  const kc = cupPalette(kinds, look?.cupColor ?? ui.look.cupColor);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // The handle.
  ctx.lineCap = "round";
  ctx.strokeStyle = kc ? kc.handle[0] : "#b3aa97";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.5, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = kc ? kc.handle[1] : "#f1ece1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.5, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // The body.
  const across = ctx.createLinearGradient(-32, 0, 32, 0);
  const b = kc ? kc.body : ["#b9b09c", "#f6f2e8", "#ffffff", "#ddd5c3", "#a39a86"];
  [0, 0.2, 0.38, 0.7, 1].forEach((p, i) => across.addColorStop(p, b[i]));
  ctx.beginPath();
  ctx.moveTo(-32, -CUP_H + 2);
  ctx.bezierCurveTo(-32, -CUP_H * 0.35, -25, -3, -13, 0);
  ctx.quadraticCurveTo(0, 5, 13, 0);
  ctx.bezierCurveTo(25, -3, 32, -CUP_H * 0.35, 32, -CUP_H + 2);
  ctx.closePath();
  ctx.fillStyle = across;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(0,0,0,0.38)";
  ctx.stroke();
  cupPattern(ctx, look?.pattern ?? ui.look.pattern, !!kc);
  // The rim, and the coffee in the opening.
  const rim = ctx.createLinearGradient(-32, 0, 32, 0);
  const r = kc ? kc.rim : ["#d3cab6", "#ffffff", "#b5ac98"];
  [0, 0.35, 1].forEach((p, i) => rim.addColorStop(p, r[i]));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H + 2, 32, 9, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4a2c18";
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H + 3, 27, 6.4, 0, 0, TAU);
  ctx.fill();
  drawCupBadges(ctx, kinds, look?.badges === "below" ? "below" : "icon");
  ctx.restore();
}

/**
 * The badges of the powers of a cup (the origin is the middle of its base). In "icon" mode (the cups of the shop, which have one power) the badge is
 * big and on the body of the cup. In "below" mode (the dialog) and "game" mode (the cups on the desk, where the number of the cup stands in the
 * middle) the badges are in a row under the cup, so that the cup itself is not covered however many powers it has.
 */
export function drawCupBadges(ctx: CanvasRenderingContext2D, kinds: readonly CupKind[], mode: "icon" | "below" | "game"): void {
  const list = kinds.filter((k): k is Exclude<CupKind, "plain"> => k !== "plain");
  const n = list.length;
  if (n === 0) return;
  let r: number;
  let spots: [number, number][];
  if (mode === "game") {
    r = n > 3 ? 4.2 : 4.8;
    spots = list.map((_, i) => [(i - (n - 1) / 2) * (r * 2 + 1.6), 9]);
  } else if (mode === "below") {
    r = n > 3 ? 7 : 8;
    spots = list.map((_, i) => [(i - (n - 1) / 2) * (r * 2 + 2), 15]);
  } else if (n === 1) {
    r = 13;
    spots = [[0, -24]];
  } else if (n === 2) {
    r = 10;
    spots = [[-11, -25], [11, -25]];
  } else if (n === 3) {
    r = 8.5;
    spots = [[-11, -34], [11, -34], [0, -16]];
  } else if (n === 4) {
    r = 8;
    spots = [[-11, -34], [11, -34], [-11, -17], [11, -17]];
  } else {
    r = 7.4;
    spots = [[-17, -34], [0, -34], [17, -34], [-9, -17], [9, -17]];
  }
  list.forEach((k, i) => drawPropBadge(ctx, k, spots[i][0], spots[i][1], r));
}

/**
 * The badge of a property of the cups: a round glossy disc in the colour of the property with its sign in white (a star for gold, a shield for
 * the thermos, a magnet, 12 for the big cup, a bolt for the laser). (x, y) is the middle.
 */
export function drawPropBadge(ctx: CanvasRenderingContext2D, kind: Exclude<CupKind, "plain">, x: number, y: number, r: number): void {
  const c = CUP_COLORS[kind];
  ctx.save();
  ctx.translate(x, y);
  const k = r / 12;
  // A soft shadow, the disc and its edge.
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(0.8 * k, 1.8 * k, r, 0, TAU);
  ctx.fill();
  const disc = ctx.createLinearGradient(0, -r, 0, r);
  disc.addColorStop(0, c.body[2]);
  disc.addColorStop(0.45, c.body[1]);
  disc.addColorStop(1, c.body[0]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.6 * k);
  ctx.strokeStyle = c.body[4];
  ctx.stroke();
  // The shine.
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.5, r * 0.62, r * 0.3, 0, 0, TAU);
  ctx.fill();
  // The sign.
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = c.body[4];
  ctx.lineWidth = 1.7;
  if (kind === "gold") {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? 8 : 3.7;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr + 0.6);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + 0.6);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  } else if (kind === "thermos") {
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, -5);
    ctx.lineTo(6, 2);
    ctx.quadraticCurveTo(5, 7, 0, 9);
    ctx.quadraticCurveTo(-5, 7, -6, 2);
    ctx.lineTo(-7, -5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  } else if (kind === "magnet") {
    const u = () => {
      ctx.beginPath();
      ctx.moveTo(-5.5, -7);
      ctx.lineTo(-5.5, 1);
      ctx.arc(0, 1, 5.5, Math.PI, 0, true);
      ctx.lineTo(5.5, -7);
    };
    ctx.lineWidth = 7;
    ctx.strokeStyle = c.body[4];
    u();
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    u();
    ctx.stroke();
  } else if (kind === "big") {
    ctx.font = "800 12.5px 'Fredoka', 'Trebuchet MS', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeText("12", 0, 0.8);
    ctx.fillText("12", 0, 0.8);
  } else {
    ctx.beginPath();
    ctx.moveTo(2.5, -9);
    ctx.lineTo(-5.5, 1.5);
    ctx.lineTo(-1, 1.5);
    ctx.lineTo(-2.5, 9);
    ctx.lineTo(5.5, -2.5);
    ctx.lineTo(1, -2.5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}
