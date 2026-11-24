// Ninja: the dojo behind (paper walls, lanterns, a wooden floor), the blade's trail, a bomb, a ball of ice, the halves of a cut ball, and the crosses.
import {drawBall} from "./draw";

const TAU = Math.PI * 2;

/** The dojo in the evening: dark wood, paper walls lit warm from behind, two red lanterns swaying, and a wooden floor. */
export function drawDojo(ctx: CanvasRenderingContext2D, top: number, w: number, h: number, time: number): void {
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, "#2a1a14");
  g.addColorStop(1, "#140c0a");
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h - top);
  // the paper walls: three panels with their wooden grid, lit from behind
  const pw = w / 3;
  for (let k = 0; k < 3; k++) {
    const x = k * pw + 8;
    const y = top + 30;
    const ph = h - top - 150;
    const lg = ctx.createRadialGradient(x + pw / 2, y + ph / 2, 20, x + pw / 2, y + ph / 2, ph);
    lg.addColorStop(0, "#f6dfb0");
    lg.addColorStop(1, "#c89a62");
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, pw - 16, ph);
    ctx.strokeStyle = "#3a2216";
    ctx.lineWidth = 3;
    for (let c = 1; c < 3; c++) {
      ctx.beginPath();
      ctx.moveTo(x + (c * (pw - 16)) / 3, y);
      ctx.lineTo(x + (c * (pw - 16)) / 3, y + ph);
      ctx.stroke();
    }
    for (let r = 1; r < 5; r++) {
      ctx.beginPath();
      ctx.moveTo(x, y + (r * ph) / 5);
      ctx.lineTo(x + pw - 16, y + (r * ph) / 5);
      ctx.stroke();
    }
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, pw - 16, ph);
  }
  // a branch of a cherry tree as a shadow on the paper
  ctx.strokeStyle = "rgba(60,30,20,0.35)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w, top + 80);
  ctx.quadraticCurveTo(w * 0.7, top + 110, w * 0.5, top + 90);
  ctx.moveTo(w * 0.75, top + 102);
  ctx.lineTo(w * 0.68, top + 150);
  ctx.stroke();
  ctx.fillStyle = "rgba(220,90,120,0.35)";
  for (let k = 0; k < 9; k++) {
    ctx.beginPath();
    ctx.arc(w * (0.52 + k * 0.05), top + 88 + Math.sin(k * 2) * 14, 5, 0, TAU);
    ctx.fill();
  }
  // the floor
  const fy = h - 120;
  const fg = ctx.createLinearGradient(0, fy, 0, h);
  fg.addColorStop(0, "#6a4026");
  fg.addColorStop(1, "#3a2214");
  ctx.fillStyle = fg;
  ctx.fillRect(0, fy, w, h - fy);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 2;
  for (let x = -40; x < w + 40; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x - 30, h);
    ctx.stroke();
  }
  ctx.fillStyle = "#24140c";
  ctx.fillRect(0, fy - 6, w, 8);
  // two lanterns, swaying and glowing
  for (const [lx, ph] of [[54, 0], [w - 54, 1.7]] as [number, number][]) {
    const sway = Math.sin(time * 1.4 + ph) * 0.08;
    ctx.save();
    ctx.translate(lx, top);
    ctx.rotate(sway);
    const glow = ctx.createRadialGradient(0, 70, 6, 0, 70, 90);
    glow.addColorStop(0, "rgba(255,140,80,0.45)");
    glow.addColorStop(1, "rgba(255,140,80,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 70, 90, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#1a0e08";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 40);
    ctx.stroke();
    ctx.fillStyle = "#d8322a";
    ctx.beginPath();
    ctx.ellipse(0, 70, 22, 30, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.ellipse(0, 70, Math.abs(k) * 7 + 1, 30, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = "#1a0e08";
    ctx.fillRect(-12, 38, 24, 5);
    ctx.fillRect(-12, 97, 24, 5);
    ctx.fillStyle = "rgba(255,220,150,0.7)";
    ctx.beginPath();
    ctx.ellipse(-6, 62, 5, 12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** The trail of the blade: a bright white streak, thick where the finger is and thin at its tail, with a blue glow. */
export function drawBlade(ctx: CanvasRenderingContext2D, pts: readonly {x: number; y: number; age: number}[], mult = 1, time = 0): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  // (the combo shows on the blade: white and blue, then gold, then fire, then a rainbow)
  const hue = (time * 400) % 360;
  const glowColor = mult >= 4 ? `hsla(${hue},100%,60%,0.7)` : mult === 3 ? "rgba(255,110,40,0.7)" : mult === 2 ? "rgba(255,200,60,0.65)" : "rgba(120,200,255,0.5)";
  const shadow = mult >= 4 ? `hsl(${hue},100%,60%)` : mult === 3 ? "#ff6a2a" : mult === 2 ? "#ffd54a" : "#8ad8ff";
  const core = mult >= 4 ? `hsl(${(hue + 60) % 360},100%,85%)` : mult === 3 ? "#fff0c0" : mult === 2 ? "#fff8d8" : "#ffffff";
  for (const [glow, color, wide] of [[18 + mult * 4, glowColor, 1.8 + mult * 0.2], [0, core, 1]] as [number, string, number][]) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = glow;
    ctx.strokeStyle = color;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 160) continue;
      const life = Math.max(0, 1 - b.age / 0.2);
      ctx.lineWidth = (1 + 9 * life) * wide;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A bomb: a black ball with a shine, a fuse with a spark that fizzes, and a red skull-ish warning mark. */
export function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 2, 0, 0, r);
  g.addColorStop(0, "#6a6a72");
  g.addColorStop(1, "#111114");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#ff3a2a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3a3a42";
  ctx.fillRect(-6, -r - 6, 12, 8);
  ctx.strokeStyle = "#c8a060";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -r - 6);
  ctx.quadraticCurveTo(8, -r - 18, 14, -r - 14);
  ctx.stroke();
  const f = 0.6 + 0.4 * Math.sin(time * 40);
  ctx.fillStyle = `rgba(255,220,90,${f})`;
  ctx.shadowColor = "#ffb020";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(14, -r - 14, 4 + f * 3, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  // a white X on it: do not cut
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(8, 8);
  ctx.moveTo(8, -8);
  ctx.lineTo(-8, 8);
  ctx.stroke();
  ctx.restore();
}

/** A ball of ice (it freezes everything): pale blue, with a snowflake. */
export function drawIceBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#7ad0ff");
  ctx.fillStyle = g;
  ctx.shadowColor = "#bfe8ff";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.rotate(time);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, 0);
    ctx.lineTo(r * 0.6, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** A half of a cut ball: the ball, clipped along the cut, with the juicy cut face, turning as it falls. */
export function drawHalf(ctx: CanvasRenderingContext2D, h: {x: number; y: number; rot: number; v: number; side: number; angle: number; off?: number; age: number}, r: number, scale: number, juice: string, time: number, draw?: (ctx: CanvasRenderingContext2D) => void): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - h.age / 1.4);
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rot);
  ctx.rotate(h.angle);
  // (the cut is where the blade went: off from the middle, so the pieces can be of different sizes)
  const cutY = -(h.off ?? 0);
  ctx.beginPath();
  if (h.side < 0) ctx.rect(-r - 4, -r - 4, 2 * r + 8, cutY + r + 4);
  else ctx.rect(-r - 4, cutY, 2 * r + 8, r + 4 - cutY);
  ctx.clip();
  ctx.rotate(-h.angle);
  if (draw) draw(ctx);
  else drawBall(ctx, 0, 0, h.v, scale, time, h.side);
  ctx.rotate(h.angle);
  ctx.fillStyle = juice;
  const half = Math.sqrt(Math.max(0, r * r - cutY * cutY));
  ctx.fillRect(-half, cutY - 2, 2 * half, 4);
  ctx.restore();
}

