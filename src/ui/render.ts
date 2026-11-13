// Draws one frame of the game, in the game's own 360 x 640 coordinates.
import {CHAIN_LENGTH, CUP_H, DIVE_HOP, H, TARGET, TUTORIAL_STEPS, W} from "../game/constants";
import {endlessLevel, ghostShow, goalFor} from "../game/engine";
import type {Cup, GameState, NumberTile} from "../game/types";
import {type Room, roomOfMode} from "./background";
import {type Book, chapterOf, drawBook, nextGame, roomOfPage} from "./book";
import {
  type Button,
  CHALK,
  GOLD,
  TAU,
  beginUi,
  drawBall,
  drawBonusBall,
  drawButton,
  drawChain,
  drawGhostBack,
  drawIce,
  drawFlag,
  drawPanel,
  drawRibbon,
  drawStar,
  registerHit,
  roundRect,
  signed,
  text,
  title,
  ui,
  write,
} from "./draw";
import type {Fx} from "./fx";
import {LANGS, LANG_NAMES, type Key, lang, t} from "./i18n";
import {BAR, litSegments, segmentLayout} from "./progress";
import {SLOW_SECONDS} from "../game/constants";

/** How far (radians) a tapped number leans to the side: about 20 degrees. */
const TILT = 0.35;

// ---- Cups -----------------------------------------------------------------------------
// A cup is drawn in two halves: the back (saucer, handle, the inside with the coffee) before the numbers,
// and the front (the body and the front lip of the rim) after them. A number that sinks into a cup then
// disappears behind the lip, so it looks like it goes in.

/** The opening of the cup, seen from a little above (an ellipse). The coffee is seen through it. */
const OPEN_RX = 28;
const OPEN_RY = 7;
const OPEN_CY = -CUP_H + 3;
/** How far (units) the coffee has sunk below the rim in an empty cup. */
const COFFEE_DROP = 9;
/** A cup with this much in it is full to the brim. */
const FULL_AT = 9;

/** How full each cup is drawn right now (0 to 1). It follows the cup's value a little slowly, so the coffee rises. */
const levels = new Map<number, number>();
let lastTime = 0;

function targetLevel(c: Cup): number {
  if (c.dead || (c.showTen > 0 && c.value === 0)) return 1;
  return Math.min(1, Math.max(0, Math.abs(c.value) / FULL_AT));
}

function updateLevels(g: GameState): void {
  const dt = Math.min(0.1, Math.max(0, g.time - lastTime));
  lastTime = g.time;
  for (const id of [...levels.keys()]) if (!g.cups.some((c) => c.id === id)) levels.delete(id);
  for (const c of g.cups) {
    const t = targetLevel(c);
    const cur = levels.get(c.id);
    levels.set(c.id, cur === undefined ? t : cur + (t - cur) * Math.min(1, dt * 7));
  }
}

/** The outline of the cup body, with its origin at the middle of the base. Slightly rounded, wider at the top. */
function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-32, -CUP_H + 2);
  ctx.bezierCurveTo(-32, -CUP_H * 0.35, -25, -3, -13, 0);
  ctx.quadraticCurveTo(0, 5, 13, 0);
  ctx.bezierCurveTo(25, -3, 32, -CUP_H * 0.35, 32, -CUP_H + 2);
  ctx.closePath();
}

/** The part of the cup in front of the coffee: the body and the front lip, everything below the opening's front edge. */
function frontPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-32, -CUP_H + 2);
  ctx.bezierCurveTo(-32, -CUP_H * 0.35, -25, -3, -13, 0);
  ctx.quadraticCurveTo(0, 5, 13, 0);
  ctx.bezierCurveTo(25, -3, 32, -CUP_H * 0.35, 32, -CUP_H + 2);
  ctx.lineTo(OPEN_RX, OPEN_CY);
  ctx.ellipse(0, OPEN_CY, OPEN_RX, OPEN_RY, 0, 0, Math.PI, false);
  ctx.closePath();
}

