// Draws one frame of the game on the canvas, in the game's own 360 x 640 coordinates.
import {CUP_H, CUP_W, H, TARGET, W} from "../game/constants";
import type {Cup, GameState, NumberTile} from "../game/types";
import type {Fx} from "./fx";

const FONT = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';
const TAU = Math.PI * 2;
const CHALK = "#e9e4d4";
const GOLD = "#ffd54a";

/** The sound button in the top right corner (game units). */
export const MUTE_BUTTON = {x: 330, y: 28, r: 16};

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center"
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = "rgba(20,12,6,0.85)";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// ---- Cups -----------------------------------------------------------------------------

/** The outline of the cup body, with its origin at the middle of the base. */
function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-32, -CUP_H);
  ctx.lineTo(32, -CUP_H);
  ctx.lineTo(24, -8);
  ctx.quadraticCurveTo(22, 0, 14, 0);
  ctx.lineTo(-14, 0);
  ctx.quadraticCurveTo(-22, 0, -24, -8);
  ctx.closePath();
}

function drawCup(ctx: CanvasRenderingContext2D, c: Cup): void {
  // Shadow on the desk.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(c.x + 4, c.y + CUP_H / 2 - 1, CUP_W * 0.46, 7, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(c.x, c.y + CUP_H / 2);
  // A number landing squashes the cup a little.
  ctx.scale(1 + 0.1 * c.bump, 1 - 0.1 * c.bump);

  const light = c.dead ? "#9b9791" : "#f1ece1";
  const dark = c.dead ? "#66625d" : "#cdc4b1";

  // Handle (behind the body).
  ctx.strokeStyle = dark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.52, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Body.
  const shade = ctx.createLinearGradient(-32, 0, 32, 0);
  shade.addColorStop(0, light);
  shade.addColorStop(1, dark);
  bodyPath(ctx);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();

  // Rim and coffee.
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H + 2, 32, 9, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.dead ? "#3a2c2a" : "#4a2c18";
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H + 3, 28, 7, 0, 0, TAU);
  ctx.fill();
  if (c.ripple > 0) {
    const k = 1 - c.ripple;
    ctx.strokeStyle = `rgba(255,230,190,${c.ripple * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -CUP_H + 3, 6 + 22 * k, 1.5 + 5.5 * k, 0, 0, TAU);
    ctx.stroke();
  }

  // The number stands on the cup.
  const showTen = c.showTen > 0 && c.value === 0;
  if (showTen) {
    text(ctx, String(TARGET), 0, -CUP_H * 0.38, 26, GOLD);
  } else if (c.dead) {
    text(ctx, String(c.value), 0, -CUP_H * 0.38, 24, "#f0a39b");
  } else {
    text(ctx, String(c.value), 0, -CUP_H * 0.38, 24, c.value === 0 ? "rgba(233,228,212,0.45)" : CHALK);
  }

  if (c.flash > 0) {
    bodyPath(ctx);
    ctx.fillStyle = `rgba(255,255,255,${c.flash * 0.7})`;
    ctx.fill();
  }
  ctx.restore();
}

// ---- Numbers --------------------------------------------------------------------------

function drawNumber(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  const bob = n.state === "fall" ? Math.sin(time * 2.4 + n.phase) * 2 : 0;
  ctx.save();
  ctx.translate(n.x + bob, n.y);
  ctx.rotate(n.state === "fall" ? Math.sin(time * 1.7 + n.phase) * 0.06 : 0);
  ctx.scale(n.scale, n.scale);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.roundRect(-19, -17, 40, 40, 9);
  ctx.fill();
  ctx.fillStyle = "#efe7d3";
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-20, -20, 40, 40, 9);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = "#2d2418";
  ctx.fillText(String(n.v), 0, 1);
  ctx.restore();
}

// ---- Screen furniture -----------------------------------------------------------------

function drawMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
  const {x, y, r} = MUTE_BUTTON;
  ctx.fillStyle = "rgba(10,8,18,0.5)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(233,228,212,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, "♪", x, y + 1, 18, muted ? "rgba(233,228,212,0.4)" : CHALK);
  if (muted) {
    ctx.strokeStyle = "#ff8a80";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 10);
    ctx.lineTo(x + 10, y - 10);
    ctx.stroke();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, g: GameState): void {
  text(ctx, `Poäng ${g.score}`, 16, 24, 22, CHALK, "left");
  text(ctx, `Nivå ${g.level}  ·  Rekord ${g.best}`, 16, 48, 13, "rgba(233,228,212,0.75)", "left");
}

function pulse(g: GameState): number {
  return 0.55 + 0.45 * Math.sin(g.time * 3.5);
}

function drawMenu(ctx: CanvasRenderingContext2D, g: GameState): void {
  ctx.fillStyle = "rgba(8,6,14,0.35)";
  ctx.fillRect(0, 0, W, H);
  text(ctx, "PERFECT 10", W / 2, 150, 44, GOLD);
  text(ctx, "Fyra kaffekoppar. Nå exakt 10.", W / 2, 192, 17, CHALK);
  text(ctx, "Tryck på en siffra så faller den i en kopp", W / 2, 240, 14, "rgba(233,228,212,0.85)");
  text(ctx, "Över 10 och koppen dör", W / 2, 262, 14, "rgba(233,228,212,0.85)");
  text(ctx, "Dra i kopparna för att flytta dem", W / 2, 284, 14, "rgba(233,228,212,0.85)");
  ctx.globalAlpha = pulse(g);
  text(ctx, "Tryck för att börja", W / 2, 340, 22, "#ffffff");
  ctx.globalAlpha = 1;
  if (g.best > 0) text(ctx, `Rekord ${g.best}`, W / 2, 378, 16, GOLD);
}

function drawOver(ctx: CanvasRenderingContext2D, g: GameState): void {
  ctx.fillStyle = "rgba(8,6,14,0.55)";
  ctx.fillRect(0, 0, W, H);
  text(ctx, "GAME OVER", W / 2, 160, 42, "#ff8a80");
  const why = g.overReason === "allDead" ? "Alla kopparna är döda" : "Siffran föll i en död kopp";
  text(ctx, why, W / 2, 200, 16, CHALK);
  text(ctx, `Poäng ${g.score}`, W / 2, 256, 30, "#ffffff");
  if (g.newBest) text(ctx, "Nytt rekord!", W / 2, 296, 22, GOLD);
  else text(ctx, `Rekord ${g.best}`, W / 2, 296, 16, "rgba(233,228,212,0.85)");
  if (g.overTimer > 1) {
    ctx.globalAlpha = pulse(g);
    text(ctx, "Tryck för att spela igen", W / 2, 350, 20, "#ffffff");
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, g: GameState): void {
  if (g.banner <= 0) return;
  const k = 1 - g.banner / 1.6; // 0 -> 1
  const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
  ctx.save();
  ctx.globalAlpha = Math.min(1, g.banner / 0.5);
  ctx.translate(W / 2, 200);
  ctx.scale(pop, pop);
  text(ctx, `NIVÅ ${g.level}`, 0, 0, 40, GOLD);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---- A whole frame --------------------------------------------------------------------

/** `bg` is the picture of the classroom from makeBackground. The context is already scaled to game units. */
export function drawGame(ctx: CanvasRenderingContext2D, g: GameState, fx: Fx, bg: HTMLCanvasElement, muted: boolean): void {
  ctx.globalAlpha = 1;
  ctx.drawImage(bg, 0, 0, W, H);

  ctx.save();
  if (g.shake > 0) ctx.translate(Math.sin(g.time * 70) * 6 * g.shake, Math.cos(g.time * 55) * 4 * g.shake);

  // The cups furthest back first, so the ones in front cover them.
  for (const c of [...g.cups].sort((a, b) => a.y - b.y)) drawCup(ctx, c);
  fx.drawSteam(ctx);
  for (const n of g.numbers) drawNumber(ctx, n, g.time);
  fx.drawTop(ctx);
  ctx.restore();

  if (g.phase === "play") drawHud(ctx, g);
  drawBanner(ctx, g);
  if (g.phase === "menu") drawMenu(ctx, g);
  if (g.phase === "over") drawOver(ctx, g);
  drawMuteButton(ctx, muted);
}
