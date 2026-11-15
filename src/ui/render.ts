// Draws one frame of the game, in the game's own 360 x 640 coordinates.
import {LASER_COOLDOWN} from "../game/cups";
import {cupPalette, cupPattern, drawCupBadges, drawShopCup} from "./cupArt";
import {DAILY_RUNGS, SCREEN_MAX} from "../game/constants";
import {type Package, rungGoal, rungOfCup, rungPayout, rungsDone} from "../game/daily";
import {type Geom, designOfDay, drawGift, drawLimitLine, drawSteps, halfWidth, stepX, stepY} from "./stepsArt";
import {CHAIN_LENGTH, COMBO_SECONDS, CUP_H, DIVE_HOP, H, MENU_LIFT, SWEEP_DOWN, TARGET, TUTORIAL_STEPS, W} from "../game/constants";
import {canContinue, endlessLevel, fadeOn, featureAge, ghostShow, goalFor, progressOf, starsFor, sweepBottom} from "../game/engine";
import type {Cup, Feature, GameState, NumberTile, PerkId} from "../game/types";
import {type Room, roomOfMode} from "./background";
import {drawAd} from "./ad";
import {type Book, chapterOf, drawBook, openNextGame, roomOfPage} from "./book";
import {
  type Button,
  CHALK,
  FONT,
  GOLD,
  TAU,
  beginUi,
  drawBall,
  drawBonusBall,
  drawButton,
  drawChain,
  drawCoin,
  drawGhostBack,
  drawHand,
  drawIce,
  drawPanel,
  drawRibbon,
  drawStar,
  registerHit,
  roundRect,
  signed,
  softShadow,
  text,
  title,
  ui,
  write,
} from "./draw";
import type {Fx} from "./fx";
import {GEAR_BUTTON, PAUSE_BUTTON, drawKey, drawStart, drawCups, drawEnergy, drawEnergyPill, drawGear, drawPause, drawPauseIcon, drawScores, drawSettings} from "./settings";
import {deviceId, playerName} from "./profile";
import {boards} from "./scores";
import {type Key, t} from "./i18n";
import {BAR, barFill, litSegments, segmentLayout, shownProgress} from "./progress";
import {SAUCER_COLORS, drawSaucerBadge, drawSetGlow, drawSetStars} from "./saucerArt";
import {SPECIAL_PERKS} from "../game/daily";
import {PAUSE_SECONDS, SLOW_SECONDS} from "../game/constants";

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
  if (c.dead || (c.showTen > 0 && c.value === c.tenCarry)) return 1;
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
  // Two, three or four saucers of a kind give a bonus: a glow under them (softer for two, brighter for three and four), and small stars for four.
  const same = c.saucer ? ui.saucerSet[c.saucer] ?? 0 : 0;
  const level = same >= 2 ? same - 1 : 0;
  const now = performance.now() / 1000;
  if (c.saucer && !c.dead) drawSetGlow(ctx, c.saucer, x, y, 1, level, now);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 5, 42, 11, 0, 0, TAU);
  ctx.fill();

  // (a saucer from the shop has the colour of its kind)
  const sc = c.saucer && !c.dead ? SAUCER_COLORS[c.saucer] : null;
  const rim = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
  rim.addColorStop(0, sc ? sc.dark : c.dead ? "#6e6a65" : "#c9c0ad");
  rim.addColorStop(0.35, sc ? sc.light : c.dead ? "#a29e98" : "#f4efe4");
  rim.addColorStop(1, sc ? sc.mid : c.dead ? "#58544f" : "#a89f8c");
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
  if (c.saucer && !c.dead && level >= 3) drawSetStars(ctx, x, y, 1, now);
}

function kindColors(c: Cup) {
  return c.dead ? null : cupPalette(c.kinds);
}

