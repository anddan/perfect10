// The way up of the daily challenge, drawn in one of seven shapes (a ladder, a pyramid, a mountain, a tower, a rocket, a staircase and a
// spaceship) that changes with the day of the streak.
// The page of the ladder and the picture that comes after every rung use the same drawings.
import {STREAK_DAYS, STREAK_RUNGS} from "../game/daily";
import {FONT, TAU, roundRect} from "./draw";

export type StepDesign = "ladder" | "pyramid" | "mountain" | "tower" | "rocket" | "stairs" | "ship";
export const DESIGNS: readonly StepDesign[] = ["ladder", "pyramid", "mountain", "tower", "rocket", "stairs", "ship"];

/** The shape of a day of the streak (1 to 7): every day of the week has its own. */
export function designOfDay(day: number): StepDesign {
  return DESIGNS[(Math.min(STREAK_DAYS, Math.max(1, Math.floor(day))) - 1) % DESIGNS.length];
}

/** Where the steps are: `cx` is the middle, `y0` the middle of the lowest step and `step` how far apart they are (going up). */
export interface Geom {
  cx: number;
  y0: number;
  step: number;
}

/** How many steps there are: the same as the rungs of the ladder. */
const STEPS = 6;

export function stepY(g: Geom, i: number): number {
  return g.y0 - i * g.step;
}

/** The mountain: the top and the foot, and how wide it is at a height. */
function peakY(g: Geom): number {
  return stepY(g, STEPS - 1) - 0.6 * g.step;
}
function footY(g: Geom): number {
  return g.y0 + 0.8 * g.step;
}
const MOUNTAIN_HALF = 92;

export function stepX(design: StepDesign, g: Geom, i: number): number {
  if (design === "stairs") return stairLeft(g, i) + 12;
  if (design !== "mountain") return g.cx;
  const y = stepY(g, i);
  const half = (MOUNTAIN_HALF * (y - peakY(g))) / (footY(g) - peakY(g));
  return g.cx + (i % 2 === 0 ? -1 : 1) * half * 0.42;
}

/** Half the width of the drawing (the labels stand outside it). */
export function halfWidth(design: StepDesign): number {
  const half: Record<StepDesign, number> = {ladder: 31, pyramid: 80, mountain: MOUNTAIN_HALF, tower: 34, rocket: 46, stairs: 74, ship: 42};
  return half[design];
}

/** A check mark, brush dark, on a step that has been climbed. */
function check(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1): void {
  ctx.save();
  ctx.strokeStyle = "#5e3a06";
  ctx.lineWidth = 2.2 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 5 * s, y);
  ctx.lineTo(x - 1.5 * s, y + 3.5 * s);
  ctx.lineTo(x + 5.5 * s, y - 3.5 * s);
  ctx.stroke();
  ctx.restore();
}

/** The gold of a step that is done, and the sand/wood of one that is not. */
function stepFill(ctx: CanvasRenderingContext2D, y0: number, y1: number, done: boolean, tone: "wood" | "sand"): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  if (done) {
    g.addColorStop(0, "#fff3a8");
    g.addColorStop(1, "#e8a91c");
  } else if (tone === "sand") {
    g.addColorStop(0, "#f3dfab");
    g.addColorStop(1, "#cfa767");
  } else {
    g.addColorStop(0, "#e3b583");
    g.addColorStop(1, "#a8774a");
  }
  return g;
}

/** Draws the whole thing: the structure (rails, rows or a mountain) with a marker for each of the six steps; `done(i)` says which are climbed. */
export function drawSteps(ctx: CanvasRenderingContext2D, design: StepDesign, g: Geom, done: (i: number) => boolean): void {
  ctx.save();
  ctx.lineJoin = "round";
  if (design === "ladder") drawLadderShape(ctx, g, done);
  else if (design === "pyramid") drawPyramidShape(ctx, g, done);
  else if (design === "tower") drawTowerShape(ctx, g, done);
  else if (design === "rocket") drawRocketShape(ctx, g, done);
  else if (design === "stairs") drawStairShape(ctx, g, done);
  else if (design === "ship") drawShipShape(ctx, g, done);
  else drawMountainShape(ctx, g, done);
  ctx.restore();
}

function drawLadderShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  const top = stepY(g, STEPS - 1) - g.step * 0.85;
  const bottom = g.y0 + g.step * 0.65;
  for (const x of [g.cx - 28, g.cx + 28]) {
    const wood = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
    wood.addColorStop(0, "#9a693f");
    wood.addColorStop(0.45, "#e3b583");
    wood.addColorStop(1, "#6f4a2a");
    ctx.fillStyle = wood;
    roundRect(ctx, x - 4, top, 8, bottom - top, 3.5);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(60,30,10,0.55)";
    ctx.stroke();
  }
  const h = Math.min(16, g.step * 0.5);
  for (let i = 0; i < STEPS; i++) {
    const y = stepY(g, i);
    const d = done(i);
    ctx.fillStyle = stepFill(ctx, y - h / 2, y + h / 2, d, "wood");
    roundRect(ctx, g.cx - 31, y - h / 2, 62, h, h / 2.2);
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = d ? "#8a5208" : "rgba(60,30,10,0.65)";
    ctx.stroke();
    if (d) check(ctx, g.cx, y);
  }
}

function drawPyramidShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  // Masonry: every step is two courses of stone blocks, and the joints of one course lie over the middle of the blocks under it.
  const sand = ["#f3dfab", "#ecd49a", "#e4c689", "#efd8a0"];
  const gold = ["#fff0a0", "#ffe27a", "#ffd75a", "#fbe58c"];
  const stoneW = Math.max(18, g.step * 0.72);
  for (let i = 0; i < STEPS; i++) {
    const y = stepY(g, i);
    const d = done(i);
    const yb = y + g.step / 2 - 0.8;
    const yt = y - g.step / 2 + 0.8;
    const hb = 80 * (1 - i / STEPS);
    const ht = 80 * (1 - (i + 1) / STEPS);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.cx - hb, yb);
    ctx.lineTo(g.cx + hb, yb);
    ctx.lineTo(g.cx + ht, yt);
    ctx.lineTo(g.cx - ht, yt);
    ctx.closePath();
    // The mortar, and then the blocks on top of it (everything is cut off at the edge of the step).
    ctx.fillStyle = d ? "#c98a14" : "#a98250";
    ctx.fill();
    ctx.clip();
    const courseH = (yb - yt) / 2;
    for (let c = 0; c < 2; c++) {
      const top = yb - (c + 1) * courseH;
      const shift = (i * 2 + c) % 2 === 0 ? 0 : stoneW / 2;
      for (let k = -1; g.cx - hb - stoneW + shift + k * stoneW < g.cx + hb + stoneW; k++) {
        const x = g.cx - hb - stoneW + shift + k * stoneW;
        const tone = (i * 7 + c * 3 + ((k % 4) + 4) * 5) % 4;
        const block = ctx.createLinearGradient(0, top, 0, top + courseH);
        block.addColorStop(0, (d ? gold : sand)[tone]);
        block.addColorStop(1, d ? "#f0b52a" : "#d4b077");
        ctx.fillStyle = block;
        roundRect(ctx, x + 0.9, top + 0.9, stoneW - 1.8, courseH - 1.8, 2.2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(g.cx - hb, yb);
    ctx.lineTo(g.cx + hb, yb);
    ctx.lineTo(g.cx + ht, yt);
    ctx.lineTo(g.cx - ht, yt);
    ctx.closePath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = d ? "#8a5208" : "rgba(90,55,20,0.85)";
    ctx.stroke();
    if (d) check(ctx, g.cx, y, hb < 22 ? 0.7 : 1);
  }
}

function drawMountainShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  const top = peakY(g);
  const foot = footY(g);
  const at = (f: number, side: -1 | 1, wob = 0): [number, number] => [g.cx + side * (MOUNTAIN_HALF * f + wob), top + f * (foot - top)];
  // The mountain: two shoulders on each side and a peak, in a cool grey-blue.
  ctx.beginPath();
  ctx.moveTo(...at(1, -1));
  ctx.lineTo(...at(0.62, -1, -8));
  ctx.lineTo(...at(0.42, -1, 4));
  ctx.lineTo(g.cx, top);
  ctx.lineTo(...at(0.38, 1, -4));
  ctx.lineTo(...at(0.66, 1, 7));
  ctx.lineTo(...at(1, 1));
  ctx.closePath();
  const rock = ctx.createLinearGradient(0, top, 0, foot);
  rock.addColorStop(0, "#9fb2c8");
  rock.addColorStop(1, "#5f7390");
  ctx.fillStyle = rock;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(35,45,65,0.75)";
  ctx.stroke();
  // The snow on top, with a ragged edge.
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  const snowY = top + (foot - top) * 0.24;
  ctx.moveTo(g.cx - 60, top - 2);
  ctx.lineTo(g.cx + 60, top - 2);
  ctx.lineTo(g.cx + 40, snowY - 4);
  ctx.lineTo(g.cx + 22, snowY + 5);
  ctx.lineTo(g.cx + 6, snowY - 3);
  ctx.lineTo(g.cx - 10, snowY + 6);
  ctx.lineTo(g.cx - 28, snowY - 2);
  ctx.lineTo(g.cx - 44, snowY + 3);
  ctx.closePath();
  ctx.fillStyle = "rgba(248,251,255,0.95)";
  ctx.fill();
  ctx.restore();
  // The path up, with a marker on every step.
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,248,230,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < STEPS; i++) {
    const x = stepX("mountain", g, i);
    const y = stepY(g, i);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < STEPS; i++) {
    const x = stepX("mountain", g, i);
    const y = stepY(g, i);
    const d = done(i);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, TAU);
    ctx.fillStyle = d ? stepFill(ctx, y - 10, y + 10, true, "sand") : "#f4ecdc";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = d ? "#8a5208" : "#4a5a70";
    ctx.stroke();
    if (d) check(ctx, x, y, 0.8);
    else {
      ctx.fillStyle = "#4a5a70";
      ctx.font = "700 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x, y + 0.5);
    }
  }
  // A flag on the top.
  const fx = g.cx;
  const fy = top + 2;
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx, fy - 16);
  ctx.stroke();
  ctx.fillStyle = done(STEPS - 1) ? "#ffd23a" : "#e3503a";
  ctx.beginPath();
  ctx.moveTo(fx, fy - 16);
  ctx.lineTo(fx + 13, fy - 12);
  ctx.lineTo(fx, fy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#7a2a18";
  ctx.stroke();
}

