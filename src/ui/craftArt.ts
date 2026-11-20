// The crafts that are flown by the finger in the match modes Fighter jet and Comet belt, and what goes with them: the shots of the jet, the balls it can pick up,
// the tails of the comets and the chains that hold balls together.
import type {GameState, NumberTile, Pickup, Shot, Weapon, WeaponPath} from "../game/types";
import {drawSnakePickupIcon} from "./snakeArt";
import {TAU, roundRect, title, write, drawShieldArc} from "./draw";

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
    // (a combo makes the shots stronger: they are bigger, and burn orange and red)
    const strong = (s.power ?? 1) >= 1.5;
    ctx.shadowColor = strong ? "rgba(255,90,30,0.95)" : "rgba(255,220,90,0.9)";
    ctx.shadowBlur = strong ? 14 : 8;
    ctx.strokeStyle = strong ? "#ffb15a" : "#fff3b0";
    ctx.lineWidth = strong ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02);
    ctx.stroke();
  }
  ctx.restore();
}

const PICKUP_COLOR: Record<Pickup, [string, string]> = {weapon: ["#fff3b0", "#e0a21b"], shield: ["#d8f4ff", "#3a9fd8"], fuel: ["#ffe2b8", "#e8731a"], heart: ["#ffd0dc", "#e0356a"], back: ["#e6d8ff", "#7a4ad8"], slow: ["#d4ffe0", "#2e9e5a"]};
/** The colour of the balls of each way of weapons: gold for the gun, red for the special weapon, green for the technique. */
const PATH_COLOR: Record<WeaponPath, [string, string]> = {a: ["#fff3b0", "#e0a21b"], b: ["#ffd0c8", "#d1392b"], c: ["#d4ffe0", "#1f9e6a"]};
const PATH_OF: Record<Weapon, WeaponPath> = {bullet: "a", laser: "a", flame: "b", missile: "b", ricochet: "c", rapid: "c"};

