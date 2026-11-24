// The cannon: the cannon itself (a brass barrel on a wooden carriage, that turns to where it is aimed), the dotted line it aims along, the red line the swarm
// must not reach, and the golden 10 that flies down to a cup when balls of the swarm have made 10.

import {roundRect, title} from "./draw";

const TAU = Math.PI * 2;

/** The cannon at (x, y) (the middle of the foot of its barrel), pointing the way `angle` points (-PI/2 is straight up). */
export function drawCannon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number, recoil = 0): void {
  ctx.save();
  ctx.translate(x, y);
  // the shadow on the desk
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 40, 8, 0, 0, TAU);
  ctx.fill();
  // the barrel: brass, with dark bands, turned to where it aims (it kicks back a little when it fires)
  ctx.save();
  ctx.rotate(angle + Math.PI / 2);
  ctx.translate(0, recoil * 8);
  const brass = ctx.createLinearGradient(-14, 0, 14, 0);
  brass.addColorStop(0, "#7a4e12");
  brass.addColorStop(0.35, "#f2c25a");
  brass.addColorStop(0.55, "#ffe9a8");
  brass.addColorStop(1, "#8a5a14");
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.moveTo(-15, 4);
  ctx.lineTo(-11, -44);
  ctx.lineTo(11, -44);
  ctx.lineTo(15, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5a3608";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // the muzzle, a thicker ring at the end, and the dark bands
  roundRect(ctx, -14, -50, 28, 9, 4);
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(90,54,8,0.55)";
  for (const by of [-30, -14]) ctx.fillRect(-13, by, 26, 3);
  ctx.restore();
  // the carriage: a round wooden body with a gold rim, and two wheels
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#2a1a0c";
    ctx.beginPath();
    ctx.arc(side * 24, 14, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#c8922e";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(side * 24, 14);
    ctx.rotate(time * 0.5 * side);
    ctx.strokeStyle = "rgba(200,146,46,0.7)";
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  const wood = ctx.createRadialGradient(-6, -4, 3, 0, 4, 24);
  wood.addColorStop(0, "#8a5a32");
  wood.addColorStop(1, "#3e2410");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.arc(0, 6, 20, Math.PI, 0);
  ctx.lineTo(20, 18);
  ctx.lineTo(-20, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e0a838";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** The line the ball will go along: soft white dots that run towards where it goes, fading out at the end. */
export function drawAimLine(ctx: CanvasRenderingContext2D, pts: readonly {x: number; y: number}[], time: number): void {
  if (pts.length < 2) return;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  ctx.save();
  const step = 14;
  let along = (time * 60) % step;
  let seg = 1;
  let segStart = 0;
  while (along < total && seg < pts.length) {
    const a = pts[seg - 1];
    const b = pts[seg];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (along > segStart + len) {
      segStart += len;
      seg++;
      continue;
    }
    const u = len > 0 ? (along - segStart) / len : 0;
    const k = along / total;
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k * 0.8)})`;
    ctx.beginPath();
    ctx.arc(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 3 - k * 1.2, 0, TAU);
    ctx.fill();
    along += step;
  }
  ctx.restore();
}

/** The line the swarm must not reach: a red dashed line that glows stronger the nearer the swarm is (near: 0 to 1). */
export function drawSwarmLimit(ctx: CanvasRenderingContext2D, y: number, w: number, near: number, time: number): void {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -time * 20;
  const pulse = near > 0.6 ? 0.5 + 0.5 * Math.sin(time * 10) : 1;
  ctx.strokeStyle = `rgba(255,70,60,${(0.2 + 0.6 * near) * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(w - 10, y);
  ctx.stroke();
  ctx.restore();
}

/** The glow round a ball of the swarm that is part of a 10, just before it pops: gold, and growing. */
export function drawTenGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, u: number, time: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rr = r * (1.1 + 0.5 * u) + Math.sin(time * 30) * 1.5;
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, rr);
  glow.addColorStop(0, `rgba(255,230,120,${0.35 + 0.4 * u})`);
  glow.addColorStop(1, "rgba(255,200,60,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = `rgba(255,236,150,${0.6 + 0.4 * u})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * A golden 10 that flies from where the balls made 10 down to its cup (u goes from 0 to 1): it stamps in big first, with a burst of rays, then flies along a
 * curve, getting smaller, with a trail of sparkles. `chain` (2 and up) is written beside it.
 */
export function drawFlyingTen(ctx: CanvasRenderingContext2D, f: {x: number; y: number; tx: number; ty: number; chain: number}, u: number, time: number, chainWord: string): void {
  const stamp = Math.min(1, u / 0.25);
  const fly = Math.max(0, (u - 0.25) / 0.75);
  const ease = fly * fly * (3 - 2 * fly);
  const x = f.x + (f.tx - f.x) * ease;
  const y = f.y + (f.ty - f.y) * ease - Math.sin(ease * Math.PI) * 50;
  ctx.save();
  // the rays when it stamps in
  if (stamp < 1) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(time * 2);
    ctx.globalAlpha = 1 - stamp;
    ctx.fillStyle = "#ffe27a";
    for (let k = 0; k < 10; k++) {
      ctx.rotate(TAU / 10);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(4, -30 - stamp * 30);
      ctx.lineTo(-4, -30 - stamp * 30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // a trail of sparkles behind it
  for (let k = 1; k <= 6; k++) {
    const e2 = Math.max(0, ease - k * 0.05);
    const tx = f.x + (f.tx - f.x) * e2;
    const ty = f.y + (f.ty - f.y) * e2 - Math.sin(e2 * Math.PI) * 50;
    ctx.fillStyle = `rgba(255,226,120,${0.5 * (1 - k / 7) * (fly > 0 ? 1 : 0)})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 5 - k * 0.6, 0, TAU);
    ctx.fill();
  }
  const pop = stamp < 1 ? 0.5 + 1.0 * Math.sin(stamp * Math.PI * 0.75) : 1.2 - 0.6 * ease;
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  const ball = ctx.createRadialGradient(-6, -7, 2, 0, 0, 22);
  ball.addColorStop(0, "#fff6c4");
  ball.addColorStop(0.5, "#ffc83a");
  ball.addColorStop(1, "#c07a0a");
  ctx.shadowColor = "rgba(255,200,60,0.9)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff2b0";
  ctx.lineWidth = 2;
  ctx.stroke();
  title(ctx, "10", 0, 1, 20, "#ffffff", "#c56a00", 0.18);
  if (f.chain >= 2 && stamp >= 1 && fly < 0.6) {
    ctx.globalAlpha = 1 - fly / 0.6;
    title(ctx, chainWord, 0, -36, 15, "#ffffff", "#e0561a", 0.2);
  }
  ctx.restore();
}