/** The saucer the cup stands on, and the shadow it throws on the desk. Drawn in desk coordinates. */
function drawSaucer(ctx: CanvasRenderingContext2D, c: Cup): void {
  const x = c.x;
  const y = c.y + CUP_H / 2 - 1;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 5, 42, 11, 0, 0, TAU);
  ctx.fill();

  const rim = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
  rim.addColorStop(0, c.dead ? "#6e6a65" : "#c9c0ad");
  rim.addColorStop(0.35, c.dead ? "#a29e98" : "#f4efe4");
  rim.addColorStop(1, c.dead ? "#58544f" : "#a89f8c");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x, y, 40, 10, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();

  // The hollow in the middle of the saucer.
  ctx.fillStyle = c.dead ? "rgba(0,0,0,0.22)" : "rgba(120,100,70,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y - 0.5, 27, 6, 0, 0, TAU);
  ctx.fill();
}

/** Handle: a thick ring with a lit edge. */
function paintHandle(ctx: CanvasRenderingContext2D, c: Cup): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = c.dead ? "#5b5753" : "#b3aa97";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.5, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = c.dead ? "#8d8984" : "#f1ece1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.5, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

/** Body: shaded across like a round cup, with a bright strip of light on the left, darker towards the bottom. */
function paintBody(ctx: CanvasRenderingContext2D, c: Cup): void {
  const across = ctx.createLinearGradient(-32, 0, 32, 0);
  across.addColorStop(0, c.dead ? "#5f5b57" : "#b9b09c");
  across.addColorStop(0.2, c.dead ? "#9f9b95" : "#f6f2e8");
  across.addColorStop(0.38, c.dead ? "#a9a59f" : "#ffffff");
  across.addColorStop(0.7, c.dead ? "#7c7873" : "#ddd5c3");
  across.addColorStop(1, c.dead ? "#4c4844" : "#a39a86");
  bodyPath(ctx);
  ctx.fillStyle = across;
  ctx.fill();
  const down = ctx.createLinearGradient(0, -CUP_H, 0, 4);
  down.addColorStop(0, "rgba(0,0,0,0)");
  down.addColorStop(0.55, "rgba(0,0,0,0.04)");
  down.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = down;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(0,0,0,0.38)";
  ctx.stroke();
}