/** The crosses: three, grey while they are free, red when used (the newest pops). */
export function drawCrosses(ctx: CanvasRenderingContext2D, x: number, y: number, used: number, max: number, time: number): void {
  for (let k = 0; k < max; k++) {
    const on = k < used;
    const cx = x + k * 30;
    const s = on ? 1 + 0.06 * Math.sin(time * 8 + k) : 0.85;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(s, s);
    ctx.strokeStyle = on ? "#ff3a2a" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = on ? 7 : 5;
    ctx.lineCap = "round";
    if (on) {
      ctx.shadowColor = "#ff3a2a";
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.moveTo(9, -9);
    ctx.lineTo(-9, 9);
    ctx.stroke();
    ctx.restore();
  }
}



/** A heart to cut (it takes a cross away): red, glowing, beating. */
export function drawHeartBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  const beat = 1 + 0.08 * Math.max(0, Math.sin(time * 7));
  ctx.scale(beat, beat);
  ctx.shadowColor = "#ff4a7a";
  ctx.shadowBlur = 18;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, r * 1.2);
  g.addColorStop(0, "#ffd0dc");
  g.addColorStop(0.4, "#ff4a6a");
  g.addColorStop(1, "#a01838");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.05, -r * 0.75, -r * 1.15, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 0.75, -r * 1.15, r * 1.4, -r * 0.05, 0, r * 0.95);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.35, r * 0.18, r * 0.1, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}
