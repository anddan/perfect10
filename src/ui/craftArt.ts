// The crafts that are flown by the finger in the match modes Fighter jet and Comet belt, and what goes with them: the shots of the jet, the balls it can pick up,
// the tails of the comets and the chains that hold balls together.
import type {GameState, NumberTile, Pickup, Shot} from "../game/types";
import {TAU, roundRect, title, drawShieldArc} from "./draw";

/** The fighter jet seen from above, nose up: grey-blue steel, a glass cockpit, a flame from its engine, missiles under its wings and a bubble when it has a shield. */
/**
 * The fighter jet seen from above, nose up: a dark purple-grey jet with a long pointed nose, delta wings and small tail wings, and fire from its two engines.
 * What it has picked up is seen on it: purple guns beside its body (longer, and then a second pair on the wings, the more guns it has), purple missiles on its wing
 * tips and under its wings, and a bubble of light when it has a shield.
 */
export function drawJet(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, o: {guns?: number; missiles?: number; shield?: boolean; stun?: number} = {}): void {
  ctx.save();
  ctx.translate(x, y);
  if ((o.stun ?? 0) > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35; // (knocked out: it blinks)
  const DARK = "#2e2433";
  const MID = "#5a4a60";
  const LIGHT = "#8c7892";
  const SHINE = "#c2adc6";
  const PURPLE = "#9b45e0";
  const poly = (pts: number[], fill: string | CanvasGradient, stroke = true) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  ctx.lineJoin = "round";
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 1.2;
  // fire from the two engines
  const flick = Math.sin(time * 40) * 3 + Math.sin(time * 23) * 2;
  for (const dx of [-4, 4]) {
    const len = 15 + flick;
    const flame = ctx.createLinearGradient(0, 30, 0, 30 + len);
    flame.addColorStop(0, "rgba(255,255,255,0.95)");
    flame.addColorStop(0.3, "rgba(200,140,255,0.9)");
    flame.addColorStop(1, "rgba(120,60,255,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(dx - 3, 29);
    ctx.quadraticCurveTo(dx, 30 + len * 1.3, dx + 3, 29);
    ctx.closePath();
    ctx.fill();
  }
  const guns = o.guns ?? 1;
  const missiles = o.missiles ?? 0;
  // the tail wings
  for (const side of [-1, 1]) poly([side * 4, 18, side * 15, 26, side * 15, 30, side * 4, 28], MID);
  // the delta wings
  const wing = ctx.createLinearGradient(-28, 0, 28, 0);
  wing.addColorStop(0, DARK);
  wing.addColorStop(0.3, LIGHT);
  wing.addColorStop(0.5, MID);
  wing.addColorStop(0.7, LIGHT);
  wing.addColorStop(1, DARK);
  for (const side of [-1, 1]) poly([side * 6, -6, side * 28, 12, side * 28, 17, side * 7, 17], wing);
  // a line along each wing
  ctx.strokeStyle = "rgba(46,36,51,0.6)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-8, 7);
  ctx.quadraticCurveTo(-16, 9, -24, 13);
  ctx.moveTo(8, 7);
  ctx.quadraticCurveTo(16, 9, 24, 13);
  ctx.stroke();
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 1.2;
  // missiles under the wings (from the second missile upgrade)
  for (let i = 0; i < Math.max(0, missiles - 1); i++) {
    for (const side of [-1, 1]) {
      const mx = side * (13 + i * 6);
      const my = 6 + i * 3;
      ctx.fillStyle = "#d9d0e0";
      ctx.beginPath();
      ctx.ellipse(mx, my, 2.2, 7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PURPLE;
      ctx.beginPath();
      ctx.ellipse(mx, my - 5, 2.2, 2.4, 0, Math.PI, 0);
      ctx.fill();
    }
  }
  // purple missiles on the wing tips (the first missile upgrade)
  if (missiles >= 1) {
    for (const side of [-1, 1]) poly([side * 28, 2, side * 29.5, 9, side * 29.5, 18, side * 26.5, 18, side * 26.5, 9], PURPLE);
  }
  // the air intakes beside the body (purple guns on them from the second gun)
  const intake = guns >= 2 ? PURPLE : DARK;
  for (const side of [-1, 1]) {
    ctx.fillStyle = intake;
    roundRect(ctx, side * 5.5 - 3, -10 - (guns >= 3 ? 4 : 0), 6, 30 + (guns >= 3 ? 4 : 0), 2);
    ctx.fill();
    ctx.stroke();
  }
  if (guns >= 4) {
    // a second pair of guns on the wings
    for (const side of [-1, 1]) {
      ctx.fillStyle = PURPLE;
      roundRect(ctx, side * 16 - 1.6, -2, 3.2, 12, 1.6);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (guns >= 2) {
    // (a glow on the purple guns, stronger the more guns there are)
    ctx.save();
    ctx.shadowColor = PURPLE;
    ctx.shadowBlur = 4 + guns * 2;
    ctx.fillStyle = "rgba(200,150,255,0.5)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 5.5, -10 - (guns >= 3 ? 4 : 0), 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // the body, and the long nose
  const body = ctx.createLinearGradient(-6, 0, 6, 0);
  body.addColorStop(0, DARK);
  body.addColorStop(0.35, LIGHT);
  body.addColorStop(0.5, SHINE);
  body.addColorStop(0.65, LIGHT);
  body.addColorStop(1, DARK);
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(3, -22, 4.5, -8);
  ctx.lineTo(5, 22);
  ctx.lineTo(3, 29);
  ctx.lineTo(-3, 29);
  ctx.lineTo(-5, 22);
  ctx.lineTo(-4.5, -8);
  ctx.quadraticCurveTo(-3, -22, 0, -34);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.stroke();
  // the shine down the nose
  poly([0, -28, 1.6, -14, 0, -4, -1.6, -14], SHINE, false);
  // the cockpit
  const glass = ctx.createLinearGradient(0, -6, 0, 4);
  glass.addColorStop(0, "#4b3b55");
  glass.addColorStop(1, "#1c1422");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -1, 2.4, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(220,200,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-0.7, -3, 0.8, 2, 0, 0, TAU);
  ctx.fill();
  // the small fin on its back, and the two engines
  poly([0, 14, 1.5, 22, 0, 27, -1.5, 22], LIGHT);
  for (const dx of [-4, 4]) {
    ctx.fillStyle = "#1c1422";
    roundRect(ctx, dx - 2.6, 26, 5.2, 4, 1.5);
    ctx.fill();
  }
  if (o.shield) {
    // a bubble of light round it
    const pulse = 0.75 + 0.25 * Math.sin(time * 6);
    const r = 40;
    const bubble = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
    bubble.addColorStop(0, "rgba(140,220,255,0)");
    bubble.addColorStop(0.85, `rgba(140,220,255,${0.35 * pulse})`);
    bubble.addColorStop(1, "rgba(140,220,255,0)");
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(200,240,255,${0.7 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The rocket of the comet belt, nose up, like a cartoon rocket: a blue-grey nose cone with a red stripe, a light body with a big round window, red curved fins at its
 * sides and one in front, a blue-grey skirt with a red band at the bottom, and a big flickering flame of fire (yellow, orange and red) out of it.
 */
export function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, shield = false, flying = true): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  const INK = "#1d1a1f";
  // the fire: three tongues on top of each other, red outside and yellow-white inside, that flicker
  const flame = (w: number, len: number, color: string, wob: number) => {
    const l = len + Math.sin(time * 31 + wob) * 4 + Math.sin(time * 17 + wob * 2) * 3;
    const sway = Math.sin(time * 13 + wob) * 2.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w, 24);
    ctx.quadraticCurveTo(-w * 1.1, 24 + l * 0.55, -w * 0.35 + sway, 24 + l * 0.8);
    ctx.lineTo(sway * 0.6 - w * 0.15, 24 + l * 0.62);
    ctx.lineTo(sway, 24 + l);
    ctx.lineTo(w * 0.25 + sway * 0.6, 24 + l * 0.66);
    ctx.lineTo(w * 0.4 + sway, 24 + l * 0.82);
    ctx.quadraticCurveTo(w * 1.1, 24 + l * 0.55, w, 24);
    ctx.closePath();
    ctx.fill();
  };
  if (flying) {
    ctx.save();
    ctx.shadowColor = "rgba(255,120,30,0.8)";
    ctx.shadowBlur = 14;
    flame(9, 34, "#e8401c", 0);
    ctx.restore();
    flame(6.5, 26, "#ff9a1f", 1.3);
    flame(4, 17, "#ffe14a", 2.6);
    flame(2, 9, "#fffbe0", 3.9);
  } else {
    // (let go: only a small blue flame, while it fills up with fuel)
    ctx.save();
    ctx.shadowColor = "rgba(80,160,255,0.8)";
    ctx.shadowBlur = 8;
    flame(5, 12, "#2f7bff", 0);
    ctx.restore();
    flame(3, 8, "#8fd0ff", 1.3);
    flame(1.5, 4, "#ffffff", 2.6);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  // the curved fins at its sides
  const red = ctx.createLinearGradient(-22, 0, 22, 0);
  red.addColorStop(0, "#b8231a");
  red.addColorStop(0.5, "#ff5a3a");
  red.addColorStop(1, "#b8231a");
  for (const side of [-1, 1]) {
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.moveTo(side * 9, 0);
    ctx.quadraticCurveTo(side * 22, 6, side * 22, 30);
    ctx.quadraticCurveTo(side * 17, 22, side * 9, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // the skirt at the bottom (blue-grey, with a red band)
  ctx.fillStyle = "#56708a";
  ctx.beginPath();
  ctx.moveTo(-8.5, 15);
  ctx.lineTo(8.5, 15);
  ctx.lineTo(10, 25);
  ctx.lineTo(-10, 25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0352b";
  ctx.fillRect(-9, 15, 18, 3);
  // the body
  const body = ctx.createLinearGradient(-10, 0, 10, 0);
  body.addColorStop(0, "#b9b2b0");
  body.addColorStop(0.4, "#f6f2ef");
  body.addColorStop(1, "#a29a98");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-9, 16);
  ctx.quadraticCurveTo(-12, -6, -6, -20);
  ctx.lineTo(6, -20);
  ctx.quadraticCurveTo(12, -6, 9, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the nose cone (blue-grey) and its red stripe
  const nose = ctx.createLinearGradient(-6, 0, 6, 0);
  nose.addColorStop(0, "#4a6079");
  nose.addColorStop(0.45, "#9db3c9");
  nose.addColorStop(1, "#3e5268");
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.moveTo(-6, -20);
  ctx.quadraticCurveTo(-5, -30, 0, -36);
  ctx.quadraticCurveTo(5, -30, 6, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0352b";
  ctx.beginPath();
  ctx.moveTo(-6.4, -20);
  ctx.lineTo(6.4, -20);
  ctx.lineTo(6.9, -17);
  ctx.lineTo(-6.9, -17);
  ctx.closePath();
  ctx.fill();
  // the big round window: a grey ring and blue glass with a shine
  ctx.fillStyle = "#8a96a3";
  ctx.beginPath();
  ctx.arc(0, -5, 6.4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const glass = ctx.createRadialGradient(-1.5, -7, 0.5, 0, -5, 4.6);
  glass.addColorStop(0, "#d6f6ff");
  glass.addColorStop(0.45, "#3fb4f0");
  glass.addColorStop(1, "#1462b8");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(0, -5, 4.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(-1.8, -7, 1.4, 0.9, -0.6, 0, TAU);
  ctx.fill();
  // the fin in front, down the middle
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.quadraticCurveTo(3.2, 14, 1.6, 26);
  ctx.lineTo(-1.6, 26);
  ctx.quadraticCurveTo(-3.2, 14, 0, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (shield) {
    // a bubble of light round it
    const pulse = 0.75 + 0.25 * Math.sin(time * 6);
    const r = 42;
    const bubble = ctx.createRadialGradient(0, -2, r * 0.6, 0, -2, r);
    bubble.addColorStop(0, "rgba(140,220,255,0)");
    bubble.addColorStop(0.85, `rgba(140,220,255,${0.35 * pulse})`);
    bubble.addColorStop(1, "rgba(140,220,255,0)");
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(0, -2, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(200,240,255,${0.7 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, r * 0.9, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** The shots of the jet: yellow streaks of light, and missiles with a trail of smoke. */
export function drawShots(ctx: CanvasRenderingContext2D, shots: readonly Shot[]): void {
  ctx.save();
  ctx.lineCap = "round";
  for (const s of shots) {
    if (s.missile) {
      // the smoke behind it
      s.trail.forEach((p, i) => {
        const a = (i + 1) / s.trail.length;
        ctx.fillStyle = `rgba(220,220,230,${0.35 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + (1 - a) * 4, 0, TAU);
        ctx.fill();
      });
      const ang = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = "rgba(255,170,60,0.9)";
      ctx.beginPath();
      ctx.moveTo(-2, 6);
      ctx.lineTo(0, 12 + Math.random() * 4);
      ctx.lineTo(2, 6);
      ctx.fill();
      ctx.fillStyle = "#eeeeee";
      roundRect(ctx, -2, -6, 4, 12, 2);
      ctx.fill();
      ctx.fillStyle = "#e0352b";
      ctx.beginPath();
      ctx.arc(0, -6, 2, Math.PI, 0);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.shadowColor = "rgba(255,220,90,0.9)";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02);
    ctx.stroke();
  }
  ctx.restore();
}

const PICKUP_COLOR: Record<Pickup, [string, string]> = {gun: ["#fff3b0", "#e0a21b"], missile: ["#ffd0c8", "#d1392b"], shield: ["#d8f4ff", "#3a9fd8"], fuel: ["#d8ffd0", "#3aa83a"]};

/** A ball the jet can fly into: it glows, and shows what it gives (bullets, a missile or a shield). */
export function drawPickup(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  const kind = n.pickup!;
  const [light, dark] = PICKUP_COLOR[kind];
  ctx.save();
  ctx.translate(n.x, n.y);
  const pulse = 1 + 0.06 * Math.sin(time * 6 + n.phase);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = dark;
  ctx.shadowBlur = 16;
  const ball = ctx.createRadialGradient(-5, -6, 2, 0, 0, 19);
  ball.addColorStop(0, light);
  ball.addColorStop(1, dark);
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  if (kind === "gun") {
    for (const dx of [-5, 0, 5]) {
      roundRect(ctx, dx - 1.5, -8, 3, 13, 1.5);
      ctx.fill();
    }
  } else if (kind === "missile") {
    ctx.rotate(-0.6);
    roundRect(ctx, -2.5, -9, 5, 16, 2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(5, 8);
    ctx.lineTo(0, 3);
    ctx.fill();
  } else if (kind === "fuel") {
    // a can of fuel
    roundRect(ctx, -6, -6, 12, 14, 2.5);
    ctx.fill();
    ctx.fillRect(-2, -10, 6, 4);
    ctx.fillStyle = PICKUP_COLOR.fuel[1];
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(4, 2, 0, 5);
    ctx.quadraticCurveTo(-4, 2, 0, -3);
    ctx.fill();
  } else drawShieldArc(ctx, 0, -2, 10, 5);
  ctx.restore();
}

/** The tail of fire behind a comet (it falls down, so the tail points up). */
export function drawCometTail(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  const len = 62 + Math.sin(time * 18 + n.phase) * 7;
  const tail = ctx.createLinearGradient(0, n.y, 0, n.y - len);
  tail.addColorStop(0, "rgba(255,200,90,0.85)");
  tail.addColorStop(0.5, "rgba(255,110,40,0.45)");
  tail.addColorStop(1, "rgba(255,60,20,0)");
  ctx.save();
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(n.x - 16, n.y);
  ctx.quadraticCurveTo(n.x, n.y - len * 1.2, n.x + 16, n.y);
  ctx.closePath();
  ctx.fill();
  // sparks that fall off it
  for (let k = 0; k < 3; k++) {
    const u = (time * 2.4 + k / 3 + n.phase) % 1;
    ctx.fillStyle = `rgba(255,${180 + k * 20},90,${1 - u})`;
    ctx.beginPath();
    ctx.arc(n.x + Math.sin(n.phase * 7 + k * 2.1) * 9, n.y - 14 - u * len, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The chains between balls that hang together (a row of comets, or skulls one over the other). */
export function drawLinks(ctx: CanvasRenderingContext2D, numbers: readonly NumberTile[]): void {
  const groups = new Map<number, NumberTile[]>();
  for (const n of numbers) {
    if (n.link === undefined || n.done || n.state !== "fall") continue;
    const list = groups.get(n.link) ?? [];
    list.push(n);
    groups.set(n.link, list);
  }
  ctx.save();
  ctx.lineCap = "round";
  for (const list of groups.values()) {
    list.sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 60) continue; // (not where the gap is)
      ctx.strokeStyle = "#3d4650";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = "#a9b6c3";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

/** The words over the jet when it has picked something up ("More guns!" and so on): they pop up, rise and fade out. */
export function drawJetGot(ctx: CanvasRenderingContext2D, g: GameState, words: string): void {
  const u = g.jetGot / 1.3;
  if (u >= 1) return;
  const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.55 : u < 0.25 ? 1.15 - ((u - 0.15) / 0.1) * 0.15 : 1;
  ctx.save();
  ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
  ctx.translate(g.shieldX, g.shieldY - 44 - u * 30);
  ctx.scale(pop, pop);
  title(ctx, words, 0, 0, 20, "#ffffff", PICKUP_COLOR[g.jetGotKind][1]);
  ctx.restore();
}

/** A comet: a ball of rock on fire (no number), with glowing cracks, and its tail of fire above it. */
export function drawComet(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  // (a comet can be smaller or bigger than usual: the whole of it, tail and all, is drawn to its size)
  const size = n.scale || 1;
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.scale(size, size);
  drawCometTail(ctx, {...n, x: 0, y: 0}, time);
  ctx.restore();
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.scale(size, size);
  ctx.rotate(time * 1.5 + n.phase);
  ctx.shadowColor = "rgba(255,120,30,0.9)";
  ctx.shadowBlur = 16;
  const rock = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
  rock.addColorStop(0, "#8a6a58");
  rock.addColorStop(0.6, "#4a3530");
  rock.addColorStop(1, "#24181a");
  ctx.fillStyle = rock;
  ctx.beginPath();
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    const r = 15 + Math.sin(k * 1.9 + n.phase) * 1.2;
    if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // glowing cracks
  const glow = 0.7 + 0.3 * Math.sin(time * 9 + n.phase);
  ctx.strokeStyle = `rgba(255,170,60,${glow})`;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(-2, 1);
  ctx.lineTo(3, -4);
  ctx.moveTo(-2, 1);
  ctx.lineTo(1, 8);
  ctx.moveTo(4, 3);
  ctx.lineTo(9, 5);
  ctx.stroke();
  ctx.restore();
}

/** The fuel of the ship: a small upright bar beside it, green when there is plenty, then yellow and red; it blinks when it has run out. */
export function drawFuel(ctx: CanvasRenderingContext2D, x: number, y: number, fuel: number, out: boolean, time: number): void {
  const h = 40;
  const w = 6;
  const bx = x + 30;
  const by = y - h / 2;
  ctx.save();
  if (out && Math.floor(time * 6) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, bx - 2, by - 2, w + 4, h + 4, 4);
  ctx.fill();
  const f = Math.max(0, Math.min(1, fuel));
  ctx.fillStyle = out ? "#e0352b" : f > 0.5 ? "#5fd35f" : f > 0.25 ? "#ffd54a" : "#ff6a2a";
  roundRect(ctx, bx, by + h * (1 - f), w, h * f, 3);
  ctx.fill();
  ctx.restore();
}
