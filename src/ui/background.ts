// The rooms behind the game, each drawn once (and again if the screen changes size).
// Every part of the book has its own place: the tutorial and the plus levels are in a classroom,
// the plus and minus levels in a café, the last chapter on a spaceship, and the endless game on a terrace in the evening.
// All of them are dimmed a little, and have a table at the front that the cups stand on.
import {DESK_Y, H, W} from "../game/constants";
import type {Mode} from "../game/types";
import {FONT, TAU} from "./draw";
import {t} from "./i18n";

export type Room = "classroom" | "cafe" | "library" | "bakery" | "spaceship" | "terrace";

export const ROOMS: Room[] = ["classroom", "cafe", "library", "bakery", "spaceship", "terrace"];

export function roomOfMode(mode: Mode): Room {
  if (mode === "mixed") return "cafe";
  if (mode === "times") return "library";
  if (mode === "divide") return "bakery";
  if (mode === "space") return "spaceship";
  if (mode === "endless") return "terrace";
  return "classroom";
}

/** A small steady random generator, so the grain and the lights look the same every time. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- The classroom --------------------------------------------------------------------

function classroom(ctx: CanvasRenderingContext2D): void {
  // The wall, with light from a window falling in from the upper right.
  const wall = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  wall.addColorStop(0, "#4b524f");
  wall.addColorStop(1, "#383e3c");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, DESK_Y);
  const light = ctx.createLinearGradient(W, 0, 0, DESK_Y * 0.8);
  light.addColorStop(0, "rgba(255,238,200,0.16)");
  light.addColorStop(1, "rgba(255,238,200,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, DESK_Y);
  ctx.fillStyle = "#2c3230";
  ctx.fillRect(0, DESK_Y - 70, W, 5);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, DESK_Y - 65, W, 65);

  // The blackboard, with a frame and a chalk tray.
  const x = 28;
  const y = 74;
  const w = W - 56;
  const h = 170;
  ctx.fillStyle = "#5e4d3a";
  ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - 8, y + h + 4, w + 16, 4);
  const board = ctx.createLinearGradient(x, y, x + w, y + h);
  board.addColorStop(0, "#2f3d37");
  board.addColorStop(1, "#26322d");
  ctx.fillStyle = board;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#4a3c2d";
  ctx.fillRect(x - 8, y + h + 8, w + 16, 7);
  ctx.fillStyle = "#cfc8b8";
  ctx.fillRect(x + 40, y + h + 4, 22, 4);
  ctx.fillStyle = "rgba(233,228,212,0.22)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("7 + 3 = 10", x + 20, y + 34);
  ctx.fillText("6 + 4 = 10", x + 60, y + 78);
  ctx.fillText("5 + 5 = 10", x + 28, y + 122);
  ctx.fillStyle = "rgba(233,228,212,0.10)";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.7, y + h * 0.55, 70, 36, -0.3, 0, TAU);
  ctx.fill();

  // The school desk, with wood grain, a pencil groove and the ring of an old mug.
  const rnd = seeded(10);
  const top = ctx.createLinearGradient(0, DESK_Y, 0, H);
  top.addColorStop(0, "#7d6244");
  top.addColorStop(1, "#5f4730");
  ctx.fillStyle = top;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);
  for (let i = 0; i < 70; i++) {
    const gy = DESK_Y + 4 + rnd() * (H - DESK_Y - 4);
    const gx = rnd() * W;
    const len = 60 + rnd() * 200;
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,230,190,0.07)";
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.bezierCurveTo(gx + len * 0.3, gy + (rnd() - 0.5) * 3, gx + len * 0.7, gy + (rnd() - 0.5) * 3, gx + len, gy + (rnd() - 0.5) * 2);
    ctx.stroke();
  }
  edge(ctx, "rgba(255,236,200,0.22)");
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, DESK_Y + 16, W, 3);
  ctx.fillStyle = "rgba(255,236,200,0.10)";
  ctx.fillRect(0, DESK_Y + 19, W, 1);
  ctx.strokeStyle = "rgba(40,24,12,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(300, DESK_Y + 52, 17, 0.4, 5.6);
  ctx.stroke();
}

/** The far edge of the table, catching the light. */
function edge(ctx: CanvasRenderingContext2D, light: string): void {
  ctx.fillStyle = light;
  ctx.fillRect(0, DESK_Y, W, 2);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(0, DESK_Y - 3, W, 3);
}

// ---- The café -------------------------------------------------------------------------

