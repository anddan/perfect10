// The snake: the track it slides along (a groove of chalk on the desk), the green body that holds the numbers of the train together, and its head.

import {roundRect} from "./draw";

const TAU = Math.PI * 2;

/** The track of the snake: a soft groove of chalk along the whole way, with a dashed line in the middle. */
export function drawSnakeTrack(ctx: CanvasRenderingContext2D, pts: readonly {x: number; y: number}[], time: number): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 4; i < pts.length; i += 4) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  path();
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 50;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 44;
  ctx.stroke();
  ctx.setLineDash([8, 12]);
  ctx.lineDashOffset = -time * 20;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** The body of the snake between two places of the track (the points of the way from one to the other): a green scaly tube. */
export function drawSnakeBody(ctx: CanvasRenderingContext2D, pieces: readonly {x: number; y: number}[][], boss: boolean): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [edge, body, shine] = boss ? ["#3a0f12", "#9c2a2a", "rgba(255,170,150,0.45)"] : ["#123d1c", "#3f9e4a", "rgba(190,255,170,0.45)"];
  for (const [width, color] of [
    [38, edge],
    [32, body],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const p of pieces) stroke(ctx, p);
  }
  // (a light stripe along its back, and dark scales)
  ctx.strokeStyle = shine;
  ctx.lineWidth = 6;
  ctx.setLineDash([4, 9]);
  for (const p of pieces) stroke(ctx, p);
  ctx.restore();
}

function stroke(ctx: CanvasRenderingContext2D, p: readonly {x: number; y: number}[]): void {
  if (p.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.stroke();
}

/**
 * The head of the snake, at (x, y), looking the way `angle` points (0 is to the right): a round green head with big eyes that look ahead, nostrils, and a
 * forked red tongue that flicks out now and then. A boss is red, with angry brows and a gold crown, and its lives as dots over it.
 */
export function drawSnakeHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number, o: {scale?: number; boss?: {hp: number; max: number}; stun?: number; angry?: boolean} = {}): void {
  const boss = o.boss;
  // (angry: red, with angry brows, and it shakes a little)
  const mad = !!boss || !!o.angry;
  if (o.angry) x += Math.sin(time * 40) * 1.2;
  const s = (o.scale ?? 1) * (boss ? 1.3 : 1);
  ctx.save();
  ctx.translate(x, y);
  // (the lives of a boss: dots over its head, that do not turn with it)
  if (boss) {
    for (let k = 0; k < boss.max; k++) {
      ctx.fillStyle = k < boss.hp ? "#ff4a5a" : "rgba(255,255,255,0.25)";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc((k - (boss.max - 1) / 2) * 12, -38 * s, 4.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }
  // (stunned by a laser: yellow stars go round over its head)
  if ((o.stun ?? 0) > 0) {
    for (let k = 0; k < 3; k++) {
      const a = time * 4 + (k * TAU) / 3;
      star(ctx, Math.cos(a) * 18 * s, -26 * s + Math.sin(a) * 6 * s, 5);
    }
  }
  ctx.rotate(angle);
  ctx.scale(s, s);
  // the tongue: out for a moment every second or so
  const flick = (time * 1.1) % 1;
  if (flick < 0.3) {
    const out = Math.sin((flick / 0.3) * Math.PI) * 16;
    ctx.strokeStyle = "#e0263a";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(20 + out, 0);
    ctx.moveTo(20 + out, 0);
    ctx.lineTo(24 + out, -4);
    ctx.moveTo(20 + out, 0);
    ctx.lineTo(24 + out, 4);
    ctx.stroke();
  }
  // the head: a shadow, a dark edge and a green face, a bit wider than long
  const [edge, light, dark] = mad ? ["#3a0f12", "#e0584a", "#8c1f1f"] : ["#123d1c", "#7fd36a", "#2f8a3c"];
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(2, 4, 24, 21, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 21, 0, 0, TAU);
  ctx.fill();
  const face = ctx.createRadialGradient(-2, -8, 3, 0, 0, 24);
  face.addColorStop(0, light);
  face.addColorStop(1, dark);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 18, 0, 0, TAU);
  ctx.fill();
  // scales on the top of the head
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  for (const [sx, sy] of [
    [-10, -4],
    [-10, 4],
    [-3, 0],
  ]) {
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, TAU);
    ctx.fill();
  }
  // nostrils
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(16, side * 4, 1.4, 0, TAU);
    ctx.fill();
  }
  // the eyes: white, with a slit of black that looks ahead (it blinks now and then)
  const blink = (time * 0.4) % 1 > 0.96;
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(6, side * 9, 6.5, blink ? 1 : 6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (!blink) {
      ctx.fillStyle = mad ? "#ffd54a" : "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(8.5, side * 9, 2.2, 4.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(7.5, side * 9 - 2, 1.1, 0, TAU);
      ctx.fill();
    }
    if (mad) {
      // angry brows
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, side * 18);
      ctx.lineTo(13, side * 14);
      ctx.stroke();
    }
  }
  if (boss) {
    // a gold crown on the back of the head
    ctx.fillStyle = "#ffd54a";
    ctx.strokeStyle = "#8a5a08";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-20, -9);
    ctx.lineTo(-31, -11);
    ctx.lineTo(-26, -4);
    ctx.lineTo(-33, 0);
    ctx.lineTo(-26, 4);
    ctx.lineTo(-31, 11);
    ctx.lineTo(-20, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The glow round a golden 10 of the snake (two numbers that met and made 10). */
export function drawGoldGlow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  const r = 34 + Math.sin(time * 8) * 3;
  const glow = ctx.createRadialGradient(x, y, 12, x, y, r);
  glow.addColorStop(0, "rgba(255,226,120,0.7)");
  glow.addColorStop(1, "rgba(255,200,60,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The sign on a ball of the snake: "back" (an arrow that turns back) or "slow" (a snail). Drawn at the origin, in white. */
export function drawSnakePickupIcon(ctx: CanvasRenderingContext2D, kind: "back" | "slow"): void {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "back") {
    ctx.beginPath();
    ctx.arc(0, 1, 7, -0.2 * Math.PI, 1.15 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-6.5, 3);
    ctx.lineTo(-1.5, -2.5);
    ctx.stroke();
  } else {
    // the shell, with a spiral, and the body under it
    roundRect(ctx, -10, 4, 20, 4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-1, -1, 7, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-1, -1, 3, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(10, -4);
    ctx.stroke();
  }
  ctx.restore();
}

/** A small yellow star (the stars round a stunned head). */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = "#ffe27a";
  ctx.strokeStyle = "#8a5a08";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

