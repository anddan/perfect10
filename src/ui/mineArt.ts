// The mine: the blocks of earth (and the tunnels dug in it), the miner with his lamp and pick, the lava that comes down from above, and the basket.

import {roundRect, title, write} from "./draw";

const TAU = Math.PI * 2;

/** A block of earth (the number is drawn on it after): brown, with a lighter top edge, a few stones in it, and darker the deeper it is. */
export function drawEarth(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, depth: number, seed: number): void {
  const h = size / 2;
  const dark = Math.min(0.45, depth * 0.006);
  ctx.save();
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, `rgb(${150 - dark * 120},${100 - dark * 80},${60 - dark * 40})`);
  g.addColorStop(1, `rgb(${110 - dark * 90},${70 - dark * 55},${40 - dark * 30})`);
  ctx.fillStyle = g;
  roundRect(ctx, x - h + 1, y - h + 1, size - 2, size - 2, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,230,190,0.18)";
  ctx.fillRect(x - h + 4, y - h + 2, size - 8, 3);
  // a few stones
  ctx.fillStyle = "rgba(60,40,25,0.45)";
  for (let k = 0; k < 3; k++) {
    const a = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    const u = a - Math.floor(a);
    const b = Math.sin(seed * 4.123 + k * 9.17) * 1234.5;
    const v = b - Math.floor(b);
    ctx.beginPath();
    ctx.arc(x - h + 8 + u * (size - 16), y - h + 8 + v * (size - 16), 2 + u * 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A tunnel: a dark hole where a block has been dug out. */
export function drawTunnel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const h = size / 2;
  ctx.save();
  ctx.fillStyle = "rgba(20,12,8,0.85)";
  ctx.fillRect(x - h, y - h, size, size);
  ctx.restore();
}

/** How the miner stands: how far a swing of the pick has come (0 to 1; outside that, none), which way it hacks, which way he looks, and how much he is
 *  squashed (above 0 when he lands, below 0 stretched while he falls), and a little hop while he walks. */
export interface MinerPose {
  swing: number;
  dc: number;
  dr: number;
  face: number;
  squash: number;
  hop: number;
}
const REST: MinerPose = {swing: -1, dc: 1, dr: 0, face: 1, squash: 0, hop: 0};

/** The miner at (x, y) (his feet a little under the middle of his block): a helmet with a lamp that lights the way, a face, a pick that he swings. */
export function drawMiner(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, tip: number, daze = 0, pose: MinerPose = REST): void {
  ctx.save();
  ctx.translate(x, y - pose.hop);
  // the light of his lamp: round him, and a beam the way he looks
  const lamp = ctx.createRadialGradient(0, -8, 4, 0, -8, 70);
  lamp.addColorStop(0, "rgba(255,240,180,0.35)");
  lamp.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = lamp;
  ctx.beginPath();
  ctx.arc(0, -8, 70, 0, TAU);
  ctx.fill();
  const flicker = 0.9 + 0.1 * Math.sin(time * 23) * Math.sin(time * 7);
  const beam = ctx.createLinearGradient(0, -15, pose.face * 90, -5);
  beam.addColorStop(0, `rgba(255,246,200,${0.32 * flicker})`);
  beam.addColorStop(1, "rgba(255,246,200,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(pose.face * 2, -15);
  ctx.lineTo(pose.face * 95, -40);
  ctx.lineTo(pose.face * 95, 22);
  ctx.closePath();
  ctx.fill();
  // (the basket went over: he spins round, two turns that slow down, and wobbles at the end)
  if (tip < TIP_SPIN) {
    const u = tip / TIP_SPIN;
    ctx.translate(0, 6);
    ctx.rotate(4 * Math.PI * (1 - Math.pow(1 - u, 3)) + Math.sin(u * 30) * 0.15 * u);
    ctx.translate(0, -6);
  }
  // (dazed: little stars go round over his helmet)
  if (daze > 0) {
    for (let k = 0; k < 3; k++) {
      const an = time * 5 + (k * TAU) / 3;
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(Math.cos(an) * 12, -24 + Math.sin(an) * 4, 2.6, 0, TAU);
      ctx.fill();
    }
  }
  // squashed when he lands, stretched while he falls (from his feet), and breathing a little when he stands
  const breathe = pose.swing < 0 && pose.squash === 0 ? 0.02 * Math.sin(time * 3) : 0;
  ctx.translate(0, 16);
  ctx.scale(1 + pose.squash * 0.5 - breathe, 1 - pose.squash * 0.5 + breathe);
  ctx.translate(0, -16);
  ctx.scale(pose.face, 1);
  // the shadow under him
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 17, 11, 3, 0, 0, TAU);
  ctx.fill();
  // legs (stepping while he walks)
  const step = pose.hop > 0.5 ? Math.sin(time * 30) * 2 : 0;
  ctx.fillStyle = "#3a2a1a";
  roundRect(ctx, -7, 12 + step, 5, 5, 2);
  ctx.fill();
  roundRect(ctx, 2, 12 - step, 5, 5, 2);
  ctx.fill();
  // body, with straps
  ctx.fillStyle = "#2f5fa8";
  roundRect(ctx, -9, 0, 18, 14, 5);
  ctx.fill();
  ctx.fillStyle = "#ffcf3a";
  ctx.fillRect(-6, 1, 2, 12);
  ctx.fillRect(4, 1, 2, 12);
  // the pick: over his shoulder, or in a swing (back, then a hard hack the way he digs, then back up)
  const rest = 0.55 + Math.sin(time * 2) * 0.05;
  const target = pose.dr === 1 ? 2.7 : pose.dr === -1 ? 0.15 : 1.75;
  const back = -1.9;
  let rot = rest;
  const s = pose.swing;
  if (s >= 0 && s <= 1) {
    const ease = (u: number) => 1 - Math.pow(1 - u, 3);
    if (s < 0.35) rot = rest + (back - rest) * ease(s / 0.35);
    else if (s < 0.5) rot = back + (target - back) * ((s - 0.35) / 0.15);
    else if (s < 0.7) rot = target;
    else rot = target + (rest - target) * ease((s - 0.7) / 0.3);
  }
  // head (it leans the way he hacks)
  ctx.save();
  if (s >= 0.35 && s < 0.7) ctx.translate(2, pose.dr === 1 ? 2 : 0);
  ctx.fillStyle = "#f2c79a";
  ctx.beginPath();
  ctx.arc(0, -6, 8, 0, TAU);
  ctx.fill();
  // eyes (blinking now and then), shut tight when he hacks
  ctx.fillStyle = "#3a2a1a";
  const blink = (time % 3.3) < 0.12;
  if ((s >= 0.35 && s < 0.7) || blink) {
    ctx.fillRect(-4, -6.5, 3, 1.2);
    ctx.fillRect(1.5, -6.5, 3, 1.2);
  } else {
    ctx.beginPath();
    ctx.arc(-2, -6, 1.3, 0, TAU);
    ctx.arc(4, -6, 1.3, 0, TAU);
    ctx.fill();
  }
  // cheeks
  ctx.fillStyle = "rgba(240,120,110,0.4)";
  ctx.beginPath();
  ctx.arc(-4, -3, 1.8, 0, TAU);
  ctx.arc(6, -3, 1.8, 0, TAU);
  ctx.fill();
  // helmet, with its lamp
  ctx.fillStyle = "#ffcf3a";
  ctx.beginPath();
  ctx.arc(0, -9, 9, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-11, -10, 22, 3);
  ctx.fillStyle = "#fffbe0";
  ctx.shadowColor = "#fff3b0";
  ctx.shadowBlur = 8 * flicker;
  ctx.beginPath();
  ctx.arc(3, -15, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the pick, in front of him (in his hand)
  ctx.save();
  ctx.translate(8, 6);
  ctx.rotate(rot);
  ctx.scale(1.25, 1.25);
  // (a blur behind it while it strikes)
  if (s >= 0.35 && s < 0.55) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 20, -Math.PI / 2 - 1.4, -Math.PI / 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#7a4e22";
  ctx.fillRect(-1.5, -20, 3, 22);
  ctx.fillStyle = "#c8ccd4";
  ctx.strokeStyle = "#6a6e78";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.quadraticCurveTo(0, -25, 10, -18);
  ctx.lineTo(0, -16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Where the pick hits a block, a moment after the swing: bright sparks that fly off, chips of stone, and a flash. (x, y) is where it hits. */
export function drawPickHit(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, dc: number, dr: number): void {
  if (age < 0 || age > 0.4) return;
  const u = age / 0.4;
  ctx.save();
  // the flash
  if (age < 0.1) {
    const fl = ctx.createRadialGradient(x, y, 1, x, y, 26);
    fl.addColorStop(0, `rgba(255,250,220,${0.9 * (1 - age / 0.1)})`);
    fl.addColorStop(1, "rgba(255,250,220,0)");
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, TAU);
    ctx.fill();
  }
  // sparks: back the way the pick came, spread out, falling a little
  ctx.lineCap = "round";
  for (let k = 0; k < 9; k++) {
    const an = Math.atan2(-dr, -dc) + (k - 4) * 0.32;
    const sp = 70 + ((k * 37) % 50);
    const d = sp * age;
    const sx = x + Math.cos(an) * d;
    const sy = y + Math.sin(an) * d + 120 * age * age;
    ctx.strokeStyle = k % 3 === 0 ? `rgba(255,255,255,${1 - u})` : `rgba(255,200,80,${1 - u})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - Math.cos(an) * 6, sy - Math.sin(an) * 6);
    ctx.stroke();
  }
  // chips of stone
  for (let k = 0; k < 5; k++) {
    const an = Math.atan2(-dr, -dc) + (k - 2) * 0.6;
    const d = 40 * age;
    ctx.fillStyle = `rgba(120,86,50,${1 - u})`;
    ctx.fillRect(x + Math.cos(an) * d - 2, y + Math.sin(an) * d + 200 * age * age - 2, 4, 4);
  }
  ctx.restore();
}

/** Dust where his feet are: puffs that grow and fade (when he lands, and when he steps). */
export function drawDust(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, big: boolean): void {
  const life = big ? 0.5 : 0.3;
  if (age < 0 || age > life) return;
  const u = age / life;
  ctx.save();
  const n = big ? 6 : 3;
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1;
    const d = (big ? 26 : 12) * (0.4 + 0.6 * (1 - Math.pow(1 - u, 2))) * (0.6 + 0.2 * (k >> 1));
    ctx.fillStyle = `rgba(200,170,130,${0.55 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(x + side * d, y - u * 6 - (k >> 1) * 2, (big ? 5 : 3.5) + u * 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The lava over the mine, from the top of the view down to its edge at y: glowing red and orange, with a bright bubbling edge. */
export function drawLava(ctx: CanvasRenderingContext2D, top: number, y: number, w: number, time: number): void {
  if (y <= top) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, y);
  g.addColorStop(0, "rgba(120,10,0,0.95)");
  g.addColorStop(1, "rgba(255,90,20,0.95)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, top);
  ctx.lineTo(w, y);
  for (let x = w; x >= 0; x -= 10) ctx.lineTo(x, y + Math.sin(x * 0.08 + time * 3) * 4);
  ctx.closePath();
  ctx.fill();
  // the bright edge, and its glow on what is under it
  ctx.strokeStyle = "rgba(255,230,120,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 10) {
    const yy = y + Math.sin(x * 0.08 + time * 3) * 4;
    if (x === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  const glow = ctx.createLinearGradient(0, y, 0, y + 40);
  glow.addColorStop(0, "rgba(255,120,40,0.35)");
  glow.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, y, w, 40);
  // bubbles
  for (let k = 0; k < 6; k++) {
    const bx = ((k * 61 + time * 20) % w);
    const by = y - 6 - ((time * 15 + k * 7) % 20);
    ctx.fillStyle = "rgba(255,200,90,0.7)";
    ctx.beginPath();
    ctx.arc(bx, by, 2 + (k % 3), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The basket at the top: what is in it now, towards 10, as a bar and a number; red when it is over 6 (careful), and how deep the miner is. */
export function drawBasket(ctx: CanvasRenderingContext2D, sum: number, depth: number, depthWord: string, time: number, keys = 0, free = "", need = 1, keyT = 99): void {
  const cx = 180;
  const y = 60;
  // (with a key: no basket, only what to do now, and the depth)
  if (free) {
    drawKeyRack(ctx, cx + 118, y - 2, keys, need, time, keyT);
    const beat = 1 + 0.04 * Math.sin(time * 6);
    ctx.save();
    ctx.translate(cx - 20, y);
    ctx.scale(beat, beat);
    title(ctx, free, 0, 0, 18, "#ffffff", "#2a9e4a", 0.18);
    ctx.restore();
    write(ctx, depthWord.replace("{n}", String(depth)), cx, y + 30, 12, "#e8dcc2", "center", 700);
    return;
  }
  ctx.save();
  const w = 150;
  ctx.fillStyle = "rgba(10,6,18,0.7)";
  roundRect(ctx, cx - w / 2, y + 20, w, 9, 4.5);
  ctx.fill();
  const u = Math.min(1, Math.abs(sum) / 10);
  ctx.fillStyle = Math.abs(sum) >= 7 ? "#ff9a3c" : "#ffd54a";
  roundRect(ctx, cx - w / 2, y + 20, Math.max(4, w * u), 9, 4.5);
  ctx.fill();
  const beat = Math.abs(sum) >= 7 ? 1 + 0.05 * Math.sin(time * 10) : 1;
  ctx.translate(cx, y);
  ctx.scale(beat, beat);
  title(ctx, `${sum < 0 ? "−" + -sum : sum} / ${sum < 0 ? "−10" : "10"}`, 0, -2, 26, "#ffffff", "#b06a12", 0.18);
  ctx.restore();
  write(ctx, depthWord.replace("{n}", String(depth)), cx, y + 44, 12, "#e8dcc2", "center", 700);
  drawKeyRack(ctx, cx + 118, y - 2, keys, need, time, keyT);
}

/** A gate in a wall of the mine: a heavy block of gold-edged iron with a padlock; it glows green when the basket would make exactly 10 with it (it can be opened). */
export function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, open: boolean): void {
  const h = size / 2;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, "#5a5866");
  g.addColorStop(1, "#33313c");
  ctx.fillStyle = g;
  roundRect(ctx, x - h + 1, y - h + 1, size - 2, size - 2, 6);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = open ? `rgba(120,240,140,${0.7 + 0.3 * Math.sin(time * 8)})` : "#d8a838";
  ctx.stroke();
  // chains across it, behind the number
  ctx.strokeStyle = open ? "rgba(156,240,168,0.6)" : "rgba(200,170,90,0.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(x - h + 5, y - h + 5);
  ctx.lineTo(x + h - 5, y + h - 5);
  ctx.moveTo(x + h - 5, y - h + 5);
  ctx.lineTo(x - h + 5, y + h - 5);
  ctx.stroke();
  ctx.restore();
}

/** The padlock of a gate, over the corner of its number: big and gold, shut; green and open (its shackle up) when the basket would open the gate. */
export function drawGateLock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, open: boolean): void {
  const lx = x + size * 0.24;
  const ly = y + size * 0.2;
  const s = open ? 1 + 0.08 * Math.sin(time * 8) : 1;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.scale(s, s);
  const body = open ? ["#c8ffd0", "#2a9e4a"] : ["#ffe9a0", "#c88a10"];
  // the shackle (up and to one side when it is open)
  ctx.strokeStyle = "rgba(20,10,0,0.7)";
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (open) ctx.arc(-3, -9, 5, Math.PI, 0);
  else ctx.arc(0, -5, 5, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = open ? "#7ae08a" : "#f0c040";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (open) ctx.arc(-3, -9, 5, Math.PI, 0);
  else ctx.arc(0, -5, 5, Math.PI, 0);
  ctx.stroke();
  // the body, with a keyhole
  const g = ctx.createLinearGradient(0, -6, 0, 8);
  g.addColorStop(0, body[0]);
  g.addColorStop(1, body[1]);
  ctx.fillStyle = g;
  roundRect(ctx, -8, -6, 16, 13, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,20,0,0.75)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(40,20,0,0.8)";
  ctx.beginPath();
  ctx.arc(0, -1, 2, 0, TAU);
  ctx.fill();
  ctx.fillRect(-0.9, -1, 1.8, 4.5);
  ctx.restore();
}

/** A plate of steel in the mine (it cannot be dug): grey metal with a light top edge and four rivets. */
export function drawSteelPlate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const h = size / 2;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, "#9a9eaa");
  g.addColorStop(1, "#5c606c");
  ctx.fillStyle = g;
  roundRect(ctx, x - h + 1, y - h + 1, size - 2, size - 2, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,32,40,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x - h + 4, y - h + 3, size - 8, 2.5);
  ctx.fillStyle = "#3a3c46";
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.arc(x + dx * (h - 8), y + dy * (h - 8), 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A gem in the earth: a cut stone that sparkles, in a colour of its own (red, blue, green or purple). */
export function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, seed: number): void {
  const colors = [["#ff9aa8", "#d01e3c"], ["#9ad6ff", "#1e6ad0"], ["#9cf0a8", "#1e9a4a"], ["#e0b0ff", "#7a2ad0"]];
  const [light, dark] = colors[seed % colors.length];
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = dark;
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.35);
  ctx.lineTo(-r * 0.35, -r * 0.75);
  ctx.lineTo(r * 0.35, -r * 0.75);
  ctx.lineTo(r * 0.7, -r * 0.35);
  ctx.lineTo(0, r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.35);
  ctx.lineTo(r * 0.7, -r * 0.35);
  ctx.moveTo(-r * 0.2, -r * 0.35);
  ctx.lineTo(0, r * 0.85);
  ctx.lineTo(r * 0.2, -r * 0.35);
  ctx.stroke();
  // a sparkle now and then
  const tw = Math.max(0, Math.sin(time * 3 + seed));
  ctx.fillStyle = `rgba(255,255,255,${tw})`;
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.5, 2 * tw + 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A gold key, lying across (x, y is its middle). */
export function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(-0.5);
  ctx.strokeStyle = "#8a5a08";
  ctx.fillStyle = "#ffd54a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-7, 0, 5.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3a2a10";
  ctx.beginPath();
  ctx.arc(-7, 0, 2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffd54a";
  ctx.fillRect(-2, -1.8, 14, 3.6);
  ctx.strokeRect(-2, -1.8, 14, 3.6);
  ctx.fillRect(8, 1.5, 2.5, 4);
  ctx.fillRect(4, 1.5, 2.5, 3);
  ctx.restore();
}

/**
 * The keys at the top right: a key for every lock of the next door (and for every one more he has), gold for the ones he has and dark for the ones still to
 * get, with how many he has under them. A new key pops in with a shine; when there are keys enough, they all glow.
 */
export function drawKeyRack(ctx: CanvasRenderingContext2D, x: number, y: number, keys: number, need: number, time: number, keyT: number): void {
  const slots = Math.max(need, Math.min(keys, 3));
  const gap = 20;
  const x0 = x - ((slots - 1) * gap) / 2;
  const enough = keys >= need;
  ctx.save();
  // the little shelf they hang on
  ctx.fillStyle = "rgba(10,6,18,0.55)";
  roundRect(ctx, x0 - 16, y - 16, (slots - 1) * gap + 32, 32, 10);
  ctx.fill();
  if (enough) {
    ctx.strokeStyle = `rgba(255,213,74,${0.6 + 0.4 * Math.sin(time * 6)})`;
    ctx.lineWidth = 2;
    roundRect(ctx, x0 - 16, y - 16, (slots - 1) * gap + 32, 32, 10);
    ctx.stroke();
  }
  for (let k = 0; k < slots; k++) {
    const kx = x0 + k * gap;
    const has = k < keys;
    const isNew = has && k === keys - 1 && keyT < 0.6;
    ctx.save();
    if (!has) ctx.globalAlpha = 0.28;
    const pop = isNew ? (keyT < 0.2 ? 0.3 + (keyT / 0.2) * 1.1 : 1.4 - Math.min(0.4, (keyT - 0.2) * 1.2)) : 1;
    const sway = has ? Math.sin(time * 2.5 + k) * 0.08 : 0;
    ctx.translate(kx, y);
    ctx.rotate(sway);
    ctx.scale(pop, pop);
    if (has && enough) {
      ctx.shadowColor = "#ffd54a";
      ctx.shadowBlur = 10;
    }
    drawKey(ctx, 0, 0, 0.9);
    ctx.restore();
    // a shine that runs over a new key
    if (isNew) {
      ctx.save();
      ctx.globalAlpha = 1 - keyT / 0.6;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      for (let r = 0; r < 4; r++) {
        const an = (r * Math.PI) / 2 + keyT * 4;
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(an) * 12, y + Math.sin(an) * 12);
        ctx.lineTo(kx + Math.cos(an) * (16 + keyT * 20), y + Math.sin(an) * (16 + keyT * 20));
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
  // how many he has (and how many the door wants), under the keys
  title(ctx, `${keys}/${need}`, x, y + 26, 13, "#ffffff", enough ? "#2a9e4a" : "#b06a12", 0.2);
}

/** How long the miner spins when the basket goes over 10. */
export const TIP_SPIN = 1.2;

/**
 * The basket went over 10: a red flash and a ring round the miner, the stones spilling, the sum it came to struck through ("13"), and "Too much!" that
 * pops up and shakes. (x, y) is the miner; age is how long ago it went over.
 */
export function drawTooMuch(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, over: number, word: string): void {
  if (age > 1.6) return;
  ctx.save();
  // a red flash round him, and two rings going out
  if (age < 0.35) {
    const fl = ctx.createRadialGradient(x, y, 4, x, y, 90);
    fl.addColorStop(0, `rgba(255,60,40,${0.55 * (1 - age / 0.35)})`);
    fl.addColorStop(1, "rgba(255,60,40,0)");
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, TAU);
    ctx.fill();
  }
  for (let k = 0; k < 2; k++) {
    const t = age - k * 0.15;
    if (t < 0 || t > 0.6) continue;
    ctx.strokeStyle = `rgba(255,80,60,${1 - t / 0.6})`;
    ctx.lineWidth = 4 * (1 - t / 0.6) + 1;
    ctx.beginPath();
    ctx.arc(x, y, 14 + t * 120, 0, TAU);
    ctx.stroke();
  }
  // the sum it came to, struck through in red, flying up
  const fade = age > 1.2 ? 1 - (age - 1.2) / 0.4 : 1;
  ctx.globalAlpha = fade;
  const pop = age < 0.15 ? 0.4 + (age / 0.15) * 0.9 : 1.3 - Math.min(0.3, (age - 0.15) * 0.6);
  const shake = age < 0.6 ? Math.sin(age * 60) * 4 * (1 - age / 0.6) : 0;
  ctx.save();
  ctx.translate(x + shake, y - 46 - age * 14);
  ctx.scale(pop, pop);
  title(ctx, word, 0, 0, 22, "#ffffff", "#d4261c", 0.22);
  ctx.restore();
  ctx.save();
  ctx.translate(x - shake, y - 74 - age * 18);
  title(ctx, String(over), 0, 0, 20, "#ffd0c8", "#8a1a10", 0.22);
  ctx.strokeStyle = "#ff3a2a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, 8);
  ctx.lineTo(16, -8);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}