function cafe(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(21);
  // Warm walls, with dark wood panelling on the lower part.
  const wall = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  wall.addColorStop(0, "#6e4b3a");
  wall.addColorStop(1, "#432e25");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, DESK_Y);
  ctx.fillStyle = "#2f2019";
  ctx.fillRect(0, 330, W, DESK_Y - 330);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 338);
    ctx.lineTo(x, DESK_Y);
    ctx.stroke();
  }
  ctx.fillStyle = "#4a3326";
  ctx.fillRect(0, 326, W, 8);
  ctx.fillStyle = "rgba(255,220,170,0.12)";
  ctx.fillRect(0, 326, W, 2);

  // A big window onto the street at dusk, with blurred lights.
  const wx = 22;
  const wy = 66;
  const ww = 132;
  const wh = 200;
  ctx.fillStyle = "#2a1c15";
  ctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
  const glass = ctx.createLinearGradient(0, wy, 0, wy + wh);
  glass.addColorStop(0, "#232c57");
  glass.addColorStop(0.6, "#5c4673");
  glass.addColorStop(1, "#c07a6a");
  ctx.fillStyle = glass;
  ctx.fillRect(wx, wy, ww, wh);
  for (let i = 0; i < 16; i++) {
    const bx = wx + 8 + rnd() * (ww - 16);
    const by = wy + 90 + rnd() * 100;
    const br = 5 + rnd() * 9;
    const bokeh = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const hue = rnd() < 0.5 ? "255,205,120" : rnd() < 0.5 ? "255,130,110" : "150,200,255";
    bokeh.addColorStop(0, `rgba(${hue},0.75)`);
    bokeh.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = bokeh;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  ctx.fillStyle = "#2a1c15";
  ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh);
  ctx.fillRect(wx, wy + wh * 0.45, ww, 6);
  ctx.fillStyle = "#3d2a20";
  ctx.fillRect(wx - 12, wy + wh + 8, ww + 24, 8);

  // A menu board on the wall, written in chalk.
  const bx = 196;
  const by = 76;
  ctx.fillStyle = "#2a1c15";
  ctx.fillRect(bx - 6, by - 6, 140, 124);
  ctx.fillStyle = "#26302b";
  ctx.fillRect(bx, by, 128, 112);
  ctx.fillStyle = "rgba(243,236,221,0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(t("cafeSign"), bx + 64, by + 28);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(t("cafeLine"), bx + 64, by + 62);
  ctx.fillText(t("cafePrice"), bx + 64, by + 90);

  // A shelf with cups on it.
  ctx.fillStyle = "#3d2a20";
  ctx.fillRect(196, 262, 140, 8);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(196, 270, 140, 4);
  for (let i = 0; i < 4; i++) {
    const cx = 216 + i * 34;
    ctx.fillStyle = i % 2 ? "#d9d0bc" : "#efe8d8";
    ctx.beginPath();
    ctx.moveTo(cx - 11, 244);
    ctx.lineTo(cx + 11, 244);
    ctx.lineTo(cx + 8, 262);
    ctx.lineTo(cx - 8, 262);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Pendant lamps with a warm glow.
  for (const lx of [92, 262]) {
    const glow = ctx.createRadialGradient(lx, 52, 4, lx, 52, 120);
    glow.addColorStop(0, "rgba(255,205,130,0.5)");
    glow.addColorStop(1, "rgba(255,205,130,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 120, 0, 240, 190);
    ctx.strokeStyle = "#1f140f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, 34);
    ctx.stroke();
    ctx.fillStyle = "#2c1d15";
    ctx.beginPath();
    ctx.moveTo(lx - 8, 34);
    ctx.lineTo(lx + 8, 34);
    ctx.lineTo(lx + 26, 58);
    ctx.lineTo(lx - 26, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,226,160,0.95)";
    ctx.beginPath();
    ctx.ellipse(lx, 58, 26, 5, 0, 0, TAU);
    ctx.fill();
  }

  // The table: dark marble with pale veins.
  const marble = ctx.createLinearGradient(0, DESK_Y, 0, H);
  marble.addColorStop(0, "#4d4946");
  marble.addColorStop(1, "#2e2b29");
  ctx.fillStyle = marble;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const vx = rnd() * W;
    const vy = DESK_Y + 6 + rnd() * (H - DESK_Y - 12);
    ctx.strokeStyle = `rgba(235,228,215,${0.05 + rnd() * 0.09})`;
    ctx.lineWidth = 0.8 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.bezierCurveTo(vx + 40, vy + (rnd() - 0.5) * 50, vx + 90, vy + (rnd() - 0.5) * 50, vx + 140 + rnd() * 80, vy + (rnd() - 0.5) * 40);
    ctx.stroke();
  }
  edge(ctx, "rgba(255,236,210,0.3)");
}