/** Handle: a thick ring with a lit edge. */
function paintHandle(ctx: CanvasRenderingContext2D, c: Cup): void {
  ctx.lineCap = "round";
  const kc = kindColors(c);
  ctx.strokeStyle = c.dead ? "#5b5753" : kc ? kc.handle[0] : "#b3aa97";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.5, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = c.dead ? "#8d8984" : kc ? kc.handle[1] : "#f1ece1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(31, -CUP_H * 0.5, 11, 12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

/** Body: shaded across like a round cup, with a bright strip of light on the left, darker towards the bottom. */
function paintBody(ctx: CanvasRenderingContext2D, c: Cup): void {
  const kc = kindColors(c);
  const across = ctx.createLinearGradient(-32, 0, 32, 0);
  across.addColorStop(0, c.dead ? "#5f5b57" : kc ? kc.body[0] : "#b9b09c");
  across.addColorStop(0.2, c.dead ? "#9f9b95" : kc ? kc.body[1] : "#f6f2e8");
  across.addColorStop(0.38, c.dead ? "#a9a59f" : kc ? kc.body[2] : "#ffffff");
  across.addColorStop(0.7, c.dead ? "#7c7873" : kc ? kc.body[3] : "#ddd5c3");
  across.addColorStop(1, c.dead ? "#4c4844" : kc ? kc.body[4] : "#a39a86");
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
  if (!c.dead) cupPattern(ctx, ui.look.pattern, !!kc);
}

/** Rim: a ceramic ring around the opening. */
function paintRim(ctx: CanvasRenderingContext2D, c: Cup): void {
  const kc = kindColors(c);
  const rim = ctx.createLinearGradient(-32, 0, 32, 0);
  rim.addColorStop(0, c.dead ? "#76726d" : kc ? kc.rim[0] : "#d3cab6");
  rim.addColorStop(0.35, c.dead ? "#b3afa9" : kc ? kc.rim[1] : "#ffffff");
  rim.addColorStop(1, c.dead ? "#5f5b57" : kc ? kc.rim[2] : "#b5ac98");
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
  // A cup with 0 in it is empty: no coffee at all (it fades away as the last of it goes).
  const amount = Math.min(1, level / 0.08);
  if (amount > 0.01) {
    ctx.save();
    ctx.globalAlpha = amount;
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
    ctx.restore();
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

/** How far (game units) a cup that is held is lifted off its saucer. */
const HELD_LIFT = 5;

/** Puts the origin in the middle of the cup's base, squashed a little by a number landing in it. */
function cupTransform(ctx: CanvasRenderingContext2D, c: Cup): void {
  ctx.translate(c.x, c.y + CUP_H / 2 - 1 - (ui.heldCup === c.id ? HELD_LIFT : 0));
  ctx.scale(1 + 0.1 * c.bump, 1 - 0.1 * c.bump);
}

/** Everything behind the numbers: the saucer, the handle, the body, the rim and the inside with the coffee. */
function drawCupBack(ctx: CanvasRenderingContext2D, c: Cup): void {
  if (ui.heldCup === c.id) {
    // A cup that is held: a soft golden glow on the desk round it.
    const gy = c.y + CUP_H / 2 - 18;
    const glow = ctx.createRadialGradient(c.x, gy, 8, c.x, gy, 66);
    glow.addColorStop(0, "rgba(255,213,74,0.42)");
    glow.addColorStop(0.6, "rgba(255,213,74,0.16)");
    glow.addColorStop(1, "rgba(255,213,74,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(c.x, gy, 66, 56, 0, 0, TAU);
    ctx.fill();
  }
  drawSaucer(ctx, c);
  ctx.save();
  cupTransform(ctx, c);
  paintHandle(ctx, c);
  paintBody(ctx, c);
  paintRim(ctx, c);
  drawInside(ctx, c, levels.get(c.id) ?? targetLevel(c));
  ctx.restore();
}

/** A big red X on a dead cup (drawn behind its number). */
function drawDeadX(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const r = 11;
  ctx.save();
  ctx.lineCap = "round";
  const cross = () => {
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
  };
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(40,6,4,0.85)";
  cross();
  ctx.stroke();
  const red = ctx.createLinearGradient(0, y - r, 0, y + r);
  red.addColorStop(0, "#ff7a6e");
  red.addColorStop(1, "#d22a20");
  ctx.lineWidth = 6;
  ctx.strokeStyle = red;
  cross();
  ctx.stroke();
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

  // A cup that is held and dragged has a glowing golden border (round the body and the rim).
  if (ui.heldCup === c.id) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Only the outside of the cup is outlined, in one line: down the right side, along the bottom, up the left side and over the back
    // of the rim. Nothing is drawn across the cup (not the front of the rim, and the outline is not closed across the opening).
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(32, -CUP_H + 2);
      ctx.bezierCurveTo(32, -CUP_H * 0.35, 25, -3, 13, 0);
      ctx.quadraticCurveTo(0, 5, -13, 0);
      ctx.bezierCurveTo(-25, -3, -32, -CUP_H * 0.35, -32, -CUP_H + 2);
      ctx.ellipse(0, -CUP_H + 2, 32, 9, 0, Math.PI, TAU);
    };
    // The glow, the gold line (lighter towards the top), and a thin bright line inside it.
    ctx.shadowColor = "rgba(255,213,74,0.95)";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    const gold = ctx.createLinearGradient(0, -CUP_H - 8, 0, 6);
    gold.addColorStop(0, "#fff0a8");
    gold.addColorStop(1, "#ffb81f");
    ctx.strokeStyle = gold;
    outline();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    outline();
    ctx.stroke();
    ctx.restore();
  }

  // The number stands on the cup.
  const showTen = c.showTen > 0 && c.value === c.tenCarry;
  const ty = -CUP_H * 0.36;
  if (showTen) {
    text(ctx, signed(TARGET * c.tenSign), 0, ty, 26, GOLD);
  } else if (c.dead) {
    // A dead cup: the red X behind, and in front what the cup came to (so that it can be seen how far over 10 it went, and learnt from).
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawDeadX(ctx, 0, ty);
    ctx.restore();
    if (!ui.deadBlank) text(ctx, signed(c.value), 0, ty, 26, "#ffe2dc", "center", "rgba(70,8,4,0.95)");
  } else if (c.hidden) {
    // A black number has landed here: the number is hidden behind a dark mist, so it has to be counted in the head.
    const mist = ctx.createRadialGradient(0, ty, 1, 0, ty, 17);
    mist.addColorStop(0, "rgba(25,22,32,0.92)");
    mist.addColorStop(0.65, "rgba(25,22,32,0.6)");
    mist.addColorStop(1, "rgba(25,22,32,0)");
    ctx.fillStyle = mist;
    ctx.beginPath();
    ctx.arc(0, ty, 17, 0, TAU);
    ctx.fill();
    text(ctx, "?", 0, ty, 22, "#cfc8dc", "center", "rgba(10,8,16,0.9)");
  } else {
    // A minus cup is written in red and a plus cup in green, so they can be told apart at a glance.
    const ink = c.value === 0 ? "rgba(70,48,30,0.45)" : c.value < 0 ? "#9c1d15" : "#16783a";
    text(ctx, signed(c.value), 0, ty, 24, ink, "center", "rgba(255,250,238,0.75)");
  }

  if (c.flash > 0) {
    bodyPath(ctx);
    ctx.fillStyle = `rgba(255,255,255,${c.flash * 0.7})`;
    ctx.fill();
  }
  if (c.kinds.includes("laser") && !c.dead) drawLaserCharge(ctx, c);
  // The powers of the cup, as little badges in a row under it.
  if (!c.dead) drawCupBadges(ctx, c.kinds, "game");
  if (c.shield) drawCupShield(ctx);
  ctx.restore();
}

/** The charge of a laser cup, a little bar under the cup: it fills up, and when it is full it glows and pulses (ready: double tap the cup). */
function drawLaserCharge(ctx: CanvasRenderingContext2D, c: Cup): void {
  const k = 1 - c.charge / LASER_COOLDOWN;
  const ready = c.charge <= 0;
  const pulse = 0.5 + 0.5 * Math.sin(lastTime * 6);
  ctx.save();
  ctx.translate(0, 5);
  ctx.fillStyle = "rgba(20,8,36,0.7)";
  roundRect(ctx, -22, -3, 44, 7, 3.5);
  ctx.fill();
  ctx.fillStyle = ready ? `rgba(255,${120 + Math.round(90 * pulse)},255,1)` : "#b58cff";
  roundRect(ctx, -22, -3, Math.max(5, 44 * k), 7, 3.5);
  ctx.fill();
  if (ready) {
    ctx.shadowColor = "rgba(230,140,255,0.9)";
    ctx.shadowBlur = 8 + 6 * pulse;
    ctx.strokeStyle = "rgba(255,230,255,0.9)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, -22, -3, 44, 7, 3.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** The shield on a cup: a see-through blue bubble round it with a soft pulse and a white glint (drawn in the cup's own coordinates). */
function drawCupShield(ctx: CanvasRenderingContext2D): void {
  const cy = -CUP_H * 0.55;
  const pulse = 0.5 + 0.5 * Math.sin(lastTime * 3);
  const fill = ctx.createRadialGradient(0, cy, 14, 0, cy, 48);
  fill.addColorStop(0, "rgba(140,190,255,0.04)");
  fill.addColorStop(0.75, "rgba(120,170,255,0.16)");
  fill.addColorStop(1, `rgba(170,215,255,${0.38 + 0.2 * pulse})`);
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, cy, 47, 45, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(200,230,255,${0.7 + 0.3 * pulse})`;
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(0, cy, 38, Math.PI * 1.12, Math.PI * 1.38);
  ctx.stroke();
  ctx.restore();
}

// ---- Numbers --------------------------------------------------------------------------

/** How much bigger the falling numbers are drawn than the balls of the book and the presentations (all kinds of them: plain, ghost, ice, steel and bonus balls). */
const NUMBER_SIZE = 1.265 * 1.05 * 1.02; // (5%, and then 2%, bigger than it was)

/** A falling number: a ball that bobs as it drifts, and leans to one side when it has been tapped. */
function drawNumber(ctx: CanvasRenderingContext2D, n: NumberTile, time: number): void {
  const bob = n.state === "fall" ? Math.sin(time * 2.4 + n.phase) * 2 : 0;
  ctx.save();
  ctx.translate(n.x + bob, n.y);
  ctx.scale(NUMBER_SIZE, NUMBER_SIZE);
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
    // (a chain that hangs straight down, between two numbers in one column, is drawn taut)
    if (m) drawChain(ctx, n.x, n.y, m.x, m.y, Math.abs(n.x - m.x) < 6 ? Math.hypot(n.x - m.x, n.y - m.y) : CHAIN_LENGTH, g.time);
  }
  // The second link of a chain of three (from the middle number to the last one).
  for (const n of g.numbers) {
    if (n.chain2 === null) continue;
    const m = g.numbers.find((o) => o.id === n.chain2);
    if (m) drawChain(ctx, n.x, n.y, m.x, m.y, CHAIN_LENGTH, g.time);
  }
}

// ---- Screen furniture -----------------------------------------------------------------

/** How long (seconds) after a round ends before its buttons work, so a late tap does not skip the screen. */
export const BUTTON_DELAY = 0.8;

const AGAIN: Button = {x: 70, y: 334, w: 220, h: 54};
const TO_BOOK: Button = {x: 70, y: 398, w: 220, h: 46};
/** How much lower the buttons are on the card when it has a pull-down screen to show. */
const REWARD_ROOM = 64;
/** The extra button of a lost round (carry on after an ad): its place, and how much taller the card gets. */
const CONTINUE: Button = {x: 60, y: 334, w: 240, h: 54};
const CONTINUE_ROOM = 62;
const INTRO_OK: Button = {x: 70, y: 452, w: 220, h: 50};
const INTRO_NEVER: Button = {x: 70, y: 510, w: 220, h: 36};


/** The sound button (always), and the one that leaves a round and goes back to the book (during a round). */
function drawTopButtons(ctx: CanvasRenderingContext2D, g: GameState): void {
  // In a round the pause button is in the corner (with Resume, the sound and Quit); everywhere else it is the gear that opens the settings.
  if (g.phase === "play") drawButton(ctx, "pause", PAUSE_BUTTON, "", "round", {draw: drawPauseIcon});
  else drawButton(ctx, "settings", GEAR_BUTTON, "", "round", {draw: drawGear});
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
  // The score: just the number (no plate and no label).
  text(ctx, String(g.score), 24, 33, 26, CHALK, "left");
  // The combo: how many perfect 10s in a row, and a bar that runs down (the time left to make the next one).
  if (g.combo >= 1 && g.comboTimer > 0) {
    const k = g.comboTimer / COMBO_SECONDS;
    const hot = g.combo >= 2;
    drawPanel(ctx, 152, 10, 104, 46, 14);
    write(ctx, t("combo"), 164, 24, 11, hot ? "#ffd98a" : "#cdbfa6", "left", 700);
    text(ctx, `\u00D7${g.combo}`, 164, 42, hot ? 22 + Math.min(8, g.combo * 2) : 20, hot ? GOLD : CHALK, "left");
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, 204, 36, 44, 8, 4);
    ctx.fill();
    ctx.fillStyle = k > 0.35 ? "#ffd54a" : "#ff8a4a";
    roundRect(ctx, 204, 36, Math.max(6, 44 * k), 8, 4);
    ctx.fill();
  }
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
    for (const n of g.numbers) if (n.state === "fall" && n.y > -g.extra) ring(n.x, n.y, 27 * NUMBER_SIZE, 27 * NUMBER_SIZE);
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
  title(ctx, g.daily ? t("dailyRung", {n: level}) : t("level", {n: level}), 0, 0, 54);
  // The endless game walks through the book: say what is new on the levels where a new kind of number comes.
  const news = g.mode === "endless" && !g.variant ? ({2: "newMinus", 3: "newTimes", 4: "newDiv"} as Record<number, Key>)[level] : undefined;
  if (news) text(ctx, t(news), 0, 50, 19, CHALK);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * The prize on the card of a level that was cleared with three stars: the ring of the pull-down screen with its number on it
 * (how many there are now) that pops in after the stars, with a glow that pulses round it, and a line that says what it is.
 */
function drawScreenReward(ctx: CanvasRenderingContext2D, g: GameState, y: number): void {
  const u = Math.min(1, Math.max(0, (g.overTimer - 1.0) / 0.45));
  if (u <= 0) return;
  // It overshoots a little, then settles.
  const pop = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
  ctx.save();
  ctx.globalAlpha = Math.min(1, u * 2);
  ctx.translate(W / 2, y);
  ctx.scale(pop, pop);
  const pulse = 0.5 + 0.5 * Math.sin(g.overTimer * 5);
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 90);
  glow.addColorStop(0, `rgba(255,226,120,${0.3 + 0.2 * pulse})`);
  glow.addColorStop(1, "rgba(255,226,120,0)");
  ctx.fillStyle = glow;
  // (squeezed to an ellipse that is about 50 high: the light has faded out completely where it ends, so there is no straight edge)
  ctx.save();
  ctx.scale(1, 0.55);
  ctx.fillRect(-100, -91, 200, 182);
  ctx.restore();
  drawScreenRing(ctx, 0, -6, g.screens, 21);
  write(ctx, t("screenEarnedNote"), 0, 28, 12, "#e8dcc2", "center", 600);
  ctx.restore();
}

/** The coins that were got in the round, to the right of the score on the card. */
function drawCardCoins(ctx: CanvasRenderingContext2D, y: number): void {
  if (ui.lastCoins <= 0) return;
  drawCoin(ctx, 272, y, 8.5);
  text(ctx, `+${ui.lastCoins}`, 285, y + 1, 19, GOLD, "left");
}

/** The card after a round: a ribbon on top, what happened, and the buttons. */
function drawCard(ctx: CanvasRenderingContext2D, g: GameState, time: number, book: Book): void {
  const won = g.phase === "won";
  ctx.fillStyle = "rgba(8,6,14,0.62)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  // The card pops up.
  const pop = Math.min(1, g.overTimer / 0.28);
  const ease = 1 - Math.pow(1 - pop, 3);
  ctx.save();
  ctx.translate(W / 2, 290);
  ctx.scale(0.86 + 0.14 * ease, 0.86 + 0.14 * ease);
  ctx.translate(-W / 2, -290);
  ctx.globalAlpha = ease;

  const reward = won && g.screenWon;
  // A lost round can be carried on after an ad: one more button above the others.
  const carryOn = !won && canContinue(g);
  // (a try of the daily challenge that did not climb the whole ladder can be tried again, as many times as you like, each for a video, when it cannot be carried on)
  const retryNew = !won && g.daily && ui.dailyRetry && !carryOn;
  const room = reward ? REWARD_ROOM : carryOn || retryNew ? CONTINUE_ROOM : 0;
  drawPanel(ctx, 30, 116, 300, 346 + room, 24);
  if (won) drawRibbon(ctx, W / 2, 86, 210, t(g.mode === "tutorial" ? "doneTutorial" : "cleared"), "#ffe27a", "#d49a14");
  else drawRibbon(ctx, W / 2, 86, 230, t("gameOver"), "#ff8f86", "#c23b30");

  if (won) {
    // Three stars that pop in one after the other: the ones the points are worth are gold, the rest are dark.
    const stars = g.mode === "tutorial" || g.daily ? 3 : starsFor(g.mode, g.stage, g.score);
    for (let i = 0; i < 3; i++) {
      const t = Math.min(1, Math.max(0, (g.overTimer - 0.25 - i * 0.16) / 0.25));
      const s = t < 1 ? 1.35 - 0.35 * t : 1;
      ctx.save();
      ctx.translate(W / 2 + (i - 1) * 62, 186 - (i === 1 ? 10 : 0));
      ctx.scale(s * t, s * t);
      drawStar(ctx, 0, 0, i === 1 ? 28 : 23, i < stars, true, true);
      ctx.restore();
    }
    const line = g.mode === "tutorial" ? t("knowBasics") : g.daily ? t("dailyCleared") : t("cupsFilled", {n: goalFor(g.mode, g.stage)});
    text(ctx, line, W / 2, g.mode === "tutorial" ? 268 : 244, g.mode === "tutorial" ? 20 : 17, CHALK);
    if (g.mode !== "tutorial") {
      write(ctx, t("score"), W / 2, 278, 12, "#cdbfa6", "center", 700);
      text(ctx, String(g.score), W / 2, 306, 36, "#ffffff");
      drawCardCoins(ctx, 306);
    }
  } else {
    const why = t(g.overReason === "allDead" ? "allDead" : "deadCup");
    text(ctx, why, W / 2, 176, 17, CHALK);
    write(ctx, t("score"), W / 2, 218, 12, "#cdbfa6", "center", 700);
    text(ctx, String(g.score), W / 2, 252, 46, "#ffffff");
    drawCardCoins(ctx, 252);
    if (g.daily) {
      write(ctx, t("dailyToday", {n: rungsDone(g.level - 1), m: DAILY_RUNGS}), W / 2, 296, 17, "#e8dcc2", "center", 600);
    } else if (g.mode === "endless") {
      if (g.newBest) text(ctx, t("newBest"), W / 2, 296, 22, GOLD);
      else write(ctx, t("record", {n: g.best}), W / 2, 296, 17, "#e8dcc2", "center", 600);
    } else {
      write(ctx, t("cupsDone", {n: Math.floor(progressOf(g) + 1e-9), m: goalFor(g.mode, g.stage)}), W / 2, 296, 17, "#e8dcc2", "center", 600);
    }
  }

  const ready = g.overTimer > BUTTON_DELAY;
  let again = t("retry");
  if (won) {
    // (the next chapter is shut until 24 of the stars of this one have been got: then the level is played again)
    const next = openNextGame(book, g.mode, g.stage);
    again = !next
      ? t("playAgain")
      : next.mode === g.mode
        ? t("nextLevel", {n: next.stage})
        : next.mode === "endless"
          ? t("toEndless")
          : t("toChapter", {n: chapterOf(next.mode)});
  }
  if (reward) drawScreenReward(ctx, g, 346);
  if (retryNew) drawButton(ctx, "daily:retry", {...CONTINUE, y: AGAIN.y}, ui.premium ? t("dailyRetryFree") : t("dailyRetry"), "green", {alpha: ready ? 1 : 0.4, pulse: ready ? time : undefined, size: 17, ad: !ui.premium});
  if (carryOn) drawButton(ctx, "continueAd", {...CONTINUE, y: AGAIN.y}, ui.premium ? t("continueFree") : t("continueAd"), "green", {alpha: ready ? 1 : 0.4, pulse: ready ? time : undefined, size: 17, ad: !ui.premium});
  if (g.daily) {
    // (the daily challenge is tried again with the button above, for a video: there is no ordinary "play again")
    drawButton(ctx, "toBook", {...AGAIN, y: AGAIN.y + room}, t("toBook"), "primary", {alpha: ready ? 1 : 0.4, pulse: ready && !carryOn ? time : undefined, size: 22});
  } else {
    drawButton(ctx, "again", {...AGAIN, y: AGAIN.y + room}, again, "primary", {alpha: ready ? 1 : 0.4, pulse: ready && !carryOn ? time : undefined, size: 22});
    drawButton(ctx, "toBook", {...TO_BOOK, y: TO_BOOK.y + room}, t("toBook"), "secondary", {alpha: ready ? 1 : 0.4, size: 18});
  }
  ctx.restore();
}

// ---- The perks of the daily challenge -------------------------------------------------

const PERK_TEXT: Record<PerkId, {name: Key; lines: Key[]}> = {
  slow: {name: "perkSlow", lines: ["perkSlowD"]},
  shield: {name: "perkShield", lines: ["perkShieldD"]},
  cloth: {name: "perkCloth", lines: ["perkClothD"]},
  life: {name: "perkLife", lines: ["perkLifeD"]},
  remove: {name: "perkRemove", lines: ["perkRemoveD"]},
  bonus: {name: "perkBonus", lines: ["perkBonusD"]},
  help: {name: "perkHelp", lines: ["perkHelpD"]},
  gold: {name: "cupGold", lines: ["cupGoldA", "cupGoldB"]},
  thermos: {name: "cupThermos", lines: ["cupThermosA", "cupThermosB"]},
  magnet: {name: "cupMagnet", lines: ["cupMagnetA", "cupMagnetB"]},
  big: {name: "cupBig", lines: ["cupBigA", "cupBigB"]},
  laser: {name: "cupLaser", lines: ["cupLaserA", "cupLaserB"]},
  sparse: {name: "perkSparse", lines: ["perkSparseD"]},
  special: {name: "perkSpecial", lines: ["perkSpecialD"]},
  points: {name: "perkPoints", lines: ["perkPointsD"]},
};

/** Breaks a text into lines that are at most `maxW` wide (in the font that is set). */
function wrapLines(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** The picture of a perk: a ball for the ones that are like the bonus balls, and a cup for the ones that give a cup a property. */
function drawPerkIcon(ctx: CanvasRenderingContext2D, perk: PerkId, x: number, y: number, time: number): void {
  if (perk === "slow" || perk === "shield" || perk === "cloth" || perk === "life") drawBonusBall(ctx, x, y, perk, 1.35, time);
  else if (perk === "bonus") drawBonusBall(ctx, x, y, "points", 1.35, time);
  else if (perk === "help") drawBall(ctx, x, y, 10, 1.3, time, 0, "ten");
  else if (perk === "sparse" || perk === "special" || perk === "points") drawSaucerBadge(ctx, perk, x, y, 28);
  else if (perk === "remove") {
    // A grey cup with a red cross over it.
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawShopCup(ctx, [], x, y + 28, 0.7);
    ctx.restore();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(60,0,0,0.6)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x - 17, y - 17);
    ctx.lineTo(x + 17, y + 17);
    ctx.moveTo(x + 17, y - 17);
    ctx.lineTo(x - 17, y + 17);
    ctx.stroke();
    ctx.strokeStyle = "#ff4d3d";
    ctx.lineWidth = 5.5;
    ctx.stroke();
  } else drawShopCup(ctx, [perk], x, y + 28, 0.7);
}

/** Where the steps stand in the picture that comes after every rung. */
const MOMENT: Geom = {cx: W / 2, y0: 480, step: 52};

/** How long the picture of the way up is shown after a rung, before the perks fade in (and when the perks can be pressed). */
const LADDER_SHOWN = 1.7;
const PERK_READY = 2.0;

/**
 * The way up, in the middle of the screen after every rung (in the shape of the day: a ladder, a pyramid or a mountain): the steps that are
 * climbed are gold, and a marker climbs up to the step that was just done, with a ring of light and sparkles when it gets there, so that it
 * is easy to see how far there is left to go. `t0` is the seconds since the rung was done.
 */
function drawLadderMoment(ctx: CanvasRenderingContext2D, rung: number, t0: number, time: number): void {
  const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const design = designOfDay(ui.streakDay);
  const climb = ease((t0 - 0.3) / 0.8);
  const arrived = t0 >= 1.1;
  drawSteps(ctx, design, MOMENT, (i) => i < rung - 1 || (i === rung - 1 && arrived));
  drawLimitLine(ctx, MOMENT, 46, 314, t("goalLine"), "#ff6a5c");
  const half = halfWidth(design);
  for (let i = 0; i < DAILY_RUNGS; i++) {
    const y = stepY(MOMENT, i);
    const done = i < rung - 1 || (i === rung - 1 && arrived);
    const last = i === DAILY_RUNGS - 1;
    write(ctx, t("dailyRung", {n: i + 1}), MOMENT.cx - half - 8, y - 4, 14, done ? "#ffe27a" : "#e8dcc2", "right", 700);
    write(ctx, t("dailyCups", {n: rungGoal(i + 1)}), MOMENT.cx - half - 8, y + 9, 10.5, "#b5a78d", "right", 600);
    const amount = rungPayout(i, ui.streakDay);
    ctx.font = `700 14px ${FONT}`;
    const pw = ctx.measureText(String(amount)).width + 34;
    const px = MOMENT.cx + half + 8;
    ctx.fillStyle = done ? "rgba(255,213,74,0.35)" : "rgba(255,255,255,0.1)";
    roundRect(ctx, px, y - 11, pw, 22, 11);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = done || last ? "rgba(255,213,74,0.8)" : "rgba(255,255,255,0.25)";
    ctx.stroke();
    drawCoin(ctx, px + 13, y, 7.5);
    write(ctx, String(amount), px + 25, y + 1, 14, done || last ? "#ffe27a" : "#e8dcc2", "left", 700);
  }
  // The marker: a gold ball with the number of the rung, climbing from the step before (or from under the first one).
  const to = {x: stepX(design, MOMENT, rung - 1), y: stepY(MOMENT, rung - 1)};
  const from = rung <= 1 ? {x: stepX(design, MOMENT, 0), y: stepY(MOMENT, 0) + MOMENT.step * 0.9} : {x: stepX(design, MOMENT, rung - 2), y: stepY(MOMENT, rung - 2)};
  const mx = from.x + (to.x - from.x) * climb;
  const my = from.y + (to.y - from.y) * climb;
  if (arrived) {
    // A ring of light that spreads, and sparkles that fly out of the step.
    const e = Math.min(1, (t0 - 1.1) / 0.6);
    ctx.save();
    ctx.lineWidth = 3 * (1 - e) + 0.5;
    ctx.strokeStyle = `rgba(255,226,122,${0.9 * (1 - e)})`;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 16 + ease(e) * 46, 0, TAU);
    ctx.stroke();
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10 + 0.3;
      const d = 18 + ease(e) * (34 + (k % 3) * 12);
      ctx.fillStyle = `rgba(255,240,170,${1 - e})`;
      ctx.beginPath();
      ctx.arc(to.x + Math.cos(a) * d, to.y + Math.sin(a) * d, 3 * (1 - e) + 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  const pulse = arrived ? 1 + 0.08 * Math.sin((t0 - 1.1) * 10) * Math.max(0, 1 - (t0 - 1.1) / 0.8) : 1;
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(pulse, pulse);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  glow.addColorStop(0, "rgba(255,226,122,0.55)");
  glow.addColorStop(1, "rgba(255,226,122,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, TAU);
  ctx.fill();
  const ball = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
  ball.addColorStop(0, "#fff3a8");
  ball.addColorStop(0.5, "#ffd23a");
  ball.addColorStop(1, "#d98a0a");
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#8a5208";
  ctx.stroke();
  text(ctx, String(rung), 0, 1, 18, "#ffffff", "center", "rgba(110,60,0,0.9)");
  ctx.restore();
  void time;
}

const PACKAGE_CUP_NAME: Record<string, Key> = {gold: "cupGold", thermos: "cupThermos", magnet: "cupMagnet", big: "cupBig", laser: "cupLaser"};

/** What a package held, as a line of text. */
function packageText(item: Package): string {
  if (item.kind === "coins") return t("pkgCoins", {n: item.n});
  if (item.kind === "cloth") return t("pkgCloth", {n: item.n});
  if (item.kind === "energy") return t("pkgEnergy", {n: item.n});
  return t("pkgCup", {name: t(PACKAGE_CUP_NAME[item.cup])});
}

/** The package of the seventh day: the box shakes, the lid flies open in a burst of light, and what was in it rises out of it. */
function drawPackage(ctx: CanvasRenderingContext2D, time: number): void {
  const item = ui.packageOpen;
  if (!item) return;
  const a = ui.packageAge;
  const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  ctx.fillStyle = "rgba(8,6,14,0.82)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  registerHit(ctx, "packagePanel", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
  drawPanel(ctx, 40, 120, 280, 400, 24);
  drawRibbon(ctx, W / 2, 98, 220, t("pkgTitle"), "#ffe27a", "#d49a14");
  const open = ease((a - 0.9) / 0.35);
  // The box shakes before it opens.
  const shake = a < 0.9 ? Math.sin(a * 38) * 0.07 * Math.min(1, a / 0.3) : 0;
  const bx = W / 2;
  const by = 400;
  if (open > 0) {
    // A burst of light from the box.
    ctx.save();
    ctx.translate(bx, by - 30);
    ctx.rotate(time * 0.6);
    const reach = 130 * open;
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, reach);
    glow.addColorStop(0, "rgba(255,236,150,0.8)");
    glow.addColorStop(1, "rgba(255,200,60,0)");
    ctx.fillStyle = glow;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-9, -reach);
      ctx.lineTo(9, -reach);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(shake);
  ctx.translate(-bx, -by);
  drawGift(ctx, bx, by, 2.6, open);
  ctx.restore();
  // What was in it, rising out of the box.
  if (a > 1.0) {
    const u = ease((a - 1.0) / 0.5);
    const iy = by - 30 - u * 165 + Math.sin(time * 3) * 3;
    ctx.save();
    ctx.globalAlpha = u;
    ctx.translate(bx, iy);
    ctx.scale(0.5 + 0.5 * u, 0.5 + 0.5 * u);
    if (item.kind === "coins") drawCoin(ctx, 0, 0, 28);
    else if (item.kind === "cloth") drawBonusBall(ctx, 0, 0, "cloth", 2.1, time);
    else if (item.kind === "energy") drawKey(ctx, 0, 0, 58, true);
    else drawShopCup(ctx, [item.cup], 0, 40, 1.3);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = ease((a - 1.3) / 0.4);
    write(ctx, t("pkgGot"), W / 2, 268, 15, "#e8dcc2", "center", 700);
    write(ctx, packageText(item), W / 2, 294, 20, "#ffe27a", "center", 700);
    ctx.restore();
  }
  if (a > 1.8) drawButton(ctx, "package:close", {x: W / 2 - 90, y: 452, w: 180, h: 50}, t("done"), "primary", {pulse: time, size: 22});
}

/** After every rung of the ladder: the ladder with where you have got to, and then three perks to choose between (the round waits). */
function drawPerk(ctx: CanvasRenderingContext2D, g: GameState, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.72)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  const pop = Math.min(1, g.overTimer / 0.28);
  const ease = 1 - Math.pow(1 - pop, 3);
  ctx.save();
  ctx.translate(W / 2, 300);
  ctx.scale(0.88 + 0.12 * ease, 0.88 + 0.12 * ease);
  ctx.translate(-W / 2, -300);
  ctx.globalAlpha = ease;
  drawPanel(ctx, 24, 96, 312, 436, 24);
  // First the ladder (where you are, and how far there is to go), which then fades out as the perks fade in.
  const ladderA = g.overTimer < LADDER_SHOWN ? 1 : Math.max(0, 1 - (g.overTimer - LADDER_SHOWN) / 0.25);
  const perksA = Math.min(1, Math.max(0, (g.overTimer - LADDER_SHOWN - 0.1) / 0.25));
  if (ladderA > 0) {
    const rung = Math.max(1, rungsDone(g.level - 1));
    ctx.save();
    ctx.globalAlpha = ease * ladderA;
    drawRibbon(ctx, W / 2, 66, 250, t("dailyRung", {n: rung}), "#ffe27a", "#d49a14");
    write(ctx, t("dailyToday", {n: rung, m: DAILY_RUNGS}), W / 2, 142, 15, "#e8dcc2", "center", 700);
    drawLadderMoment(ctx, rung, g.overTimer, time);
    ctx.restore();
  }
  if (perksA <= 0) {
    ctx.restore();
    return;
  }
  ctx.globalAlpha = ease * perksA;
  drawRibbon(ctx, W / 2, 66, 250, t("perkTitle"), "#ffe27a", "#d49a14");
  write(ctx, t("perkSub"), W / 2, 142, 14, "#e8dcc2", "center", 600);
  const ready = g.overTimer > PERK_READY;
  g.perkChoices.forEach((perk, i) => {
    const b: Button = {x: 42, y: 160 + i * 118, w: 276, h: 106};
    if (ready) registerHit(ctx, `perk:${i}`, b);
    const pressed = ui.pressed === `perk:${i}` ? 2 : 0;
    drawPanel(ctx, b.x, b.y + pressed, b.w, b.h, 16, "card");
    // (a special perk, with a bit of luck: a golden edge and a little "LUCKY!")
    const lucky = SPECIAL_PERKS.includes(perk);
    if (lucky) {
      ctx.save();
      ctx.shadowColor = "#ffd54a";
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "#ffd54a";
      ctx.lineWidth = 3;
      roundRect(ctx, b.x, b.y + pressed, b.w, b.h, 16);
      ctx.stroke();
      ctx.restore();
      write(ctx, t("perkLuckyTag"), b.x + 92, b.y + 11 + pressed, 10.5, "#ffd54a", "left", 800);
    }
    drawPerkIcon(ctx, perk, b.x + 48, b.y + 50 + pressed, time);
    const txt = PERK_TEXT[perk];
    write(ctx, t(txt.name), b.x + 92, b.y + 28 + pressed, 19, "#ffffff", "left", 700);
    // (x2 or x3: it is taken that many times)
    const times = g.perkTimes[i] ?? 1;
    if (times > 1) text(ctx, `×${times}`, b.x + b.w - 16, b.y + 26 + pressed, 26, "#ffd54a", "right", "#4a2a05");
    ctx.font = `600 13px ${FONT}`;
    const lines = wrapLines(ctx, txt.lines.map((k) => t(k)).join(" "), b.w - 92 - 12);
    lines.slice(0, 3).forEach((line, k) => write(ctx, line, b.x + 92, b.y + 54 + k * 17 + pressed, 13, "#e8dcc2", "left", 600));
  });
  ctx.restore();
}

// ---- Presenting a new kind of number --------------------------------------------------

/** The words of each new kind of number: its name and what it does. */
const FEATURE_TEXT: Record<Feature, {title: Key; body: Key}> = {
  screen: {title: "fScreenT", body: "fScreenD"},
  cup3: {title: "fCup3T", body: "fCup3D"},
  cups: {title: "fCupsT", body: "fCupsD"},
  zero: {title: "fZeroT", body: "fZeroD"},
  ten: {title: "fTenT", body: "fTenD"},
  fog: {title: "fFogT", body: "fFogD"},
  star: {title: "fStarT", body: "fStarD"},
  steel: {title: "fSteelT", body: "fSteelD"},
  chain3: {title: "fChain3T", body: "fChain3D"},
  vchain: {title: "fVchainT", body: "fVchainD"},
  fade: {title: "fFadeT", body: "fFadeD"},
  points: {title: "fPointsT", body: "fPointsD"},
  life: {title: "fLifeT", body: "fLifeD"},
  slow: {title: "fSlowT", body: "fSlowD"},
  pause: {title: "fPauseT", body: "fPauseD"},
  bomb: {title: "fBombT", body: "fBombD"},
  cloth: {title: "fClothT", body: "fClothD"},
  shield: {title: "fShieldT", body: "fShieldD"},
  chain: {title: "fChainT", body: "fChainD"},
  ice: {title: "fIceT", body: "fIceD"},
  ghost: {title: "fGhostT", body: "fGhostD"},
  diamond: {title: "fDiamondT", body: "fDiamondD"},
};

/** A number to show in the presentation (not part of the game). */
function demoTile(v: number, extra: Partial<NumberTile> = {}): NumberTile {
  return {
    id: 0,
    col: 0,
    x: 0,
    y: 0,
    prevY: 0,
    v,
    op: "add",
    bonus: null,
    chain: null,
    chain2: null,
    ghost: null,
    ice: 0,
    state: "fall",
    target: null,
    aim: 0,
    speed: 0,
    hang: null,
    tilt: 0,
    phase: 0,
    scale: 1,
    done: false,
    ...extra,
  };
}

/**
 * The hand of the tutorial, over everything: it taps the numbers that are to be tapped, and drags the dead cup aside
 * (with an arrow that shows which way).
 */
function drawTutorialHand(ctx: CanvasRenderingContext2D, g: GameState): void {
  if (g.mode !== "tutorial" || g.phase !== "play" || g.tutorialNote) return;
  if (g.tutorialStep <= 2) {
    // A tap now and then: the hand comes up under the number, presses, and lets go.
    const u = (g.time * 1.1) % 1;
    const press = u < 0.25 ? u / 0.25 : u < 0.5 ? 1 : Math.max(0, 1 - (u - 0.5) / 0.25);
    for (const n of g.numbers) {
      if (n.state !== "fall" || n.y <= 0) continue;
      drawHand(ctx, n.x + 3, n.y + 6 + (1 - press) * 16, press, 0.95);
    }
  } else if (g.tutorialStep === 3) {
    const dead = g.cups.find((c) => c.dead);
    if (!dead) return;
    // The hand takes hold of the cup, pulls it one place to the side, lets go, and starts over.
    const dir = dead.x < W / 2 ? 1 : -1;
    const dist = 90 * dir;
    const u = (g.time * 0.5) % 1;
    const hold = u < 0.15 ? u / 0.15 : u < 0.8 ? 1 : Math.max(0, 1 - (u - 0.8) / 0.1);
    const move = u < 0.2 ? 0 : u < 0.75 ? (1 - Math.cos(((u - 0.2) / 0.55) * Math.PI)) / 2 : 1;
    const y = dead.y - 18;
    // An arrow along the way.
    ctx.save();
    ctx.globalAlpha = 0.85 * (u > 0.88 ? 1 - (u - 0.88) / 0.12 : 1);
    ctx.strokeStyle = "rgba(255,236,150,0.95)";
    ctx.fillStyle = "rgba(255,236,150,0.95)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.setLineDash([2, 9]);
    ctx.beginPath();
    ctx.moveTo(dead.x, y - 48);
    ctx.lineTo(dead.x + dist - dir * 14, y - 48);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dead.x + dist, y - 48);
    ctx.lineTo(dead.x + dist - dir * 15, y - 57);
    ctx.lineTo(dead.x + dist - dir * 15, y - 39);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
    drawHand(ctx, dead.x + dist * move, y + (1 - hold) * 14, hold, 1);
    ctx.restore();
  }
}

// ---- The pull-down screen -------------------------------------------------------------

/** The cloth of the screen with a roller above it and a bar under it (x, y is the upper left corner of the cloth). */
function drawScreenCloth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cloth = ctx.createLinearGradient(0, y, 0, y + h);
  cloth.addColorStop(0, "#f6f1e3");
  cloth.addColorStop(1, "#e4dcc6");
  ctx.fillStyle = cloth;
  ctx.fillRect(x, y, w, h);
  // A fine weave in the cloth, and a soft light from the projector.
  ctx.strokeStyle = "rgba(120,100,70,0.07)";
  ctx.lineWidth = 1;
  for (let wy = y + 6; wy < y + h; wy += 6) {
    ctx.beginPath();
    ctx.moveTo(x, wy);
    ctx.lineTo(x + w, wy);
    ctx.stroke();
  }
  const light = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 4, x + w / 2, y + h * 0.4, w * 0.7);
  light.addColorStop(0, "rgba(255,255,240,0.5)");
  light.addColorStop(1, "rgba(255,255,240,0)");
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, h);
  // The shadow under the roller.
  const shade = ctx.createLinearGradient(0, y, 0, y + 14);
  shade.addColorStop(0, "rgba(0,0,0,0.28)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, 14);
  // The roller (a dark metal tube) above, and the bar under, with a cord that hangs from it.
  const tube = ctx.createLinearGradient(0, y - 12, 0, y);
  tube.addColorStop(0, "#5c6470");
  tube.addColorStop(0.5, "#a9b0ba");
  tube.addColorStop(1, "#4a515c");
  ctx.fillStyle = tube;
  ctx.fillRect(x - 5, y - 12, w + 10, 12);
  const bar = ctx.createLinearGradient(0, y + h, 0, y + h + 8);
  bar.addColorStop(0, "#8a6a44");
  bar.addColorStop(1, "#4d3822");
  ctx.fillStyle = bar;
  ctx.fillRect(x - 2, y + h, w + 4, 8);
  ctx.strokeStyle = "#3a2c1c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + h + 8);
  ctx.lineTo(x + w / 2, y + h + 20);
  ctx.stroke();
  ctx.fillStyle = "#d9b36c";
  ctx.strokeStyle = "#6a4a18";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h + 25, 5, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** The screen as it comes down over the numbers (and rolls up again), over everything that is in the air. */
function drawSweep(ctx: CanvasRenderingContext2D, g: GameState): void {
  const edge = sweepBottom(g);
  if (edge <= 1 - g.extra) return;
  drawScreenCloth(ctx, 10, -g.extra, W - 20, edge + g.extra);
}

/** The gold ring with the number of screens on it (the handle of the cord, and the prize on the card). */
function drawScreenRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, count: number, r = 15): void {
  const k = r / 15;
  const ring = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  ring.addColorStop(0, "#f1cf86");
  ring.addColorStop(1, "#a97a2c");
  softShadow(ctx, cx - r, cy - r + 1, r * 2, r * 2, r, 4, 0.35);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#5e4010";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx - 4 * k, cy - 6 * k, 6 * k, 3 * k, -0.5, 0, TAU);
  ctx.fill();
  text(ctx, String(count), cx, cy + 1, Math.round(17 * k), "#fff6d6", "center", "#4d3510");
}

const SCREEN_HANDLE: Button = {x: 306, y: 68, w: 48, h: 58};

/** The cord with the ring on it, at the top of the screen (tap it to pull the screen down): how many screens there are is on the ring. */
function drawScreenHandle(ctx: CanvasRenderingContext2D, g: GameState, time: number): void {
  if (g.mode === "tutorial" || g.phase !== "play" || featureAge(g, "screen") < 0) return;
  const ready = g.screens > 0 && g.sweep < 0;
  const pulled = g.sweep >= 0 ? 18 * Math.min(1, g.sweep / SWEEP_DOWN) : 0;
  const hx = 330;
  const hy = 98 + pulled + (ready ? Math.sin(time * 3) * 1.5 : 0);
  if (ready) registerHit(ctx, "screen", SCREEN_HANDLE);
  ctx.save();
  // Three screens, as many as there can be: the ring glows, with a few twinkles round it.
  if (g.screens >= SCREEN_MAX) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    const r = 31 + 5 * pulse;
    const glow = ctx.createRadialGradient(hx, hy, 8, hx, hy, r);
    glow.addColorStop(0, `rgba(255,226,120,${0.7 + 0.25 * pulse})`);
    glow.addColorStop(0.55, `rgba(255,200,70,${0.32 + 0.18 * pulse})`);
    glow.addColorStop(1, "rgba(255,190,50,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const life = Math.sin(((time * 0.9 + i / 3) % 1) * Math.PI);
      const a = i * 2.1 + time * 0.5;
      const sx = hx + Math.cos(a) * 21;
      const sy = hy + Math.sin(a) * 21;
      const s = 4.5 * life;
      ctx.globalAlpha = life;
      ctx.fillStyle = "#fff6c4";
      ctx.beginPath();
      ctx.moveTo(sx, sy - s);
      ctx.quadraticCurveTo(sx, sy, sx + s, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + s);
      ctx.quadraticCurveTo(sx, sy, sx - s, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - s);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = g.screens > 0 ? 1 : 0.45;
  ctx.strokeStyle = "#e8dcc2";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(hx, 52);
  ctx.lineTo(hx, hy - 15);
  ctx.stroke();
  drawScreenRing(ctx, hx, hy + (ui.pressed === "screen" ? 2 : 0), g.screens);
  ctx.restore();
}

/** The picture of a new kind of number, big, in the middle of the presentation (cx, cy is where its middle is). */
function drawFeatureArt(ctx: CanvasRenderingContext2D, f: Feature, cx: number, cy: number, time: number): void {
  const ball = (x: number, y: number, k: number, tile: NumberTile) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    drawNumber(ctx, tile, time);
    ctx.restore();
  };
  if (f === "points" || f === "life" || f === "slow" || f === "star" || f === "pause" || f === "bomb" || f === "cloth" || f === "shield" || f === "diamond") {
    ball(cx, cy, 2.3, demoTile(0, {bonus: f}));
  } else if (f === "steel") {
    ball(cx, cy, 2.3, demoTile(2, {op: "steel"}));
  } else if (f === "chain3") {
    // Three numbers on a chain.
    const xs = [cx - 76, cx, cx + 76];
    drawChain(ctx, xs[0], cy, xs[1], cy + Math.sin(time * 2) * 2, CHAIN_LENGTH, time);
    drawChain(ctx, xs[1], cy + Math.sin(time * 2) * 2, xs[2], cy, CHAIN_LENGTH, time);
    ball(xs[0], cy, 1.4, demoTile(3, {phase: 0}));
    ball(xs[1], cy, 1.4, demoTile(5, {phase: 2}));
    ball(xs[2], cy, 1.4, demoTile(2, {phase: 4}));
  } else if (f === "screen") {
    // A pull-down screen: the roller at the top, the cloth with a few numbers fading on it, the bar and the cord with its ring.
    ctx.save();
    ctx.translate(cx, cy);
    drawScreenCloth(ctx, -90, -44, 180, 72);
    for (const [dx, dy, v] of [[-52, -12, 3], [-6, 2, 7], [46, -16, 5]] as const) {
      ctx.globalAlpha = 0.55;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(0.8, 0.8);
      drawBall(ctx, 0, 0, v, 1, time, 0, "add");
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (f === "cups" || f === "cup3") {
    // Four (or three) little cups in a row.
    const values = f === "cups" ? [3, 6, 1, 4] : [3, 6, 1];
    ctx.save();
    ctx.translate(cx, cy + 4);
    ctx.scale(0.62, 0.62);
    const demo: Cup[] = values.map((value, i) => ({
      id: -1 - i,
      x: (i - (values.length - 1) / 2) * 84,
      y: 0,
      value,
      dead: false,
      bump: 0,
      ripple: 0,
      showTen: 0,
      tenSign: 1,
      tenCarry: 0,
      flash: 0,
      hidden: false,
      kinds: [],
      charge: 0,
      shield: false,
      seed: i * 2.3,
    }));
    for (const c of demo) drawCupBack(ctx, c);
    for (const c of demo) drawCupFront(ctx, c);
    ctx.restore();
  } else if (f === "zero") {
    ball(cx, cy, 2.3, demoTile(0, {op: "zero"}));
  } else if (f === "ten") {
    ball(cx, cy, 1.75, demoTile(10, {op: "ten"})); // (smaller than the others: the rays round it need room)
  } else if (f === "fog") {
    ball(cx, cy, 2.3, demoTile(4, {op: "dim"}));
  } else if (f === "fade") {
    // A little progress bar: three segments full and the fourth draining away, and when it is gone it breaks up (over and over).
    const cycle = 4.2;
    const u = (time % cycle) / cycle;
    const left = 1 - Math.min(1, u / 0.7); // (how much of the fourth segment is left)
    const segW = 46;
    const gap = 6;
    const sh = 16;
    const x0 = cx - (4 * segW + 3 * gap) / 2;
    const y = cy - sh / 2 + 6;
    ctx.fillStyle = "rgba(18,12,28,0.82)";
    roundRect(ctx, x0 - 8, y - 5, 4 * segW + 3 * gap + 16, sh + 10, (sh + 10) / 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const sx = x0 + i * (segW + gap);
      const frac = i < 3 ? 1 : left;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(ctx, sx, y, segW, sh, sh / 2);
      ctx.fill();
      if (frac <= 0) continue;
      const fw = Math.max(2, segW * frac);
      const gold = ctx.createLinearGradient(0, y, 0, y + sh);
      gold.addColorStop(0, frac < 1 ? "#ffd9a0" : "#fff0a0");
      gold.addColorStop(1, frac < 1 ? "#ee8a14" : "#f0a914");
      ctx.fillStyle = gold;
      roundRect(ctx, sx, y, fw, sh, Math.min(sh / 2, fw / 2));
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#8a5208";
      ctx.stroke();
    }
    // "-5%" falls from the draining segment now and then; when the segment is gone, a few bits fall and a ring spreads.
    const sx3 = x0 + 3 * (segW + gap) + segW / 2;
    if (u < 0.7) {
      // (a little clock over the segment, its hand going round)
      const hand = u * cycle * 2.2;
      ctx.strokeStyle = "#ffb08a";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(sx3, y - 13, 7, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx3, y - 13);
      ctx.lineTo(sx3 + Math.sin(hand) * 5, y - 13 - Math.cos(hand) * 5);
      ctx.stroke();
    } else {
      const k = (u - 0.7) / 0.3;
      ctx.strokeStyle = `rgba(255,154,122,${1 - k})`;
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(sx3, y + sh / 2, 6 + k * 30, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const px = sx3 + (hash01(i, 31) - 0.5) * segW + (hash01(i, 33) - 0.5) * 60 * k;
        const py = y + sh / 2 - 24 * k * hash01(i, 35) + 90 * k * k;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd54a" : "#ff8a5c";
        ctx.fillRect(px - 2, py - 1.5, 4, 3);
      }
      ctx.globalAlpha = 1;
    }
  } else if (f === "vchain") {
    // Two small numbers on a chain, one above the other.
    const sway = Math.sin(time * 2) * 2;
    drawChain(ctx, cx + sway, cy - 29, cx, cy + 29, 58, time);
    ball(cx + sway, cy - 29, 0.95, demoTile(2, {phase: 0}));
    ball(cx, cy + 29, 0.95, demoTile(3, {phase: 2}));
  } else if (f === "chain") {
    // Two numbers on a chain that sways a little.
    const ax = cx - 46;
    const bx = cx + 46;
    drawChain(ctx, ax, cy, bx, cy + Math.sin(time * 2) * 3, CHAIN_LENGTH, time);
    ball(ax, cy, 1.6, demoTile(3, {phase: 0}));
    ball(bx, cy, 1.6, demoTile(4, {phase: 2}));
  } else if (f === "ice") {
    // The ice is whole, and then cracked, and then whole again.
    ball(cx, cy, 2.3, demoTile(5, {ice: Math.floor(time / 1.3) % 2 === 0 ? 2 : 1}));
  } else {
    ball(cx, cy, 2.3, demoTile(7, {ghost: "flip"}));
  }
}

/** Breaks a text into lines that are at most `maxW` wide. The font has to be set already. */
function wrapText(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A new kind of number is presented: its picture, what it does, and two buttons (go on, or go on and never show it again). */
function drawIntro(ctx: CanvasRenderingContext2D, g: GameState, time: number): void {
  const f = g.intro[0];
  if (!f) return;
  ctx.fillStyle = "rgba(8,6,14,0.66)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  const pop = Math.min(1, g.overTimer / 0.28);
  const ease = 1 - Math.pow(1 - pop, 3);
  ctx.save();
  ctx.translate(W / 2, 330);
  ctx.scale(0.86 + 0.14 * ease, 0.86 + 0.14 * ease);
  ctx.translate(-W / 2, -330);
  ctx.globalAlpha = ease;

  drawPanel(ctx, 30, 106, 300, 450, 24);
  drawRibbon(ctx, W / 2, 76, 190, t("introNew"), "#ffe27a", "#d49a14");
  text(ctx, t(FEATURE_TEXT[f].title), W / 2, 172, 24, CHALK);
  // The picture on a darker plate, so it stands out.
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  roundRect(ctx, 56, 196, 248, 100, 18);
  ctx.fill();
  drawFeatureArt(ctx, f, W / 2, 246, time);
  // What it does.
  ctx.font = `600 15px ${FONT}`;
  const lines = wrapText(ctx, t(FEATURE_TEXT[f].body), 250);
  lines.forEach((line, i) => write(ctx, line, W / 2, 322 + i * 21, 15, "#e8dcc2", "center", 600));

  const ready = g.overTimer > BUTTON_DELAY;
  drawButton(ctx, "introOk", INTRO_OK, t("introOk"), "primary", {alpha: ready ? 1 : 0.4, pulse: ready ? time : undefined, size: 22});
  drawButton(ctx, "introNever", INTRO_NEVER, t("introNever"), "secondary", {alpha: ready ? 1 : 0.4, size: 15});
  ctx.restore();
}

/**
 * The progress bar along the bottom: a segment for every cup the level needs. When a cup reaches 10 a star flies down
 * from it, and the segment it lands on pops, flashes and sparkles. (In the endless game it is five cups at a time.)
 */
function drawProgress(ctx: CanvasRenderingContext2D, g: GameState, fx: Fx): void {
  if (g.mode === "tutorial") return;
  const {x, y, w, h} = BAR;
  const cupsShown = g.level - 1 - fx.pending;
  const lay = segmentLayout(g, cupsShown);
  const lit = litSegments(g, cupsShown);
  // (when the progress fades, the top segment is only partly filled: how much is shown by how far it has drained)
  const fading = fadeOn(g);
  const prog = fading ? barFill(g, shownProgress(g, fx.pending, fx.drainShown)) : 0;
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
  if (g.mode === "endless") write(ctx, g.daily ? t("dailyRung", {n: rungOfCup(cupsShown).rung}) : t("level", {n: endlessLevel(g)}), x + 14, y + h / 2 + 1, 12, CHALK, "left", 700);

  for (let i = 0; i < lay.count; i++) {
    const sx = lay.x0 + i * (lay.segW + lay.gap);
    const sy = y + 3;
    const sh = h - 6;
    const frac = fading ? Math.min(1, Math.max(0, prog - i)) : i < lit ? 1 : 0;
    const on = frac >= 1;
    const partial = frac > 0 && frac < 1;
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
    if (partial) {
      // A segment that is draining: the empty one, with the gold that is left of it filling it from the left.
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.stroke();
      const fw = Math.max(2, lay.segW * frac);
      const rest = ctx.createLinearGradient(0, sy, 0, sy + sh);
      rest.addColorStop(0, "#ffd9a0");
      rest.addColorStop(1, "#ee8a14");
      ctx.beginPath();
      ctx.roundRect(sx, sy, fw, sh, Math.min(sh / 2, fw / 2));
      ctx.fillStyle = rest;
      ctx.fill();
      ctx.strokeStyle = "#8a5208";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.roundRect(sx + 1.5, sy + 1.5, Math.max(0, fw - 3), sh * 0.35, sh / 4);
      ctx.fill();
    } else if (on) {
      const gold = ctx.createLinearGradient(0, sy, 0, sy + sh);
      gold.addColorStop(0, "#fff0a0");
      gold.addColorStop(1, "#f0a914");
      ctx.fillStyle = gold;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
    }
    if (!partial) {
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = on ? "#8a5208" : "rgba(255,255,255,0.22)";
      ctx.stroke();
    }
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
  // A segment that has faded away for good: for a moment its ghost flashes, swells and fades out of the bar.
  for (const gone of fx.gone) {
    const u = Math.min(1, gone.age / 0.55);
    const cx = lay.x0 + gone.seg * (lay.segW + lay.gap) + lay.segW / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + 0.35 * u, 1 + 0.9 * (1 - u) * (1 - u));
    ctx.globalAlpha = Math.pow(1 - u, 1.3);
    ctx.fillStyle = `rgb(255,${Math.round(236 - 110 * u)},${Math.round(190 - 100 * u)})`;
    ctx.beginPath();
    ctx.roundRect(-lay.segW / 2, -(h - 6) / 2, lay.segW, h - 6, (h - 6) / 2);
    ctx.fill();
    ctx.restore();
  }
}

/** The diamond at work: it hangs where it was tapped, a little bigger, and fades away when it has changed the last number. */
function drawZapDiamond(ctx: CanvasRenderingContext2D, g: GameState): void {
  const z = g.zap;
  if (!z) return;
  const a = Math.min(1, Math.max(0, (z.end - z.time) / 0.4));
  const pop = Math.min(1, z.time / 0.2);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(z.x, z.y);
  const k = (0.9 + 0.5 * (1 - Math.pow(1 - pop, 3))) * NUMBER_SIZE;
  ctx.scale(k, k);
  drawBonusBall(ctx, 0, 0, "diamond", 1, g.time);
  ctx.restore();
}

/** While the diamond is at work everything waits: a cold blue tint over the screen. */
function drawZapVeil(ctx: CanvasRenderingContext2D, g: GameState): void {
  const z = g.zap;
  if (!z) return;
  const a = Math.min(1, z.time / 0.25, (z.end - z.time) / 0.4);
  ctx.fillStyle = `rgba(30,60,150,${0.24 * Math.max(0, a)})`;
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
}

/** A pause ball is on: a cool green tint and green edges, and a bar with the pause sign that runs down. */
function drawFrozen(ctx: CanvasRenderingContext2D, g: GameState): void {
  const k = Math.min(1, g.pause / PAUSE_SECONDS);
  ctx.fillStyle = "rgba(70,220,150,0.08)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78);
  edge.addColorStop(0, "rgba(50,210,140,0)");
  edge.addColorStop(1, "rgba(50,210,140,0.3)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  if (g.mode === "tutorial") return;
  ctx.save();
  ctx.translate(0, -g.extra);
  drawPanel(ctx, 10, 62, 136, 26, 12);
  ctx.fillStyle = "#c4f7d8";
  roundRect(ctx, 21, 68, 3.5, 14, 1.5);
  ctx.fill();
  roundRect(ctx, 28.5, 68, 3.5, 14, 1.5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(ctx, 42, 70, 92, 10, 5);
  ctx.fill();
  const bar = ctx.createLinearGradient(0, 70, 0, 80);
  bar.addColorStop(0, "#c4f7d8");
  bar.addColorStop(1, "#2fbf7e");
  ctx.fillStyle = bar;
  roundRect(ctx, 42, 70, Math.max(6, 92 * k), 10, 5);
  ctx.fill();
  ctx.restore();
}

/** Slow motion: a cool blue tint over the screen, blue edges, and a bar under the score that runs down. */
function drawSlow(ctx: CanvasRenderingContext2D, g: GameState): void {
  const k = Math.min(1, g.slow / SLOW_SECONDS);
  ctx.fillStyle = "rgba(80,160,255,0.09)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78);
  edge.addColorStop(0, "rgba(60,150,255,0)");
  edge.addColorStop(1, "rgba(60,150,255,0.34)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  if (g.mode === "tutorial") return;
  ctx.save();
  ctx.translate(0, -g.extra);
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
  ctx.restore();
}

// ---- A whole frame --------------------------------------------------------------------

/** The room behind the game: the one of the mode being played, or, in the book, the one of the page (fading between two). */
function drawRoom(ctx: CanvasRenderingContext2D, g: GameState, rooms: Record<Room, HTMLCanvasElement>, book: Book): void {
  // (a room that has been chosen in the shop is the one everywhere; otherwise every game and every page of the book has its own)
  const chosen = ui.look.room !== "auto" && rooms[ui.look.room as Room] ? (ui.look.room as Room) : null;
  if (g.phase !== "menu") {
    ctx.drawImage(rooms[chosen ?? roomOfMode(g.mode)], 0, -g.extra, W, H + g.extra);
    return;
  }
  const i = Math.floor(book.pos);
  const f = book.pos - i;
  ctx.drawImage(rooms[chosen ?? roomOfPage(i)], 0, -g.extra, W, H + g.extra);
  if (f > 0.001) {
    ctx.globalAlpha = f;
    ctx.drawImage(rooms[chosen ?? roomOfPage(i + 1)], 0, -g.extra, W, H + g.extra);
    ctx.globalAlpha = 1;
  }
}

/** What happens when something is bought: a ring of light and a spray of spinning coins where the button was, and how much it cost floats up. */
/** Coins that come in: a flash of light, two rings, a fountain of spinning coins (more of them for more coins), twinkles, and "+N" that floats up. */
function drawGainFx(ctx: CanvasRenderingContext2D, f: number, x: number, y: number, n: number): void {
  const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  // The flash.
  const flash = Math.max(0, 1 - f / 0.55);
  if (flash > 0) {
    const r = 30 + 90 * ease(f / 0.55);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(255,240,170,${0.8 * flash})`);
    glow.addColorStop(1, "rgba(255,200,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // Two rings of light, one after the other.
  for (const [delay, reach] of [[0, 46], [0.12, 70]] as const) {
    const u = Math.min(1, Math.max(0, (f - delay) / 0.55));
    if (u <= 0 || u >= 1) continue;
    ctx.globalAlpha = 0.85 * (1 - u);
    ctx.lineWidth = 1 + 3.5 * (1 - u);
    ctx.strokeStyle = "#ffe27a";
    ctx.beginPath();
    ctx.arc(x, y, 8 + ease(u) * reach, 0, TAU);
    ctx.stroke();
  }
  // The fountain of coins.
  const count = Math.min(36, 16 + Math.floor(n / 60));
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (hash01(i, 3) - 0.5) * 1.9;
    const sp = 170 + hash01(i, 5) * 200;
    const delay = hash01(i, 7) * 0.18;
    const u = Math.max(0, f - delay);
    ctx.globalAlpha = Math.max(0, Math.min(1, (1.7 - f) * 1.6));
    ctx.save();
    ctx.translate(x + Math.cos(a) * sp * u, y + Math.sin(a) * sp * u + 0.5 * 640 * u * u);
    ctx.scale(Math.max(0.15, Math.abs(Math.cos(u * 12 + i))), 1);
    drawCoin(ctx, 0, 0, 4.5 + (i % 4));
    ctx.restore();
  }
  // Twinkles round the button.
  for (let i = 0; i < 10; i++) {
    const a = hash01(i, 11) * TAU;
    const d = 16 + hash01(i, 13) * 46;
    const life = Math.sin(Math.min(1, Math.max(0, (f - hash01(i, 17) * 0.5) / 0.5)) * Math.PI);
    if (life <= 0) continue;
    const sx = x + Math.cos(a) * d;
    const sy = y + Math.sin(a) * d;
    const s = (3 + hash01(i, 19) * 3) * life;
    ctx.globalAlpha = life;
    ctx.fillStyle = "#fff6c4";
    ctx.beginPath();
    ctx.moveTo(sx, sy - s);
    ctx.quadraticCurveTo(sx, sy, sx + s, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + s);
    ctx.quadraticCurveTo(sx, sy, sx - s, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - s);
    ctx.closePath();
    ctx.fill();
  }
  // "+N", rising and then fading away.
  const rise = Math.min(1, f / 0.9);
  ctx.globalAlpha = Math.min(1, f / 0.1) * (1 - Math.max(0, (f - 1.0) / 0.7));
  text(ctx, "+" + n, x, y - 34 - rise * 36, 26, "#fff3c0", "center", "rgba(70,40,5,0.9)");
}

function drawBuyFx(ctx: CanvasRenderingContext2D, extra: number): void {
  const f = ui.buyFx;
  if (f < 0 || f >= (ui.buyGain ? 1.8 : 1.2)) return;
  if (ui.buyGain) {
    ctx.save();
    ctx.translate(0, -extra);
    drawGainFx(ctx, f, ui.buyAt.x, ui.buyAt.y, ui.buyN);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(0, -extra); // (the place of the button is where it is on the screen)
  const {x, y} = ui.buyAt;
  const ring = Math.min(1, f / 0.45);
  ctx.globalAlpha = 0.85 * (1 - ring);
  ctx.lineWidth = 1 + 3 * (1 - ring);
  ctx.strokeStyle = "#ffe27a";
  ctx.beginPath();
  ctx.arc(x, y, 8 + ring * 32, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + ((i - 5.5) / 5.5) * 1.15;
    const sp = 120 + ((i * 37) % 11) * 11;
    const px = x + Math.cos(a) * sp * f;
    const py = y + Math.sin(a) * sp * f + 0.5 * 520 * f * f;
    ctx.globalAlpha = Math.max(0, Math.min(1, (1.0 - f) * 2.2));
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(Math.max(0.15, Math.abs(Math.cos(f * 11 + i))), 1);
    drawCoin(ctx, 0, 0, 4.5 + (i % 3));
    ctx.restore();
  }
  const rise = Math.min(1, f / 0.9);
  ctx.globalAlpha = Math.min(1, f / 0.1) * (1 - Math.max(0, (f - 0.6) / 0.6));
  text(ctx, "\u2212" + ui.buyN, x, y - 26 - rise * 22, 18, "#fff3c0", "center", "rgba(70,40,5,0.9)");
  ctx.restore();
}

/** A short message over the bottom of the screen (it fades away). */
function drawNotice(ctx: CanvasRenderingContext2D): void {
  if (!ui.notice || ui.noticeTime <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, ui.noticeTime / 0.4);
  ctx.font = `700 15px ${FONT}`;
  const w = Math.min(W - 24, ctx.measureText(ui.notice).width + 36);
  drawPanel(ctx, W / 2 - w / 2, 520, w, 38, 14);
  write(ctx, ui.notice, W / 2, 539, 15, "#ffffff", "center", 700);
  ctx.restore();
}

/** A number between 0 and 1 that is always the same for the same input (for the specks and the balls that drift about). */
function hash01(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Slow specks of dust floating in the light, and a soft beam from the upper right: it makes the room feel lived in. */
function drawAmbient(ctx: CanvasRenderingContext2D, g: GameState): void {
  const t = g.time;
  const top = -g.extra;
  const beam = ctx.createLinearGradient(W, top, W * 0.2, top + 500);
  beam.addColorStop(0, "rgba(255,238,200,0.11)");
  beam.addColorStop(1, "rgba(255,238,200,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, top);
  ctx.lineTo(W, top);
  ctx.lineTo(W, top + 520);
  ctx.lineTo(W * 0.25, top + 520);
  ctx.closePath();
  ctx.fill();
  const span = H + g.extra;
  for (let i = 0; i < 26; i++) {
    const x = (hash01(i, 1) * W + Math.sin(t * 0.25 + i) * 14 + W) % W;
    const y = top + ((hash01(i, 2) * span + t * (4 + hash01(i, 3) * 7)) % span);
    const a = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7));
    ctx.fillStyle = `rgba(255,244,215,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash01(i, 3) * 1.4, 0, TAU);
    ctx.fill();
  }
}

/** In the book: a few numbers drift down, faint, behind it (above it, on a tall phone), as a hint of what the game is. */
function drawMenuBalls(ctx: CanvasRenderingContext2D, g: GameState): void {
  const t = g.time;
  const span = H + g.extra + 90;
  const values = [3, -2, 5, 4, -4, 6, 2, -5, 7];
  for (let i = 0; i < values.length; i++) {
    const x = [30, 95, 150, 210, 270, 330][i % 6] + (hash01(i, 4) - 0.5) * 24 + Math.sin(t * 0.6 + i) * 6;
    const y = -g.extra - 45 + ((hash01(i, 5) * span + t * (14 + hash01(i, 6) * 16)) % span);
    ctx.globalAlpha = 0.32;
    drawBall(ctx, x, y, values[i], 0.8 + hash01(i, 6) * 0.5, t, i, i % 4 === 1 ? "mul" : "add");
  }
  ctx.globalAlpha = 1;
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
  music: boolean,
  volume: number,
  book: Book,
  fade: number
): void {
  beginUi(ctx);
  ctx.globalAlpha = 1;
  // The game is drawn against the bottom of the screen; a tall phone has `extra` units more above it. What belongs at the top of the screen
  // (the score, the buttons) is drawn with `atTop`, and the full-screen pages cover the extra part too.
  ui.extra = g.extra;
  ctx.save();
  ctx.translate(0, g.extra);
  const atTop = (draw: () => void) => {
    ctx.save();
    ctx.translate(0, -g.extra);
    draw();
    ctx.restore();
  };
  drawRoom(ctx, g, rooms, book);
  drawAmbient(ctx, g);
  if (g.phase === "menu") drawMenuBalls(ctx, g);

  if (g.phase === "menu") {
    // (the book and its buttons are lifted a little on a tall phone, off the bottom edge, so that a finger on the page numbers does not start the phone's swipe-up)
    ui.lift = Math.min(MENU_LIFT, g.extra);
    // (the header is in the middle of the empty space above the book: the space is from the top of the screen to the top of the book)
    // With room enough above the book (a tall phone) the title gets a row of its own above the energy and the settings, big, and the two rows
    // stand together in the middle of the space; when it is tight the title stays between the energy and the settings, in one row.
    const space = 62 - ui.lift + ui.extra;
    // (the row with the energy and the settings is 36 high, the gap between the rows 6 and there is about 6 above and below: what is left is for the title,
    // which gets a row of its own as soon as it can be bigger there than between the energy and the settings, and is made as big as there is room for)
    const titleH = Math.min(50, space - 54);
    if (titleH >= 30) {
      const top = -ui.extra + (space - (titleH + 42)) / 2;
      ui.headerRows = 2;
      ui.titleMax = Math.min(52, titleH * 1.05);
      ui.titleDy = top + titleH / 2 - 22 + ui.lift;
      ui.headerDy = top + titleH + 6 + 18 - 21 + ui.lift;
    } else {
      ui.headerRows = 1;
      ui.headerDy = Math.min(0, 10 + (ui.lift - ui.extra) / 2);
      ui.titleDy = ui.headerDy;
    }
    ctx.save();
    ctx.translate(0, -ui.lift);
    drawBook(ctx, book, g, g.time);
    ctx.restore();
  } else {
    ctx.save();
    if (g.shake > 0) ctx.translate(Math.sin(g.time * 70) * 6 * g.shake, Math.cos(g.time * 55) * 4 * g.shake);

    // The cups furthest back first, so the ones in front cover them. The front of every cup is drawn
    // after the numbers, so a number sinking into a cup disappears behind the cup's front edge.
    updateLevels(g);
    // (the cup that is held is drawn last, in front of all the others)
    const cups = [...g.cups].sort((a, b) => (ui.heldCup === a.id ? 1 : 0) - (ui.heldCup === b.id ? 1 : 0) || a.y - b.y);
    const sets: Record<string, number> = {};
    for (const c of g.cups) if (c.saucer && g.mode !== "tutorial") sets[c.saucer] = (sets[c.saucer] ?? 0) + 1;
    ui.saucerSet = sets;
    ui.deadBlank = g.variant === "save"; // (the dead cup of Save the cup shows no number)
    for (const c of cups) drawCupBack(ctx, c);
    fx.drawSteam(ctx);
    drawChains(ctx, g);
    // (a bonus ball that is just falling never lands in a cup: it is drawn after the cups, so that it goes in front of them, not through them)
    const passing = (n: NumberTile): boolean => n.bonus !== null && n.state === "fall";
    for (const n of g.numbers) if (!passing(n)) drawNumber(ctx, n, g.time);
    // The cord with the ring is under the screen: when the screen comes down it covers it.
    atTop(() => drawScreenHandle(ctx, g, g.time));
    drawSweep(ctx, g);
    drawHints(ctx, g);
    for (const c of cups) drawCupFront(ctx, c);
    for (const n of g.numbers) if (passing(n)) drawNumber(ctx, n, g.time);
    drawZapDiamond(ctx, g);
    drawTutorialHand(ctx, g);
    fx.drawTop(ctx);
    ctx.restore();

    // The progress bar, and the stars flying down to it, stay still when the screen shakes.
    drawProgress(ctx, g, fx);
    fx.drawFlyers(ctx);
    drawZapVeil(ctx, g);
    if (g.phase === "play" && g.pause > 0) drawFrozen(ctx, g);
    else if (g.phase === "play" && g.slow > 0) drawSlow(ctx, g);
    if (g.phase === "play" || (g.phase === "won" && g.overTimer < 0)) atTop(() => drawHud(ctx, g));
    drawBanner(ctx, g);
    if (g.phase === "intro") drawIntro(ctx, g, g.time);
    if (g.phase === "perk") drawPerk(ctx, g, g.time);
    if ((g.phase === "over" || g.phase === "won") && g.overTimer >= 0) drawCard(ctx, g, g.time, book);
    fx.drawCelebration(ctx);
  }
  // The settings, and in the book the energy and the coins, are at the top of the screen (which is higher than the book on a tall phone).
  if (g.phase === "menu") {
    // (the header of the book, the energy and the settings with the title between them, sits right above the book, and moves with it)
    ctx.save();
    ctx.translate(0, -ui.lift + ui.headerDy);
    drawTopButtons(ctx, g);
    drawEnergyPill(ctx, ui.energyN, ui.energyNext, ui.premium, ui.headerRows === 2);
    ctx.restore();
  } else {
    atTop(() => drawTopButtons(ctx, g));
  }
  if (g.phase !== "menu" && ui.energyFx >= 0 && ui.energyFx < 1) {
    // (a try that is started from the card after a round: the pill is there for a moment, to show what it cost)
    atTop(() => drawEnergyPill(ctx, ui.energyN, ui.energyNext, ui.premium));
  }

  if (ui.pauseOpen) drawPause(ctx, muted, music, g.time);
  if (ui.settingsOpen) drawSettings(ctx, {muted, music, volume, unlockAll: book.unlockAll, name: playerName(), hiddenIntros: g.hideIntros.size > 0}, g.time);
  if (ui.scoresOpen) drawScores(ctx, boards[ui.scoresMode], deviceId(), g.time, ui.scoresMode);
  if (ui.energyOpen) drawEnergy(ctx, ui.energyN, ui.energyNext, g.time);
  if (ui.cupsOpen) drawCups(ctx);
  if (ui.adOpen) drawAd(ctx, g.time, ui.adTime, ui.adFor);
  if (ui.startOpen) drawStart(ctx, g.time);
  if (ui.packageOpen) drawPackage(ctx, g.time);

  drawNotice(ctx);
  drawBuyFx(ctx, g.extra);

  if (fade > 0.001) {
    ctx.fillStyle = `rgba(10,6,16,${Math.min(1, fade)})`;
    ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  }
  ctx.restore();
}
