// Draw to 10: the helpers on the board (a clock, a bomb, a star), the ice over a tile, the line that is being drawn with what it comes to so far,
// and the clock at the top of the screen.

import {roundRect, title, write} from "./draw";

const TAU = Math.PI * 2;

/** A helper of the board at (x, y): a round glossy ball in its colour (a clock: blue, a bomb: dark, a star: gold) with its sign on it. */
export function drawLineHelper(ctx: CanvasRenderingContext2D, kind: "clock" | "bomb" | "star" | "bolt" | "laser" | "magnet", x: number, y: number, r: number, time: number): void {
  const [light, dark] = kind === "clock" ? ["#bfe8ff", "#2a7ad0"] : kind === "bomb" ? ["#8a8a96", "#1e1e26"] : kind === "bolt" ? ["#e8d8ff", "#7a3ad8"] : kind === "laser" ? ["#f5c8ff", "#a020d0"] : kind === "magnet" ? ["#ffd0d0", "#c0202a"] : ["#fff3b0", "#e0a21b"];
  ctx.save();
  ctx.translate(x, y);
  const pulse = 1 + 0.04 * Math.sin(time * 5 + x);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = dark;
  ctx.shadowBlur = 12;
  const ball = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r);
  ball.addColorStop(0, light);
  ball.addColorStop(1, dark);
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineCap = "round";
  if (kind === "clock") {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 1, r * 0.52, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(0, 1 - r * 0.36);
    ctx.moveTo(0, 1);
    ctx.lineTo(r * 0.26, 1 + r * 0.1);
    ctx.stroke();
    write(ctx, "+4", 0, r * 0.98, 10, "#ffffff", "center", 800);
  } else if (kind === "bomb") {
    ctx.fillStyle = "#101014";
    ctx.beginPath();
    ctx.arc(0, 3, r * 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#c8a060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.25, -r * 0.22);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.6, r * 0.2, -r * 0.7);
    ctx.stroke();
    const spark = 0.6 + 0.4 * Math.sin(time * 20);
    ctx.fillStyle = `rgba(255,${180 + 60 * spark},60,1)`;
    ctx.beginPath();
    ctx.arc(r * 0.2, -r * 0.72, 2.5 + spark, 0, TAU);
    ctx.fill();
  } else if (kind === "magnet") {
    // a horseshoe magnet: red, with silver ends, and little lines that pull in
    ctx.lineWidth = r * 0.34;
    ctx.lineCap = "butt";
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, r * 0.38, Math.PI, 0, true);
    ctx.stroke();
    ctx.fillStyle = "#d8dce4";
    ctx.fillRect(-r * 0.55, -r * 0.1, r * 0.34, r * 0.3);
    ctx.fillRect(r * 0.21, -r * 0.1, r * 0.34, r * 0.3);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 8);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, r * 0.35);
    ctx.lineTo(-r * 0.38, r * 0.6);
    ctx.moveTo(r * 0.38, r * 0.35);
    ctx.lineTo(r * 0.38, r * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === "laser") {
    // a glowing cross of light, the way the laser goes (across and up and down)
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(time * 18);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "#ff8cff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, 0);
    ctx.lineTo(r * 0.62, 0);
    ctx.moveTo(0, -r * 0.62);
    ctx.lineTo(0, r * 0.62);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (kind === "bolt") {
    // a lightning bolt, that flickers
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 25);
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.65);
    ctx.lineTo(-r * 0.35, r * 0.08);
    ctx.lineTo(-r * 0.02, r * 0.08);
    ctx.lineTo(-r * 0.18, r * 0.65);
    ctx.lineTo(r * 0.38, -r * 0.12);
    ctx.lineTo(r * 0.04, -r * 0.12);
    ctx.closePath();
    ctx.fillStyle = "#fff6a0";
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r * 0.58 : r * 0.25;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Ice over a tile: a pale blue see-through block with a light edge and a shine. */
export function drawLineIce(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  const h = size / 2;
  roundRect(ctx, x - h, y - h, size, size, 10);
  ctx.fillStyle = "rgba(190,230,255,0.45)";
  ctx.fill();
  ctx.strokeStyle = "rgba(235,250,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(x - h + 6, y - h + 6);
  ctx.lineTo(x - h + 20, y - h + 6);
  ctx.lineTo(x - h + 6, y - h + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The line that is being drawn, through the middles of its tiles: thick and glowing (gold when it makes 10, else white), and what it comes to so far in a
 * bubble by its last tile ("= 7", or "= 10!" in gold, or "?" when a "divided by" does not come out even).
 */
export function drawLinePath(ctx: CanvasRenderingContext2D, pts: readonly {x: number; y: number}[], value: number | null, time: number): void {
  if (pts.length === 0) return;
  const ten = (value === 10 || value === -10) && pts.length >= 2;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  };
  path();
  ctx.strokeStyle = ten ? "rgba(255,200,60,0.45)" : "rgba(255,255,255,0.25)";
  ctx.lineWidth = 22;
  ctx.stroke();
  path();
  ctx.strokeStyle = ten ? "#ffe27a" : "rgba(255,255,255,0.9)";
  ctx.lineWidth = 7;
  ctx.stroke();
  for (const p of pts) {
    ctx.fillStyle = ten ? "#fff3b0" : "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, TAU);
    ctx.fill();
  }
  // the bubble with what it comes to
  const last = pts[pts.length - 1];
  const bx = Math.max(40, Math.min(320, last.x));
  const by = last.y - 44;
  const words = value === null ? "?" : ten ? (value < 0 ? "= −10!" : "= 10!") : `= ${value < 0 ? "−" + -value : value}`;
  ctx.font = "700 18px sans-serif";
  const bw = Math.max(48, ctx.measureText(words).width + 22);
  ctx.fillStyle = ten ? "#ffd54a" : "rgba(20,14,30,0.85)";
  roundRect(ctx, bx - bw / 2, by - 15, bw, 30, 15);
  ctx.fill();
  ctx.strokeStyle = ten ? "#fff6c4" : "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const pop = ten ? 1 + 0.08 * Math.sin(time * 14) : 1;
  ctx.translate(bx, by);
  ctx.scale(pop, pop);
  write(ctx, words, 0, 1, 18, ten ? "#4a2a00" : "#ffffff", "center", 800);
  ctx.restore();
}

/**
 * The clock at the top: the seconds left, big, over a bar that empties (it turns red and beats when there are fewer than ten), and the seconds the last 10
 * gave back, "+3 s", rising and fading beside it.
 */
export function drawLineClock(ctx: CanvasRenderingContext2D, left: number, total: number, got: number, gotT: number, time: number): void {
  const cx = 180;
  const y = 62;
  const low = left < 10;
  const beat = low ? 1 + 0.08 * Math.max(0, Math.sin(time * 10)) : 1;
  ctx.save();
  // the bar
  const w = 150;
  ctx.fillStyle = "rgba(10,6,18,0.7)";
  roundRect(ctx, cx - w / 2, y + 22, w, 9, 4.5);
  ctx.fill();
  ctx.fillStyle = low ? "#ff4a3a" : "#7ae08a";
  roundRect(ctx, cx - w / 2, y + 22, Math.max(4, (w * left) / total), 9, 4.5);
  ctx.fill();
  ctx.translate(cx, y);
  ctx.scale(beat, beat);
  const secs = Math.ceil(left);
  title(ctx, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, 0, 0, 30, "#ffffff", low ? "#d4261c" : "#2f86dc", 0.18);
  ctx.restore();
  if (gotT < 1.2) {
    ctx.save();
    ctx.globalAlpha = gotT < 0.9 ? 1 : (1.2 - gotT) / 0.3;
    title(ctx, `+${got.toFixed(1).replace(".0", "")} s`, cx + 92, y - gotT * 16, 18, "#ffffff", "#25b457", 0.18);
    ctx.restore();
  }
}

/** The help: the tiles of a line that makes 10 glow gold in turn, one after the other, with a dotted gold line through them and a little hand at the first. */
export function drawLineHint(ctx: CanvasRenderingContext2D, pts: readonly {x: number; y: number}[], time: number): void {
  if (pts.length < 2) return;
  ctx.save();
  const beat = (time * 1.6) % 1;
  pts.forEach((p, i) => {
    const on = Math.max(0, 1 - Math.abs(beat * (pts.length + 1) - i - 0.5));
    ctx.strokeStyle = `rgba(255,226,120,${0.45 + 0.55 * on})`;
    ctx.lineWidth = 3 + 2 * on;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 25 + 3 * on, 0, TAU);
    ctx.stroke();
  });
  ctx.setLineDash([4, 8]);
  ctx.lineDashOffset = -time * 30;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,226,120,0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
  // a finger that slides along the line
  const u = (time * 0.7) % 1;
  const seg = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
  const k = u * (pts.length - 1) - seg;
  const fx = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * k;
  const fy = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * k;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "rgba(60,40,20,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(fx + 6, fy + 10, 9, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The time is low: the edges of the screen glow red and beat with the seconds (stronger the fewer there are). */
export function drawLowTime(ctx: CanvasRenderingContext2D, left: number, time: number, extra: number): void {
  const strength = Math.min(1, (10 - left) / 10) * 0.6 + 0.25;
  const beat = 0.55 + 0.45 * Math.pow(Math.max(0, Math.sin(time * Math.PI * 2)), 3);
  ctx.save();
  const top = -extra;
  const h = 640 + extra;
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number): void => {
    const g2 = ctx.createLinearGradient(x0, y0, x1, y1);
    g2.addColorStop(0, `rgba(230,30,30,${0.55 * strength * beat})`);
    g2.addColorStop(1, "rgba(230,30,30,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(rx, ry, rw, rh);
  };
  edge(0, 0, 46, 0, 0, top, 46, h);
  edge(360, 0, 314, 0, 314, top, 46, h);
  edge(0, top, 0, top + 60, 0, top, 360, 60);
  edge(0, 640, 0, 580, 0, 580, 360, 60);
  ctx.restore();
}

/** A ghost number of the snake: a soft purple shimmer round it, and a thin ring that runs down until it turns into another number (u: 1 just changed, 0 about to). */
export function drawGhostAura(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, time: number): void {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 14, x, y, 34);
  glow.addColorStop(0, `rgba(190,140,255,${0.35 + 0.15 * Math.sin(time * 6)})`);
  glow.addColorStop(1, "rgba(190,140,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(230,210,255,0.9)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, 27, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, u)));
  ctx.stroke();
  ctx.restore();
}