// ---- The library ----------------------------------------------------------------------

function library(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(47);
  // A dark green wall, covered in bookshelves: six rows of books with a plank under each.
  const wall = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  wall.addColorStop(0, "#2f3a30");
  wall.addColorStop(1, "#1f2a22");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, DESK_Y);
  const spines = ["#7a2e2e", "#2e4f7a", "#3c6b4a", "#8a6a2c", "#5b3a6b", "#a0522d", "#2f6b6b", "#6b4a2e", "#8a3b55"];
  for (let row = 0; row < 6; row++) {
    const bottom = 78 + row * 72;
    let x = 4;
    while (x < W) {
      if (rnd() < 0.07) {
        x += 10 + rnd() * 16; // a gap in the row
        continue;
      }
      const bw = 8 + rnd() * 10;
      const bh = 40 + rnd() * 22;
      ctx.fillStyle = spines[Math.floor(rnd() * spines.length)];
      ctx.fillRect(x, bottom - bh, bw, bh);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x, bottom - bh, 2, bh);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(x + bw - 2, bottom - bh, 2, bh);
      if (rnd() < 0.5) {
        ctx.fillStyle = "rgba(255,215,120,0.55)";
        ctx.fillRect(x, bottom - bh + 6, bw, 1.6);
        ctx.fillRect(x, bottom - 8, bw, 1.6);
      }
      x += bw + 0.6;
    }
    ctx.fillStyle = "#2a1b12";
    ctx.fillRect(0, bottom, W, 8);
    ctx.fillStyle = "rgba(255,225,170,0.14)";
    ctx.fillRect(0, bottom, W, 1.5);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, bottom + 8, W, 6);
  }
  // A green reading lamp hanging in front of the shelves, with a pool of warm light.
  const glow = ctx.createRadialGradient(W / 2, 70, 6, W / 2, 70, 200);
  glow.addColorStop(0, "rgba(255,220,140,0.5)");
  glow.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 330);
  ctx.strokeStyle = "#16100c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, 40);
  ctx.stroke();
  ctx.fillStyle = "#1f6b45";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 10, 40);
  ctx.lineTo(W / 2 + 10, 40);
  ctx.lineTo(W / 2 + 34, 72);
  ctx.lineTo(W / 2 - 34, 72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0f3a26";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,236,170,0.95)";
  ctx.beginPath();
  ctx.ellipse(W / 2, 72, 34, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, DESK_Y - 70, W, 70);

  // A walnut desk, with a green leather top, gold edging and wood grain around it.
  const wood = ctx.createLinearGradient(0, DESK_Y, 0, H);
  wood.addColorStop(0, "#5c3b27");
  wood.addColorStop(1, "#3a2417");
  ctx.fillStyle = wood;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);
  for (let i = 0; i < 50; i++) {
    const gx = rnd() * W;
    const gy = DESK_Y + 4 + rnd() * (H - DESK_Y - 4);
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,210,160,0.07)";
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 50 + rnd() * 130, gy + (rnd() - 0.5) * 3);
    ctx.stroke();
  }
  const leather = ctx.createLinearGradient(0, DESK_Y + 22, 0, H - 8);
  leather.addColorStop(0, "#2e5a43");
  leather.addColorStop(1, "#1f3f2f");
  ctx.fillStyle = leather;
  roundedBox(ctx, 10, DESK_Y + 22, W - 20, H - DESK_Y - 34, 8);
  ctx.strokeStyle = "rgba(255,213,110,0.55)";
  ctx.lineWidth = 2;
  roundedBox(ctx, 14, DESK_Y + 26, W - 28, H - DESK_Y - 42, 6, true);
  edge(ctx, "rgba(255,225,180,0.25)");
}

function roundedBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, stroke = false): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (stroke) ctx.stroke();
  else ctx.fill();
}

// ---- The bakery -----------------------------------------------------------------------