/** The sign of a weapon, in white, about 20 across (drawn round 0, 0). */
export function drawWeaponIcon(ctx: CanvasRenderingContext2D, w: Weapon, k = 1): void {
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (w === "bullet") {
    for (const dx of [-5, 0, 5]) {
      roundRect(ctx, dx - 1.5, -8, 3, 13, 1.5);
      ctx.fill();
    }
  } else if (w === "laser") {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(0, -9);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 4, 5);
      ctx.lineTo(s * 7, -2);
      ctx.stroke();
    }
  } else if (w === "flame") {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(8, -2, 6, 4);
    ctx.quadraticCurveTo(4, 9, 0, 9);
    ctx.quadraticCurveTo(-4, 9, -6, 4);
    ctx.quadraticCurveTo(-8, -2, 0, -10);
    ctx.fill();
  } else if (w === "missile") {
    ctx.rotate(-0.6);
    roundRect(ctx, -2.5, -9, 5, 16, 2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(5, 8);
    ctx.lineTo(0, 3);
    ctx.fill();
  } else if (w === "ricochet") {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-8, 8);
    ctx.lineTo(-2, -4);
    ctx.lineTo(3, 4);
    ctx.lineTo(8, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(3, -7);
    ctx.moveTo(8, -8);
    ctx.lineTo(8, -3);
    ctx.stroke();
  } else {
    ctx.lineWidth = 2.6;
    for (const dy of [-3, 4]) {
      ctx.beginPath();
      ctx.moveTo(-7, dy + 4);
      ctx.lineTo(0, dy - 3);
      ctx.lineTo(7, dy + 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A ball the jet or the ship can fly into: it glows, and shows what it gives (a weapon, a shield, fuel or a life). Two weapons side by side have their names under them. */
export function drawPickup(ctx: CanvasRenderingContext2D, n: NumberTile, time: number, label?: string): void {
  const kind = n.pickup!;
  const [light, dark] = kind === "weapon" && n.weapon ? PATH_COLOR[PATH_OF[n.weapon]] : PICKUP_COLOR[kind];
  ctx.save();
  ctx.translate(n.x, n.y);
  if (label) {
    // (a choice: the name under the ball, and a line between the two)
    write(ctx, label, 0, 30, 11, "#ffffff", "center", 800);
  }
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
  if (kind === "weapon" && n.weapon) drawWeaponIcon(ctx, n.weapon);
  else if (kind === "heart") {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-12, 0, -8, -10, 0, -4);
    ctx.bezierCurveTo(8, -10, 12, 0, 0, 8);
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
  } else if (kind === "back" || kind === "slow") drawSnakePickupIcon(ctx, kind);
  else drawShieldArc(ctx, 0, -2, 10, 5);
  ctx.restore();
}

/** The laser of the jet: a hot beam straight up from its nose, wider and brighter with every upgrade, that flickers. */
export function drawLaser(ctx: CanvasRenderingContext2D, x: number, y: number, top: number, lv: number, time: number): void {
  const half = 3 + 2 * lv;
  const flick = 0.85 + 0.15 * Math.sin(time * 50);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const outer = ctx.createLinearGradient(x - half * 3, 0, x + half * 3, 0);
  outer.addColorStop(0, "rgba(255,60,200,0)");
  outer.addColorStop(0.5, `rgba(255,80,220,${0.5 * flick})`);
  outer.addColorStop(1, "rgba(255,60,200,0)");
  ctx.fillStyle = outer;
  ctx.fillRect(x - half * 3, top, half * 6, y - top);
  ctx.fillStyle = `rgba(255,200,250,${0.9 * flick})`;
  ctx.fillRect(x - half * 0.5, top, half, y - top);
  // a flash at the nose
  const flash = ctx.createRadialGradient(x, y, 0, x, y, 14 + lv * 3);
  flash.addColorStop(0, "rgba(255,255,255,0.95)");
  flash.addColorStop(1, "rgba(255,80,220,0)");
  ctx.fillStyle = flash;
  ctx.beginPath();
  ctx.arc(x, y, 14 + lv * 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The plasma flame of the jet: a cone of fire in front of its nose, blue-white near it and violet further out, with waves of plasma rolling out along it. */
export function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number, time: number): void {
  const reach = 80 + 30 * lv;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cone = ctx.createLinearGradient(0, y, 0, y - reach);
  cone.addColorStop(0, "rgba(220,240,255,0.9)");
  cone.addColorStop(0.35, "rgba(120,170,255,0.6)");
  cone.addColorStop(1, "rgba(170,80,255,0)");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  const w = 10 + reach * 0.45;
  ctx.quadraticCurveTo(x - w, y - reach * 0.6 + Math.sin(time * 20) * 4, x - w * 0.8, y - reach);
  ctx.lineTo(x + w * 0.8, y - reach);
  ctx.quadraticCurveTo(x + w, y - reach * 0.6 + Math.cos(time * 23) * 4, x + 6, y);
  ctx.closePath();
  ctx.fill();
  // waves of plasma rolling out
  for (let k = 0; k < 3; k++) {
    const u = (time * 2.2 + k / 3) % 1;
    const wy = y - u * reach;
    const ww = 8 + u * reach * 0.45;
    ctx.strokeStyle = `rgba(200,220,255,${0.7 * (1 - u)})`;
    ctx.lineWidth = 3 * (1 - u) + 1;
    ctx.beginPath();
    ctx.ellipse(x, wy, ww, 4 + u * 6, 0, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** Under the jet: the three ways of weapons, each a small round sign (the weapon chosen, or a question mark) with three dots for its upgrades. */
export function drawWeaponHud(ctx: CanvasRenderingContext2D, x: number, y: number, o: {weapons: Record<WeaponPath, Weapon | null>; lv: Record<WeaponPath, number>}): void {
  const top = y + 46;
  ctx.save();
  (["a", "b", "c"] as WeaponPath[]).forEach((p, i) => {
    const cx = x + (i - 1) * 30;
    const w = o.weapons[p];
    const [light, dark] = PATH_COLOR[p];
    ctx.globalAlpha = w ? 1 : 0.4;
    const ball = ctx.createRadialGradient(cx - 2, top - 3, 1, cx, top, 10);
    ball.addColorStop(0, light);
    ball.addColorStop(1, dark);
    ctx.fillStyle = w ? ball : "rgba(60,50,70,0.8)";
    ctx.beginPath();
    ctx.arc(cx, top, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, top);
    if (w) drawWeaponIcon(ctx, w, 0.55);
    else write(ctx, "?", 0, 1, 11, "#ffffff", "center", 800);
    ctx.restore();
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < o.lv[p] ? "#ffe27a" : "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(cx - 6 + k * 6, top + 14, 2.2, 0, TAU);
      ctx.fill();
    }
  });
  ctx.restore();
}

/** The lives of the ship of the comet belt: an upright bar to its left, one red part for each life (the lost ones dark), that shakes when one has just been lost. */
export function drawHealth(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, max: number, hurt: number, time: number): void {
  const h = 40;
  const w = 7;
  const shake = hurt > 0 ? Math.sin(time * 60) * 2 * Math.min(1, hurt) : 0;
  const bx = x - 30 - w + shake;
  const by = y - h / 2;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, bx - 2, by - 2, w + 4, h + 4, 4);
  ctx.fill();
  const seg = (h - (max - 1) * 2) / max;
  for (let i = 0; i < max; i++) {
    const sy = by + h - (i + 1) * seg - i * 2;
    ctx.fillStyle = i < hp ? (hp === 1 ? `rgba(255,70,70,${0.6 + 0.4 * Math.sin(time * 10)})` : "#ff4a5a") : "rgba(255,255,255,0.12)";
    roundRect(ctx, bx, sy, w, seg, 2.5);
    ctx.fill();
  }
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
  title(ctx, words, 0, 0, 20, "#ffffff", g.jetGotKind === "weapon" && g.jetGotWeapon ? PATH_COLOR[PATH_OF[g.jetGotWeapon]][1] : PICKUP_COLOR[g.jetGotKind][1]);
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
export function drawFuel(ctx: CanvasRenderingContext2D, x: number, y: number, fuel: number, out: boolean, time: number, capacity = 6): void {
  // (the tank grows on every new level: so does the bar)
  const h = Math.min(80, 40 * (capacity / 6));
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

/** The trail of light the jet or the ship leaves when it flies on its own to where the finger is: glowing blobs that fade, and streaks between them. */
export function drawTrail(ctx: CanvasRenderingContext2D, trail: readonly {x: number; y: number; age: number}[], rgb: string): void {
  if (trail.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const fade = 1 - b.age / 0.25;
    ctx.strokeStyle = `rgba(${rgb},${0.5 * fade})`;
    ctx.lineWidth = 16 * fade + 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const p of trail) {
    const fade = 1 - p.age / 0.25;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22);
    glow.addColorStop(0, `rgba(${rgb},${0.45 * fade})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The missiles the skulls shoot back at the jet: small and red, glowing, pointing the way they fly, with a puff of smoke behind. */
export function drawEnemyShots(ctx: CanvasRenderingContext2D, shots: readonly {x: number; y: number; vx: number; vy: number}[], time: number): void {
  for (const e of shots) {
    const a = Math.atan2(e.vy, e.vx);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillStyle = "rgba(200,200,210,0.35)";
    ctx.beginPath();
    ctx.arc(0, -11, 3.5, 0, TAU);
    ctx.arc(0, -16, 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255,160,60,${0.7 + 0.3 * Math.sin(time * 30)})`;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(0, -10);
    ctx.lineTo(2, -5);
    ctx.fill();
    ctx.shadowColor = "rgba(255,40,40,0.9)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#d4261c";
    roundRect(ctx, -2.6, -6, 5.2, 12, 2.6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#3a1a1a";
    ctx.beginPath();
    ctx.arc(0, 6, 2.6, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

/** The glow round the jet while a combo makes its shots stronger. */
export function drawComboGlow(ctx: CanvasRenderingContext2D, x: number, y: number, combo: number, time: number): void {
  const k = Math.min(1, (combo - 1) / 5);
  const r = 40 + 10 * k + Math.sin(time * 12) * 3;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 8, x, y, r);
  glow.addColorStop(0, `rgba(255,140,40,${0.35 + 0.25 * k})`);
  glow.addColorStop(1, "rgba(255,60,20,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Comet belt: a giant planet, as wide as two columns, that falls slowly: a big round planet in rusty reds and browns with bands across it, craters, a light
 * on its upper left and a dark side, a thin ring tilted round it, and a soft glow of the atmosphere round its edge. It turns slowly.
 */
export function drawPlanet(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  const r = 15 * (n.scale || 1);
  ctx.save();
  ctx.translate(n.x, n.y);
  // the glow of the atmosphere
  const glow = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.35);
  glow.addColorStop(0, "rgba(255,170,110,0.35)");
  glow.addColorStop(1, "rgba(255,170,110,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.35, 0, TAU);
  ctx.fill();
  // the back of the ring (behind the planet)
  const ring = (front: boolean): void => {
    ctx.save();
    ctx.rotate(-0.35);
    ctx.strokeStyle = "rgba(240,215,170,0.75)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.55, r * 0.38, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(160,120,80,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.42, r * 0.33, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.stroke();
    ctx.restore();
  };
  ring(false);
  // the planet: a ball with its light from the upper left
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const body = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.1);
  body.addColorStop(0, "#f4b27a");
  body.addColorStop(0.5, "#c0603a");
  body.addColorStop(1, "#5a2418");
  ctx.fillStyle = body;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  // bands across it, that slide slowly (it turns)
  const turn = (time * 6) % (r * 2);
  ctx.globalAlpha = 0.28;
  for (const [y, h, c] of [
    [-0.55, 0.12, "#8a3a20"],
    [-0.2, 0.18, "#f0c090"],
    [0.15, 0.1, "#7a2e1a"],
    [0.45, 0.16, "#e09a6a"],
  ] as const) {
    ctx.fillStyle = c;
    ctx.fillRect(-r, y * r, r * 2, h * r);
  }
  ctx.globalAlpha = 1;
  // craters
  for (const [cx, cy, cr] of [
    [-0.3, 0.25, 0.16],
    [0.35, -0.3, 0.12],
    [0.1, 0.55, 0.1],
    [-0.55, -0.2, 0.08],
  ] as const) {
    const x = ((cx * r + turn + r) % (r * 2)) - r;
    ctx.fillStyle = "rgba(60,20,10,0.35)";
    ctx.beginPath();
    ctx.arc(x, cy * r, cr * r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,210,170,0.25)";
    ctx.beginPath();
    ctx.arc(x - cr * r * 0.25, cy * r - cr * r * 0.25, cr * r * 0.6, 0, TAU);
    ctx.fill();
  }
  // the dark side
  const night = ctx.createLinearGradient(-r, -r, r, r);
  night.addColorStop(0.45, "rgba(0,0,0,0)");
  night.addColorStop(1, "rgba(10,4,20,0.65)");
  ctx.fillStyle = night;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,200,150,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ring(true);
  ctx.restore();
}