/** A step marker that is a round token: gold with a check when it is done, otherwise light with the number of the step. */
function token(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, i: number, done: boolean, light = "#f4ecdc", ink = "#4a5a70"): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = done ? stepFill(ctx, y - r, y + r, true, "sand") : light;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = done ? "#8a5208" : ink;
  ctx.stroke();
  if (done) check(ctx, x, y, r / 10 * 0.85);
  else {
    ctx.fillStyle = ink;
    ctx.font = `700 ${Math.round(r * 1.1)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y + 0.5);
  }
}

/** A flag on a pole (the pole stands at (x, y) and goes up): red until the top is reached, then gold. */
function flag(ctx: CanvasRenderingContext2D, x: number, y: number, done: boolean, h = 16): void {
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  ctx.fillStyle = done ? "#ffd23a" : "#e3503a";
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + 13, y - h + 4);
  ctx.lineTo(x, y - h + 8);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#7a2a18";
  ctx.stroke();
}

/** A tower of stone: a window on every floor that lights up gold when it is climbed, battlements and a flag on top. */
function drawTowerShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  const half = 32;
  const top = stepY(g, STEPS - 1) - g.step / 2;
  const bottom = g.y0 + g.step / 2;
  const stone = ctx.createLinearGradient(g.cx - half, 0, g.cx + half, 0);
  stone.addColorStop(0, "#cfc8bb");
  stone.addColorStop(0.5, "#b3ab9c");
  stone.addColorStop(1, "#8d8577");
  // The battlements first (so that the wall covers their feet).
  ctx.fillStyle = stone;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(60,52,40,0.8)";
  for (const dx of [-half, -7, 18]) {
    roundRect(ctx, g.cx + dx, top - 9, 14, 11, 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = stone;
  roundRect(ctx, g.cx - half, top, half * 2, bottom - top, 3);
  ctx.fill();
  ctx.stroke();
  // The joints between the floors.
  ctx.strokeStyle = "rgba(60,52,40,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < STEPS - 1; i++) {
    const y = stepY(g, i) - g.step / 2;
    ctx.moveTo(g.cx - half, y);
    ctx.lineTo(g.cx + half, y);
  }
  ctx.stroke();
  const wh = Math.min(20, g.step * 0.68);
  for (let i = 0; i < STEPS; i++) {
    const y = stepY(g, i);
    const d = done(i);
    // An arched window.
    ctx.beginPath();
    ctx.moveTo(g.cx - 8, y + wh / 2);
    ctx.lineTo(g.cx - 8, y - wh / 2 + 8);
    ctx.arc(g.cx, y - wh / 2 + 8, 8, Math.PI, 0);
    ctx.lineTo(g.cx + 8, y + wh / 2);
    ctx.closePath();
    ctx.fillStyle = d ? stepFill(ctx, y - wh / 2, y + wh / 2, true, "sand") : "#2f3b55";
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = d ? "#8a5208" : "#1c2438";
    ctx.stroke();
    if (d) check(ctx, g.cx, y + 1, 0.8);
  }
  flag(ctx, g.cx, top - 9, done(STEPS - 1));
}

/** A rocket on its way up: a porthole for every step, a red nose cone and fins, and a flame at the bottom. */
function drawRocketShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  const half = 28;
  const top = stepY(g, STEPS - 1) - g.step / 2;
  const bottom = g.y0 + g.step / 2;
  // The flame.
  const fire = ctx.createLinearGradient(0, bottom, 0, bottom + g.step * 0.6);
  fire.addColorStop(0, "#ffe27a");
  fire.addColorStop(0.5, "#ff9a1f");
  fire.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.moveTo(g.cx - 15, bottom - 1);
  ctx.quadraticCurveTo(g.cx - 12, bottom + g.step * 0.4, g.cx, bottom + g.step * 0.6);
  ctx.quadraticCurveTo(g.cx + 12, bottom + g.step * 0.4, g.cx + 15, bottom - 1);
  ctx.closePath();
  ctx.fill();
  // The fins.
  ctx.fillStyle = "#d23a2d";
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#6e1510";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(g.cx + side * half, bottom - g.step * 1.5);
    ctx.lineTo(g.cx + side * (half + 17), bottom + g.step * 0.05);
    ctx.lineTo(g.cx + side * half, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The body and the nose cone.
  const body = ctx.createLinearGradient(g.cx - half, 0, g.cx + half, 0);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.6, "#e3e8ef");
  body.addColorStop(1, "#aab4c4");
  ctx.fillStyle = body;
  roundRect(ctx, g.cx - half, top, half * 2, bottom - top, 5);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#5b6678";
  ctx.stroke();
  ctx.fillStyle = "#d23a2d";
  ctx.beginPath();
  ctx.moveTo(g.cx - half, top + 0.5);
  ctx.quadraticCurveTo(g.cx - half + 4, top - g.step * 0.45, g.cx, top - g.step * 0.55);
  ctx.quadraticCurveTo(g.cx + half - 4, top - g.step * 0.45, g.cx + half, top + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#6e1510";
  ctx.stroke();
  // A porthole for every step.
  const r = Math.min(11, g.step * 0.36);
  for (let i = 0; i < STEPS; i++) {
    const y = stepY(g, i);
    const d = done(i);
    ctx.beginPath();
    ctx.arc(g.cx, y, r, 0, TAU);
    ctx.fillStyle = d ? stepFill(ctx, y - r, y + r, true, "sand") : "#33506e";
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = d ? "#8a5208" : "#7d8798";
    ctx.stroke();
    if (d) check(ctx, g.cx, y, r / 10 * 0.85);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(g.cx - r * 0.3, y - r * 0.35, r * 0.3, 0, TAU);
      ctx.fill();
    }
  }
}

/** The left edge of a strip of the staircase. */
function stairLeft(g: Geom, i: number): number {
  return g.cx - 72 + 24 * i;
}

/** A staircase going up to the right: every step is a block (a strip down to the ground), with a flag on the highest one. */
function drawStairShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  const foot = g.y0 + g.step * 0.7;
  for (let i = 0; i < STEPS; i++) {
    const left = stairLeft(g, i);
    const topY = stepY(g, i) - g.step / 2;
    const d = done(i);
    const fill = ctx.createLinearGradient(0, topY, 0, foot);
    if (d) {
      fill.addColorStop(0, "#fff3a8");
      fill.addColorStop(1, "#e8a91c");
    } else {
      fill.addColorStop(0, "#e9d3a4");
      fill.addColorStop(1, "#b98f5a");
    }
    ctx.fillStyle = fill;
    ctx.fillRect(left, topY, 24, foot - topY);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = d ? "#8a5208" : "rgba(90,55,20,0.75)";
    ctx.strokeRect(left, topY, 24, foot - topY);
    // The top of the step: a darker edge, like the tread.
    ctx.fillStyle = d ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)";
    ctx.fillRect(left + 1, topY + 1, 22, 3.5);
  }
  for (let i = 0; i < STEPS; i++) token(ctx, stairLeft(g, i) + 12, stepY(g, i) + 2, 8.5, i, done(i), "#f7efdc", "#7a5a32");
  flag(ctx, stairLeft(g, STEPS - 1) + 12, stepY(g, STEPS - 1) - g.step / 2, done(STEPS - 1));
}

/** A spaceship: a flying saucer on top that pulls you up in a beam of light, with a landing pad for every step. */
function drawShipShape(ctx: CanvasRenderingContext2D, g: Geom, done: (i: number) => boolean): void {
  const sy = stepY(g, STEPS - 1) - g.step * 0.55;
  const bottom = g.y0 + g.step * 0.6;
  // The beam, wider the further down it goes.
  const beam = ctx.createLinearGradient(0, sy, 0, bottom);
  beam.addColorStop(0, "rgba(255,244,170,0.6)");
  beam.addColorStop(1, "rgba(255,244,170,0.12)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(g.cx - 14, sy + 6);
  ctx.lineTo(g.cx + 14, sy + 6);
  ctx.lineTo(g.cx + 40, bottom);
  ctx.lineTo(g.cx - 40, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,236,140,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // The pads, one for every step.
  for (let i = 0; i < STEPS; i++) {
    const y = stepY(g, i);
    const d = done(i);
    const rx = 22 - (i * 1.2);
    ctx.beginPath();
    ctx.ellipse(g.cx, y, rx, 7, 0, 0, TAU);
    const pad = ctx.createLinearGradient(0, y - 7, 0, y + 7);
    if (d) {
      pad.addColorStop(0, "#fff3a8");
      pad.addColorStop(1, "#e8a91c");
    } else {
      pad.addColorStop(0, "#c9d3e3");
      pad.addColorStop(1, "#7a869c");
    }
    ctx.fillStyle = pad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = d ? "#8a5208" : "#3f4a60";
    ctx.stroke();
    if (d) check(ctx, g.cx, y, 0.62);
    else {
      ctx.fillStyle = "#2c3750";
      ctx.font = "700 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), g.cx, y + 0.5);
    }
  }
  // The saucer: a glass dome on a metal disc with a row of lights.
  const dome = ctx.createLinearGradient(0, sy - 16, 0, sy);
  dome.addColorStop(0, "#e9f6ff");
  dome.addColorStop(1, "#7fb8e6");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(g.cx, sy - 2, 15, 13, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#3f5f86";
  ctx.stroke();
  const metal = ctx.createLinearGradient(0, sy - 8, 0, sy + 9);
  metal.addColorStop(0, "#e3e8f0");
  metal.addColorStop(0.5, "#aab4c6");
  metal.addColorStop(1, "#6a7488");
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.ellipse(g.cx, sy, 36, 9, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#3f4a60";
  ctx.stroke();
  for (let k = -2; k <= 2; k++) {
    ctx.fillStyle = done(STEPS - 1) ? "#ffd23a" : "#ffe9a8";
    ctx.beginPath();
    ctx.arc(g.cx + k * 12, sy + 1.5 + Math.abs(k) * 0.6, 2.2, 0, TAU);
    ctx.fill();
  }
}

/**
 * The goal line of the streak: a red dotted line right above the last stage that has to be cleared for the day to count (between stage 4 and
 * stage 5), from x0 to x1, with a few words at its end saying so. `color` is the red (a lighter one on a dark ground).
 */
export function drawLimitLine(ctx: CanvasRenderingContext2D, g: Geom, x0: number, x1: number, label: string, color = "#d6362b"): void {
  const y = (stepY(g, STREAK_RUNGS - 1) + stepY(g, STREAK_RUNGS)) / 2;
  ctx.save();
  ctx.font = `700 9.5px ${FONT}`;
  const tw = ctx.measureText(label.toUpperCase()).width;
  ctx.globalAlpha = 0.7; // (a little see-through, so that it does not take the eye from the steps)
  ctx.setLineDash([2, 4.4]);
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1 - tw - 8, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), x1, y + 0.5);
  ctx.restore();
}

/** A little wrapped present, with a bow: (x, y) is the middle of the box. `open` (0 to 1) lifts the lid. */
export function drawGift(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1, open = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  // The box.
  const body = ctx.createLinearGradient(0, -2, 0, 14);
  body.addColorStop(0, "#ef5b4a");
  body.addColorStop(1, "#b92b22");
  ctx.fillStyle = body;
  roundRect(ctx, -13, -2, 26, 16, 3);
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "#6e1510";
  ctx.stroke();
  ctx.fillStyle = "#ffd23a";
  ctx.fillRect(-2.5, -2, 5, 16);
  // The lid, which lifts and tips when it opens.
  ctx.save();
  ctx.translate(0, -open * 8);
  ctx.rotate(-open * 0.35);
  const lid = ctx.createLinearGradient(0, -9, 0, -1);
  lid.addColorStop(0, "#ff7766");
  lid.addColorStop(1, "#d23a2d");
  ctx.fillStyle = lid;
  roundRect(ctx, -15, -9, 30, 8, 3);
  ctx.fill();
  ctx.strokeStyle = "#6e1510";
  ctx.stroke();
  ctx.fillStyle = "#ffd23a";
  ctx.fillRect(-2.5, -9, 5, 8);
  // The bow.
  ctx.fillStyle = "#ffd23a";
  ctx.strokeStyle = "#a8690a";
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 5.5, -12, 5.5, 3.6, dir * -0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -10.5, 2.4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}