function bakery(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(61);
  // A warm kitchen wall of cream tiles, with blue-green cupboards under it.
  const wall = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  wall.addColorStop(0, "#efe3c6");
  wall.addColorStop(1, "#d6c6a2");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, DESK_Y);
  ctx.strokeStyle = "rgba(120,98,62,0.28)";
  ctx.lineWidth = 1.2;
  for (let y = 0; y < 330; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
    for (let x = (y / 22) % 2 ? 0 : 20; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + 22);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#3f6b66";
  ctx.fillRect(0, 330, W, DESK_Y - 330);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 330, W, 5);
  for (let i = 0; i < 4; i++) {
    const dx = 8 + i * 88;
    ctx.fillStyle = "#4a7c76";
    ctx.fillRect(dx, 344, 80, 104);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 6, 350, 68, 92);
    ctx.fillStyle = "#e8cf92";
    ctx.beginPath();
    ctx.arc(dx + 66, 396, 3.5, 0, TAU);
    ctx.fill();
  }

  // A window with morning light.
  ctx.fillStyle = "#7a5a36";
  ctx.fillRect(236, 38, 108, 112);
  const sky = ctx.createLinearGradient(0, 44, 0, 144);
  sky.addColorStop(0, "#bfe0f2");
  sky.addColorStop(1, "#f6e7bd");
  ctx.fillStyle = sky;
  ctx.fillRect(242, 44, 96, 100);
  ctx.fillStyle = "#7a5a36";
  ctx.fillRect(287, 44, 6, 100);
  ctx.fillRect(242, 92, 96, 6);
  const shaft = ctx.createLinearGradient(290, 100, 110, 330);
  shaft.addColorStop(0, "rgba(255,244,200,0.4)");
  shaft.addColorStop(1, "rgba(255,244,200,0)");
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(242, 144);
  ctx.lineTo(338, 144);
  ctx.lineTo(220, 330);
  ctx.lineTo(60, 330);
  ctx.closePath();
  ctx.fill();

  // Copper pans hanging on a rail.
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(14, 44, 190, 5);
  for (const [px, r] of [[44, 24], [102, 19], [158, 22]] as const) {
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 49);
    ctx.lineTo(px, 62);
    ctx.stroke();
    const copper = ctx.createLinearGradient(px - r, 0, px + r, 0);
    copper.addColorStop(0, "#8c4a22");
    copper.addColorStop(0.35, "#e8955a");
    copper.addColorStop(1, "#a05a2c");
    ctx.fillStyle = copper;
    ctx.beginPath();
    ctx.arc(px, 62 + r, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(px - r * 0.35, 62 + r * 0.6, r * 0.28, r * 0.14, -0.6, 0, TAU);
    ctx.fill();
  }

  // A shelf with jars of flour and sugar.
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(14, 232, 214, 7);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(14, 239, 214, 4);
  const jars = ["#f7f1e1", "#e8c9a0", "#d9d2c2", "#f2e3b3", "#e0b48a"];
  for (let i = 0; i < 5; i++) {
    const jx = 24 + i * 40;
    const jh = 34 + rnd() * 14;
    ctx.fillStyle = jars[i];
    ctx.fillRect(jx, 232 - jh, 28, jh);
    ctx.fillStyle = "#b9a37a";
    ctx.fillRect(jx - 2, 232 - jh - 6, 32, 7);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(jx + 4, 232 - jh + 4, 4, jh - 8);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(jx + 0.5, 232 - jh + 0.5, 27, jh - 1);
  }

  // The counter: a butcher block with flour dusted on it.
  const block = ctx.createLinearGradient(0, DESK_Y, 0, H);
  block.addColorStop(0, "#c99d64");
  block.addColorStop(1, "#9a6c3a");
  ctx.fillStyle = block;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);
  for (let x = 0; x < W; x += 34) {
    ctx.fillStyle = "rgba(60,30,8,0.22)";
    ctx.fillRect(x, DESK_Y, 2, H - DESK_Y);
    ctx.fillStyle = "rgba(255,230,190,0.1)";
    ctx.fillRect(x + 2, DESK_Y, 1, H - DESK_Y);
  }
  for (let i = 0; i < 40; i++) {
    const gx = rnd() * W;
    const gy = DESK_Y + 4 + rnd() * (H - DESK_Y - 4);
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(60,30,8,0.12)" : "rgba(255,230,190,0.1)";
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 20 + rnd() * 50, gy + (rnd() - 0.5) * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const fx = 30 + rnd() * (W - 60);
    const fy = DESK_Y + 30 + rnd() * (H - DESK_Y - 60);
    const dust = ctx.createRadialGradient(fx, fy, 0, fx, fy, 40 + rnd() * 30);
    dust.addColorStop(0, "rgba(255,252,240,0.38)");
    dust.addColorStop(1, "rgba(255,252,240,0)");
    ctx.fillStyle = dust;
    ctx.fillRect(fx - 80, fy - 80, 160, 160);
  }
  edge(ctx, "rgba(255,240,205,0.35)");
}