/** Rim: a ceramic ring around the opening. */
function paintRim(ctx: CanvasRenderingContext2D, c: Cup): void {
  const rim = ctx.createLinearGradient(-32, 0, 32, 0);
  rim.addColorStop(0, c.dead ? "#76726d" : "#d3cab6");
  rim.addColorStop(0.35, c.dead ? "#b3afa9" : "#ffffff");
  rim.addColorStop(1, c.dead ? "#5f5b57" : "#b5ac98");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(0, -CUP_H + 2, 32, 9, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(0,0,0,0.38)";
  ctx.stroke();
}

/**
 * The inside of the cup seen through the opening: the cream-coloured wall, and the coffee on the bottom of it.
 * An empty cup has the coffee deep down, so only a thin dark edge of it shows at the front; a full cup has it at the brim.
 */
function drawInside(ctx: CanvasRenderingContext2D, c: Cup, level: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, OPEN_CY, OPEN_RX, OPEN_RY, 0, 0, TAU);
  ctx.clip();

  // The wall inside the cup, lit from the left, with the rim casting a shadow down it.
  const wall = ctx.createLinearGradient(-OPEN_RX, 0, OPEN_RX, 0);
  wall.addColorStop(0, c.dead ? "#59554f" : "#b9b09b");
  wall.addColorStop(0.3, c.dead ? "#86827c" : "#e9e2d2");
  wall.addColorStop(1, c.dead ? "#46423e" : "#948b77");
  ctx.fillStyle = wall;
  ctx.fillRect(-OPEN_RX - 2, OPEN_CY - OPEN_RY - 2, OPEN_RX * 2 + 4, OPEN_RY * 2 + 4);
  const shade = ctx.createLinearGradient(0, OPEN_CY - OPEN_RY, 0, OPEN_CY + OPEN_RY);
  shade.addColorStop(0, "rgba(0,0,0,0.38)");
  shade.addColorStop(0.6, "rgba(0,0,0,0.08)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(-OPEN_RX - 2, OPEN_CY - OPEN_RY - 2, OPEN_RX * 2 + 4, OPEN_RY * 2 + 4);

  // The coffee: lower and a little narrower the emptier the cup is.
  const low = 1 - level;
  const rx = OPEN_RX - 5 * low;
  const ry = (OPEN_RY * rx) / OPEN_RX;
  const cy = OPEN_CY + low * COFFEE_DROP;
  const f = rx / OPEN_RX;
  const coffee = ctx.createRadialGradient(-6 * f, cy - 1, 1, 0, cy, rx);
  if (c.dead) {
    coffee.addColorStop(0, "#4a403d");
    coffee.addColorStop(1, "#231c1a");
  } else {
    coffee.addColorStop(0, "#8a5632");
    coffee.addColorStop(0.55, "#5b3418");
    coffee.addColorStop(1, "#2a140a");
  }
  ctx.fillStyle = coffee;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
  ctx.clip();
  // The far wall of the cup shades the coffee: a dark crescent along the back edge.
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath();
  ctx.ellipse(0, cy, rx + 1, ry + 1, 0, 0, TAU);
  ctx.ellipse(0, cy + 3.2, rx + 1, ry + 1, 0, 0, TAU);
  ctx.fill("evenodd");
  if (!c.dead) {
    // A ring of lighter crema close to the edge, and a soft reflection of the window.
    ctx.strokeStyle = "rgba(205,150,95,0.35)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, cy + 0.6, rx - 3.5, Math.max(0.5, ry - 2), 0, 0, TAU);
    ctx.stroke();
    const sheen = ctx.createLinearGradient(-16 * f, cy - 3, 4 * f, cy + 1);
    sheen.addColorStop(0, "rgba(255,236,205,0)");
    sheen.addColorStop(0.5, "rgba(255,236,205,0.38)");
    sheen.addColorStop(1, "rgba(255,236,205,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(-8 * f, cy - 0.5, 13 * f, 2.4, -0.18, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // A thin wet line on the wall where the coffee reaches.
  if (level < 0.97) {
    ctx.strokeStyle = "rgba(70,40,20,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }

  if (c.ripple > 0) {
    const k = 1 - c.ripple;
    ctx.strokeStyle = `rgba(255,230,190,${c.ripple * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, cy, (6 + 20 * k) * f, (1.5 + 5 * k) * f, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** Puts the origin in the middle of the cup's base, squashed a little by a number landing in it. */
function cupTransform(ctx: CanvasRenderingContext2D, c: Cup): void {
  ctx.translate(c.x, c.y + CUP_H / 2 - 1);
  ctx.scale(1 + 0.1 * c.bump, 1 - 0.1 * c.bump);
}

/** Everything behind the numbers: the saucer, the handle, the body, the rim and the inside with the coffee. */
function drawCupBack(ctx: CanvasRenderingContext2D, c: Cup): void {
  drawSaucer(ctx, c);
  ctx.save();
  cupTransform(ctx, c);
  paintHandle(ctx, c);
  paintBody(ctx, c);
  paintRim(ctx, c);
  drawInside(ctx, c, levels.get(c.id) ?? targetLevel(c));
  ctx.restore();
}

/** Everything in front of the numbers: the body and the front lip again (over a number sinking in), and the number on the cup. */
function drawCupFront(ctx: CanvasRenderingContext2D, c: Cup): void {
  ctx.save();
  cupTransform(ctx, c);

  ctx.save();
  frontPath(ctx);
  ctx.clip();
  paintBody(ctx, c);
  paintRim(ctx, c);
  ctx.restore();

  // The number stands on the cup.
  const showTen = c.showTen > 0 && c.value === 0;
  const ty = -CUP_H * 0.36;
  if (showTen) {
    text(ctx, signed(TARGET * c.tenSign), 0, ty, 26, GOLD);
  } else if (c.dead) {
    text(ctx, signed(c.value), 0, ty, 24, "#ffd0c8");
  } else {
    // A minus cup is written in red, so it can be told from a plus cup at a glance.
    const ink = c.value === 0 ? "rgba(70,48,30,0.45)" : c.value < 0 ? "#9c1d15" : "#3b2414";
    text(ctx, signed(c.value), 0, ty, 24, ink, "center", "rgba(255,250,238,0.75)");
  }

  if (c.flash > 0) {
    bodyPath(ctx);
    ctx.fillStyle = `rgba(255,255,255,${c.flash * 0.7})`;
    ctx.fill();
  }
  ctx.restore();
}

// ---- Numbers --------------------------------------------------------------------------

/** A falling number: a ball that bobs as it drifts, and leans to one side when it has been tapped. */
function drawNumber(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  const bob = n.state === "fall" ? Math.sin(time * 2.4 + n.phase) * 2 : 0;
  ctx.save();
  ctx.translate(n.x + bob, n.y);
  // A tapped number leans to one side as it hops (all the way over when it is at the top of the hop).
  if (n.state === "dive") ctx.rotate(n.tilt * TILT * Math.min(1, Math.max(0, (n.speed + DIVE_HOP) / DIVE_HOP)));
  if (n.bonus) {
    drawBonusBall(ctx, 0, 0, n.bonus, n.scale, time);
  } else if (n.ghost) {
    // A ghost number goes seen, hidden, seen: it turns over to show its back, or it turns see-through.
    const show = ghostShow(n, time);
    if (n.ghost === "fade") {
      ctx.globalAlpha = 0.1 + 0.9 * show;
      drawBall(ctx, 0, 0, n.v, n.scale, time, n.phase, n.op);
    } else {
      const turn = (1 - show) * Math.PI;
      ctx.scale(Math.max(0.04, Math.abs(Math.cos(turn))), 1);
      if (turn > Math.PI / 2) drawGhostBack(ctx, 0, 0, n.scale, time, n.phase);
      else drawBall(ctx, 0, 0, n.v, n.scale, time, n.phase, n.op);
    }
  } else {
    drawBall(ctx, 0, 0, n.v, n.scale, time, n.phase, n.op);
    if (n.ice > 0) drawIce(ctx, 0, 0, n.ice, n.scale, time, n.phase);
  }
  ctx.restore();
}

/** The chains between the numbers that are chained together (each chain once, behind the numbers). */
function drawChains(ctx: CanvasRenderingContext2D, g: GameState): void {
  for (const n of g.numbers) {
    if (n.chain === null || n.chain < n.id) continue;
    const m = g.numbers.find((o) => o.id === n.chain);
    if (m) drawChain(ctx, n.x, n.y, m.x, m.y, CHAIN_LENGTH, g.time);
  }
}

// ---- Screen furniture -----------------------------------------------------------------

/** How long (seconds) after a round ends before its buttons work, so a late tap does not skip the screen. */
export const BUTTON_DELAY = 0.8;

const MUTE: Button = {x: 310, y: 10, w: 38, h: 38};
const MENU: Button = {x: 266, y: 10, w: 38, h: 38};
const LANG: Button = {x: 10, y: 10, w: 68, h: 38};
const AGAIN: Button = {x: 70, y: 334, w: 220, h: 54};
const TO_BOOK: Button = {x: 70, y: 398, w: 220, h: 46};

function speaker(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string, muted: boolean): void {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 3.5);
  ctx.lineTo(cx - 4, cy - 3.5);
  ctx.lineTo(cx + 2, cy - 9);
  ctx.lineTo(cx + 2, cy + 9);
  ctx.lineTo(cx - 4, cy + 3.5);
  ctx.lineTo(cx - 9, cy + 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  if (muted) {
    ctx.strokeStyle = "#ff8a80";
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 5);
    ctx.lineTo(cx + 13, cy + 5);
    ctx.moveTo(cx + 13, cy - 5);
    ctx.lineTo(cx + 6, cy + 5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 5.5, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 10, -0.9, 0.9);
    ctx.stroke();
  }
}

function hamburger(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string): void {
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const dy of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + dy);
    ctx.lineTo(cx + 8, cy + dy);
    ctx.stroke();
  }
}

/** The sound button (always), and the one that leaves a round and goes back to the book (during a round). */
function drawTopButtons(ctx: CanvasRenderingContext2D, g: GameState, muted: boolean): void {
  drawButton(ctx, "mute", MUTE, "", "round", {draw: (c, cx, cy, ink) => speaker(c, cx, cy, ink, muted)});
  if (g.phase === "play") drawButton(ctx, "menu", MENU, "", "round", {draw: hamburger});
  // In the book: the language button shows the flag of the language that is on, and opens a list of them.
  if (g.phase === "menu") {
    drawButton(ctx, "lang", LANG, "", "round", {
      draw: (c, cx, cy, ink) => {
        drawFlag(c, lang(), cx - 25, cy - 10, 30, 20);
        // An arrow that points down, and up when the list is open.
        const d = ui.langOpen ? -1 : 1;
        c.fillStyle = ink;
        c.beginPath();
        c.moveTo(cx + 12, cy - 3 * d);
        c.lineTo(cx + 24, cy - 3 * d);
        c.lineTo(cx + 18, cy + 4 * d);
        c.closePath();
        c.fill();
      },
    });
    if (ui.langOpen) drawLangMenu(ctx, g);
  } else {
    ui.langOpen = false;
  }
}

const LIST = {x: 10, y: 54, w: 184, pad: 8, rowH: 42, gap: 4};

/** The list of languages that slides down from the language button: a flag and the name of each. */
function drawLangMenu(ctx: CanvasRenderingContext2D, g: GameState): void {
  const n = LANGS.length;
  const h = LIST.pad * 2 + n * LIST.rowH + (n - 1) * LIST.gap;
  const k = Math.min(1, Math.max(0, (g.time - ui.langAt) / 0.18));
  const ease = 1 - Math.pow(1 - k, 3);
  // A tap anywhere else closes it.
  registerHit(ctx, "langClose", {x: 0, y: 0, w: W, h: H});
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, LIST.y - 4, W, h * ease + 14);
  ctx.clip();
  ctx.translate(0, -(1 - ease) * (h + 8));
  drawPanel(ctx, LIST.x, LIST.y, LIST.w, h, 16);
  LANGS.forEach((l, i) => {
    const row = {x: LIST.x + LIST.pad, y: LIST.y + LIST.pad + i * (LIST.rowH + LIST.gap), w: LIST.w - LIST.pad * 2, h: LIST.rowH};
    const id = `lang:${l}`;
    registerHit(ctx, id, row);
    const current = l === lang();
    const pressed = ui.pressed === id;
    if (current || pressed) {
      ctx.fillStyle = pressed ? "rgba(255,255,255,0.16)" : "rgba(255,213,74,0.2)";
      roundRect(ctx, row.x, row.y, row.w, row.h, 12);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = current ? "rgba(255,213,74,0.8)" : "rgba(255,255,255,0.3)";
      ctx.stroke();
    }
    drawFlag(ctx, l, row.x + 10, row.y + row.h / 2 - 11, 32, 22);
    text(ctx, LANG_NAMES[l], row.x + 54, row.y + row.h / 2 + 1, 17, CHALK, "left");
    if (current) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(row.x + row.w - 26, row.y + row.h / 2);
      ctx.lineTo(row.x + row.w - 20, row.y + row.h / 2 + 6);
      ctx.lineTo(row.x + row.w - 10, row.y + row.h / 2 - 6);
      ctx.stroke();
    }
  });
  ctx.restore();
}

/** A row of dots, the first `filled` of them gold. */
function pips(ctx: CanvasRenderingContext2D, x: number, y: number, count: number, filled: number, gap = 14): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i < filled ? GOLD : "rgba(255,255,255,0.14)";
    ctx.strokeStyle = i < filled ? "#8a5208" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x + i * gap, y, 4.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

const GUIDE: Key[][] = [
  ["g0a", "g0b"],
  ["g1a", "g1b"],
  ["g2a", "g2b"],
  ["g3a", "g3b"],
];

/** The guide of the tutorial: what step it is on, what to do, and whether the last try went right. */
function drawGuide(ctx: CanvasRenderingContext2D, g: GameState): void {
  const step = Math.min(g.tutorialStep, TUTORIAL_STEPS - 1);
  drawPanel(ctx, 10, 58, 340, 90, 18);
  write(ctx, t("step", {n: step + 1, m: TUTORIAL_STEPS}), 26, 78, 12, "#cdbfa6", "left", 700);
  if (g.tutorialNote) {
    const good = g.tutorialNote === "good";
    const x = 236;
    ctx.fillStyle = good ? "#2fae5e" : "#d6483d";
    ctx.beginPath();
    ctx.roundRect(x, 66, 100, 24, 12);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = good ? "#0f5a2a" : "#6a130d";
    ctx.stroke();
    text(ctx, t(good ? "good" : "retry"), x + 50, 79, 14, "#ffffff", "center", good ? "rgba(5,60,28,0.8)" : "rgba(90,8,5,0.8)");
  } else {
    pips(ctx, 262, 78, TUTORIAL_STEPS, g.tutorialStep, 16);
  }
  GUIDE[step].forEach((line, k) => text(ctx, t(line), 26, 104 + k * 24, 17, CHALK, "left"));
}

function drawHud(ctx: CanvasRenderingContext2D, g: GameState): void {
  if (g.mode === "tutorial") {
    drawGuide(ctx, g);
    return;
  }
  // The score on a little plate.
  drawPanel(ctx, 10, 10, 136, 46, 14);
  write(ctx, t("score"), 24, 24, 11, "#cdbfa6", "left", 700);
  text(ctx, String(g.score), 24, 42, 22, CHALK, "left");
}

/** A pulsing ring that shows what to touch in the tutorial. */
function drawHints(ctx: CanvasRenderingContext2D, g: GameState): void {
  if (g.mode !== "tutorial" || g.phase !== "play" || g.tutorialNote) return;
  const k = (g.time * 1.4) % 1;
  const ring = (x: number, y: number, rx: number, ry: number) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,224,110,0.95)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,224,110,${0.8 * (1 - k)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx + k * 16, ry + k * 16, 0, 0, TAU);
    ctx.stroke();
  };
  if (g.tutorialStep <= 2) {
    for (const n of g.numbers) if (n.state === "fall" && n.y > 0) ring(n.x, n.y, 27, 27);
  } else if (g.tutorialStep === 3) {
    const dead = g.cups.find((c) => c.dead);
    if (dead) ring(dead.x, dead.y - 4, 46, 40);
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, g: GameState): void {
  if (g.banner <= 0) return;
  const k = 1 - g.banner / 1.6; // 0 -> 1
  const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
  ctx.save();
  ctx.globalAlpha = Math.min(1, g.banner / 0.5);
  ctx.translate(W / 2, 210);
  ctx.scale(pop, pop);
  const level = endlessLevel(g);
  title(ctx, t("level", {n: level}), 0, 0, 54);
  // The endless game walks through the book: say what is new on the levels where a new kind of number comes.
  const news = g.mode === "endless" ? ({2: "newMinus", 3: "newTimes", 4: "newDiv"} as Record<number, Key>)[level] : undefined;
  if (news) text(ctx, t(news), 0, 50, 19, CHALK);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** The card after a round: a ribbon on top, what happened, and the buttons. */
function drawCard(ctx: CanvasRenderingContext2D, g: GameState, time: number): void {
  const won = g.phase === "won";
  ctx.fillStyle = "rgba(8,6,14,0.62)";
  ctx.fillRect(0, 0, W, H);
  // The card pops up.
  const pop = Math.min(1, g.overTimer / 0.28);
  const ease = 1 - Math.pow(1 - pop, 3);
  ctx.save();
  ctx.translate(W / 2, 290);
  ctx.scale(0.86 + 0.14 * ease, 0.86 + 0.14 * ease);
  ctx.translate(-W / 2, -290);
  ctx.globalAlpha = ease;

  drawPanel(ctx, 30, 116, 300, 346, 24);
  if (won) drawRibbon(ctx, W / 2, 86, 210, t(g.mode === "tutorial" ? "doneTutorial" : "cleared"), "#ffe27a", "#d49a14");
  else drawRibbon(ctx, W / 2, 86, 230, t("gameOver"), "#ff8f86", "#c23b30");

  if (won) {
    // Three stars that pop in one after the other.
    for (let i = 0; i < 3; i++) {
      const t = Math.min(1, Math.max(0, (g.overTimer - 0.25 - i * 0.16) / 0.25));
      const s = t < 1 ? 1.35 - 0.35 * t : 1;
      ctx.save();
      ctx.translate(W / 2 + (i - 1) * 62, 186 - (i === 1 ? 10 : 0));
      ctx.scale(s * t, s * t);
      drawStar(ctx, 0, 0, i === 1 ? 28 : 23, true);
      ctx.restore();
    }
    const line = g.mode === "tutorial" ? t("knowBasics") : t("cupsFilled", {n: goalFor(g.mode, g.stage)});
    text(ctx, line, W / 2, g.mode === "tutorial" ? 268 : 244, g.mode === "tutorial" ? 20 : 17, CHALK);
    if (g.mode !== "tutorial") {
      write(ctx, t("score"), W / 2, 278, 12, "#cdbfa6", "center", 700);
      text(ctx, String(g.score), W / 2, 306, 36, "#ffffff");
    }
  } else {
    const why = t(g.overReason === "allDead" ? "allDead" : "deadCup");
    text(ctx, why, W / 2, 176, 17, CHALK);
    write(ctx, t("score"), W / 2, 218, 12, "#cdbfa6", "center", 700);
    text(ctx, String(g.score), W / 2, 252, 46, "#ffffff");
    if (g.mode === "endless") {
      if (g.newBest) text(ctx, t("newBest"), W / 2, 296, 22, GOLD);
      else write(ctx, t("record", {n: g.best}), W / 2, 296, 17, "#e8dcc2", "center", 600);
    } else {
      write(ctx, t("cupsDone", {n: g.level - 1, m: goalFor(g.mode, g.stage)}), W / 2, 296, 17, "#e8dcc2", "center", 600);
    }
  }

  const ready = g.overTimer > BUTTON_DELAY;
  let again = t("retry");
  if (won) {
    const next = nextGame(g.mode, g.stage);
    again = !next
      ? t("playAgain")
      : next.mode === g.mode
        ? t("nextLevel")
        : next.mode === "endless"
          ? t("toEndless")
          : t("toChapter", {n: chapterOf(next.mode)});
  }
  drawButton(ctx, "again", AGAIN, again, "primary", {alpha: ready ? 1 : 0.4, pulse: ready ? time : undefined, size: 22});
  drawButton(ctx, "toBook", TO_BOOK, t("toBook"), "secondary", {alpha: ready ? 1 : 0.4, size: 18});
  ctx.restore();
}

/**
 * The progress bar along the bottom: a segment for every cup the level needs. When a cup reaches 10 a star flies down
 * from it, and the segment it lands on pops, flashes and sparkles. (In the endless game it is five cups at a time.)
 */
function drawProgress(ctx: CanvasRenderingContext2D, g: GameState, fx: Fx): void {
  if (g.mode === "tutorial") return;
  const {x, y, w, h} = BAR;
  const lay = segmentLayout(g);
  const lit = litSegments(g, g.level - 1 - fx.pending);
  const glow = fx.pop.t;

  // A glow around the whole bar when a segment lands.
  if (glow > 0) {
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = `rgba(255,213,74,${0.07 * glow * (6 - i) / 3})`;
      ctx.beginPath();
      ctx.roundRect(x - i * 1.6, y - i * 1.6, w + i * 3.2, h + i * 3.2, h / 2 + i);
      ctx.fill();
    }
  }
  // The track.
  ctx.fillStyle = "rgba(18,12,28,0.82)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = glow > 0 ? `rgba(255,226,130,${0.4 + 0.5 * glow})` : "rgba(255,225,160,0.32)";
  ctx.stroke();
  if (g.mode === "endless") write(ctx, t("level", {n: endlessLevel(g)}), x + 14, y + h / 2 + 1, 12, CHALK, "left", 700);

  for (let i = 0; i < lay.count; i++) {
    const sx = lay.x0 + i * (lay.segW + lay.gap);
    const sy = y + 3;
    const sh = h - 6;
    const on = i < lit;
    const popping = glow > 0 && fx.pop.seg === i;
    ctx.save();
    if (popping) {
      // The segment that has just landed swells and settles back.
      ctx.translate(sx + lay.segW / 2, sy + sh / 2);
      ctx.scale(1 + 0.06 * glow, 1 + 0.7 * glow);
      ctx.translate(-(sx + lay.segW / 2), -(sy + sh / 2));
    }
    ctx.beginPath();
    ctx.roundRect(sx, sy, lay.segW, sh, sh / 2);
    if (on) {
      const gold = ctx.createLinearGradient(0, sy, 0, sy + sh);
      gold.addColorStop(0, "#fff0a0");
      gold.addColorStop(1, "#f0a914");
      ctx.fillStyle = gold;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
    }
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = on ? "#8a5208" : "rgba(255,255,255,0.22)";
    ctx.stroke();
    if (on) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.roundRect(sx + 2, sy + 1.5, lay.segW - 4, sh * 0.35, sh / 4);
      ctx.fill();
    }
    if (popping) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * glow})`;
      ctx.beginPath();
      ctx.roundRect(sx, sy, lay.segW, sh, sh / 2);
      ctx.fill();
    }
    ctx.restore();
    if (popping) {
      // A ring that spreads out from it.
      ctx.strokeStyle = `rgba(255,236,160,${glow})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx + lay.segW / 2, sy + sh / 2, 6 + (1 - glow) * 26, 0, TAU);
      ctx.stroke();
    }
  }
}

/** Slow motion: a cool blue tint over the screen, blue edges, and a bar under the score that runs down. */
function drawSlow(ctx: CanvasRenderingContext2D, g: GameState): void {
  const k = Math.min(1, g.slow / SLOW_SECONDS);
  ctx.fillStyle = "rgba(80,160,255,0.09)";
  ctx.fillRect(0, 0, W, H);
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78);
  edge.addColorStop(0, "rgba(60,150,255,0)");
  edge.addColorStop(1, "rgba(60,150,255,0.34)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  if (g.mode === "tutorial") return;
  drawPanel(ctx, 10, 62, 136, 26, 12);
  // A little hourglass, and a bar that runs down.
  ctx.strokeStyle = "#b8ecff";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(21, 68);
  ctx.lineTo(31, 68);
  ctx.lineTo(26, 75);
  ctx.lineTo(31, 82);
  ctx.lineTo(21, 82);
  ctx.lineTo(26, 75);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(ctx, 42, 70, 92, 10, 5);
  ctx.fill();
  const bar = ctx.createLinearGradient(0, 70, 0, 80);
  bar.addColorStop(0, "#b8f1ff");
  bar.addColorStop(1, "#35b7e8");
  ctx.fillStyle = bar;
  roundRect(ctx, 42, 70, Math.max(6, 92 * k), 10, 5);
  ctx.fill();
}

// ---- A whole frame --------------------------------------------------------------------

/** The room behind the game: the one of the mode being played, or, in the book, the one of the page (fading between two). */
function drawRoom(ctx: CanvasRenderingContext2D, g: GameState, rooms: Record<Room, HTMLCanvasElement>, book: Book): void {
  if (g.phase !== "menu") {
    ctx.drawImage(rooms[roomOfMode(g.mode)], 0, 0, W, H);
    return;
  }
  const i = Math.floor(book.pos);
  const f = book.pos - i;
  ctx.drawImage(rooms[roomOfPage(i)], 0, 0, W, H);
  if (f > 0.001) {
    ctx.globalAlpha = f;
    ctx.drawImage(rooms[roomOfPage(i + 1)], 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

/**
 * `rooms` are the pictures of the rooms from makeBackgrounds. The context is already scaled to game units.
 * `fade` (0 to 1) is how far the screen is faded to black between two screens.
 */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  g: GameState,
  fx: Fx,
  rooms: Record<Room, HTMLCanvasElement>,
  muted: boolean,
  book: Book,
  fade: number
): void {
  beginUi(ctx);
  ctx.globalAlpha = 1;
  drawRoom(ctx, g, rooms, book);

  if (g.phase === "menu") {
    drawBook(ctx, book, g, g.time);
  } else {
    ctx.save();
    if (g.shake > 0) ctx.translate(Math.sin(g.time * 70) * 6 * g.shake, Math.cos(g.time * 55) * 4 * g.shake);

    // The cups furthest back first, so the ones in front cover them. The front of every cup is drawn
    // after the numbers, so a number sinking into a cup disappears behind the cup's front edge.
    updateLevels(g);
    const cups = [...g.cups].sort((a, b) => a.y - b.y);
    for (const c of cups) drawCupBack(ctx, c);
    fx.drawSteam(ctx);
    drawChains(ctx, g);
    for (const n of g.numbers) drawNumber(ctx, n, g.time);
    drawHints(ctx, g);
    for (const c of cups) drawCupFront(ctx, c);
    fx.drawTop(ctx);
    ctx.restore();

    // The progress bar, and the stars flying down to it, stay still when the screen shakes.
    drawProgress(ctx, g, fx);
    fx.drawFlyers(ctx);
    if (g.phase === "play" && g.slow > 0) drawSlow(ctx, g);
    if (g.phase === "play") drawHud(ctx, g);
    drawBanner(ctx, g);
    if (g.phase === "over" || g.phase === "won") drawCard(ctx, g, g.time);
  }
  drawTopButtons(ctx, g, muted);

  if (fade > 0.001) {
    ctx.fillStyle = `rgba(10,6,16,${Math.min(1, fade)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