// ---- The spaceship --------------------------------------------------------------------

/** The inside of a spaceship: a big window onto space with a ringed planet, and a console that the cups stand on. */
function spaceship(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(77);
  // The hull: dark metal, with ribs along the ceiling and a long light there.
  const hull = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  hull.addColorStop(0, "#2a3345");
  hull.addColorStop(1, "#131822");
  ctx.fillStyle = hull;
  ctx.fillRect(0, 0, W, DESK_Y);
  ctx.fillStyle = "#0d1118";
  ctx.fillRect(0, 0, W, 30);
  for (let x = 6; x < W; x += 22) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x, 0, 2, 30);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x + 2, 0, 3, 30);
  }
  const strip = ctx.createLinearGradient(0, 0, 0, 14);
  strip.addColorStop(0, "rgba(210,236,255,0.9)");
  strip.addColorStop(1, "rgba(150,205,255,0.15)");
  ctx.fillStyle = strip;
  ctx.beginPath();
  ctx.roundRect(44, 6, W - 88, 7, 3.5);
  ctx.fill();
  const stripGlow = ctx.createLinearGradient(0, 10, 0, 64);
  stripGlow.addColorStop(0, "rgba(160,215,255,0.22)");
  stripGlow.addColorStop(1, "rgba(160,215,255,0)");
  ctx.fillStyle = stripGlow;
  ctx.fillRect(0, 10, W, 54);

  const wx = 30;
  const wy = 34;
  const ww = W - 60;
  const wh = DESK_Y - wy - 54;
  const windowPath = (grow = 0) => {
    ctx.beginPath();
    ctx.roundRect(wx - grow, wy - grow, ww + 2 * grow, wh + 2 * grow, 54 + grow);
  };

  // Space, seen through the window.
  ctx.save();
  windowPath();
  ctx.clip();
  const space = ctx.createLinearGradient(0, wy, 0, wy + wh);
  space.addColorStop(0, "#04050d");
  space.addColorStop(0.6, "#0a1030");
  space.addColorStop(1, "#1a1442");
  ctx.fillStyle = space;
  ctx.fillRect(wx, wy, ww, wh);
  for (const [x, y, rad, color] of [
    [90, 150, 160, "rgba(130,70,210,0.38)"],
    [290, 90, 140, "rgba(40,150,225,0.26)"],
    [190, 360, 170, "rgba(225,75,145,0.2)"],
  ] as const) {
    const neb = ctx.createRadialGradient(x, y, 0, x, y, rad);
    neb.addColorStop(0, color);
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(wx, wy, ww, wh);
  }
  // Stars, some of them with a glint.
  for (let i = 0; i < 190; i++) {
    const x = wx + rnd() * ww;
    const y = wy + rnd() * wh;
    const tint = rnd();
    ctx.fillStyle = `rgba(${tint < 0.2 ? "190,210,255" : tint < 0.35 ? "255,225,190" : "255,255,255"},${0.25 + rnd() * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, rnd() < 0.08 ? 1.5 : 0.45 + rnd() * 0.85, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  for (const [x, y] of [[60, 80], [300, 170], [150, 60], [320, 40], [40, 260]]) {
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  }
  // A far away sun.
  const sun = ctx.createRadialGradient(40, 60, 0, 40, 60, 120);
  sun.addColorStop(0, "rgba(255,244,214,0.55)");
  sun.addColorStop(0.15, "rgba(255,226,170,0.25)");
  sun.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(wx, wy, ww, wh);
  // A small moon.
  const moon = ctx.createRadialGradient(72, 288, 2, 76, 292, 22);
  moon.addColorStop(0, "#d9dbe3");
  moon.addColorStop(1, "#6d7080");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(76, 292, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(60,64,80,0.45)";
  for (const [dx, dy, rad] of [[-6, -5, 4], [6, 4, 5], [-3, 8, 2.5]]) {
    ctx.beginPath();
    ctx.arc(76 + dx, 292 + dy, rad, 0, TAU);
    ctx.fill();
  }
  // A ringed planet, low in the window: the back of its ring, the planet, and the front of its ring.
  const px = 262;
  const py = 322;
  const pr = 80;
  const ring = (from: number, to: number) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.32);
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(236,212,164,0.78)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 150, 34, 0, from, to);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(200,170,120,0.7)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 124, 28, 0, from, to);
    ctx.stroke();
    ctx.restore();
  };
  ring(Math.PI, TAU);
  const body = ctx.createRadialGradient(px - 28, py - 30, 6, px, py, pr);
  body.addColorStop(0, "#f6dcae");
  body.addColorStop(0.5, "#d49a58");
  body.addColorStop(1, "#6a3a22");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? "rgba(120,60,30,0.22)" : "rgba(255,235,200,0.14)";
    ctx.fillRect(px - pr, py - pr + 8 + i * 17, pr * 2, 7 + (i % 3) * 3);
  }
  const night = ctx.createRadialGradient(px - 40, py - 40, pr * 0.5, px, py, pr * 1.25);
  night.addColorStop(0, "rgba(0,0,20,0)");
  night.addColorStop(1, "rgba(0,0,20,0.7)");
  ctx.fillStyle = night;
  ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  ctx.restore();
  ring(0, Math.PI);
  ctx.restore();

  // The pillars of the ship at both sides of the window, with ribs and pipes running down them.
  for (const side of [-1, 1]) {
    const edgeX = side < 0 ? 0 : W;
    const innerX = side < 0 ? wx - 8 : wx + ww + 8;
    const pillar = ctx.createLinearGradient(edgeX, 0, innerX, 0);
    pillar.addColorStop(0, "#10141c");
    pillar.addColorStop(1, "#2c3547");
    ctx.fillStyle = pillar;
    ctx.beginPath();
    ctx.moveTo(edgeX, 0);
    ctx.lineTo(innerX, wy + 26);
    ctx.lineTo(innerX, wy + wh - 26);
    ctx.lineTo(edgeX, DESK_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(innerX, wy + 26);
    ctx.lineTo(innerX, wy + wh - 26);
    ctx.stroke();
    // Two pipes down the pillar.
    for (const [offset, width] of [[10, 7], [21, 5]] as const) {
      const pipeX = side < 0 ? offset : W - offset;
      const pipe = ctx.createLinearGradient(pipeX - width / 2, 0, pipeX + width / 2, 0);
      pipe.addColorStop(0, "#161b25");
      pipe.addColorStop(0.35, "#6d788c");
      pipe.addColorStop(1, "#1b212d");
      ctx.fillStyle = pipe;
      ctx.fillRect(pipeX - width / 2, 6, width, DESK_Y - 12);
      ctx.fillStyle = "#0e121a";
      for (let y = 70; y < DESK_Y - 30; y += 92) ctx.fillRect(pipeX - width / 2 - 2, y, width + 4, 6);
    }
  }

  // The frame of the window: thick metal with rivets.
  const metal = ctx.createLinearGradient(0, wy - 12, 0, wy + wh + 12);
  metal.addColorStop(0, "#6b7789");
  metal.addColorStop(0.5, "#3a4354");
  metal.addColorStop(1, "#262c39");
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.roundRect(wx - 12, wy - 12, ww + 24, wh + 24, 66);
  ctx.roundRect(wx, wy, ww, wh, 54);
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  windowPath(11);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 2;
  windowPath();
  ctx.stroke();
  ctx.fillStyle = "#8a96a9";
  for (let x = wx + 40; x < wx + ww - 30; x += 46) {
    for (const y of [wy - 6, wy + wh + 6]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
    }
  }
  for (let y = wy + 60; y < wy + wh - 50; y += 46) {
    for (const x of [wx - 6, wx + ww + 6]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
    }
  }
  // A glare on the glass.
  ctx.save();
  windowPath();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.moveTo(wx + 50, wy);
  ctx.lineTo(wx + 140, wy);
  ctx.lineTo(wx + 40, wy + wh);
  ctx.lineTo(wx - 50, wy + wh);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(wx + 160, wy);
  ctx.lineTo(wx + 190, wy);
  ctx.lineTo(wx + 90, wy + wh);
  ctx.lineTo(wx + 60, wy + wh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // A metal ledge under the window, with grooves and one long thin light.
  const ledge = ctx.createLinearGradient(0, DESK_Y - 42, 0, DESK_Y);
  ledge.addColorStop(0, "#242c3b");
  ledge.addColorStop(1, "#0f131b");
  ctx.fillStyle = ledge;
  ctx.fillRect(0, DESK_Y - 42, W, 42);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, DESK_Y - 42, W, 1.5);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (const y of [DESK_Y - 30, DESK_Y - 14]) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (const y of [DESK_Y - 28, DESK_Y - 12]) ctx.fillRect(0, y, W, 1);
  const thin = ctx.createLinearGradient(40, 0, W - 40, 0);
  thin.addColorStop(0, "rgba(110,215,255,0)");
  thin.addColorStop(0.5, "rgba(130,225,255,0.75)");
  thin.addColorStop(1, "rgba(110,215,255,0)");
  ctx.fillStyle = thin;
  ctx.fillRect(40, DESK_Y - 22, W - 80, 2.5);

  // The console that the cups stand on: dark panels with seams, rivets and a glowing edge.
  const top = ctx.createLinearGradient(0, DESK_Y, 0, H);
  top.addColorStop(0, "#37425a");
  top.addColorStop(1, "#1b2130");
  ctx.fillStyle = top;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let y = DESK_Y + 62; y < H; y += 62) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = DESK_Y + 64; y < H; y += 62) ctx.fillRect(0, y, W, 1);
  for (let row = 0; row < 3; row++) {
    const sx = 40 + rnd() * (W - 80);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(sx, DESK_Y + 2 + row * 62, 2, 60);
  }
  ctx.fillStyle = "#7f8ba0";
  for (let row = 0; row < 3; row++) {
    for (let x = 14; x < W; x += 66) {
      for (const dy of [8, 54]) {
        ctx.beginPath();
        ctx.arc(x, DESK_Y + dy + row * 62, 1.8, 0, TAU);
        ctx.fill();
      }
    }
  }
  // A faint pattern of hexagons across the console.
  ctx.strokeStyle = "rgba(150,200,255,0.06)";
  ctx.lineWidth = 1;
  const hex = 20;
  for (let row = 0; row * hex * 1.5 < H - DESK_Y + hex; row++) {
    for (let col = 0; col < W / (hex * 1.74) + 1; col++) {
      const hx = col * hex * 1.74 + (row % 2 ? hex * 0.87 : 0);
      const hy = DESK_Y + 10 + row * hex * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3 + Math.PI / 6;
        const vx = hx + hex * 0.9 * Math.cos(ang);
        const vy = hy + hex * 0.9 * Math.sin(ang);
        if (k === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(90,210,255,0.28)";
  ctx.fillRect(0, DESK_Y + 2, W, 3);
  edge(ctx, "rgba(150,225,255,0.4)");
}

// ---- The terrace ----------------------------------------------------------------------

function terrace(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(33);
  // An evening sky, from dark blue to orange at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  sky.addColorStop(0, "#221d4a");
  sky.addColorStop(0.45, "#6a3b7a");
  sky.addColorStop(0.8, "#e5825a");
  sky.addColorStop(1, "#ffc279");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, DESK_Y);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * 190, 0.6 + rnd() * 1.1, 0, TAU);
    ctx.fill();
  }
  const sun = ctx.createRadialGradient(250, 340, 0, 250, 340, 190);
  sun.addColorStop(0, "rgba(255,226,160,0.8)");
  sun.addColorStop(1, "rgba(255,200,130,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 150, W, 300);

  // The city in the distance, two rows of buildings, the nearer one with lit windows.
  for (const row of [
    {base: 392, min: 40, max: 110, color: "#5a3c68", windows: false},
    {base: 416, min: 30, max: 90, color: "#2c2144", windows: true},
  ]) {
    let x = -10;
    while (x < W) {
      const bw = 22 + rnd() * 34;
      const bh = row.min + rnd() * (row.max - row.min);
      ctx.fillStyle = row.color;
      ctx.fillRect(x, row.base - bh, bw, bh + 40);
      if (row.windows) {
        for (let wy = row.base - bh + 8; wy < row.base - 4; wy += 11) {
          for (let wx = x + 5; wx < x + bw - 5; wx += 9) {
            if (rnd() < 0.42) {
              ctx.fillStyle = "rgba(255,214,130,0.8)";
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
      }
      x += bw + 2 + rnd() * 4;
    }
  }

  // A string of lights hanging across the top.
  const bulbs = 11;
  ctx.strokeStyle = "#1a1228";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= bulbs; i++) {
    const t = i / bulbs;
    const px = -4 + t * (W + 8);
    const py = 34 + Math.sin(t * Math.PI) * 38;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  for (let i = 1; i < bulbs; i++) {
    const t = i / bulbs;
    const px = -4 + t * (W + 8);
    const py = 34 + Math.sin(t * Math.PI) * 38 + 5;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 20);
    glow.addColorStop(0, "rgba(255,226,150,0.85)");
    glow.addColorStop(1, "rgba(255,226,150,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(px - 20, py - 20, 40, 40);
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, TAU);
    ctx.fill();
  }

  // The railing of the terrace.
  ctx.fillStyle = "#1f1830";
  ctx.fillRect(0, 418, W, 7);
  ctx.fillRect(0, DESK_Y - 8, W, 8);
  for (let x = 6; x < W; x += 20) ctx.fillRect(x, 418, 4, DESK_Y - 418);
  ctx.fillStyle = "rgba(255,200,140,0.18)";
  ctx.fillRect(0, 418, W, 2);

  // The table: warm teak boards with seams and grain.
  const teak = ctx.createLinearGradient(0, DESK_Y, 0, H);
  teak.addColorStop(0, "#a8754a");
  teak.addColorStop(1, "#6b4527");
  ctx.fillStyle = teak;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);
  for (let y = DESK_Y + 44; y < H; y += 46) {
    ctx.fillStyle = "rgba(30,14,4,0.45)";
    ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = "rgba(255,225,180,0.12)";
    ctx.fillRect(0, y + 2, W, 1);
    // The boards end at different places.
    const sx = 30 + rnd() * (W - 60);
    ctx.fillStyle = "rgba(30,14,4,0.4)";
    ctx.fillRect(sx, y - 44, 2, 44);
  }
  for (let i = 0; i < 60; i++) {
    const gx = rnd() * W;
    const gy = DESK_Y + 4 + rnd() * (H - DESK_Y - 4);
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.1)" : "rgba(255,225,180,0.08)";
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 40 + rnd() * 120, gy + (rnd() - 0.5) * 2);
    ctx.stroke();
  }
  edge(ctx, "rgba(255,230,190,0.28)");
}

// ---- Putting it together --------------------------------------------------------------

function dim(ctx: CanvasRenderingContext2D, extra: number): void {
  // The whole room is a little dimmed, and darker at the corners.
  ctx.fillStyle = "rgba(10,8,18,0.2)";
  ctx.fillRect(0, 0, W, H + extra);
  const v = ctx.createRadialGradient(W / 2, extra + H * 0.55, H * 0.25, W / 2, extra + H * 0.55, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H + extra);
}

/** The tones of the light that can be put over a room: layers of colour, each with the way it is mixed with the picture. */
const TINTS: Record<string, [GlobalCompositeOperation, string][]> = {
  sunset: [["overlay", "rgba(255,128,48,0.6)"], ["source-over", "rgba(255,90,60,0.1)"]],
  night: [["multiply", "rgba(80,100,200,0.7)"], ["overlay", "rgba(40,60,170,0.4)"]],
  forest: [["overlay", "rgba(70,170,90,0.55)"], ["multiply", "rgba(160,225,170,0.3)"]],
  sepia: [["saturation", "rgba(128,128,128,1)"], ["multiply", "rgba(214,172,120,0.9)"]],
};

/**
 * The finished picture of a room, at `pxPerUnit` pixels for every game unit. On a tall phone the picture is `extra` units taller: the room
 * is drawn as it always is, against the bottom, and the wall goes on up to the top (the top edge of the room is stretched upwards).
 */
function makeRoom(room: Room, pxPerUnit: number, extra: number, tint: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(W * pxPerUnit));
  c.height = Math.max(1, Math.round((H + extra) * pxPerUnit));
  const ctx = c.getContext("2d")!;
  const k = c.width / W;
  ctx.scale(k, k);
  ctx.translate(0, extra);
  if (room === "classroom") classroom(ctx);
  else if (room === "cafe") cafe(ctx);
  else if (room === "library") library(ctx);
  else if (room === "bakery") bakery(ctx);
  else if (room === "spaceship") spaceship(ctx);
  else terrace(ctx);
  ctx.translate(0, -extra);
  if (extra > 0) {
    // (the top few units of the room, stretched up to the top of the picture)
    const strip = Math.max(1, Math.round(3 * k));
    const above = Math.round(extra * k);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(c, 0, above, c.width, strip, 0, 0, c.width, above + 1);
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }
  dim(ctx, extra);
  for (const [op, color] of TINTS[tint] ?? []) {
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H + extra);
  }
  ctx.globalCompositeOperation = "source-over";
  return c;
}

export function makeBackgrounds(pxPerUnit: number, extra = 0, tint = "none"): Record<Room, HTMLCanvasElement> {
  return {
    classroom: makeRoom("classroom", pxPerUnit, extra, tint),
    cafe: makeRoom("cafe", pxPerUnit, extra, tint),
    library: makeRoom("library", pxPerUnit, extra, tint),
    bakery: makeRoom("bakery", pxPerUnit, extra, tint),
    spaceship: makeRoom("spaceship", pxPerUnit, extra, tint),
    terrace: makeRoom("terrace", pxPerUnit, extra, tint),
  };
}
