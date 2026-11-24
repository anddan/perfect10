// The start menu: a book that fills the screen. Drag a page sideways to turn it, or press the next button.
// Page 1 is the tutorial, page 2 the plus levels (nine, three on every row), page 3 the plus and minus levels,
// and the last page is the endless game. Every page of the book is in its own room (see background.ts).
import {STREAK_DAYS, rungGoal, rungPayout, streakFactor} from "../game/daily";
import {DAILY_RUNGS, ERASER_MAX, H, SCREEN_MAX, W, STAGES} from "../game/constants";
import {type StepDesign, designOfDay, drawGift, drawLimitLine, drawSteps, halfWidth, stepY} from "./stepsArt";
import {CUP_PRICE, SHOP_CUPS} from "../game/cups";
import {LOOK_KINDS, type LookKind, looksOf, lookKey} from "../game/looks";
import {CLOTH_PRICE, ERASER_PRICE, ENDLESS_COST, ENERGY_PRICE, MAX_COPIES, ONLINE_PRICE, VARIANT_PRICE, VIDEO_COINS, type UnlockMode, refillPrice} from "./wallet";
import {SAUCERS, SAUCER_EFFECT, SAUCER_PRICE, SAUCER_SLOTS, type SaucerKind, isSaucer, saucerPower} from "../game/saucers";
import {drawSaucerPlate} from "./saucerArt";
import {ENERGY_MAX} from "./energy";
import {ENERGY_PILL, HEADER, coinsPillBox, drawGear} from "./settings";
import {COIN_PACKS, CURRENCY, PREMIUM} from "./purchase";
import {dailyMixOf, goalFor, starsFor} from "../game/engine";
import type {GameState, Mode, Op, Variant} from "../game/types";
import {roomOfMode, type Room} from "./background";
import {drawShopCup} from "./cupArt";
import {drawComet, drawJet, drawShip} from "./craftArt";
import {drawSnakeBody, drawSnakeHead} from "./snakeArt";
import {drawAimLine, drawCannon, drawTenGlow} from "./cannonArt";
import {drawLinePath} from "./lineArt";
import {drawEarth, drawLava, drawMiner, drawTunnel} from "./mineArt";
import {drawBlade, drawHalf} from "./ninjaArt";
import {applyTint} from "./tint";
import {type Key, t} from "./i18n";
import {playerName} from "./profile";
import {drawKey, drawTrophy} from "./settings";
import {type Button,
  FONT,
  GOLD,
  INK,
  TAU,
  drawBall,
  drawBonusBall,
  drawEraser,
  drawIce,
  setBallLabel,
  drawCoin,
  drawStar,
  drawButton,
  drawWoodPill,
  logoTitleFit,
  logoWidth,
  registerHit,
  roundRect,
  softShadow,
  text,
  ui,
  wrapLines,
  write, drawShieldArc} from "./draw";

/** The holes along the left edge of the pages (their middle, measured from the left edge of the page and from the top), and the metal spiral that goes through them. */
const SPIRAL_AT = [60, 138, 216, 294, 372, 450];
const HOLE_X = 13;
const HOLE_R = 4.6;

/** Where the book is (game units): nearly the whole screen, so a whole page is shown. */
export const BOOK = {x: 14, y: 62, w: 332, h: 514};

/** What each page of the book is: the games, and after them the daily challenge (the ladder) and the shop. */
export type Page = Mode | "cover" | "contents" | "daily" | "shop" | "looks" | "buy" | "save" | "sixeight" | "defend" | "ice" | "fast" | "find" | "shield" | "jet" | "comet" | "snake" | "cannon" | "line" | "mine" | "ninja" | "online" | "back";
export const PAGES: Page[] = ["cover", "contents", "tutorial", "daily", "plus", "minus", "mixed", "times", "divide", "space", "endless", "save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "cannon", "line", "mine", "ninja", "online", "shop", "looks", "buy", "back"];
/** The pages of the match modes (they are kept together, under a line of their own, in the contents). */
export const MATCH_PAGES: readonly Page[] = ["endless", "save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "cannon", "line", "mine", "ninja", "online"];
/** The pages of the daily challenge and the shop. */
/** The front cover is the first thing in the book (it has no page number); the contents is page 1. */
export const CONTENTS_PAGE = PAGES.indexOf("contents");
export const DAILY_PAGE = PAGES.indexOf("daily");
export const SHOP_PAGE = PAGES.indexOf("shop");
export const BUY_PAGE = PAGES.indexOf("buy");
export const LOOKS_PAGE = PAGES.indexOf("looks");

/** The chapters of the book, with twelve levels each, in order. */
export const CHAPTER_MODES = ["plus", "minus", "mixed", "times", "divide", "space"] as const;
export type ChapterMode = (typeof CHAPTER_MODES)[number];

export function isChapter(mode: Mode): mode is ChapterMode {
  return (CHAPTER_MODES as readonly Mode[]).includes(mode);
}

/** Which chapter of the book a game is in (1 to 6). */
export function chapterOf(mode: Mode): number {
  return Math.max(0, (CHAPTER_MODES as readonly Mode[]).indexOf(mode)) + 1;
}
const LAST = PAGES.length - 1;

export interface Book {
  /** Which page is showing: 2 is the third page, 2.4 is a page that is 40 percent of the way to being turned. */
  pos: number;
  /** The page it is settling on. */
  target: number;
  dragging: boolean;
  /** Where `pos` was when a drag began. */
  dragFrom: number;
  /** After a button press: seconds left of the page lifting and trembling before it is pulled all the way through. */
  windup: number;
  windupFrom: number;
  /** The levels that have been cleared, as "plus-3" and so on. */
  cleared: Set<string>;
  /** Every level is open (for testing). The locks are still there in the real game. */
  unlockAll: boolean;
  /** Premium has been bought: every level and the endless game are open. */
  premium: boolean;
  /** The most cups that have been filled in a level (the dots on its tile light up for them), as "plus-3" and so on. */
  bestCups: Map<string, number>;
  /** The most points that have been got in a cleared level (shown under its number), as "plus-3" and so on. */
  bestScores: Map<string, number>;
  /** How many times a page has been turned (to the next or the previous page): the sound of a page turning goes by it. */
  turns: number;
  /** A jump over several pages (a press on a far page number): one page turns over the page that is jumped to, instead of every page in between turning. `f` is how far it has turned (0 to 1). */
  jump: {from: number; to: number; f: number} | null;
}

export function createBook(page = 0, cleared: Iterable<string> = [], unlockAll = false, bestCups: Record<string, number> = {}, bestScores: Record<string, number> = {}): Book {
  const p = Math.min(LAST, Math.max(0, page));
  return {
    pos: p,
    target: p,
    dragging: false,
    dragFrom: p,
    windup: 0,
    windupFrom: p,
    cleared: new Set(cleared),
    unlockAll,
    premium: false,
    bestCups: new Map(Object.entries(bestCups)),
    bestScores: new Map(Object.entries(bestScores)),
    turns: 0,
    jump: null,
  };
}

export function clearedKey(mode: Mode, stage: number): string {
  return `${mode}-${stage}`;
}

/** Remembers that `cups` cups were filled in a level: only if that is more than before. Returns whether it was. */
export function markProgress(b: Book, mode: Mode, stage: number, cups: number): boolean {
  const key = clearedKey(mode, stage);
  if (cups <= (b.bestCups.get(key) ?? 0)) return false;
  b.bestCups.set(key, cups);
  return true;
}

/** Remembers the points got in a cleared level: only if that is more than before. Returns whether it was. */
export function markScore(b: Book, mode: Mode, stage: number, score: number): boolean {
  const key = clearedKey(mode, stage);
  if (score <= (b.bestScores.get(key) ?? 0)) return false;
  b.bestScores.set(key, score);
  return true;
}

export function markCleared(b: Book, mode: Mode, stage: number): void {
  b.cleared.add(clearedKey(mode, stage));
}

/** The page a mode lives on. */
export function pageOfMode(mode: Mode): number {
  return Math.max(0, PAGES.indexOf(mode));
}

/** The most stars there are in a chapter (three in each of its twelve levels). */
export const CHAPTER_STARS = 3 * STAGES;
/** How many stars, all chapters added together (180 at most), open the endless game. */
export const STARS_FOR_ENDLESS = 120;
/** The stars that open the match modes (without buying them for coins, or Premium): Save the cup and Even numbers. */
export const STARS_FOR_VARIANT: Record<Variant, number> = {save: 125, sixeight: 130, defend: 135, ice: 140, fast: 145, find: 150, shield: 155, jet: 160, comet: 165, snake: 170, cannon: 175, line: 180, mine: 185, ninja: 190};

/** The stars got in a level (the points of its best try): none until it has been cleared. */
export function starsOfLevel(b: Book, mode: Mode, stage: number): number {
  const key = clearedKey(mode, stage);
  return b.cleared.has(key) ? starsFor(mode, stage, b.bestScores.get(key) ?? 0) : 0;
}

/** Whether every level of a chapter has been cleared (that opens the next chapter). */
export function chapterCleared(b: Book, mode: ChapterMode): boolean {
  for (let s = 1; s <= STAGES; s++) if (!b.cleared.has(clearedKey(mode, s))) return false;
  return true;
}

/** The stars got in all the levels of a chapter (0 to 36). */
export function chapterStars(b: Book, mode: ChapterMode): number {
  let n = 0;
  for (let s = 1; s <= STAGES; s++) n += starsOfLevel(b, mode, s);
  return n;
}

/** The stars got in all the chapters together (0 to 180). */
export function totalStars(b: Book): number {
  return CHAPTER_MODES.reduce((n, m) => n + chapterStars(b, m), 0);
}

/**
 * Whether a level can be played. The levels come one after the other: the first plus level is open, every other
 * level opens when the one before it has been cleared, and the first level of a chapter when every level of the chapter before it has
 * been cleared (a level that has been cleared stays open). The endless game opens when 120 stars have been got in
 * all the chapters together. The tutorial is always open.
 */
export function isUnlocked(b: Book, mode: Mode, stage: number): boolean {
  if (b.unlockAll || b.premium) return true;
  if (mode === "endless") return totalStars(b) >= STARS_FOR_ENDLESS;
  const chapter = CHAPTER_MODES.indexOf(mode as ChapterMode);
  if (chapter < 0) return true;
  if (stage <= 1) return chapter === 0 || b.cleared.has(clearedKey(mode, 1)) || chapterCleared(b, CHAPTER_MODES[chapter - 1]);
  return b.cleared.has(clearedKey(mode, stage - 1));
}

/** The game that follows another, if it is open (the next chapter may be shut for want of stars). */
export function openNextGame(b: Book, mode: Mode, stage: number): {mode: Mode; stage: number} | undefined {
  const next = nextGame(mode, stage);
  return next && isUnlocked(b, next.mode, next.stage) ? next : undefined;
}

/** The room behind a page of the book. */
export function roomOfPage(page: number): Room {
  const p = PAGES[Math.min(LAST, Math.max(0, page))];
  return p === "daily" || p === "save" || p === "sixeight" || p === "defend" || p === "ice" || p === "fast" || p === "find" || p === "shield" || p === "jet" || p === "comet" || p === "snake" || p === "cannon" || p === "line" || p === "mine" || p === "ninja" || p === "online" ? "terrace" : p === "shop" ? "bakery" : p === "looks" || p === "contents" || p === "cover" ? "classroom" : p === "buy" || p === "back" ? "cafe" : roomOfMode(p);
}

/** The game that follows another in the book: level after level, then the next page, ending in the endless game. */
export function nextGame(mode: Mode, stage: number): {mode: Mode; stage: number} | undefined {
  if (mode === "tutorial") return {mode: "plus", stage: 1};
  const chapter = CHAPTER_MODES.indexOf(mode as ChapterMode);
  if (chapter < 0) return undefined;
  if (stage < STAGES) return {mode, stage: stage + 1};
  return chapter + 1 < CHAPTER_MODES.length ? {mode: CHAPTER_MODES[chapter + 1], stage: 1} : {mode: "endless", stage: 0};
}

/**
 * The page the player is on: the tutorial page until the tutorial has been cleared, then the page of the first level that
 * has not been cleared yet (the endless page when every level has been).
 */
export function currentPage(b: Book): number {
  if (!b.cleared.has(clearedKey("tutorial", 0))) return pageOfMode("tutorial");
  let game: {mode: Mode; stage: number} | undefined = {mode: "plus", stage: 1};
  while (game && game.mode !== "endless" && b.cleared.has(clearedKey(game.mode, game.stage))) {
    const next = nextGame(game.mode, game.stage);
    // The next chapter is shut (too few stars): stay in the chapter where the stars are to be got.
    if (next && next.mode !== "endless" && !isUnlocked(b, next.mode, next.stage)) return pageOfMode(game.mode);
    game = next;
  }
  return pageOfMode(game ? game.mode : "endless");
}

/** Shows a page straight away (coming back from a round). */
export function showPage(b: Book, page: number): void {
  const p = Math.min(LAST, Math.max(0, page));
  b.pos = b.target = b.dragFrom = b.windupFrom = p;
  b.dragging = false;
  b.windup = 0;
  b.jump = null;
}

/** Turns to a page. From a button, the page first lifts and trembles a moment before it is pulled all the way through. */
export function goToPage(b: Book, page: number, fromButton = false): void {
  const target = Math.min(LAST, Math.max(0, Math.round(page)));
  // (a jump that is still turning: carry on from the page it has reached)
  if (b.jump) {
    b.pos = b.jump.f < 0.5 ? b.jump.from : b.jump.to;
    b.jump = null;
  }
  if (target !== b.target) b.turns++;
  // A jump over several pages shows one page turning (the one that was open) over the page that is jumped to; the pages in between are not shown.
  const here = Math.round(b.pos);
  if (!b.dragging && Math.abs(target - here) > 1) {
    b.jump = {from: here, to: target, f: 0};
    b.pos = b.target = b.dragFrom = b.windupFrom = target;
    b.windup = 0;
    return;
  }
  // The wind-up only comes when the book is lying still: if a page is already on its way (quick presses on the buttons) it just carries on
  // towards the new page, instead of starting the wind-up over and over so that the page sticks.
  const resting = b.windup <= 0 && Math.abs(b.target - b.pos) < 0.01;
  b.target = target;
  if (resting) {
    b.windupFrom = b.pos;
    b.windup = fromButton && Math.abs(b.target - b.pos) > 0.5 ? WINDUP : 0;
  } else {
    b.windup = 0;
  }
}

export function beginDrag(b: Book): void {
  b.jump = null;
  b.dragging = true;
  b.windup = 0;
  b.dragFrom = b.pos;
}

/** The finger has moved `dx` game units sideways since the drag began: dragging left turns the page forwards. */
export function dragBy(b: Book, dx: number): void {
  if (!b.dragging) return;
  b.pos = Math.min(LAST, Math.max(0, b.dragFrom - dx / BOOK.w));
}

/** The finger let go: the page turns the rest of the way if it has gone far enough, otherwise it falls back. */
export function endDrag(b: Book): void {
  if (!b.dragging) return;
  const from = Math.round(b.dragFrom);
  const moved = b.pos - b.dragFrom;
  b.dragging = false;
  goToPage(b, moved > 0.12 ? from + 1 : moved < -0.12 ? from - 1 : from);
}

const WINDUP = 0.24;
/** How far (of a page) the page lifts during the wind-up. */
const LIFT = 0.075;

export function updateBook(b: Book, dt: number): void {
  if (b.dragging) return;
  if (b.jump) {
    // The same pull as when one page turns: fast at first, and never slower than a steady pull.
    b.jump.f = Math.min(1, b.jump.f + Math.max((1 - b.jump.f) * dt * 7, dt * 1.35));
    if (b.jump.f >= 1) b.jump = null;
    return;
  }
  if (b.windup > 0) {
    // The corner lifts and trembles; the rest follows once it lets go.
    b.windup = Math.max(0, b.windup - dt);
    const k = Math.sin((1 - b.windup / WINDUP) * Math.PI * 0.5);
    b.pos = b.windupFrom + Math.sign(b.target - b.windupFrom) * LIFT * k;
    return;
  }
  const diff = b.target - b.pos;
  if (Math.abs(diff) < 0.002) {
    b.pos = b.target;
    return;
  }
  // Fast at first, and never slower than a steady pull, so the page always goes all the way through.
  const step = Math.max(Math.abs(diff) * dt * 7, dt * 1.35);
  b.pos += Math.sign(diff) * Math.min(Math.abs(diff), step);
}

// ---- Small pictures for the pages -----------------------------------------------------

/** A little coffee cup: (x, y) is the middle of the cup. */
/** The handle of a cup, as a glossy ring like the level tiles: light at the top, darker at the bottom, a white shine and a bright rim. */
function drawGlossyHandle(ctx: CanvasRenderingContext2D): void {
  const cx = 23.5;
  const cy = -1;
  const ring = new Path2D();
  ring.moveTo(cx + 8.5, cy);
  ring.ellipse(cx, cy, 8.5, 10.5, 0, 0, TAU);
  ring.moveTo(cx + 3.6, cy);
  ring.ellipse(cx, cy, 3.6, 5.6, 0, 0, TAU);
  ctx.save();
  const body = ctx.createLinearGradient(0, cy - 10.5, 0, cy + 10.5);
  body.addColorStop(0, "#fffdf6");
  body.addColorStop(1, "#b9b09a");
  ctx.fillStyle = body;
  ctx.fill(ring, "evenodd");
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(60,40,15,0.55)";
  ctx.stroke(ring);
  ctx.clip(ring, "evenodd");
  const shine = ctx.createLinearGradient(0, cy - 10.5, 0, cy + 3);
  shine.addColorStop(0, "rgba(255,255,255,0.95)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(cx - 9, cy - 11, 18, 14);
  // A white swoosh along the upper outer edge.
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 6.2, 8.4, 0, -Math.PI * 0.45, Math.PI * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawCupIcon(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, ink: string, dead = false, scale = 1, glossyHandle = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(2, 18, 25, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = dead ? "#8a8680" : "#d8cfba";
  ctx.beginPath();
  ctx.ellipse(0, 16, 23, 5.5, 0, 0, TAU);
  ctx.fill();
  if (glossyHandle) {
    drawGlossyHandle(ctx);
  } else {
    ctx.strokeStyle = dead ? "#6f6b66" : "#b3aa97";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(18, 1, 7, 8, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  }
  const body = ctx.createLinearGradient(-19, 0, 19, 0);
  body.addColorStop(0, dead ? "#6a6661" : "#c4bba6");
  body.addColorStop(0.35, dead ? "#b0aca6" : "#fffdf6");
  body.addColorStop(1, dead ? "#55514d" : "#a89f8b");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-19, -14);
  ctx.bezierCurveTo(-19, 2, -15, 14, -9, 16);
  ctx.lineTo(9, 16);
  ctx.bezierCurveTo(15, 14, 19, 2, 19, -14);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();
  ctx.fillStyle = dead ? "#a29e98" : "#f4efe4";
  ctx.beginPath();
  ctx.ellipse(0, -14, 19, 6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dead ? "#3a2c2a" : "#4a2c18";
  ctx.beginPath();
  ctx.ellipse(0, -13.5, 16, 4, 0, 0, TAU);
  ctx.fill();
  write(ctx, label, 0, 4, 15, ink, "center", 700);
  ctx.restore();
}

/** An arrow with a head at both ends, for "swap places". */
function drawSwapArrow(ctx: CanvasRenderingContext2D, x: number, y: number, half = 11): void {
  const head = half * 0.45;
  ctx.strokeStyle = "#5b4a36";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - half, y);
  ctx.lineTo(x + half, y);
  ctx.moveTo(x - half, y);
  ctx.lineTo(x - half + head, y - 4.5);
  ctx.moveTo(x - half, y);
  ctx.lineTo(x - half + head, y + 4.5);
  ctx.moveTo(x + half, y);
  ctx.lineTo(x + half - head, y - 4.5);
  ctx.moveTo(x + half, y);
  ctx.lineTo(x + half - head, y + 4.5);
  ctx.stroke();
}

/** A round green badge with a check mark, for what has been cleared. */
/**
 * A clean check mark, straight and smooth: two straight strokes with round ends, in green with a darker edge and a thin light line along the
 * top, for the lines of the contents. (x, y) is the middle and r about half its width.
 */
function drawCleanCheck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const k = r / 7;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - 6.2 * k, y + 0.4 * k);
    ctx.lineTo(x - 2.2 * k, y + 4.6 * k);
    ctx.lineTo(x + 6.6 * k, y - 4.8 * k);
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  path();
  ctx.lineWidth = 5.6 * k;
  ctx.strokeStyle = "#1c6b3a";
  ctx.stroke();
  const green = ctx.createLinearGradient(0, y - 5 * k, 0, y + 5 * k);
  green.addColorStop(0, "#58d483");
  green.addColorStop(1, "#27a456");
  path();
  ctx.lineWidth = 3.6 * k;
  ctx.strokeStyle = green;
  ctx.stroke();
  ctx.restore();
}

function drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // A check mark painted with a brush: a short stroke down, then a long sweep up that thins out to a tail. The brush is
  // thickest near the turn, its edges are a little uneven, and it leaves a few lighter streaks.
  const pt = (a: number, b: number, c: number, d: number, t: number): number => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  const X = [x - r * 0.95, x - r * 0.72, x - r * 0.46, x - r * 0.28, x - r * 0.02, x + r * 0.52, x + r * 1.02];
  const Y = [y + r * 0.02, y + r * 0.22, y + r * 0.56, y + r * 0.8, y + r * 0.18, y - r * 0.55, y - r * 0.96];
  const along = (t: number): {x: number; y: number} => {
    // The first half of t is the stroke down, the second half the sweep up.
    const first = t < 0.3;
    const u = first ? t / 0.3 : (t - 0.3) / 0.7;
    const i = first ? 0 : 3;
    return {x: pt(X[i], X[i + 1], X[i + 2], X[i + 3], u), y: pt(Y[i], Y[i + 1], Y[i + 2], Y[i + 3], u)};
  };
  const N = 44;
  const left: {x: number; y: number}[] = [];
  const right: {x: number; y: number}[] = [];
  const mid: {x: number; y: number; nx: number; ny: number; w: number}[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = along(t);
    const q = along(Math.min(1, t + 0.01));
    const o = along(Math.max(0, t - 0.01));
    const dx = q.x - o.x;
    const dy = q.y - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // How wide the brush is here: full soon after the start, a bit thinner at the turn, then thinning to a tail.
    const profile = t < 0.12 ? 0.55 + 3.7 * t : t < 0.3 ? 1 : Math.max(0.22, 1 - 0.8 * Math.pow((t - 0.3) / 0.7, 1.3));
    const w = r * 0.5 * profile;
    const rough = 1 + 0.09 * Math.sin(t * 41) + 0.06 * Math.sin(t * 97 + 1);
    const rough2 = 1 + 0.09 * Math.sin(t * 53 + 2) + 0.06 * Math.sin(t * 89);
    left.push({x: p.x + nx * w * 0.5 * rough, y: p.y + ny * w * 0.5 * rough});
    right.push({x: p.x - nx * w * 0.5 * rough2, y: p.y - ny * w * 0.5 * rough2});
    mid.push({x: p.x, y: p.y, nx, ny, w});
  }
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (const p of left) ctx.lineTo(p.x, p.y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  shape();
  ctx.fillStyle = "#17a845";
  ctx.fill();
  // Streaks left by the bristles.
  ctx.strokeStyle = "rgba(190,255,205,0.45)";
  ctx.lineWidth = Math.max(0.6, r * 0.045);
  for (const k of [-0.22, 0.05, 0.26]) {
    ctx.beginPath();
    mid.slice(2, N - 5).forEach((m, i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, m.x + m.nx * m.w * k, m.y + m.ny * m.w * k));
    ctx.stroke();
  }
  ctx.restore();
}

/** An infinity sign drawn as a thick golden loop. */
function drawInfinity(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number): void {
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * TAU;
      const d = 1 + Math.sin(t) * Math.sin(t);
      const px = cx + (a * Math.cos(t)) / d;
      const py = cy + (a * Math.sin(t) * Math.cos(t)) / d;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  ctx.lineWidth = 22;
  ctx.strokeStyle = "#3a1d08";
  path();
  ctx.stroke();
  ctx.lineWidth = 15;
  const g = ctx.createLinearGradient(0, cy - a * 0.5, 0, cy + a * 0.5);
  g.addColorStop(0, "#fff0a0");
  g.addColorStop(1, "#e0a114");
  ctx.strokeStyle = g;
  path();
  ctx.stroke();
}

// ---- The pages ------------------------------------------------------------------------

/** One step of the tutorial, as a line on the first page. */
function drawTutorialRow(ctx: CanvasRenderingContext2D, i: number, y: number, done: boolean): void {
  const rows: {title: string; lines: string[]; icon: (cx: number, cy: number) => void}[] = [
    {title: t("r1t"), lines: [t("r1a"), t("r1b")], icon: (cx, cy) => drawBall(ctx, cx, cy, 4, 0.95)},
    {title: t("r2t"), lines: [t("r2a"), t("r2b")], icon: (cx, cy) => drawCupIcon(ctx, cx, cy, "10", "#a86b10")},
    {title: t("r3t"), lines: [t("r3a"), t("r3b")], icon: (cx, cy) => drawCupIcon(ctx, cx, cy, "13", "#ffd0c8", true)},
    {
      title: t("r4t"),
      lines: [t("r4a"), t("r4b")],
      icon: (cx, cy) => {
        // Two small cups with a glossy handle each, and the arrow between them (they are a little closer to the left than the other
        // icons, so that the handle of the right cup does not run into the text).
        drawCupIcon(ctx, cx - 26, cy, "", INK, false, 0.5, true);
        drawSwapArrow(ctx, cx - 0.5, cy - 2, 8);
        drawCupIcon(ctx, cx + 23, cy, "", INK, false, 0.5, true);
      },
    },
    {
      title: t("r5t"),
      lines: [t("r5a"), t("r5b")],
      icon: (cx, cy) => {
        // The cloth: a piece of cloth on its roller, and the cord with the gold ring that is pulled.
        ctx.fillStyle = "#f6f1e3";
        ctx.strokeStyle = "rgba(90,60,25,0.55)";
        ctx.lineWidth = 1.6;
        roundRect(ctx, cx - 18, cy - 21, 36, 22, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#8a6a44";
        roundRect(ctx, cx - 20, cy + 1, 40, 4.5, 2);
        ctx.fill();
        ctx.strokeStyle = "#8a7a5c";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 5);
        ctx.lineTo(cx, cy + 11);
        ctx.stroke();
        const ring = ctx.createLinearGradient(0, cy + 10, 0, cy + 24);
        ring.addColorStop(0, "#f1cf86");
        ring.addColorStop(1, "#a97a2c");
        ctx.fillStyle = ring;
        ctx.strokeStyle = "#5e4010";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx, cy + 17, 6.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      },
    },
  ];
  const row = rows[i];
  if (done) {
    // A step that has been cleared has a check mark where its number was, with no badge round it.
    drawCheck(ctx, 46, y + 1, 14);
  } else {
    // The number of the step, in a round badge.
    const g = ctx.createLinearGradient(0, y - 15, 0, y + 15);
    g.addColorStop(0, "#ffe98f");
    g.addColorStop(1, "#e8a91c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(46, y, 15, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#8a5208";
    ctx.stroke();
    write(ctx, String(i + 1), 46, y + 1, 18, "#43270a", "center", 700);
  }
  row.icon(104, y);
  write(ctx, row.title, 146, y - 17, 19, INK, "left", 700);
  row.lines.forEach((line, k) => write(ctx, line, 146, y + 3 + k * 16.5, 14.5, "#5b4a36", "left", 600));
}

function drawTutorialPage(ctx: CanvasRenderingContext2D, b: Book, time: number): void {
  const w = BOOK.w;
  write(ctx, t("tutLabel"), w / 2, 38, 14, "#8a6d3b", "center", 700);
  write(ctx, t("tutorial"), w / 2, 82, 46, "#43270a", "center", 700);
  write(ctx, t("tutSub"), w / 2, 122, 16, "#5b4a36", "center", 600);
  for (let i = 0; i < 5; i++) drawTutorialRow(ctx, i, 160 + i * 56, b.cleared.has(clearedKey("tutorial", 0)));
  drawButton(ctx, "play:tutorial:0", {x: w / 2 - 112, y: BOOK.h - 92, w: 224, h: 56}, b.cleared.has(clearedKey("tutorial", 0)) ? t("playAgain") : t("startTutorial"), "primary", {
    pulse: time,
    size: 22,
  });
}

/** A padlock, for a level that is not open yet. */
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const cx = 0;
  const cy = 0;
  ctx.lineCap = "round";
  ctx.lineWidth = 5.5;
  ctx.strokeStyle = "#2c2f36";
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 9, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = "#d3d6dc";
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 9, Math.PI, 0);
  ctx.stroke();
  const body = ctx.createLinearGradient(0, cy - 4, 0, cy + 18);
  body.addColorStop(0, "#f0f1f4");
  body.addColorStop(1, "#a3a8b1");
  ctx.fillStyle = body;
  roundRect(ctx, cx - 15, cy - 4, 30, 24, 6);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2c2f36";
  ctx.stroke();
  ctx.fillStyle = "#2c2f36";
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 3.6, 0, TAU);
  ctx.fill();
  ctx.fillRect(cx - 1.6, cy + 7, 3.2, 7);
  ctx.restore();
}

/** The colour (hue) of a level's tile: every chapter has its own run of colours, from the first level to the last. */
function stageHue(mode: Mode, stage: number): number {
  return mode === "plus"
    ? 134 - (stage - 1) * 14
    : mode === "minus"
      ? 12 + (stage - 1) * 4
      : mode === "mixed"
      ? 205 + (stage - 1) * 15
      : mode === "divide"
        ? 335 - (stage - 1) * 7
        : mode === "space"
          ? 275 + (stage - 1) * 4
          : 168 + (stage - 1) * 10;
}

/**
 * The sky on a tile of the space chapter (drawn inside the tile): a soft nebula, a scatter of stars and one thing out there
 * (a ringed planet, a moon or a comet). Every tile has its own stars.
 */
function drawNightSky(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stage: number, hue: number): void {
  let a = stage * 7919 + 13;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  for (const [fx, fy, rad, h] of [
    [0.25 + rnd() * 0.2, 0.7, 0.7, hue + 40],
    [0.75, 0.3 + rnd() * 0.2, 0.6, hue - 60],
  ] as const) {
    const neb = ctx.createRadialGradient(x + s * fx, y + s * fy, 0, x + s * fx, y + s * fy, s * rad);
    neb.addColorStop(0, `hsla(${h} 90% 60% / 0.4)`);
    neb.addColorStop(1, `hsla(${h} 90% 60% / 0)`);
    ctx.fillStyle = neb;
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 16; i++) {
    const sx = x + rnd() * s;
    const sy = y + rnd() * s;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.5 + rnd() * 0.9, 0, TAU);
    ctx.fill();
  }
  // One thing out there, in the lower right (the number and the dots keep to the middle).
  const px = x + s * 0.8;
  const py = y + s * 0.78;
  const kind = stage % 3;
  if (kind === 0) {
    ctx.fillStyle = "#e9b878";
    ctx.beginPath();
    ctx.arc(px, py, s * 0.075, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(245,225,185,0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(px, py, s * 0.13, s * 0.036, -0.4, 0, TAU);
    ctx.stroke();
  } else if (kind === 1) {
    ctx.fillStyle = "#dfe3ee";
    ctx.beginPath();
    ctx.arc(px, py, s * 0.07, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue} 50% 14%)`;
    ctx.beginPath();
    ctx.arc(px + s * 0.03, py - s * 0.02, s * 0.065, 0, TAU);
    ctx.fill();
  } else {
    const tail = ctx.createLinearGradient(px, py, px + s * 0.22, py - s * 0.2);
    tail.addColorStop(0, "rgba(255,255,255,0.9)");
    tail.addColorStop(1, "rgba(160,220,255,0)");
    ctx.strokeStyle = tail;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + s * 0.22, py - s * 0.2);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, TAU);
    ctx.fill();
  }
}

/**
 * One of the twelve levels: a tile in the colour of how hard it is, with the number of cups it needs underneath
 * (a dot lights up for every cup that has been filled). A level that is not open yet is grey with a padlock, and cannot be pressed.
 */
function drawTile(
  ctx: CanvasRenderingContext2D,
  mode: Mode,
  stage: number,
  x: number,
  y: number,
  cleared: boolean,
  doneCups: number,
  locked: boolean,
  s = 88,
  score = 0
): void {
  const id = `play:${mode}:${stage}`;
  const k = s / 88; // how much smaller than the biggest size the tile is drawn
  const hue = stageHue(mode, stage);
  const space = mode === "space";
  /** A colour of this tile: grey when locked, otherwise in its own hue (and darker, like the night sky, in the space chapter). */
  const col = (sat: number, light: number) =>
    locked ? `hsl(${hue} 6% ${light - 6}%)` : space ? `hsl(${hue} ${Math.round(sat * 0.7)}% ${Math.round(light * 0.42)}%)` : `hsl(${hue} ${sat}% ${light}%)`;
  const pressed = !locked && ui.pressed === id;
  const dy = pressed ? 4 : 0;
  if (!locked) registerHit(ctx, id, {x, y, w: s, h: s});

  // A glossy tile of glass: a rich colour, a bright hard-edged shine over the top half and a glow along the bottom.
  const face = ctx.createLinearGradient(0, y + dy, 0, y + dy + s);
  face.addColorStop(0, col(85, 60));
  face.addColorStop(0.5, col(82, 46));
  face.addColorStop(1, col(78, 36));
  ctx.fillStyle = face;
  roundRect(ctx, x, y + dy, s, s, 18 * k);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y + dy, s, s, 18 * k);
  ctx.clip();
  // The light that comes up from the bottom edge.
  const glow = ctx.createRadialGradient(x + s / 2, y + dy + s * 1.02, 0, x + s / 2, y + dy + s * 1.02, s * 0.75);
  glow.addColorStop(0, locked ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.42)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x, y + dy, s, s);
  if (space && !locked) drawNightSky(ctx, x, y + dy, s, stage, hue);
  // The shine: the top half, with a gently curved lower edge (a softer one on the night sky).
  const shine = ctx.createLinearGradient(0, y + dy, 0, y + dy + s * 0.52);
  shine.addColorStop(0, locked ? "rgba(255,255,255,0.45)" : space ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)");
  shine.addColorStop(1, locked ? "rgba(255,255,255,0.1)" : space ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.22)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.moveTo(x, y + dy);
  ctx.lineTo(x + s, y + dy);
  ctx.lineTo(x + s, y + dy + s * 0.4);
  ctx.quadraticCurveTo(x + s / 2, y + dy + s * 0.58, x, y + dy + s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // (no dark border round the tile: only the edge of a tile of space glows a little)
  if (space && !locked) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#8fd8ff";
    ctx.shadowColor = "rgba(130,210,255,0.85)";
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y + dy, s, s, 18 * k);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  ctx.strokeStyle = locked ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 2, y + dy + 2, s - 4, s - 4, 16 * k);
  ctx.stroke();

  if (locked) {
    drawLock(ctx, x + s / 2, y + dy + s / 2 - 6 * k, k);
    return;
  }
  if (space) {
    ctx.shadowColor = "rgba(150,220,255,0.9)";
    ctx.shadowBlur = 10;
  }
  text(ctx, String(stage), x + s / 2, y + dy + s * 0.55, 42 * 1.05 * k, "#ffffff", "center", space ? "rgba(8,6,40,0.95)" : `hsl(${hue} 70% 18%)`);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  // The points got in the level, as three stars above its number: gold for the ones the points are worth, dark for the rest
  // (and all dark in a level that has not been cleared).
  const stars = cleared ? starsFor(mode, stage, score) : 0;
  for (let i = 0; i < 3; i++) drawStar(ctx, x + s / 2 + (i - 1) * 21 * k, y + dy + s * 0.19, 8.4 * 1.05 * k, i < stars, true, true);
  // One little dot for every cup the level needs.
  const goal = goalFor(mode, stage);
  for (let i = 0; i < goal; i++) {
    // A dot for every cup that has been filled lights up gold; the rest are pale.
    ctx.fillStyle = cleared || i < doneCups ? "#ffd54a" : "rgba(255,255,255,0.45)";
    ctx.strokeStyle = `hsl(${hue} 62% 24%)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x + s / 2 + (i - (goal - 1) / 2) * 9 * k, y + dy + s - 14 * k, 3.4 * k, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

// ---- The signs of the chapters ------------------------------------------------------------

/** How wide the ball of a chapter is on its page. */
const SIGN_BALL = 46;

/** How wide the sign of a chapter is (plus and minus has two balls). */
function signWidth(mode: ChapterMode): number {
  return mode === "mixed" ? 72 : SIGN_BALL;
}

/**
 * The sign of a chapter, centred on (cx, cy): the number ball of the chapter itself, as it looks in the game, with its sign alone on it: + on a green ball for plus,
 * − on a red one for minus, both for plus and minus, × on a blue one, ÷ on a yellow one, and the star ball for the last chapter.
 */
function drawSign(ctx: CanvasRenderingContext2D, mode: ChapterMode, cx: number, cy: number, _hue: number): void {
  const k = SIGN_BALL / 40;
  const ball = (x: number, label: string, v: number, op: Op, size = k) => {
    setBallLabel(label);
    drawBall(ctx, x, cy, v, size, 0, 0, op, "classic");
    setBallLabel(null);
  };
  if (mode === "plus") ball(cx, "+", 1, "add");
  else if (mode === "minus") ball(cx, "−", -1, "add");
  else if (mode === "mixed") {
    // (they lie over each other a little: the minus ball behind, the plus ball in front)
    ball(cx + 15, "−", -1, "add", k * 0.9);
    ball(cx - 15, "+", 1, "add", k * 0.9);
  } else if (mode === "times") ball(cx, "×", 2, "mul");
  else if (mode === "divide") ball(cx, "÷", 2, "div");
  else drawBonusBall(ctx, cx, cy, "star", k, 0);
}

/**
 * A line of text with a small gold star in front of it, centred on cx: it says how many stars open something. If it is wider than the
 * page it is made smaller to fit.
 */
function writeWithStar(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, size: number, color: string): void {
  const gap = 6;
  const widthAt = (px: number) => {
    ctx.font = `600 ${px}px ${FONT}`;
    return px * 1.1 + gap + ctx.measureText(s).width;
  };
  const room = BOOK.w - 28;
  const fit = Math.min(size, size * (room / widthAt(size)));
  const r = fit * 0.55;
  const x0 = cx - widthAt(fit) / 2;
  drawStar(ctx, x0 + r, y, r, true, true, true);
  write(ctx, s, x0 + r * 2 + gap, y, fit, color, "left", 600);
}

function drawLevelsPage(ctx: CanvasRenderingContext2D, b: Book, mode: ChapterMode): void {
  const w = BOOK.w;
  const chapter = chapterOf(mode);
  const info = {
    plus: {title: t("ch1"), size: 46, color: "#23753f", sub: t("sub1")},
    minus: {title: t("chMinus"), size: 46, color: "#b3322b", sub: t("subMinus")},
    mixed: {title: t("ch2"), size: 38, color: "#2c5f8a", sub: t("sub2")},
    times: {title: t("ch3"), size: 46, color: "#2a57b8", sub: t("sub3")},
    divide: {title: t("ch4"), size: 46, color: "#b07a00", sub: t("sub4")},
    space: {title: t("ch5"), size: 46, color: "#4a3fa0", sub: t("sub5")},
  }[mode];
  write(ctx, t("chapter", {n: chapter}), w / 2, 38, 14, "#8a6d3b", "center", 700);
  // The stars got in the chapter, out of all of them, in the top left corner.
  starPill(ctx, `${chapterStars(b, mode)}/${CHAPTER_STARS}`);
  // The name of the chapter, and after it its sign (+, plus and minus, times, divide or a star): filled with the
  // colour of the chapter's level 3 (the bottom of its tile) and its dark border.
  ctx.font = `700 ${info.size}px ${FONT}`;
  const gapW = 12;
  const wordW = ctx.measureText(info.title).width;
  const signW = signWidth(mode);
  const x0 = w / 2 - (wordW + gapW + signW) / 2;
  write(ctx, info.title, x0, 82, info.size, info.color, "left", 700);
  drawSign(ctx, mode, x0 + wordW + gapW + signW / 2, 83, stageHue(mode, 3));
  write(ctx, info.sub, w / 2, 122, 16, "#5b4a36", "center", 600);

  // Four rows of three levels (the last row, levels 10 to 12, brings ice numbers).
  const size = 74;
  const gap = 14;
  const gx = (w - (3 * size + 2 * gap)) / 2;
  const top = 144;
  // The level you are at (the first one here that is open and not cleared yet): a soft gold glow behind its tile, and a ring round it that pulses.
  let at = -1;
  for (let i = 0; i < STAGES && at < 0; i++) if (isUnlocked(b, mode, i + 1) && !b.cleared.has(clearedKey(mode, i + 1))) at = i;
  const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 3.2);
  if (at >= 0) {
    const ax = gx + (at % 3) * (size + gap) + size / 2;
    const ay = top + Math.floor(at / 3) * (size + gap) + size / 2;
    // A wide warm light behind it, and a soft halo of light round the tile (a few blurred glows, stronger and weaker as it breathes).
    const halo = ctx.createRadialGradient(ax, ay, size * 0.35, ax, ay, size * (0.95 + 0.1 * pulse));
    halo.addColorStop(0, `rgba(255,214,80,${0.65 + 0.25 * pulse})`);
    halo.addColorStop(0.55, `rgba(255,196,50,${0.28 + 0.15 * pulse})`);
    halo.addColorStop(1, "rgba(255,190,40,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(ax - size * 1.1, ay - size * 1.1, size * 2.2, size * 2.2);
    const tx = ax - size / 2;
    const ty = ay - size / 2;
    ctx.save();
    ctx.shadowColor = `rgba(255,200,60,${0.75 + 0.25 * pulse})`;
    for (const [blur, alpha] of [[30 + 12 * pulse, 0.9], [16, 1], [8, 1]]) {
      ctx.shadowBlur = blur * ui.px;
      ctx.fillStyle = `rgba(255,220,110,${alpha})`;
      roundRect(ctx, tx - 2, ty - 2, size + 4, size + 4, 16);
      ctx.fill();
    }
    ctx.restore();
  }
  for (let i = 0; i < STAGES; i++) {
    drawTile(
      ctx,
      mode,
      i + 1,
      gx + (i % 3) * (size + gap),
      top + Math.floor(i / 3) * (size + gap),
      b.cleared.has(clearedKey(mode, i + 1)),
      b.bestCups.get(clearedKey(mode, i + 1)) ?? 0,
      !isUnlocked(b, mode, i + 1),
      size,
      b.bestScores.get(clearedKey(mode, i + 1)) ?? 0
    );
  }
  if (at >= 0) {
    // (and a few little sparkles that come and go round it)
    const tx = gx + (at % 3) * (size + gap);
    const ty = top + Math.floor(at / 3) * (size + gap);
    const now = performance.now() / 1000;
    for (let k = 0; k < 4; k++) {
      const life = Math.sin(((now * 0.7 + k / 4) % 1) * Math.PI);
      const ang = k * 1.7 + now * 0.4;
      const sx = tx + size / 2 + Math.cos(ang) * (size * 0.62);
      const sy = ty + size / 2 + Math.sin(ang) * (size * 0.62);
      const z = 4 * life;
      ctx.globalAlpha = life;
      ctx.fillStyle = "#fff6c4";
      ctx.beginPath();
      ctx.moveTo(sx, sy - z);
      ctx.quadraticCurveTo(sx, sy, sx + z, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + z);
      ctx.quadraticCurveTo(sx, sy, sx - z, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - z);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // At the bottom: what opens this chapter (if it is shut), or else what opens the next one (nothing is said in the last chapter).
  const hint = !isUnlocked(b, mode, 1) ? t("openChapter", {n: chapter - 1}) : chapter < CHAPTER_MODES.length ? t("openChapterNext", {n: chapter + 1}) : "";
  if (hint) write(ctx, hint, w / 2, BOOK.h - 17, 14, "#5b4a36", "center", 600);
}

/** What the way up is called in each shape ("The ladder", "The mountain" and so on): it is the title of the page of the daily challenge. */
const DESIGN_NAME: Record<StepDesign, Key> = {ladder: "dnLadder", pyramid: "dnPyramid", mountain: "dnMountain", tower: "dnTower", rocket: "dnRocket", stairs: "dnStairs", ship: "dnShip"};

/** What a page of the book is called in the contents. */
function pageName(page: Page): string {
  switch (page) {
    case "tutorial":
      return t("tutorial");
    case "daily":
      return t("dailySteps");
    case "plus":
      return `${chapterOf(page)}. ${t("ch1")}`;
    case "minus":
      return `${chapterOf(page)}. ${t("chMinus")}`;
    case "mixed":
      return `${chapterOf(page)}. ${t("ch2")}`;
    case "times":
      return `${chapterOf(page)}. ${t("ch3")}`;
    case "divide":
      return `${chapterOf(page)}. ${t("ch4")}`;
    case "space":
      return `${chapterOf(page)}. ${t("ch5")}`;
    case "endless":
      return t("endless");
    case "save":
      return t("saveName");
    case "sixeight":
      return t("sixEightName");
    case "defend":
      return t("defendName");
    case "ice":
      return t("iceName");
    case "fast":
      return t("fastName");
    case "find":
      return t("findName");
    case "shield":
      return t("shieldName");
    case "jet":
      return t("jetName");
    case "comet":
      return t("cometName");
    case "snake":
      return t("snakeName");
    case "cannon":
      return t("cannonName");
    case "line":
      return t("lineName");
    case "mine":
      return t("mineName");
    case "ninja":
      return t("ninjaName");
    case "online":
      return t("onlineName");
    case "shop":
      return t("shop");
    case "looks":
      return t("looks");
    case "buy":
      return t("buy");
    default:
      return t("toc");
  }
}

/**
 * The first page: the other pages of the book on a line each (the chapters with the stars got in them): a tap on a line goes to that page.
 * Of the chapters only the one the player is on is shown, and a line under it opens the whole list (and closes it again).
 */
function drawContentsPage(ctx: CanvasRenderingContext2D, b: Book): void {
  const w = BOOK.w;
  starPill(ctx, `${totalStars(b)}/${CHAPTER_MODES.length * CHAPTER_STARS}`);
  pageHead(ctx, t("tocLabel"), t("toc"), "#6b4a1e", t("tocSub"));
  // The chapter that is shown while the list is closed: the one the player is on (the first before anything has been played, the last when
  // everything has been cleared).
  const here = PAGES[currentPage(b)];
  const mine: ChapterMode = isChapter(here as Mode) ? (here as ChapterMode) : here === "endless" ? CHAPTER_MODES[CHAPTER_MODES.length - 1] : CHAPTER_MODES[0];
  const lastChapter = CHAPTER_MODES[CHAPTER_MODES.length - 1];
  const rows: ({page: Page; index: number} | "toggle" | "modes")[] = [];
  for (let i = CONTENTS_PAGE + 1; i < PAGES.length; i++) {
    const page = PAGES[i];
    if (page === "back") continue; // (the back cover is not a page that is listed)
    if (isChapter(page as Mode)) {
      if (ui.tocOpen || page === mine) rows.push({page, index: i});
      // (the line that opens and closes the list comes after the last of the chapters)
      if (page === lastChapter) rows.push("toggle");
    } else if (MATCH_PAGES.includes(page)) {
      // (the match mode that was visited last is shown, and under it a line that opens all of them and closes them again)
      if (ui.modesOpen || page === ui.lastMatch) rows.push({page, index: i});
      if (page === MATCH_PAGES[MATCH_PAGES.length - 1]) rows.push("modes");
    } else rows.push({page, index: i});
  }
  const x = 22;
  const rw = w - 44;
  const top = 140;
  // (the list ends here, over the button for the settings at the bottom of the page)
  const listEnd = BOOK.h - 54;
  // The rows are always the same distance apart, also when the lists are opened: if they do not all fit, the list scrolls (drag it up and down, or use the wheel).
  const pitch = 34;
  const rowH = Math.min(27, pitch - 3);
  // The chapters and the line that opens them are in one box, and so are the match modes and their line (the box is there when they are opened too).
  const groups: [number, number][] = [];
  const firstChapter = rows.findIndex((r) => typeof r !== "string" && isChapter(r.page as Mode));
  const chapterToggle = rows.indexOf("toggle");
  if (firstChapter >= 0 && chapterToggle > firstChapter) groups.push([firstChapter, chapterToggle]);
  const firstMatch = rows.findIndex((r) => typeof r !== "string" && MATCH_PAGES.includes(r.page));
  const matchToggle = rows.indexOf("modes");
  if (firstMatch >= 0 && matchToggle > firstMatch) groups.push([firstMatch, matchToggle]);
  // A box has 4 units of padding round its rows, so the rows after and before it are moved 4 units away on each side: the gap above a box, under it and between two boxes
  // is then the same as the gap between two rows (7 units).
  const GAP = 4;
  const yOfRow = (k: number): number => {
    let extra = 0;
    for (let j = 0; j <= k; j++) {
      if (groups.some(([from]) => from === j)) extra += GAP;
      if (j > 0 && groups.some(([, to]) => to === j - 1)) extra += GAP;
    }
    return top + k * pitch + extra;
  };
  const contentH = yOfRow(rows.length - 1) + rowH - top;
  ui.tocMax = Math.max(0, Math.ceil(contentH - (listEnd - top) + 4));
  ui.tocScroll = Math.min(ui.tocMax, Math.max(0, ui.tocScroll));
  ctx.save();
  if (ui.tocMax > 0) {
    ctx.beginPath();
    ctx.rect(0, top - 3, w, listEnd - top + 6);
    ctx.clip();
  }
  ctx.translate(0, -ui.tocScroll);
  for (const [from, to] of groups) {
    const gy = yOfRow(from) - 4;
    const gh = yOfRow(to) + rowH + 4 - gy;
    ctx.fillStyle = "rgba(120,85,40,0.09)";
    roundRect(ctx, x - 5, gy, rw + 10, gh, 14);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(120,85,40,0.38)";
    ctx.stroke();
  }
  rows.forEach((row, k) => {
    const y0 = yOfRow(k);
    // (a row that is scrolled out of sight is not drawn, and cannot be pressed)
    if (y0 - ui.tocScroll < top - rowH || y0 - ui.tocScroll > listEnd + 6) return;
    if (row === "toggle" || row === "modes") {
      // A flat little line: "show all chapters" with a chevron that points down, or "only mine" with one that points up (and the same for the match modes).
      const isModes = row === "modes";
      const open = isModes ? ui.modesOpen : ui.tocOpen;
      const tid = isModes ? "toc:modes" : "toc:toggle";
      registerHit(ctx, tid, {x, y: y0, w: rw, h: rowH});
      const y = y0 + (ui.pressed === tid ? 2 : 0);
      // (only the words and the chevron, no button behind them)
      const label = t(isModes ? (open ? "tocMatchHide" : "tocMatch") : open ? "tocHide" : "tocShowAll");
      ctx.font = `700 12.5px ${FONT}`;
      const tw = ctx.measureText(label).width;
      write(ctx, label, w / 2 - 8, y + rowH / 2 + 0.5, 12.5, "#7a5c2e", "center", 700);
      const cx = w / 2 - 8 + tw / 2 + 12;
      const dir = open ? -1 : 1;
      ctx.strokeStyle = "#7a5c2e";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 4.5, y + rowH / 2 - 2 * dir);
      ctx.lineTo(cx, y + rowH / 2 + 2.5 * dir);
      ctx.lineTo(cx + 4.5, y + rowH / 2 - 2 * dir);
      ctx.stroke();
      return;
    }
    const {page, index: i} = row;
    const id = `toc:${i}`;
    registerHit(ctx, id, {x, y: y0, w: rw, h: rowH});
    const y = y0 + (ui.pressed === id ? 2 : 0);
    const chapter = isChapter(page as Mode);
    const locked = chapter ? !isUnlocked(b, page as Mode, 1) : page === "endless" ? !isUnlocked(b, "endless", 0) : page === "save" || page === "sixeight" || page === "defend" || page === "ice" || page === "fast" || page === "find" || page === "shield" || page === "jet" || page === "comet" || page === "snake" || page === "cannon" || page === "line" || page === "mine" || page === "ninja" || page === "online" ? !variantOpen(b, page) : false;
    softCard(ctx, x, y, rw, rowH, 10, "cream");
    // The left and the right edge of the line have the colour of their group (the same as the tab and the page number).
    ctx.save();
    roundRect(ctx, x, y, rw, rowH, 10);
    ctx.clip();
    ctx.fillStyle = TAB_GROUPS[groupOfPage(i)].color.mid;
    ctx.fillRect(x + rw - 5, y, 5, rowH);
    ctx.fillRect(x, y, 5, rowH);
    ctx.restore();
    // The number of the page, in a little round chip.
    ctx.fillStyle = "rgba(120,85,40,0.14)";
    ctx.beginPath();
    ctx.arc(x + 17, y + rowH / 2, Math.min(9.5, rowH / 2 - 2), 0, TAU);
    ctx.fill();
    write(ctx, String(i), x + 17, y + rowH / 2 + 0.5, 11.5, "#7a5c2e", "center", 700);
    write(ctx, pageName(page), x + 36, y + rowH / 2 + 0.5, 14.5, locked ? "#8f8372" : "#3b2a14", "left", 700);
    // The chapter the player is on says so, in small letters after its name.
    if (chapter && page === here) {
      ctx.font = `700 14.5px ${FONT}`;
      write(ctx, t("tocCurrent"), x + 36 + ctx.measureText(pageName(page)).width + 7, y + rowH / 2 + 1, 10, "#a86b10", "left", 700);
    }
    // The match mode that was visited last says so, in small letters after its name.
    if (ui.hasLastMatch && MATCH_PAGES.includes(page) && page === ui.lastMatch) {
      ctx.font = `700 14.5px ${FONT}`;
      write(ctx, t("tocLast"), x + 36 + ctx.measureText(pageName(page)).width + 7, y + rowH / 2 + 1, 10, "#a86b10", "left", 700);
    }
    // On the right: the stars got in a chapter (a lock if it is shut), or what the page has for it.
    if (chapter || page === "endless") {
      const got = chapter ? chapterStars(b, page as ChapterMode) : Math.min(totalStars(b), STARS_FOR_ENDLESS);
      const out = chapter ? CHAPTER_STARS : STARS_FOR_ENDLESS;
      ctx.globalAlpha = locked ? 0.6 : 1;
      write(ctx, `${got}/${out}`, x + rw - 52, y + rowH / 2 + 0.5, 13.5, "#5b4a36", "right", 700);
      drawStar(ctx, x + rw - 39, y + rowH / 2 + 0.5, 7.5, true, true, true);
      ctx.globalAlpha = 1;
      // A chapter with every level cleared has a check mark at the right edge (the line is not green any more).
      if (chapter && chapterCleared(b, page as ChapterMode)) drawCleanCheck(ctx, x + rw - 16, y + rowH / 2, 7);
      // (a line that is not done has the arrow, like the other lines, in the place of the check mark)
      else write(ctx, "›", x + rw - 16, y + rowH / 2 - 0.5, 18, "#a08358", "center", 700);
    } else if (page === "online") {
      write(ctx, t("tocSoon"), x + rw - 14, y + rowH / 2 + 0.5, 11.5, "#8a6d3b", "right", 700);
    } else if ((page === "tutorial" && b.cleared.has(clearedKey("tutorial", 0))) || (page === "daily" && ui.dailyCleared)) {
      // (a check mark: the tutorial is done, or today's daily steps are all climbed)
      drawCleanCheck(ctx, x + rw - 16, y + rowH / 2, 7);
    } else {
      write(ctx, "\u203A", x + rw - 16, y + rowH / 2 - 0.5, 18, "#a08358", "center", 700);
    }
  });
  ctx.restore();
  // A thin bar at the right edge shows that the list goes on, and where in it the page is.
  if (ui.tocMax > 0) {
    const track = listEnd - top;
    const thumb = Math.max(28, (track * track) / contentH);
    const ty = top + (ui.tocScroll / ui.tocMax) * (track - thumb);
    ctx.fillStyle = "rgba(90,60,25,0.12)";
    roundRect(ctx, w - 15, top, 4, track, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90,60,25,0.4)";
    roundRect(ctx, w - 15, ty, 4, thumb, 2);
    ctx.fill();
  }
  // The settings (they used to be a gear at the top of the screen): a button at the bottom of the contents, with a gear in front of its name.
  const word = t("settings");
  ctx.font = `700 14px ${FONT}`;
  const gear = 22;
  const wordW = ctx.measureText(word).width;
  const btnW = Math.max(150, Math.ceil(gear + 8 + wordW) + 44);
  drawWoodPill(ctx, "settings", {x: w / 2 - btnW / 2, y: BOOK.h - 42, w: btnW, h: 30}, (c, cx, cy) => {
    const left = cx - (gear + 8 + wordW) / 2;
    c.save();
    c.translate(left + gear / 2, cy);
    c.scale(0.9, 0.9);
    drawGear(c, 0, 0, "#ffffff");
    c.restore();
    text(c, word, left + gear + 8, cy + 1, 14, "#ffffff", "left", "rgba(40,25,5,0.85)");
  });
}

function drawEndlessPage(ctx: CanvasRenderingContext2D, b: Book, time: number): void {
  const w = BOOK.w;
  // (the stars that open the endless game, out of the ones it takes)
  starPill(ctx, `${Math.min(totalStars(b), STARS_FOR_ENDLESS)}/${STARS_FOR_ENDLESS}`);
  write(ctx, t("endLabel"), w / 2, 38, 14, "#8a6d3b", "center", 700);
  write(ctx, t("endless"), w / 2, 82, 46, "#a86b10", "center", 700);
  write(ctx, t("endSub"), w / 2, 122, 16, "#5b4a36", "center", 600);
  drawInfinity(ctx, w / 2, 200, 66);
  write(ctx, t("endQ1"), w / 2, 290, 17, INK, "center", 700);
  write(ctx, t("endQ2"), w / 2, 312, 17, INK, "center", 700);
  // The record, on a little plaque.
  const px = w / 2 - 92;
  softShadow(ctx, px, 340, 184, 64, 14, 5, 0.25);
  const plaque = ctx.createLinearGradient(0, 340, 0, 404);
  plaque.addColorStop(0, "#5a4636");
  plaque.addColorStop(1, "#3a2c22");
  ctx.fillStyle = plaque;
  roundRect(ctx, px, 340, 184, 64, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,213,74,0.6)";
  ctx.stroke();
  // The record, with the name it was made under.
  const who = playerName();
  write(ctx, who ? `${t("recordLabel")} \u00B7 ${who}` : t("recordLabel"), w / 2, 357, 13, "#e8cf92", "center", 700);
  text(ctx, String(ui.bests.endless), w / 2, 382, 30, GOLD);
  // The trophy opens the top list.
  drawButton(ctx, "scores:endless", {x: px + 184 + 10, y: 351, w: 44, h: 44}, "", "round", {draw: drawTrophy});
  if (isUnlocked(b, "endless", 0)) {
    drawButton(ctx, "play:endless:0", {x: w / 2 - 112, y: BOOK.h - 92, w: 224, h: 56}, t("play"), "primary", {pulse: time, size: 24});
    // What a try costs: coins and a key (on two lines, with the coin next to the first), or nothing with Premium.
    if (ui.premium) write(ctx, t("endFree"), w / 2, BOOK.h - 20, 13, "#2f7a3e", "center", 700);
    else {
      const [first, second] = t("endCost", {n: ENDLESS_COST}).split("|");
      ctx.font = `600 13px ${FONT}`;
      const tw = ctx.measureText(first).width;
      drawCoin(ctx, w / 2 - tw / 2 - 5, BOOK.h - 27, 6.5);
      write(ctx, first, w / 2 + 7, BOOK.h - 27, 13, "#5b4a36", "center", 600);
      write(ctx, second ?? "", w / 2, BOOK.h - 11, 12.5, "#5b4a36", "center", 600);
    }
  } else {
    // Endless opens when 120 stars have been got in all the chapters together.
    drawLock(ctx, w / 2, BOOK.h - 84, 1.1);
    writeWithStar(ctx, t("openEndless", {n: STARS_FOR_ENDLESS}), w / 2, BOOK.h - 36, 15, "#5b4a36");
  }
}

/** Whether a match mode (or Online) is open: it has been bought with coins, there are stars enough in the book (not for Online), or Premium is on. */
export function variantOpen(b: Book, mode: UnlockMode): boolean {
  return b.unlockAll || b.premium || ui.modes.includes(mode) || (mode !== "online" && totalStars(b) >= STARS_FOR_VARIANT[mode]);
}

const VARIANT_KEYS: Record<Variant, {name: Key; sub: Key; rules: Key}> = {
  save: {name: "saveName", sub: "saveSub", rules: "saveRules"},
  sixeight: {name: "sixEightName", sub: "sixEightSub", rules: "sixEightRules"},
  defend: {name: "defendName", sub: "defendSub", rules: "defendRules"},
  ice: {name: "iceName", sub: "iceSub", rules: "iceRules"},
  fast: {name: "fastName", sub: "fastSub", rules: "fastRules"},
  find: {name: "findName", sub: "findSub", rules: "findRules"},
  shield: {name: "shieldName", sub: "shieldSub", rules: "shieldRules"},
  jet: {name: "jetName", sub: "jetSub", rules: "jetRules"},
  comet: {name: "cometName", sub: "cometSub", rules: "cometRules"},
  snake: {name: "snakeName", sub: "snakeSub", rules: "snakeRules"},
  cannon: {name: "cannonName", sub: "cannonSub", rules: "cannonRules"},
  line: {name: "lineName", sub: "lineSub", rules: "lineRules"},
  mine: {name: "mineName", sub: "mineSub", rules: "mineRules"},
  ninja: {name: "ninjaName", sub: "ninjaSub", rules: "ninjaRules"},
};

/** The picture in the middle of the page of a match mode. */
function drawVariantArt(ctx: CanvasRenderingContext2D, mode: Variant, cx: number, cy: number, time: number): void {
  if (mode === "jet") {
    // Three cups, the jet flying from side to side and shooting at a steel skull, and a 10 on its way past it into a cup.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 56, 0.66);
    const jx = cx + Math.sin(time * 1.3) * 34;
    const jy = cy + 12;
    ctx.save();
    ctx.strokeStyle = "#ffd54a";
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const u = (time * 2.5 + k / 3) % 1;
      const y = jy - 26 - u * 70;
      ctx.globalAlpha = 1 - u * 0.6;
      ctx.beginPath();
      ctx.moveTo(jx, y);
      ctx.lineTo(jx, y - 10);
      ctx.stroke();
    }
    ctx.restore();
    const steel = ui.steelSkulls;
    ui.steelSkulls = true;
    drawBall(ctx, jx, cy - 92 + Math.sin(time * 4) * 2, 99, 0.9, time, 0, "skull");
    ui.steelSkulls = steel;
    drawBall(ctx, cx + 76, cy - 40 + ((time * 30) % 60), 10, 0.85, time, 1, "ten");
    ctx.save();
    ctx.translate(jx, jy);
    ctx.scale(0.8, 0.8);
    drawJet(ctx, 0, 0, time, {missiles: 1});
    ctx.restore();
    return;
  }
  if (mode === "ninja") {
    // A 4 and a 6 in the air, a blade cutting through the 6 (its halves flying apart), and a 3 coming up.
    const u = (time * 0.7) % 1;
    drawBall(ctx, cx - 60, cy - 30 + Math.sin(time * 2) * 6, 4, 1.4, time, 1);
    drawBall(ctx, cx + 70, cy + 40 - u * 40, 3, 1.2, time, 3);
    const apart = Math.min(1, u * 2) * 18;
    for (const side of [-1, 1]) drawHalf(ctx, {x: cx + 10 + side * apart * 0.3, y: cy - 10 + side * apart, rot: side * u * 0.6, v: 6, side, angle: -0.5, age: 0}, 25, 1.4, "#8ad04a", time);
    const pts = Array.from({length: 8}, (_, k) => ({x: cx - 40 + k * 14, y: cy + 30 - k * 12, age: k < 7 ? (7 - k) * 0.02 : 0}));
    drawBlade(ctx, pts);
    return;
  }
  if (mode === "mine") {
    // A few rows of earth with numbers, a tunnel dug down through them, the miner in it, and the lava glowing over it all.
    const size = 34;
    const x0 = cx - 2 * size;
    const y0 = cy - 40;
    const tunnel = [[2, 0], [2, 1], [3, 1], [3, 2]];
    const vals = [3, 5, 1, 4, 2, 6, 2, 7, 4, 1, 3, 5, 2, 8, 4, 6, 1, 3, 5, 2];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = x0 + c * size;
      const y = y0 + r * size;
      if (tunnel.some(([tc, tr]) => tc === c && tr === r)) drawTunnel(ctx, x, y, size);
      else {
        drawEarth(ctx, x, y, size, r * 10, r * 5 + c);
        drawBall(ctx, x, y, vals[r * 5 + c], 0.62, time, r * 5 + c, "add");
      }
    }
    drawMiner(ctx, x0 + 3 * size, y0 + 2 * size + 2, time, 9);
    drawLava(ctx, y0 - 26, y0 - 20 + Math.sin(time) * 2, BOOK.w, time);
    return;
  }
  if (mode === "line") {
    // A board of numbers, and a line drawn through three of them that make 10 (3, then ×2, then +4), glowing gold, with "= 10!" by its end.
    const vals: [number, "add" | "mul" | "div"][] = [[5, "add"], [3, "add"], [2, "mul"], [6, "add"], [4, "add"], [1, "add"], [2, "add"], [7, "add"], [2, "div"], [4, "add"], [8, "add"], [3, "add"]];
    const at = (k: number) => ({x: cx + ((k % 4) - 1.5) * 44, y: cy - 58 + Math.floor(k / 4) * 44});
    vals.forEach(([v, op], k) => drawBall(ctx, at(k).x, at(k).y, v, 1.05, time, k, op));
    const draw = Math.min(3, Math.floor((time * 1.2) % 4.5));
    if (draw >= 1) {
      const ids = [1, 2, 6].slice(0, draw);
      const value = [3, 6, 8][draw - 1];
      drawLinePath(ctx, ids.map(at), draw === 3 ? 10 : value, time);
    }
    return;
  }
  if (mode === "cannon") {
    // A swarm of number balls at the top, the cannon at the bottom aiming at it with its dotted line, and two balls that glow gold (they make 10).
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const bx = cx + (c - 2) * 32;
      const by = cy - 50 + r * 28;
      const v = [3, 6, 2, 5, 1, 4, 7, 3, 2, 6, 5, 2, 8, 1, 4][r * 5 + c]; // (the two that glow make 10)
      if (r === 2 && c === 1) drawTenGlow(ctx, bx, by, 14, 0.5 + 0.5 * Math.sin(time * 6), time);
      if (r === 2 && c === 2) drawTenGlow(ctx, bx, by, 14, 0.5 + 0.5 * Math.sin(time * 6), time);
      drawBall(ctx, bx, by, v, 0.8, time, r * 5 + c, "add");
    }
    const a = -Math.PI / 2 + Math.sin(time * 1.2) * 0.35;
    drawAimLine(ctx, [{x: cx, y: cy + 30}, {x: cx + Math.cos(a) * 80, y: cy + 30 + Math.sin(a) * 80}], time);
    ctx.save();
    ctx.translate(cx, cy + 56);
    ctx.scale(0.7, 0.7);
    drawCannon(ctx, 0, 0, a, time);
    ctx.restore();
    return;
  }
  if (mode === "snake") {
    // Three cups, and the snake sliding along its track over them: a row of numbers going left, the head in front, and a turn down at the left.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 56, 0.66);
    const go = (time * 18) % 40;
    const pts: {x: number; y: number}[] = [];
    for (let k = 0; k <= 60; k++) pts.push({x: cx + 110 - k * 3.6, y: cy - 44});
    drawSnakeBody(ctx, [pts], false);
    [3, 7, 2, 5].forEach((v, i) => drawBall(ctx, cx + 100 - go - i * 40 + 40, cy - 44, v, 0.7, time, i, "add"));
    drawSnakeHead(ctx, cx - 90 - go * 0.2, cy - 44, Math.PI, time, {scale: 0.85});
    drawBall(ctx, cx - 76, cy - 10 + ((time * 50) % 50), 5, 0.7, time, 5, "add");
    return;
  }
  if (mode === "comet") {
    // Three cups, steel 2s falling down into them, comets (balls of fire) falling beside them, and the ship weaving between it all.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 56, 0.66);
    [-76, 76].forEach((dx, i) => drawBall(ctx, cx + dx, cy - 70 + ((time * 40 + i * 50) % 100), 10, 0.75, time, i, "ten"));
    [-38, 38].forEach((dx, i) => {
      const n = {x: cx + dx, y: cy - 80 + ((time * 55 + i * 60) % 120), phase: i * 1.7, state: "fall"} as unknown as Parameters<typeof drawComet>[1];
      drawComet(ctx, n, time);
    });
    ctx.save();
    ctx.translate(cx + Math.sin(time * 1.6) * 9, cy + 14);
    ctx.scale(0.75, 0.75);
    drawShip(ctx, 0, 0, time);
    ctx.restore(); // (in the gap between the two comets in the middle)
    return;
  }
  if (mode === "shield") {
    // Three cups, and a big steel boss skull held up by the shield, with its red life bar going down.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 50, 0.66);
    const sx = cx + Math.sin(time * 1.4) * 30;
    const steel = ui.steelSkulls;
    ui.steelSkulls = true;
    const by = cy - 28 + Math.sin(time * 5) * 1.5;
    drawBall(ctx, sx, by, 99, 1.45, time, 0, "skull");
    ui.steelSkulls = steel;
    drawShieldArc(ctx, sx, cy + 6, 48, 14, 1);
    const bw = 66;
    const life = 1 - ((time * 0.25) % 1);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, sx - bw / 2 - 2, by - 48, bw + 4, 11, 5.5);
    ctx.fill();
    ctx.fillStyle = "#e0352b";
    roundRect(ctx, sx - bw / 2, by - 46, bw * life, 7, 3.5);
    ctx.fill();
    write(ctx, "BOSS", sx, by - 56, 11, "#b8261d", "center", 800);
    return;
  }
  if (mode === "find") {
    // Four columns of numbers over four cups: the one that makes 10 shines.
    const cols = [[3, 4], [2, 5, 3], [6, 1], [4, 2, 2]];
    cols.forEach((list, c) => {
      const x = cx + (c - 1.5) * 64;
      drawShopCup(ctx, [], x, cy + 56, 0.55);
      if (c === 1) {
        const glow = ctx.createRadialGradient(x, cy - 30, 6, x, cy - 30, 60);
        glow.addColorStop(0, `rgba(255,213,74,${0.4 + 0.2 * Math.sin(time * 3)})`);
        glow.addColorStop(1, "rgba(255,213,74,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 60, cy - 100, 120, 140);
      }
      list.forEach((v, i) => drawBall(ctx, x, cy - 56 + i * 30, v, 0.66, time, c + i, "add"));
    });
    return;
  }
  if (mode === "fast") {
    // A 10, a 0 and a skull hanging in the air over three cups, and a big 3 of the count down.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 44, 0.66);
    drawBall(ctx, cx - 76, cy - 30 + Math.sin(time * 6) * 1.5, 10, 1, time, 0, "ten");
    drawBall(ctx, cx, cy - 12 + Math.sin(time * 6 + 1) * 1.5, 99, 1, time, 1, "skull");
    drawBall(ctx, cx + 76, cy - 30 + Math.sin(time * 6 + 2) * 1.5, 0, 1, time, 2, "zero");
    return;
  }
  if (mode === "ice") {
    // Three numbers frozen in ice, over three cups.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 44, 0.66);
    [3, -2, 5].forEach((v, i) => {
      const x = cx + (i - 1) * 76;
      const y = cy - 24 + (i % 2) * 12 + Math.sin(time * 2 + i) * 3;
      drawBall(ctx, x, y, v, 1, time, i, "add");
      drawIce(ctx, x, y, 2, 1);
    });
    return;
  }
  if (mode === "defend") {
    // Three cups, with skulls and a few numbers on their way down to them.
    for (let i = 0; i < 3; i++) drawShopCup(ctx, [], cx + (i - 1) * 76, cy + 44, 0.66);
    drawBall(ctx, cx - 76, cy - 30 + Math.sin(time * 2) * 3, 99, 1, time, 0, "skull");
    drawBall(ctx, cx, cy - 14 + Math.sin(time * 2 + 1) * 3, 3, 1, time, 1, "add");
    drawBall(ctx, cx + 76, cy - 34 + Math.sin(time * 2 + 2) * 3, 99, 1, time, 2, "skull");
    return;
  }
  if (mode === "save") {
    // Four cups, one of them dead (grey, with a red cross), and 1s on their way down.
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * 66;
      const dead = i === 2;
      ctx.save();
      if (dead) ctx.globalAlpha = 0.5;
      drawShopCup(ctx, [], x, cy + 44, 0.66);
      ctx.restore();
      if (dead) {
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(60,0,0,0.6)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x - 13, cy + 18);
        ctx.lineTo(x + 13, cy + 44);
        ctx.moveTo(x + 13, cy + 18);
        ctx.lineTo(x - 13, cy + 44);
        ctx.stroke();
        ctx.strokeStyle = "#ff4d3d";
        ctx.lineWidth = 4.5;
        ctx.stroke();
      }
      drawBall(ctx, x, cy - 24 + (i % 2) * 14 + Math.sin(time * 2 + i) * 3, 1, 0.66, time, i, "add");
    }
  } else {
    // A 2, a 4, an 8, times 2 and divided by 2.
    const shown: [number, Op][] = [[2, "add"], [4, "add"], [8, "add"], [2, "mul"], [2, "div"]];
    shown.forEach(([v, op], i) => drawBall(ctx, cx + (i - 2) * 62, cy + (i % 2) * 8, v, 0.9, time, i, op));
    write(ctx, "4 \u00D7 2 = 8,  8 + 2 = 10", cx, cy + 58, 15, "#7a5c2e", "center", 700);
  }
}

/** The record of a game on a little plaque (with the name it was made under), and the trophy that opens the top list. */
function drawRecordPlaque(ctx: CanvasRenderingContext2D, best: number, trophyId: string): void {
  const w = BOOK.w;
  const px = w / 2 - 92;
  softShadow(ctx, px, 340, 184, 64, 14, 5, 0.25);
  const plaque = ctx.createLinearGradient(0, 340, 0, 404);
  plaque.addColorStop(0, "#5a4636");
  plaque.addColorStop(1, "#3a2c22");
  ctx.fillStyle = plaque;
  roundRect(ctx, px, 340, 184, 64, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,213,74,0.6)";
  ctx.stroke();
  const who = playerName();
  write(ctx, who ? `${t("recordLabel")} \u00B7 ${who}` : t("recordLabel"), w / 2, 357, 13, "#e8cf92", "center", 700);
  text(ctx, String(best), w / 2, 382, 30, GOLD);
  drawButton(ctx, trophyId, {x: px + 184 + 10, y: 351, w: 44, h: 44}, "", "round", {draw: drawTrophy});
}

/**
 * The page of a match mode (the endless game with rules of its own): what it is, its rules, the record with the trophy of its top list, and the button
 * to play it (a key a try, free with Premium); or, if it has not been bought, the price in coins (it opens with Premium too).
 */
function drawVariantPage(ctx: CanvasRenderingContext2D, b: Book, mode: Variant, time: number): void {
  const w = BOOK.w;
  const k = VARIANT_KEYS[mode];
  // (the stars that open it, out of the ones it takes)
  starPill(ctx, `${Math.min(totalStars(b), STARS_FOR_VARIANT[mode])}/${STARS_FOR_VARIANT[mode]}`);
  pageHead(ctx, t("matchLabel"), t(k.name), "#a86b10", t(k.sub));
  drawVariantArt(ctx, mode, w / 2, 190, time);
  drawRules(ctx, t(k.rules), w / 2, 282, w - 40, 3);
  drawRecordPlaque(ctx, ui.bests[mode] ?? 0, `scores:${mode}`);
  if (variantOpen(b, mode)) {
    drawButton(ctx, `variant:${mode}`, {x: w / 2 - 112, y: BOOK.h - 92, w: 224, h: 56}, t("play"), "primary", {pulse: time, size: 24});
    if (ui.premium) write(ctx, t("endFree"), w / 2, BOOK.h - 20, 13, "#2f7a3e", "center", 700);
    else {
      const [first, second] = t("variantCost").split("|");
      write(ctx, first, w / 2, BOOK.h - 27, fitSize(ctx, first, 13, w - 36), "#5b4a36", "center", 600);
      write(ctx, second ?? "", w / 2, BOOK.h - 11, fitSize(ctx, second ?? "", 12.5, w - 36), "#5b4a36", "center", 600);
    }
  } else {
    const afford = ui.coins >= VARIANT_PRICE;
    drawButton(ctx, `unlock:${mode}`, {x: w / 2 - 112, y: BOOK.h - 100, w: 224, h: 52}, "", afford ? "primary" : "secondary", {
      draw: (c, cx, cy, ink) => coinAmount(c, VARIANT_PRICE, cx, cy, 22, afford ? ink : "#f6efe0", afford ? "rgba(255,246,206,0.75)" : "rgba(14,8,24,0.85)"),
    });
    t("variantLocked", {n: STARS_FOR_VARIANT[mode]}).split("|").forEach((line, i) => write(ctx, line, w / 2, BOOK.h - 32 + i * 16, fitSize(ctx, line, 13, w - 36), "#5b4a36", "center", 600));
  }
}

/** The page for playing online (not built yet): what is coming. */
function drawOnlinePage(ctx: CanvasRenderingContext2D, b: Book, time: number): void {
  const w = BOOK.w;
  pageHead(ctx, t("matchLabel"), t("onlineName"), "#a86b10", t("onlineSub"));
  // Two cups with a dotted line between them.
  for (const x of [w / 2 - 70, w / 2 + 70]) drawShopCup(ctx, [], x, 240 + Math.sin(time * 2 + x) * 2, 0.9);
  ctx.setLineDash([3, 6]);
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#a08358";
  ctx.beginPath();
  ctx.moveTo(w / 2 - 36, 214);
  ctx.quadraticCurveTo(w / 2, 170, w / 2 + 36, 214);
  ctx.stroke();
  ctx.setLineDash([]);
  write(ctx, t("onlineSoon"), w / 2, 330, 30, "#a86b10", "center", 700);
  write(ctx, t("onlineModes"), w / 2, 372, 16, INK, "center", 700);
  // It costs coins (it is open with Premium too): the price, or a check mark when it has been bought.
  if (variantOpen(b, "online")) {
    drawCleanCheck(ctx, w / 2 - 44, BOOK.h - 74, 9);
    write(ctx, t("onlineOwned"), w / 2 - 28, BOOK.h - 74, 17, "#2f7a3e", "left", 700);
  } else {
    const afford = ui.coins >= ONLINE_PRICE;
    drawButton(ctx, "unlock:online", {x: w / 2 - 112, y: BOOK.h - 100, w: 224, h: 52}, "", afford ? "primary" : "secondary", {
      draw: (c, cx, cy, ink) => coinAmount(c, ONLINE_PRICE, cx, cy, 22, afford ? ink : "#f6efe0", afford ? "rgba(255,246,206,0.75)" : "rgba(14,8,24,0.85)"),
    });
    t("onlineLocked").split("|").forEach((line, i) => write(ctx, line, w / 2, BOOK.h - 32 + i * 16, 13, "#5b4a36", "center", 600));
  }
}

/** A price or an amount: a coin and the number. (x, y) is the middle. */
function coinAmount(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, size: number, color: string, outline: string): void {
  ctx.font = `700 ${size}px ${FONT}`;
  const tw = ctx.measureText(String(n)).width;
  const start = x - (tw + size + 4) / 2;
  drawCoin(ctx, start + size / 2, y, size * 0.5);
  text(ctx, String(n), start + size + 4, y + 1, size, color, "left", outline);
}

/** A soft card for the shop and the store: cream paper with a warm edge, a sheen along the top and a shadow (green when it is owned, gold when it is the one to pick). */
function softCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 14, tone: "cream" | "green" | "gold" | "blue" = "cream"): void {
  softShadow(ctx, x, y + 1, w, h, r, 6, 0.2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (tone === "green") {
    g.addColorStop(0, "#f2faea");
    g.addColorStop(1, "#dcefce");
  } else if (tone === "blue") {
    g.addColorStop(0, "#f0f7ff");
    g.addColorStop(1, "#d5e7fa");
  } else if (tone === "gold") {
    g.addColorStop(0, "#fff7d8");
    g.addColorStop(1, "#f7e0a2");
  } else {
    g.addColorStop(0, "#fffaf0");
    g.addColorStop(1, "#f5ead2");
  }
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  sheen.addColorStop(0, "rgba(255,255,255,0.6)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h * 0.5);
  ctx.restore();
  ctx.lineWidth = tone === "gold" ? 2 : 1.3;
  ctx.strokeStyle = tone === "green" ? "rgba(47,174,94,0.6)" : tone === "blue" ? "rgba(60,130,210,0.6)" : tone === "gold" ? "rgba(214,150,20,0.9)" : "rgba(120,85,40,0.3)";
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

/** A thin line with a small diamond in the middle, under the title of a page. */
function flourish(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number): void {
  ctx.strokeStyle = "rgba(150,110,50,0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - 9, y);
  ctx.moveTo(cx + 9, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.fillStyle = "#c9a35a";
  ctx.beginPath();
  ctx.moveTo(cx, y - 4);
  ctx.lineTo(cx + 5, y);
  ctx.lineTo(cx, y + 4);
  ctx.lineTo(cx - 5, y);
  ctx.closePath();
  ctx.fill();
}

/** The stars (for instance 16/32), as a pill in the top right corner of a page. */
function starPill(ctx: CanvasRenderingContext2D, label: string): void {
  cornerPill(ctx, "right", label, (x, y) => drawStar(ctx, x, y, 8.5, true, true, true));
}

/** A pill in a top corner of a page: the number first, and its little picture after it. (`hit`: the button it is, if it is one.) */
function cornerPill(ctx: CanvasRenderingContext2D, side: "left" | "right", label: string, icon: (x: number, y: number) => void, hit?: string): void {
  const w = BOOK.w;
  ctx.font = `700 15px ${FONT}`;
  const pw = ctx.measureText(label).width + 44;
  const x = side === "right" ? w - 14 - pw : 14;
  ctx.fillStyle = "rgba(90,60,25,0.13)";
  roundRect(ctx, x, 10, pw, 26, 13);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(90,60,25,0.25)";
  ctx.stroke();
  if (hit) registerHit(ctx, hit, {x, y: 10, w: pw, h: 26});
  write(ctx, label, x + pw - 30, 24, 15, "#5b4a36", "right", 700);
  icon(x + pw - 15, 23);
}

/** The label, the big title and the line under the title that every one of these pages starts with. */
function pageHead(ctx: CanvasRenderingContext2D, label: string, title: string, color: string, sub: string): void {
  const w = BOOK.w;
  write(ctx, label, w / 2, 36, 13, "#8a6d3b", "center", 700);
  // (a long title is made smaller to fit the page)
  ctx.font = `700 44px ${FONT}`;
  const size = Math.min(44, 44 * ((w - 40) / Math.max(1, ctx.measureText(title).width)));
  write(ctx, title, w / 2, 76, size, color, "center", 700);
  write(ctx, sub, w / 2, 108, 14.5, "#5b4a36", "center", 600);
  flourish(ctx, w / 2, 124, 96);
}

/** What a shop item is, in at most two lines in the room that there is (the text gets smaller if it is long). */
function shopText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, room: number, maxLines = 2, startSize = 11.5): void {
  let size = startSize;
  let lines: string[] = [];
  for (; size >= 8.5; size -= 0.5) {
    ctx.font = `600 ${size}px ${FONT}`;
    lines = wrapLines(ctx, s, room);
    if (lines.length <= maxLines) break;
  }
  lines.slice(0, maxLines).forEach((line, k) => write(ctx, line, x, y + k * (size + 1.6), size, "#6a583f", "left", 600));
}

const SHOP_TEXT = {
  gold: {name: "cupGold", a: "cupGoldA", b: "cupGoldB"},
  thermos: {name: "cupThermos", a: "cupThermosA", b: "cupThermosB"},
  magnet: {name: "cupMagnet", a: "cupMagnetA", b: "cupMagnetB"},
  big: {name: "cupBig", a: "cupBigA", b: "cupBigB"},
  laser: {name: "cupLaser", a: "cupLaserA", b: "cupLaserB"},
} as const;

/** A row of tabs on a pill, with the chosen one lit. The ids of the hits are `${prefix}:${i}`. */
function tabBar(ctx: CanvasRenderingContext2D, labels: string[], active: number, prefix: string, y: number): void {
  const tx = 26;
  const tw = BOOK.w - 26 - 14;
  const th = 28;
  ctx.fillStyle = "rgba(90,60,25,0.14)";
  roundRect(ctx, tx, y, tw, th, 14);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(90,60,25,0.25)";
  ctx.stroke();
  const tabW = tw / labels.length;
  labels.forEach((label, i) => {
    const on = active === i;
    if (on) {
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, "#ffe98f");
      g.addColorStop(1, "#f2b320");
      ctx.fillStyle = g;
      roundRect(ctx, tx + i * tabW + 2, y + 2, tabW - 4, th - 4, 12);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#9c610a";
      ctx.stroke();
    }
    registerHit(ctx, `${prefix}:${i}`, {x: tx + i * tabW, y, w: tabW, h: th});
    write(ctx, label, tx + i * tabW + tabW / 2, y + th / 2 + 1, 12, on ? "#4a2a05" : "#6a583f", "center", 700);
  });
}

/** The shop: two tabs, the cups with powers (and the cloth) and the energy (with the continue token). */
function drawShopPage(ctx: CanvasRenderingContext2D): void {
  pageHead(ctx, t("shopLabel"), t("shop"), "#a86b10", ui.shopTab === 0 ? t("shopSub") : ui.shopTab === 1 ? t("saucerSub") : t("suppliesSub"));
  // (the button for the cups is in the top right corner: the number of the page is in the top left one)
  if (ui.shopTab === 0) drawButton(ctx, "cups:open", {x: BOOK.w - 14 - 104, y: 8, w: 104, h: 28}, t("cupsBtn"), "secondary", {size: 14});
  tabBar(ctx, [t("shopTab0"), t("shopTab2"), t("shopTab1")], ui.shopTab, "shop:tab", 134);
  if (ui.shopTab === 0) drawShopCups(ctx);
  else if (ui.shopTab === 1) drawShopSaucers(ctx);
  else drawShopEnergy(ctx);
}

/** A card for every cup with a power (and one for the cloth), with what it does and what it costs; the pips show how many copies there are. */
function drawShopCups(ctx: CanvasRenderingContext2D): void {
  const w = BOOK.w;
  const x0 = 26;
  const cw = w - 26 - 14;
  const top = 168;
  const pitch = 62;
  const ch = 56;
  SHOP_CUPS.forEach((kind, i) => {
    const y0 = top + i * pitch;
    const txt = SHOP_TEXT[kind];
    const copies = ui.owned[kind] ?? 0;
    const owned = copies > 0;
    softCard(ctx, x0, y0, cw, ch, 14, owned ? "green" : "cream");
    // (a card of a cup that has been bought opens the dialog for putting it on the cups; the button on it buys one more)
    if (owned) registerHit(ctx, `shop:own:${kind}`, {x: x0, y: y0, w: cw, h: ch});
    ctx.fillStyle = "rgba(110,80,40,0.1)";
    ctx.beginPath();
    ctx.arc(x0 + 34, y0 + 28, 24, 0, TAU);
    ctx.fill();
    drawShopCup(ctx, [kind], x0 + 34, y0 + 44, 0.66);
    write(ctx, t(txt.name), x0 + 72, y0 + 17, 16, INK, "left", 700);
    // One pip for every copy that has been bought (a cup that is to have the power needs a copy of its own: up to one for every cup).
    ctx.font = `700 16px ${FONT}`;
    const pipX = x0 + 72 + ctx.measureText(t(txt.name)).width + 10;
    for (let p = 0; p < MAX_COPIES; p++) {
      ctx.fillStyle = p < copies ? "#f2b320" : "rgba(110,80,40,0.18)";
      ctx.strokeStyle = p < copies ? "#8a5208" : "rgba(110,80,40,0.3)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(pipX + p * 9, y0 + 16, 3.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    shopText(ctx, `${t(txt.a)} ${t(txt.b)}`, x0 + 72, y0 + 32, cw - 72 - 96, 2, 12.5);
    const btn = {x: x0 + cw - 86, y: y0 + 10, w: 76, h: 36};
    if (copies >= MAX_COPIES) {
      drawButton(ctx, `shop:own:${kind}`, btn, t("shopFull"), "green", {size: 17});
    } else {
      const afford = ui.coins >= CUP_PRICE[kind];
      drawButton(ctx, `shop:buy:${kind}`, btn, "", afford ? "primary" : "secondary", {
        draw: (c, cx, cy2, ink) => coinAmount(c, CUP_PRICE[kind], cx, cy2, 17, afford ? ink : "#f6efe0", afford ? "rgba(255,246,206,0.75)" : "rgba(14,8,24,0.85)"),
      });
    }
  });
  ctx.font = `600 12px ${FONT}`;
  wrapLines(ctx, t("shopHint"), w - 50)
    .slice(0, 2)
    .forEach((line, k) => write(ctx, line, w / 2, 490 + k * 14, 12, "#6a583f", "center", 600));
}

const SAUCER_TEXT: Record<SaucerKind, {name: Key; desc: Key; sum: Key}> = {
  slow: {name: "saucerSlow", desc: "saucerSlowD", sum: "saucerSumSlow"},
  sparse: {name: "saucerSparse", desc: "saucerSparseD", sum: "saucerSumSparse"},
  special: {name: "saucerSpecial", desc: "saucerSpecialD", sum: "saucerSumSpecial"},
  points: {name: "saucerPoints", desc: "saucerPointsD", sum: "saucerSumPoints"},
};

/**
 * The saucers: the four places under the cups (tap one to change what is on it), what they give all together, and a card for every kind of saucer with
 * what it does and what it costs (the pips show how many have been bought). Only four fit, so they have to be chosen; the same kind adds up.
 */
function drawShopSaucers(ctx: CanvasRenderingContext2D): void {
  const w = BOOK.w;
  const x0 = 26;
  const cw = w - 26 - 14;
  const on = (kind: SaucerKind) => ui.saucerSlots.filter((k) => k === kind).length;
  // The four places under the cups, with a line about what they give all together.
  ctx.fillStyle = "rgba(110,80,40,0.1)";
  roundRect(ctx, x0, 168, cw, 86, 14);
  ctx.fill();
  write(ctx, t("saucerCaption"), x0 + cw / 2, 178, 11, "#6a583f", "center", 700);
  const slotW = cw / SAUCER_SLOTS;
  for (let i = 0; i < SAUCER_SLOTS; i++) {
    const k = ui.saucerSlots[i];
    registerHit(ctx, `saucer:slot:${i}`, {x: x0 + slotW * i, y: 186, w: slotW, h: 50});
    const same = isSaucer(k) ? on(k) : 0;
    drawSaucerPlate(ctx, isSaucer(k) ? k : null, x0 + slotW * (i + 0.5), 224, 0.8, true, same >= 2 ? same - 1 : 0, performance.now() / 1000);
  }
  const sums = SAUCERS.filter((k) => on(k) > 0).map((k) => t(SAUCER_TEXT[k].sum, {n: Math.round(saucerPower(on(k)) * SAUCER_EFFECT[k] * 100)}));
  write(ctx, sums.length > 0 ? sums.join("  ·  ") : t("saucerNone"), x0 + cw / 2, 245, 10.5, "#8a5208", "center", 700);
  // A card for every kind.
  const top = 261;
  const pitch = 56;
  const ch = 52;
  SAUCERS.forEach((kind, i) => {
    const y0 = top + i * pitch;
    const txt = SAUCER_TEXT[kind];
    const copies = ui.saucers[kind] ?? 0;
    softCard(ctx, x0, y0, cw, ch, 14, copies > 0 ? "green" : "cream");
    drawSaucerPlate(ctx, kind, x0 + 36, y0 + 26, 0.62);
    write(ctx, t(txt.name), x0 + 72, y0 + 16, 15.5, INK, "left", 700);
    // (one pip for every saucer that has been bought, under the picture)
    for (let p = 0; p < MAX_COPIES; p++) {
      ctx.fillStyle = p < copies ? "#f2b320" : "rgba(110,80,40,0.18)";
      ctx.strokeStyle = p < copies ? "#8a5208" : "rgba(110,80,40,0.3)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x0 + 36 + (p - 1.5) * 9, y0 + 43, 3.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    shopText(ctx, t(txt.desc), x0 + 72, y0 + 30, cw - 72 - 96, 2, 12.5);
    const btn = {x: x0 + cw - 86, y: y0 + 8, w: 76, h: 36};
    if (copies >= MAX_COPIES) {
      drawButton(ctx, `saucer:buy:${kind}`, btn, t("shopFull"), "green", {size: 17});
    } else {
      const afford = ui.coins >= SAUCER_PRICE[kind];
      drawButton(ctx, `saucer:buy:${kind}`, btn, "", afford ? "primary" : "secondary", {
        draw: (c, cx, cy2, ink) => coinAmount(c, SAUCER_PRICE[kind], cx, cy2, 17, afford ? ink : "#f6efe0", afford ? "rgba(255,246,206,0.75)" : "rgba(14,8,24,0.85)"),
      });
    }
  });
  ctx.font = `600 12px ${FONT}`;
  wrapLines(ctx, `${t("saucerHint")} ${t("saucerSetNote")}`, w - 50)
    .slice(0, 3)
    .forEach((line, k) => write(ctx, line, w / 2, 484 + k * 14, 12, "#6a583f", "center", 600));
}

/** The energy for coins (one point, or a full refill) and the continue token that carries on a lost round without an ad. */
function drawShopEnergy(ctx: CanvasRenderingContext2D): void {
  const w = BOOK.w;
  const x0 = 26;
  const cw = w - 26 - 14;
  const missing = ENERGY_MAX - ui.energyN;
  const items = [
    {id: "shop:energy1", name: t("supEnergy1"), desc: `${t("supEnergy1D")} ${t("shopClothB", {n: ui.energyN, m: ENERGY_MAX})}`, price: ENERGY_PRICE, off: missing < 1, icon: 0},
    {id: "shop:energyFull", name: t("supRefill"), desc: t("supRefillD", {n: missing}), price: refillPrice(missing), off: missing < 1, icon: 1},
    {id: "shop:cloth", name: t("shopCloth"), desc: `${t("shopClothA")} ${t("shopClothB", {n: ui.screens, m: SCREEN_MAX})}`, price: CLOTH_PRICE, off: ui.screens >= SCREEN_MAX, icon: 2},
    {id: "shop:eraser", name: t("shopEraser"), desc: `${t("shopEraserA")} ${t("shopClothB", {n: ui.erasers, m: ERASER_MAX})}`, price: ERASER_PRICE, off: ui.erasers >= ERASER_MAX, icon: 3},
  ];
  items.forEach((it, i) => {
    const y0 = 172 + i * 84;
    softCard(ctx, x0, y0, cw, 76, 16, "cream");
    ctx.fillStyle = "rgba(110,80,40,0.1)";
    ctx.beginPath();
    ctx.arc(x0 + 40, y0 + 38, 27, 0, TAU);
    ctx.fill();
    if (it.icon === 0) drawKey(ctx, x0 + 40, y0 + 38, 38, true);
    else if (it.icon === 1) {
      drawKey(ctx, x0 + 29, y0 + 42, 26, true);
      drawKey(ctx, x0 + 52, y0 + 42, 26, true);
      drawKey(ctx, x0 + 40, y0 + 34, 34, true);
    } else if (it.icon === 3) drawEraser(ctx, x0 + 40, y0 + 38, 1.7);
    else {
      ctx.save();
      ctx.translate(x0 + 40, y0 + 38);
      ctx.scale(1.05, 1.05);
      drawBonusBall(ctx, 0, 0, "cloth", 1, 0);
      ctx.restore();
    }
    write(ctx, it.name, x0 + 78, y0 + 20, 17, INK, "left", 700);
    shopText(ctx, it.desc, x0 + 78, y0 + 36, cw - 78 - 96, 3, 11);
    const btn = {x: x0 + cw - 86, y: y0 + 20, w: 76, h: 36};
    if (it.off) drawButton(ctx, it.id, btn, t("shopFull"), "secondary", {size: 15});
    else {
      const afford = ui.coins >= it.price;
      drawButton(ctx, it.id, btn, "", afford ? "primary" : "secondary", {
        draw: (c, cx, cy2, ink) => coinAmount(c, it.price, cx, cy2, 16, afford ? ink : "#f6efe0", afford ? "rgba(255,246,206,0.75)" : "rgba(14,8,24,0.85)"),
      });
    }
  });
}

/**
 * The way up of the daily challenge: six steps with the cups each needs and what it pays, in a shape that changes with the day of the
 * streak (a ladder, a pyramid or a mountain), how many days in a row there are, and the button for today's try (or for the package).
 */
function drawDailyPage(ctx: CanvasRenderingContext2D, time: number): void {
  const w = BOOK.w;
  const design = designOfDay(ui.streakDay);
  // (under the title: the match mode of the day, which the whole ladder is played as)
  pageHead(ctx, t("dayLabel"), t(DESIGN_NAME[design]), "#b05a1c", t(VARIANT_KEYS[dailyMixOf()].name));
  const geom = {cx: w / 2, y0: 312, step: 30};
  drawSteps(ctx, design, geom, (i) => i < ui.dailyRungs);
  // The red dotted goal line of the streak, with a few words at its end.
  drawLimitLine(ctx, geom, 45, w - 18, t("goalLine"));
  const half = halfWidth(design);
  for (let i = 0; i < DAILY_RUNGS; i++) {
    const y = stepY(geom, i);
    const reached = i < ui.dailyRungs;
    const last = i === DAILY_RUNGS - 1;
    // On the left: the rung, and the cups it needs.
    write(ctx, t("dailyRung", {n: i + 1}), geom.cx - half - 8, y - 4, 14, reached ? "#8a5208" : INK, "right", 700);
    write(ctx, t("dailyCups", {n: rungGoal(i + 1)}), geom.cx - half - 8, y + 9, 10.5, "#7a6648", "right", 600);
    // On the right: what it pays today, in a small pill (gold for the top).
    const amount = rungPayout(i, ui.streakDay);
    ctx.font = `700 14px ${FONT}`;
    const pw = ctx.measureText(String(amount)).width + 34;
    const px = geom.cx + half + 8;
    ctx.fillStyle = reached ? "rgba(255,213,74,0.55)" : last ? "rgba(255,213,74,0.35)" : "rgba(90,60,25,0.12)";
    roundRect(ctx, px, y - 10, pw, 20, 10);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = reached || last ? "rgba(168,107,16,0.7)" : "rgba(90,60,25,0.25)";
    ctx.stroke();
    drawCoin(ctx, px + 13, y, 7.5);
    write(ctx, String(amount), px + 25, y + 1, 14, reached || last ? "#7a4a05" : "#5b4a36", "left", 700);
  }
  t("dailyInfo")
    .split("|")
    .forEach((line, k) => write(ctx, line, w / 2, 352 + k * 15, 12, "#6a583f", "center", 600));

  // The days in a row: a dot for every day of the week (the last one is the package), the ones that are done in gold.
  const pending = !ui.streakToday && ui.streakCount < STREAK_DAYS ? ui.streakDay : 0;
  for (let k = 1; k <= STREAK_DAYS; k++) {
    const x = w / 2 + (k - 4) * 38;
    const y = 394;
    const done = k <= ui.streakCount;
    if (k === pending) {
      ctx.strokeStyle = `rgba(214,150,20,${0.55 + 0.45 * Math.sin(time * 4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 14.5, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, TAU);
    ctx.fillStyle = done ? "#ffd23a" : "rgba(90,60,25,0.12)";
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = done ? "#8a5208" : "rgba(90,60,25,0.4)";
    ctx.stroke();
    if (k === STREAK_DAYS) {
      ctx.save();
      if (!done) ctx.globalAlpha = 0.55;
      drawGift(ctx, x, y - 1, 0.62);
      ctx.restore();
    } else if (done) {
      ctx.strokeStyle = "#5e3a06";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x - 4.5, y);
      ctx.lineTo(x - 1.3, y + 3.3);
      ctx.lineTo(x + 5, y - 3.5);
      ctx.stroke();
    } else write(ctx, String(k), x, y + 0.5, 12, k === pending ? "#8a5208" : "#7a6648", "center", 700);
  }
  if (ui.streakGift) {
    drawButton(ctx, "daily:gift", {x: w / 2 - 100, y: 412, w: 200, h: 32}, t("giftOpen"), "primary", {pulse: time, size: 17});
  } else if (ui.streakCount === 0 && !ui.streakToday) {
    t("streakStart")
      .split("|")
      .forEach((line, k) => write(ctx, line, w / 2, 421 + k * 15, 12.5, "#6a583f", "center", 600));
  } else {
    const day = ui.streakToday ? ui.streakCount : ui.streakDay;
    write(ctx, t("streakLine", {n: ui.streakCount, p: Math.round((streakFactor(day) - 1) * 100)}), w / 2, 421, 13, "#8a5208", "center", 700);
    write(ctx, t("streakMiss"), w / 2, 436, 12, "#6a583f", "center", 600);
  }
  if (!ui.dailyUsed) {
    drawButton(ctx, "daily:play", {x: w / 2 - 112, y: BOOK.h - 66, w: 224, h: 52}, t("dailyPlay"), "primary", {pulse: time, size: 24});
  } else {
    write(ctx, ui.dailyCleared ? t("dailyCleared") : t("dailyToday", {n: ui.dailyRungs, m: DAILY_RUNGS}), w / 2, BOOK.h - (ui.dailyRetry ? 58 : 50), 17, ui.dailyCleared ? "#a86b10" : INK, "center", 700);
    // A try that did not get to the goal line can be tried again once, for a video.
    if (ui.dailyRetry) drawButton(ctx, "daily:retry", {x: w / 2 - 112, y: BOOK.h - 46, w: 224, h: 32}, ui.premium ? t("dailyRetryFree") : t("dailyRetry"), "green", {size: 14, pulse: time, ad: !ui.premium});
    else write(ctx, t("dailyWait"), w / 2, BOOK.h - 26, 14, "#6a583f", "center", 600);
  }
}

/** A pile of coins, bigger for a bigger pack: (x, y) is the middle of the bottom of the pile. */
function coinPile(ctx: CanvasRenderingContext2D, x: number, y: number, level: number): void {
  const rows: [number, number][][] = [
    [[-9, 0], [9, 0], [0, -8]],
    [[-17, 0], [0, 0], [17, 0], [-8, -9], [9, -9], [0, -18]],
    [[-26, 0], [-9, 0], [9, 0], [26, 0], [-17, -9], [0, -9], [17, -9], [-8, -18], [9, -18], [0, -27]],
  ];
  const r = level === 2 ? 11 : 10;
  for (const [dx, dy] of rows[level]) drawCoin(ctx, x + dx, y + dy - r, r);
}

/** A small round check mark (a white tick on a green disc). */
function tick(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, "#7ae79a");
  g.addColorStop(1, "#1f9c4d");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#0f5a2a";
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.6, r * 0.28);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y + r * 0.02);
  ctx.lineTo(x - r * 0.1, y + r * 0.38);
  ctx.lineTo(x + r * 0.5, y - r * 0.34);
  ctx.stroke();
}

/** A small ribbon over the top edge of a card ("popular", "best value"). */
function cardTag(ctx: CanvasRenderingContext2D, cx: number, y: number, label: string): void {
  ctx.font = `800 10.5px ${FONT}`;
  const w = ctx.measureText(label).width + 20;
  const g = ctx.createLinearGradient(0, y - 9, 0, y + 9);
  g.addColorStop(0, "#ffe27a");
  g.addColorStop(1, "#e59a14");
  ctx.fillStyle = g;
  roundRect(ctx, cx - w / 2, y - 9, w, 18, 9);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#8a5208";
  ctx.stroke();
  write(ctx, label, cx, y + 0.5, 10.5, "#4a2a05", "center", 800);
}

/** The store: three packs of coins side by side, and Premium (the best deal) on a card of its own. */
function drawBuyPage(ctx: CanvasRenderingContext2D): void {
  const w = BOOK.w;
  pageHead(ctx, t("buyLabel"), t("buy"), "#23753f", t("buySub"));
  // The video for coins, once a day, is a green button named "Free coins": a play triangle (a white check mark when it has been watched today),
  // the name, and what it gives. (It takes the place of the little title "Coins" that the packs below had.)
  const videoBox = {x: 26, y: 130, w: 120, h: 25};
  const videoLook = (c: CanvasRenderingContext2D, cx: number, cy: number) => {
    if (ui.videoReady) {
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(cx - 52, cy - 5.5);
      c.lineTo(cx - 52, cy + 5.5);
      c.lineTo(cx - 43, cy);
      c.closePath();
      c.fill();
    } else {
      // Watched today: a white check mark with a dark edge (green on the green button could not be seen).
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(cx - 55, cy + 0.5);
      c.lineTo(cx - 51, cy + 4.5);
      c.lineTo(cx - 43, cy - 4);
      c.strokeStyle = "rgba(0,50,20,0.7)";
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2.6;
      c.stroke();
    }
    text(c, t("videoName"), cx + (ui.videoReady ? -2 : 4), cy + 1, 12, "#ffffff", "center", "rgba(0,60,20,0.85)");
    if (ui.videoReady) text(c, `+${VIDEO_COINS}`, cx + 44, cy + 1, 12, "#fff3a8", "center", "rgba(0,60,20,0.7)");
  };
  drawButton(ctx, "video:coins", videoBox, "", "green", {draw: videoLook, alpha: ui.videoReady ? 1 : 0.7});
  const cw = 90;
  const gap = (w - 26 - 14 - 3 * cw) / 2;
  const tags = [null, t("buyPopular"), t("buyBest")];
  COIN_PACKS.forEach((pack, i) => {
    const x = 26 + i * (cw + gap);
    // (the cards start a little lower, under the button for the free coins, and end where they did)
    const y = 172;
    const h = 138;
    softCard(ctx, x, y, cw, h, 14, i === 1 ? "gold" : "cream");
    coinPile(ctx, x + cw / 2, y + 63, i);
    text(ctx, String(pack.coins), x + cw / 2, y + 79, 23, INK, "center", "rgba(255,250,235,0.8)");
    write(ctx, t("buyUnit"), x + cw / 2, y + 95, 12, "#7a6648", "center", 600);
    drawButton(ctx, `buy:${pack.id}`, {x: x + 7, y: y + h - 35, w: cw - 14, h: 30}, `${pack.price} ${CURRENCY}`, "primary", {size: 15});
    const tag = tags[i];
    if (tag) cardTag(ctx, x + cw / 2, y, tag);
  });
  // Premium.
  const px = 26;
  const py = 326;
  const pw = w - 26 - 14;
  const ph = 178;
  softShadow(ctx, px, py, pw, ph, 18, 7, 0.35);
  const card = ctx.createLinearGradient(0, py, 0, py + ph);
  card.addColorStop(0, "#4b3a66");
  card.addColorStop(1, "#271e3d");
  ctx.fillStyle = card;
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.fill();
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.clip();
  const glow = ctx.createRadialGradient(px + 52, py + 34, 4, px + 52, py + 34, 120);
  glow.addColorStop(0, "rgba(255,213,74,0.35)");
  glow.addColorStop(1, "rgba(255,213,74,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#f2c24a";
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.stroke();
  // The emblem, the name and what it is.
  const em = ctx.createLinearGradient(0, py + 12, 0, py + 56);
  em.addColorStop(0, "#fff0a0");
  em.addColorStop(1, "#e59a14");
  ctx.fillStyle = em;
  ctx.beginPath();
  ctx.arc(px + 36, py + 36, 20, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#8a5208";
  ctx.stroke();
  drawStar(ctx, px + 36, py + 37, 12.5, true, true, true);
  write(ctx, t("premium"), px + 66, py + 29, 24, GOLD, "left", 700);
  write(ctx, t("premTag"), px + 67, py + 49, 11, "#cdbfe6", "left", 700);
  [t("premCoins", {n: PREMIUM.coins}), t("premOpen"), t("premFree")].forEach((line, k) => {
    tick(ctx, px + 24, py + 72 + k * 22, 8);
    write(ctx, line, px + 40, py + 73 + k * 22, 13.5, "#f3ecdd", "left", 600);
  });
  if (ui.premium) {
    tick(ctx, px + pw / 2 - 40, py + ph - 26, 11);
    write(ctx, t("premOwned"), px + pw / 2 - 24, py + ph - 26, 18, "#9be8a9", "left", 700);
  } else {
    drawButton(ctx, "buy:premium", {x: px + (pw - 200) / 2, y: py + ph - 44, w: 200, h: 34}, `${PREMIUM.price} ${CURRENCY}`, "primary", {size: 19});
  }
}

const LOOK_NAME: Record<string, Key> = {
  "cupColor:porcelain": "lkPorcelain",
  "cupColor:sky": "lkSky",
  "cupColor:rose": "lkRose",
  "cupColor:mint": "lkMint",
  "cupColor:midnight": "lkMidnight",
  "cupColor:sunset": "lkSunset",
  "cupColor:lemon": "lkLemon",
  "cupColor:lilac": "lkLilac",
  "cupColor:graphite": "lkGraphite",
  "pattern:none": "lkPlain",
  "pattern:dots": "lkDots",
  "pattern:stripes": "lkStripes",
  "pattern:stars": "lkStars",
  "pattern:waves": "lkWaves",
  "pattern:hearts": "lkHearts",
  "pattern:checks": "lkChecks",
  "room:auto": "lkAuto",
  "room:classroom": "lkClassroom",
  "room:cafe": "lkCafe",
  "room:library": "lkLibrary",
  "room:bakery": "lkBakery",
  "room:spaceship": "lkSpaceship",
  "room:terrace": "lkTerrace",
  "room:greenhouse": "lkGreenhouse",
  "room:beach": "lkBeach",
  "tint:none": "lkNatural",
  "tint:sunset": "lkSunset",
  "tint:night": "lkNight",
  "tint:forest": "lkForest",
  "tint:sepia": "lkSepia",
  "tint:ocean": "lkOcean",
  "tint:rose": "lkRose",
  "tint:dawn": "lkDawn",
  "tint:mono": "lkMono",
  "numbers:classic": "lkClassic",
  "numbers:neon": "lkNeon",
  "numbers:candy": "lkCandy",
  "numbers:wood": "lkWood",
  "numbers:dark": "lkDark",
  "numbers:minimal": "lkMinimal",
  "numbers:glass": "lkGlass",
  "numbers:chalk": "lkChalk",
  "numbers:reverse": "lkReverse",
};

const LOOK_TABS: Key[] = ["lookTab0", "lookTab1", "lookTab2", "lookTab3", "lookTab4"];

/** Two colours for the little picture of each tone of light (the sky, and the desk). */
const TINT_SWATCH: Record<string, [string, string, string]> = {
  none: ["#7c8a90", "#4b5256", "#f3ecdd"],
  sunset: ["#ff9a52", "#7a2e3c", "#ffe0a0"],
  night: ["#27337a", "#0f1330", "#dfe6ff"],
  forest: ["#5fae6c", "#1f4a2c", "#e8ffd0"],
  sepia: ["#c9a577", "#6a4a2a", "#f6e6c8"],
  ocean: ["#3aa0d6", "#12456b", "#e6f7ff"],
  rose: ["#f08ab0", "#6b2a48", "#ffe8f2"],
  dawn: ["#b79ae0", "#f0a27a", "#fff1c4"],
  mono: ["#9a9a9a", "#3a3a3a", "#f2f2f2"],
};

/** The little picture on a card of the looks: a cup, a piece of a room, a tone of light or three balls. */
function drawLookPreview(ctx: CanvasRenderingContext2D, kind: LookKind, id: string, x: number, y: number, w: number): void {
  const cx = x + w / 2;
  if (kind === "cupColor") drawShopCup(ctx, [], cx, y + 56, 0.64, {cupColor: id, pattern: "none"});
  else if (kind === "pattern") drawShopCup(ctx, [], cx, y + 56, 0.64, {cupColor: ui.look.cupColor, pattern: id});
  else if (kind === "numbers") {
    drawBall(ctx, cx - 25, y + 34, 5, 0.6, 0, 0, "add", id);
    drawBall(ctx, cx, y + 36, -3, 0.6, 0, 0, "add", id);
    drawBall(ctx, cx + 25, y + 34, 2, 0.6, 0, 0, "mul", id);
  } else {
    const pw = w - 12;
    const ph = 50;
    const px = x + 6;
    const py = y + 8;
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 9);
    ctx.clip();
    if (kind === "room") {
      const pics = ui.roomPics;
      const slices = id === "auto" ? ["classroom", "cafe", "spaceship"] : [id];
      slices.forEach((room, i) => {
        const pic = pics?.[room];
        if (!pic) return;
        const k = pic.width / W;
        const sw = pic.width / slices.length;
        const sh = (pic.width * ph) / pw;
        const sy = Math.min(pic.height - sh, (ui.extra + 330) * k - sh);
        ctx.drawImage(pic, (i * pic.width) / slices.length, Math.max(0, sy), sw, sh, px + (i * pw) / slices.length, py, pw / slices.length + 0.5, ph);
      });
    } else {
      // A tone of light: sky and ground in its colours, and a sun (or a moon).
      const sw = TINT_SWATCH[id] ?? TINT_SWATCH.none;
      const sky = ctx.createLinearGradient(0, py, 0, py + ph);
      sky.addColorStop(0, sw[0]);
      sky.addColorStop(1, sw[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = sw[2];
      ctx.beginPath();
      ctx.arc(px + pw * 0.7, py + ph * 0.38, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(px, py + ph * 0.72, pw, ph * 0.28);
    }
    ctx.restore();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(60,40,20,0.35)";
    roundRect(ctx, px, py, pw, ph, 9);
    ctx.stroke();
  }
}

/** The looks: a tab for every kind, and a grid of cards under it. A card shows what it is, and has a button to buy it, put it on, or (when it is on) a mark. */
function drawLooksPage(ctx: CanvasRenderingContext2D): void {
  const w = BOOK.w;
  pageHead(ctx, t("lookLabel"), t("looks"), "#8a3fa0", t("looksSub"));
  const tx = 26;
  const tw = w - 26 - 14;
  tabBar(ctx, LOOK_TABS.map((k) => t(k)), ui.lookTab, "looks:tab", 134);
  // The cards.
  const kind = LOOK_KINDS[Math.min(LOOK_KINDS.length - 1, Math.max(0, ui.lookTab))];
  const gap = 8;
  const cw = (tw - 2 * gap) / 3;
  const ch = 100;
  looksOf(kind).forEach((look, i) => {
    const x = tx + (i % 3) * (cw + gap);
    const y = 176 + Math.floor(i / 3) * (ch + 8);
    const owned = look.price === 0 || ui.looksOwned.includes(lookKey(kind, look.id));
    const on = ui.look[kind] === look.id;
    // (green: the one in use, blue: bought, and cream: not bought yet)
    softCard(ctx, x, y, cw, ch, 14, on ? "green" : owned ? "blue" : "cream");
    drawLookPreview(ctx, kind, look.id, x, y, cw);
    // (the colours the wrong way round are hard to play: a warning above the balls)
    if (kind === "numbers" && look.id === "reverse") write(ctx, t("lkDare"), x + cw / 2, y + 11, 9, "#c23b30", "center", 800);
    write(ctx, t(LOOK_NAME[`${kind}:${look.id}`]), x + cw / 2, y + 66, 12, INK, "center", 700);
    const btn = {x: x + 7, y: y + ch - 24, w: cw - 14, h: 19};
    if (on) drawButton(ctx, `looks:use:${kind}:${look.id}`, btn, t("lookOn"), "green", {size: 11.5});
    else if (owned) drawButton(ctx, `looks:use:${kind}:${look.id}`, btn, t("lookPick"), "blue", {size: 11.5});
    else {
      const afford = ui.coins >= look.price;
      drawButton(ctx, `looks:buy:${kind}:${look.id}`, btn, "", afford ? "primary" : "secondary", {
        draw: (c, bx, by, ink) => coinAmount(c, look.price, bx, by, 12, afford ? ink : "#f6efe0", afford ? "rgba(255,246,206,0.75)" : "rgba(14,8,24,0.85)"),
      });
    }
  });
}

/** A tag at the top edge of a page, in the colour of its group (brown for the contents, orange for today, green for the chapters, blue for the match modes, purple for the shop): the same colour as the tab and the page number. */
function drawTopTag(ctx: CanvasRenderingContext2D, index: number): void {
  const c = TAB_GROUPS[groupOfPage(index)].color;
  // (the same tab as the one on the edge of the book, turned to hang from the top edge of the page: quiet, a bit see-through, with the word of its group)
  const tw = 64;
  const th = 17;
  const x = BOOK.w / 2 - tw / 2;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.roundRect(x + 0.5, -2, tw, th + 2, [0, 0, 8, 8]);
  ctx.fill();
  const fill = ctx.createLinearGradient(0, 0, 0, th);
  fill.addColorStop(0, c.light);
  fill.addColorStop(0.6, c.mid);
  fill.addColorStop(1, c.deep);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, -2, tw, th + 2, [0, 0, 8, 8]);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.edge;
  ctx.stroke();
  // The word of the group, in white (not a sign).
  const label = t(TAB_LABEL[groupOfPage(index)]);
  ctx.font = `700 10.5px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.strokeText(label, BOOK.w / 2, 7.5, tw - 8);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, BOOK.w / 2, 7.5, tw - 8);
  ctx.restore();
}

/** The back cover: the green leather of the book (the same as the front), a gold frame, "coming soon" and the button for writing to us. */
/** The green leather of a cover: the soft light, the shade by the spine, the holes of the spiral and the gold frame. */
function drawCoverBase(ctx: CanvasRenderingContext2D): void {
  const {w, h} = BOOK;
  const leather = ctx.createLinearGradient(0, 0, w, h);
  leather.addColorStop(0, "#3d5f46");
  leather.addColorStop(1, "#1f3626");
  ctx.fillStyle = leather;
  ctx.fillRect(0, 0, w, h);
  // A soft light in the middle, and the shade next to the spine.
  const glow = ctx.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.4, w * 0.8);
  glow.addColorStop(0, "rgba(255,255,230,0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const spine = ctx.createLinearGradient(0, 0, 34, 0);
  spine.addColorStop(0, "rgba(0,0,0,0.4)");
  spine.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 34, h);
  // The holes of the spiral.
  for (const hy of SPIRAL_AT) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(HOLE_X, hy, HOLE_R, 0, TAU);
    ctx.fill();
  }
  // The gold frame.
  ctx.strokeStyle = "rgba(255,213,74,0.55)";
  ctx.lineWidth = 2.2;
  roundRect(ctx, 28, 22, w - 44, h - 44, 16);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,213,74,0.3)";
  roundRect(ctx, 34, 28, w - 56, h - 56, 12);
  ctx.stroke();
}

/**
 * The front cover of the book: the title, the ball with the 10, a few words about why it is good to train the brain with numbers, and a button that opens the book.
 */
function drawFrontCover(ctx: CanvasRenderingContext2D, time: number): void {
  const {w, h} = BOOK;
  drawCoverBase(ctx);
  const cx = w / 2 + 8;
  text(ctx, "PERFECT 10", cx, 82, 38, "#f4d36a", "center", "rgba(20,36,24,0.9)");
  flourish(ctx, cx, 110, 78);
  // The ball with the 10, with a soft golden light round it.
  const glow = ctx.createRadialGradient(cx, 186, 20, cx, 186, 100);
  glow.addColorStop(0, "rgba(255,226,120,0.4)");
  glow.addColorStop(1, "rgba(255,226,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 120, 76, 240, 220);
  drawBall(ctx, cx, 186 + Math.sin(time * 1.6) * 3, 10, 2.3, time, 0, "add");
  // Why it is good.
  text(ctx, t("coverTag"), cx, 272, 24, "#ffe9a0", "center", "rgba(20,36,24,0.9)");
  ctx.font = `600 16px ${FONT}`;
  wrapLines(ctx, t("coverLine"), w - 112).forEach((line, i) => write(ctx, line, cx, 308 + i * 22, 16, "#d9ead9", "center", 600));
  drawButton(ctx, `toc:${CONTENTS_PAGE}`, {x: cx - 100, y: h - 102, w: 200, h: 50}, t("coverOpen"), "primary", {pulse: time, size: 21});
}

function drawBackCover(ctx: CanvasRenderingContext2D, time: number): void {
  const {w, h} = BOOK;
  drawCoverBase(ctx);
  const cx = w / 2 + 8;
  write(ctx, "PERFECT 10", cx, 112, 30, "#f4d36a", "center", 700);
  flourish(ctx, cx, 136, 70);
  text(ctx, t("onlineSoon"), cx, 220, 40, "#ffe9a0", "center", "rgba(20,36,24,0.9)");
  ctx.font = `600 16px ${FONT}`;
  wrapLines(ctx, t("backLine"), w - 110).forEach((line, i) => write(ctx, line, cx, 280 + i * 22, 16, "#cfe3d2", "center", 600));
  // Writing to us.
  write(ctx, t("backAsk"), cx, h - 138, 15, "#e8f2ea", "center", 700);
  drawButton(ctx, "support", {x: cx - 100, y: h - 114, w: 200, h: 48}, t("backSend"), "primary", {pulse: time, size: 20});
}

/** The paper of one page, and what is written on it. Drawn at the origin: the caller puts it where it goes. */
function paintPage(ctx: CanvasRenderingContext2D, index: number, b: Book, _g: GameState, time: number): void {
  const {w, h} = BOOK;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 12);
  ctx.clip();
  // The page after the last one is the back cover of the book: green leather, with what is coming and a way to write to us.
  if (PAGES[index] === "back") {
    drawBackCover(ctx, time);
    ctx.restore();
    return;
  }
  // The first page is the front cover.
  if (PAGES[index] === "cover") {
    drawFrontCover(ctx, time);
    ctx.restore();
    return;
  }
  // Paper with school-book lines and a red margin.
  const paper = ctx.createLinearGradient(0, 0, w, 0);
  paper.addColorStop(0, "#f7efdb");
  paper.addColorStop(1, "#ebe0c5");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(80,110,160,0.12)";
  ctx.lineWidth = 1;
  for (let y = 142; y < h - 8; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  // The shade next to the spine, and the holes the spiral goes through.
  const spine = ctx.createLinearGradient(0, 0, 30, 0);
  spine.addColorStop(0, "rgba(60,40,10,0.3)");
  spine.addColorStop(1, "rgba(60,40,10,0)");
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 30, h);
  for (const hy of SPIRAL_AT) {
    const hole = ctx.createRadialGradient(HOLE_X, hy - 1.5, 0.5, HOLE_X, hy, HOLE_R);
    hole.addColorStop(0, "#0e0b07");
    hole.addColorStop(1, "#3b3022");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(HOLE_X, hy, HOLE_R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,250,235,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(HOLE_X, hy, HOLE_R + 0.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const mode = PAGES[index];
  if (mode === "contents") drawContentsPage(ctx, b);
  else if (mode === "tutorial") drawTutorialPage(ctx, b, time);
  else if (mode === "daily") drawDailyPage(ctx, time);
  else if (mode === "shop") drawShopPage(ctx);
  else if (mode === "looks") drawLooksPage(ctx);
  else if (mode === "buy") drawBuyPage(ctx);
  else if (mode === "save" || mode === "sixeight" || mode === "defend" || mode === "ice" || mode === "fast" || mode === "find" || mode === "shield" || mode === "jet" || mode === "comet" || mode === "snake" || mode === "cannon" || mode === "line" || mode === "mine" || mode === "ninja") drawVariantPage(ctx, b, mode, time);
  else if (mode === "online") drawOnlinePage(ctx, b, time);
  else if (isChapter(mode)) drawLevelsPage(ctx, b, mode);
  else drawEndlessPage(ctx, b, time);
  drawTopTag(ctx, index);
  ctx.restore();
}

// ---- Turning a page -------------------------------------------------------------------

let buffer: HTMLCanvasElement | null = null;

/** Draws a page into a picture, so that it can be sliced into rows for the page turn. */
function pictureOfPage(index: number, b: Book, g: GameState, time: number): HTMLCanvasElement {
  const s = ui.px;
  const bw = Math.ceil(BOOK.w * s);
  const bh = Math.ceil(BOOK.h * s);
  if (!buffer || buffer.width !== bw || buffer.height !== bh) {
    buffer = document.createElement("canvas");
    buffer.width = bw;
    buffer.height = bh;
  }
  const bc = buffer.getContext("2d")!;
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.clearRect(0, 0, bw, bh);
  bc.setTransform(s, 0, 0, s, 0, 0);
  paintPage(bc, index, b, g, time);
  return buffer;
}

const ROWS = 96;
/** How much sooner the top of a page turns than the bottom: it peels from the top. */
const LEAD = 0.55;

/**
 * The page on top, `f` of the way turned. It peels from the top: the top rows turn first, so the free edge is slanted.
 * At the start and the end it trembles a little at the top.
 */
function drawTurning(ctx: CanvasRenderingContext2D, picture: HTMLCanvasElement, f: number, time: number, stiff = false): void {
  const s = ui.px;
  const edgeF = Math.min(f, 1 - f);
  const rowH = BOOK.h / ROWS;
  for (let r = 0; r < ROWS; r++) {
    const y0 = r * rowH;
    const yc = (r + 0.5) / ROWS;
    // (a cover is stiff: it turns flat, with no lead at the top and no ripple)
    let a = stiff ? f : f * (1 + LEAD) - yc * LEAD;
    // A smooth ripple down the page (not noise from row to row), strongest at the top.
    if (!stiff && edgeF < 0.3) a += Math.sin(time * 30 + yc * 9) * 0.017 * Math.sin((edgeF / 0.3) * Math.PI) * (1 - yc * 0.75);
    a = Math.min(1, Math.max(0, a));
    const dw = BOOK.w * Math.cos((a * Math.PI) / 2);
    if (dw < 0.6) continue;
    const x = BOOK.x;
    const y = BOOK.y + y0;
    // The shadow the turning page throws on the page under it.
    const sh = ctx.createLinearGradient(x + dw, 0, x + dw + 38, 0);
    sh.addColorStop(0, `rgba(30,20,5,${0.34 * (0.4 + a * 0.6)})`);
    sh.addColorStop(1, "rgba(30,20,5,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(x + dw, y, Math.min(38, BOOK.w - dw), rowH + 0.6);
    // The row of the page itself, narrowed, and shaded the more it has turned.
    ctx.drawImage(picture, 0, y0 * s, picture.width, rowH * s + 1, x, y, dw, rowH + 0.7);
    ctx.fillStyle = `rgba(30,20,5,${a * 0.34})`;
    ctx.fillRect(x, y, dw, rowH + 0.7);
    // A line of light along the bending edge.
    const lw = Math.min(16, dw);
    const hl = ctx.createLinearGradient(x + dw - lw, 0, x + dw, 0);
    hl.addColorStop(0, "rgba(255,250,235,0)");
    hl.addColorStop(1, `rgba(255,250,235,${0.28 * Math.sin(a * Math.PI)})`);
    ctx.fillStyle = hl;
    ctx.fillRect(x + dw - lw, y, lw, rowH + 0.7);
  }
}

// ---- The whole book -------------------------------------------------------------------

/** A chevron pointing left (dir -1) or right (dir 1), centred on (x, y). */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 4.5 * dir, y - 8);
  ctx.lineTo(x + 3.5 * dir, y);
  ctx.lineTo(x - 4.5 * dir, y + 8);
  ctx.stroke();
}

/** The colours of a group of pages: the light top of a tab, its middle, its dark foot, its edge, and the ink for a number on the middle colour. */
interface GroupColor {
  light: string;
  mid: string;
  deep: string;
  edge: string;
  ink: string;
}

/**
 * The pages of the book in groups, each with a colour (the tabs on the right edge of the book, the page numbers, and the edge of the lines in the contents
 * follow it): the contents (brown), the tutorial and the daily steps (orange), the chapters (green), the match modes (blue), and the shop, looks and
 * purchase pages (purple).
 */
export const TAB_GROUPS: {id: string; color: GroupColor; icon: string}[] = [
  {id: "toc", color: {light: "#c79a63", mid: "#9a6a37", deep: "#7d5328", edge: "#4e3216", ink: "#fff6e6"}, icon: "M3 11.5L12 4l9 7.5M5.5 10v9.5h4.5v-5h4v5h4.5V10"},
  {id: "today", color: {light: "#ffc66b", mid: "#f09a27", deep: "#d27d10", edge: "#7a4a08", ink: "#4a2a05"}, icon: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"},
  {id: "chapters", color: {light: "#7fdc9b", mid: "#36ad5b", deep: "#2a8f49", edge: "#14582b", ink: "#06361a"}, icon: "M7 21V4M7 5h11l-2.5 3.8 2.5 3.7H7"},
  {id: "match", color: {light: "#8fc6ff", mid: "#3f86e0", deep: "#2f6cc0", edge: "#163e7c", ink: "#06233f"}, icon: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8"},
  {id: "shop", color: {light: "#c9a4f2", mid: "#8a5cc8", deep: "#6f46aa", edge: "#3e2468", ink: "#ffffff"}, icon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v8M9 12h6"},
];

/** Which group a page belongs to (an index into TAB_GROUPS). */
export function groupOfPage(page: number): number {
  const p = PAGES[Math.min(LAST, Math.max(0, page))];
  if (p === "contents" || p === "cover") return 0;
  if (p === "tutorial" || p === "daily") return 1;
  if (isChapter(p as Mode)) return 2;
  if (MATCH_PAGES.includes(p)) return 3;
  return 4;
}

/** The page a tab goes to: the contents, the daily steps, the chapter the player is on, the match mode that was visited last, or the shop. */
export function tabTarget(b: Book, group: number): number {
  if (group === 0) return CONTENTS_PAGE;
  if (group === 1) return PAGES.indexOf("daily");
  if (group === 2) {
    const cur = currentPage(b);
    const p = PAGES[cur];
    return isChapter(p as Mode) ? cur : p === "endless" ? pageOfMode("space") : pageOfMode("plus");
  }
  if (group === 3) {
    const last = PAGES.indexOf(ui.lastMatch as Page);
    return last >= 0 ? last : PAGES.indexOf("endless");
  }
  return SHOP_PAGE;
}

/** The tabs on the right edge of the book: where the first one is, how tall each is, and how far apart. */
const TAB = {y: BOOK.y + 50, h: 50, pitch: 56, w: 22, wOn: 32};

/** The coloured tabs on the right edge, one for each group of pages (a setting: they can be hidden): the one the book is open at sticks out further. A tap goes to the group. */
function drawTabs(ctx: CanvasRenderingContext2D, b: Book): void {
  const here = ui.scrubAmt > 0.02 ? b.target : Math.round(b.pos);
  const active = PAGES[here] === "back" ? -1 : groupOfPage(here);
  TAB_GROUPS.forEach((grp, k) => {
    const on = k === active;
    const wk = on ? TAB.wOn : TAB.w;
    const x = W - wk;
    const y = TAB.y + k * TAB.pitch;
    const c = grp.color;
    registerHit(ctx, `side:${k}`, {x: x - 2, y, w: wk + 2, h: TAB.h});
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.88;
    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.beginPath();
    ctx.roundRect(x - 2.5, y + 3, wk + 6, TAB.h, [11, 0, 0, 11]);
    ctx.fill();
    const fill = ctx.createLinearGradient(0, y, 0, y + TAB.h);
    fill.addColorStop(0, c.light);
    fill.addColorStop(0.55, c.mid);
    fill.addColorStop(1, c.deep);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, wk + 6, TAB.h, [11, 0, 0, 11]);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = c.edge;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 11, y + 1.8);
    ctx.lineTo(W, y + 1.8);
    ctx.stroke();
    const s = on ? 0.82 : 0.6;
    drawBarSign(ctx, grp, x + wk / 2 + 1, y + TAB.h / 2, 24 * s, "#ffffff");
    ctx.restore();
  });
}

/** The bar at the bottom of the screen (like the one in Forza Manager): how tall it is, and the round button in the middle that sticks up over its top edge. */
export const BAR = {h: 64, round: 26, rise: 14, side: 64};

/**
 * The groups in the order they have on the bar, left to right. The one in the middle is the big round one: the Levels until every level of the book
 * has been cleared, and the Match modes after that (then the Levels move over to its place).
 */
export function barOrder(b: Book): number[] {
  const done = CHAPTER_MODES.every((m) => chapterCleared(b, m));
  return done ? [0, 1, 3, 2, 4] : [0, 1, 2, 3, 4];
}

/** The short word of each group, written on the tag at the top of its pages: in the order of TAB_GROUPS. */
const TAB_LABEL: Key[] = ["tabToc", "tabToday", "tabChapters", "tabMatch", "tabShop"];

/** The pages a group of the bar pops out when it is tapped (only the match modes and the shop do: the others go straight to their page). */
export function subPages(group: number): number[] {
  if (group === 3) return MATCH_PAGES.map((p) => PAGES.indexOf(p));
  if (group === 4) return [SHOP_PAGE, PAGES.indexOf("looks"), BUY_PAGE];
  return [];
}

/** The sign of a page in the arc over the bar (lines in a 24 by 24 square, like the signs of the groups). */
const SUB_ICON: Partial<Record<Page, string>> = {
  endless: "M12 12c-1.5-2.5-3-4-5-4a4 4 0 0 0 0 8c2 0 3.5-1.5 5-4zm0 0c1.5 2.5 3 4 5 4a4 4 0 0 0 0-8c-2 0-3.5 1.5-5 4z",
  save: "M5 5h11v7a5.5 5.5 0 0 1-11 0zM16 7h2.5a2.5 2.5 0 0 1 0 5H16M6 20.5h10",
  sixeight: "M4 12h16M12 6.2v.1M12 17.8v.1",
  defend: "M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4.2 3 5.2V19h8v-3.8c1.8-1 3-2.7 3-5.2a7 7 0 0 0-7-7zM9 10.5v.1M15 10.5v.1M10 19v2M14 19v2",
  ice: "M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 3 3-3M9 20l3-3 3 3",
  shield: "M3 13a9 9 0 0 1 18 0M6 13a6 6 0 0 1 12 0M12 2v2M8 18l-2 3M16 18l2 3",
  jet: "M12 2l2 6v4l7 4v2l-7-2v4l2 2v1l-4-1-4 1v-1l2-2v-4l-7 2v-2l7-4V8z",
  comet: "M15 9a3 3 0 1 0 0 .1M13 11L3 21M12 8L5 15M16 12l-7 7",
  snake: "M3 6h13a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h10M18 16l3 2-3 2",
  cannon: "M7 15l9-9 3 3-9 9zM5 20a3 3 0 1 0 6 0 3 3 0 0 0-6 0M18 4l2-2M20 7h2M15 2V0",
  line: "M5 5h3v3H5zM10.5 10.5h3v3h-3zM16 5h3v3h-3zM6.5 6.5l5.5 5.5 5.5-5.5M4 19h16",
  mine: "M4 9l8-5 8 5M7 7.2V20M17 7.2V20M7 20h10M12 10v6M9.5 13h5",
  ninja: "M21 3c-2.5 1-8 5.5-11.5 9M8 10.5l5.5 5.5M7.2 14.8L3.5 18.5M2.8 19.2l2 2",
  find: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM16 16l5 5M7.5 10.5h6M10.5 7.5v6",
  fast: "M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10V4.5a1.5 1.5 0 0 1 3 0V11M15 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4L4 12.5a1.5 1.5 0 0 1 2.5-1.5L9 13.5M2 4l2 2M2 9h2M5 1.5l.8 2.5",
  online: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18",
  shop: "M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8",
  looks: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16.5v3M17 18h3",
  buy: "M3 7h18v11H3zM3 11h18M7 15h4",
};

/** Whether a page of the arc is shut (the match modes that have not been opened yet). */
function subLocked(b: Book, page: Page): boolean {
  if (page === "endless") return !isUnlocked(b, "endless", 0);
  if (page === "save" || page === "sixeight" || page === "defend" || page === "ice" || page === "fast" || page === "find" || page === "shield" || page === "jet" || page === "comet" || page === "snake" || page === "cannon" || page === "line" || page === "mine" || page === "ninja" || page === "online") return !variantOpen(b, page);
  return false;
}

/** Draws the sign of a group (the same lines as the tab used to have) with its centre at cx, cy, size px high. */
function drawBarSign(ctx: CanvasRenderingContext2D, grp: (typeof TAB_GROUPS)[number], cx: number, cy: number, size: number, ink: string): void {
  const k = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * k, cy - 12 * k);
  ctx.scale(k, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.translate(0, 1);
  ctx.stroke(new Path2D(grp.icon));
  ctx.translate(0, -1);
  ctx.strokeStyle = ink;
  ctx.stroke(new Path2D(grp.icon));
  ctx.restore();
}

/**
 * The bar along the bottom edge of the screen, one place for each group of pages: the one the book is open at is lit in the colour of its group, and the one
 * in the middle is a big round button. A tap goes to the group. (It is drawn in the game's own coordinates, with the bottom of the screen at y = 640.)
 */
export function drawMenuBar(ctx: CanvasRenderingContext2D, b: Book): void {
  if (ui.coverIntro || ui.layout !== "menu") return; // (the very first start, or the tabs on the edge are used instead)
  const here = ui.scrubAmt > 0.02 ? b.target : Math.round(b.pos);
  const active = PAGES[here] === "back" ? -1 : groupOfPage(here); // (nothing is lit at the back cover)
  const top = H - BAR.h;
  const order = barOrder(b);
  const open = ui.barOpen >= 0 && subPages(ui.barOpen).length > 0 ? ui.barOpen : -1;
  if (open >= 0) {
    // (everything over the bar is dimmed, and a tap anywhere on it closes the arc)
    ctx.fillStyle = "rgba(6,3,1,0.62)";
    ctx.fillRect(0, -ui.extra, W, H + ui.extra);
    registerHit(ctx, "barBackdrop", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
  }
  // The bar itself: dark wood, rounded at the top, with a light line along its top edge and a shadow up over the table.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.roundRect(0, top - 5, W, BAR.h + 5, [20, 20, 0, 0]);
  ctx.fill();
  const wood = ctx.createLinearGradient(0, top, 0, H);
  wood.addColorStop(0, "#3a2616");
  wood.addColorStop(1, "#22150b");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(0, top, W, BAR.h + 40, [20, 20, 0, 0]);
  ctx.fill();
  // (the bar follows the tone that is chosen in the Looks, like the room does)
  ctx.save();
  ctx.clip();
  applyTint(ctx, ui.look.tint, 0, top, W, BAR.h + 40);
  ctx.restore();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(255,213,74,0.35)";
  ctx.stroke();
  registerHit(ctx, "menuBar", {x: 0, y: top - BAR.rise, w: W, h: BAR.h + BAR.rise + 40});
  ctx.restore();

  // The places: two on each side and the round one in the middle (the sides share what is left of the width).
  const mid = order.length >> 1;
  const sideW = (W - 12 - BAR.side) / (order.length - 1);
  const centreOf = (slot: number): number => (slot === mid ? W / 2 : slot < mid ? 6 + sideW * (slot + 0.5) : W - 6 - sideW * (order.length - slot - 0.5));
  order.forEach((group, slot) => {
    const grp = TAB_GROUPS[group];
    const c = grp.color;
    const on = group === active || group === open;
    const cx = centreOf(slot);
    const isMid = slot === mid;
    const w = isMid ? BAR.side : sideW;
    registerHit(ctx, `tab:${group}`, {x: cx - w / 2, y: top - (isMid ? BAR.rise : 0), w, h: BAR.h + (isMid ? BAR.rise : 0)});
    const word = t(TAB_LABEL[group]);
    if (isMid) {
      // The big round button: in the colour of its group, sticking up over the edge of the bar, with a dark ring round it.
      const cy = top + 12;
      const r = BAR.round;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.arc(cx, cy + 3, r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22150b";
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fill();
      const fill = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 2, cx, cy, r);
      fill.addColorStop(0, c.light);
      fill.addColorStop(0.6, c.mid);
      fill.addColorStop(1, c.deep);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = on ? 3 : 1.6;
      ctx.strokeStyle = on ? "#ffffff" : c.edge;
      ctx.stroke();
      ctx.restore();
      drawBarSign(ctx, grp, cx, cy, 28, "#ffffff");
      write(ctx, word, cx, top + 49, 10.5, on ? c.light : "#f3ecdd", "center", 700);
      return;
    }
    const cy = top + 22;
    const ink = on ? c.light : "rgba(243,236,221,0.72)";
    if (on) {
      // (the one that is open: a short bar in its colour along the top edge of the bar)
      ctx.fillStyle = c.mid;
      ctx.beginPath();
      ctx.roundRect(cx - 14, top - 1, 28, 3.4, [0, 0, 3, 3]);
      ctx.fill();
    }
    drawBarSign(ctx, grp, cx, cy, 24, ink);
    write(ctx, word, cx, top + 49, 10.5, ink, "center", on ? 700 : 600);
    // A marker on Today while the daily challenge has not been started today (green, with a play triangle, like the button for the free coins in the shop).
    // (and while the gift of the day is waiting)
    if (group === 1 && (!ui.dailyUsed || ui.giftReady)) drawMarker(ctx, cx + 13, cy - 11);
    // The same on Shop while the free coins of the Purchase page can be got.
    if (group === 4 && ui.videoReady) drawMarker(ctx, cx + 13, cy - 11);
  });
  if (open >= 0) drawArc(ctx, b, open, top, here);
}

/** A little round marker: green, with a white play triangle (something is waiting to be done). */
function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.arc(x, y + 1.5, 8.5, 0, Math.PI * 2);
  ctx.fill();
  const fill = ctx.createLinearGradient(0, y - 8, 0, y + 8);
  fill.addColorStop(0, "#8cf0a8");
  fill.addColorStop(1, "#25b457");
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#0f6a30";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x - 2.6, y - 4);
  ctx.lineTo(x - 2.6, y + 4);
  ctx.lineTo(x + 4, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The pages of a group, popped out in an arc over the middle of the bar (like in Forza Manager): a round button with a sign for each, and its name under it.
 * They pop out one after the other. The page the book is open at is lit in the colour of the group. A tap goes to the page.
 */
function drawArc(ctx: CanvasRenderingContext2D, b: Book, group: number, top: number, here: number): void {
  const pages = subPages(group);
  // (many pages (the match modes): a slider instead, that the finger scrolls sideways)
  if (pages.length > 6) {
    drawSlider(ctx, b, group, top, here);
    return;
  }
  const c = TAB_GROUPS[group].color;
  const px = W / 2;
  const py = top + 4;
  const age = performance.now() / 1000 - ui.barOpenAt;
  // (up to four in one arc; more go in two rows: the first half in an outer arc, the rest in an inner one under it)
  const twoRows = pages.length > 4;
  const outer = twoRows ? Math.ceil(pages.length / 2) : pages.length;
  // (with many (the match modes) they stand in a grid of three across instead, the last row nearest the bar)
  const grid = pages.length > 6;
  const rows = Math.ceil(pages.length / 3);
  pages.forEach((index, k) => {
    const page = PAGES[index];
    const inOuter = k < outer;
    const row = inOuter ? outer : pages.length - outer;
    const kk = inOuter ? k : k - outer;
    const radius = !twoRows ? 130 : inOuter ? 222 : 118;
    const step = !twoRows ? 36 : inOuter ? 36 : 46;
    const a = ((kk - (row - 1) / 2) * step * Math.PI) / 180;
    const p = Math.min(1, Math.max(0, (age - k * 0.035) / 0.22));
    const back = p - 1;
    const pop = p >= 1 ? 1 : 1 + 2.70158 * back * back * back + 1.70158 * back * back; // (it overshoots a little, and settles)
    const spread = Math.min(1, p * 1.4);
    // (in two rows the places are spread evenly across the width, with a gentle curve, so that four of them fit in a row)
    const off = kk - (row - 1) / 2;
    const gRow = Math.floor(k / 3);
    const tx = grid ? px + ((k % 3) - 1) * 104 : twoRows ? px + off * 82 : px + Math.sin(a) * radius;
    const ty = grid ? py - 92 - (rows - 1 - gRow) * 86 : twoRows ? py - (inOuter ? 208 : 116) + off * off * (inOuter ? 9 : 14) : py - Math.cos(a) * radius;
    const x = px + (tx - px) * spread;
    const y = py + (ty - py) * spread;
    const r = 28 * Math.max(0.01, pop);
    const lit = index === here;
    const locked = subLocked(b, page);
    registerHit(ctx, `sub:${index}`, {x: x - 34, y: y - 34, w: 68, h: 82});
    ctx.save();
    ctx.globalAlpha = p * (locked ? 0.6 : 1);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(x, y + 3, r, 0, Math.PI * 2);
    ctx.fill();
    const fill = ctx.createLinearGradient(0, y - r, 0, y + r);
    fill.addColorStop(0, lit ? c.light : "#5a3d27");
    fill.addColorStop(1, lit ? c.deep : "#2c1c10");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!lit) {
      ctx.save();
      ctx.clip();
      applyTint(ctx, ui.look.tint, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.lineWidth = lit ? 3 : 1.6;
    ctx.strokeStyle = lit ? "#ffffff" : c.mid;
    ctx.stroke();
    const icon = SUB_ICON[page];
    if (icon) {
      ctx.translate(x - 12 * pop, y - 12 * pop);
      ctx.scale(pop, pop);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.translate(0, 1);
      ctx.stroke(new Path2D(icon));
      ctx.translate(0, -1);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke(new Path2D(icon));
    }
    ctx.restore();
    // (the Purchase page has the marker while the free coins can be got)
    if (page === "buy" && ui.videoReady && p >= 1) drawMarker(ctx, x + r * 0.72, y - r * 0.72);
    // The name under the button (made smaller if it is long, so that it stays clear of the next one).
    ctx.save();
    ctx.globalAlpha = p * (locked ? 0.7 : 1);
    const name = pageName(page);
    ctx.font = `700 11px ${FONT}`;
    const size = Math.min(11, (11 * 66) / Math.max(1, ctx.measureText(name).width));
    write(ctx, name, x, y + r + 11, size, "rgba(0,0,0,0.6)", "center", 700);
    write(ctx, name, x, y + r + 10, size, lit ? c.light : "#fff6e6", "center", 700);
    ctx.restore();
  });
}

/** The four grey buttons under the book: to the first page, one page back, one page forward and to the last page. */
const FIRST_BUTTON: Button = {x: 14, y: 591, w: 36, h: 38};
const PREV_BUTTON: Button = {x: FIRST_BUTTON.x + FIRST_BUTTON.w + 2, y: 591, w: 36, h: 38};
const LAST_BUTTON: Button = {x: W - 14 - 36, y: 591, w: 36, h: 38};
const NEXT_BUTTON: Button = {x: LAST_BUTTON.x - 2 - 36, y: 591, w: 36, h: 38};
/** The strip with the page numbers, between the buttons (game units): a finger dragged along it turns the pages. */
export const PAGER = {x: PREV_BUTTON.x + PREV_BUTTON.w, w: NEXT_BUTTON.x - (PREV_BUTTON.x + PREV_BUTTON.w)};

/** A chevron with a bar at its tip (to the end of the book): dir -1 points left, 1 points right. */
function endChevron(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, color: string): void {
  chevron(ctx, x + 2.5 * dir, y, dir, color);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 6.5 * dir, y - 8);
  ctx.lineTo(x + 6.5 * dir, y + 8);
  ctx.stroke();
}

/** Whether the grey buttons and the page numbers under the book are shown (they are hidden: the bar at the bottom and the contents go to the pages, and a swipe turns them). */
const SHOW_PAGER = false;

function drawNav(ctx: CanvasRenderingContext2D, b: Book): void {
  if (!SHOW_PAGER) return;
  // (the same grey button on both sides: the ones for the first and the previous page, and for the next and the last)
  if (b.target > 0) {
    drawButton(ctx, "first", FIRST_BUTTON, "", "round", {draw: (c, cx, cy, ink) => endChevron(c, cx, cy, -1, ink)});
    drawButton(ctx, "prev", PREV_BUTTON, "", "round", {draw: (c, cx, cy, ink) => chevron(c, cx - 1, cy, -1, ink)});
  }
  if (b.target < LAST) {
    drawButton(ctx, "next", NEXT_BUTTON, "", "round", {draw: (c, cx, cy, ink) => chevron(c, cx + 1, cy, 1, ink)});
    // (the button for the last page goes to the Purchase page, so it is not there when the book is at it, or at the back cover after it)
    if (b.target < BUY_PAGE) drawButton(ctx, "last", LAST_BUTTON, "", "round", {draw: (c, cx, cy, ink) => endChevron(c, cx, cy, 1, ink)});
  }
  // The pages, as numbers: the first and the last, and the one you are on with its neighbours (the pages in between are "..."), so that it
  // stays small however many pages there are. Every number can be pressed, to go straight to that page.
  const here = ui.scrubAmt > 0.02 ? b.target : Math.round(b.pos);
  const shown = [...new Set([0, LAST, here - 1, here, here + 1].filter((i) => i >= 0 && i <= LAST))].sort((a, c) => a - c);
  const items: (number | null)[] = [];
  shown.forEach((p, k) => {
    items.push(p);
    const next = shown[k + 1];
    if (next !== undefined && next - p === 2) items.push(p + 1);
    else if (next !== undefined && next - p > 2) items.push(null);
  });
  // (the whole strip can be pressed and dragged along, to turn the pages quickly: see GameCanvas)
  registerHit(ctx, "pageStrip", {x: PAGER.x, y: 593, w: PAGER.w, h: 36});
  const chipW = 22;
  const gapW = 2;
  // While a finger is dragged along the strip the page it is on swells (and its neighbours a little), the way the icons of a dock do.
  // (the numbers further away shrink to make room, so that the strip does not grow past the buttons)
  const grow = (p: number) => 1 + ui.scrubAmt * (p === here ? 0.6 : Math.abs(p - here) === 1 ? 0.2 : -0.27);
  const widths = items.map((p) => (p === null ? chipW * (1 - 0.27 * ui.scrubAmt) : chipW * grow(p)));
  const total = widths.reduce((a, c) => a + c, 0) + (items.length - 1) * gapW;
  let x = PAGER.x + PAGER.w / 2 - total / 2;
  items.forEach((p, k) => {
    const wk = widths[k];
    const cx = x + wk / 2;
    x += wk + gapW;
    if (p === null) {
      write(ctx, "…", cx, 609, 14, "rgba(243,236,221,0.7)", "center", 700);
      return;
    }
    const s = grow(p);
    const on = p === here;
    const h = 20 * s;
    registerHit(ctx, `page:${p}`, {x: cx - wk / 2 - 1, y: 595, w: wk + 2, h: 32});
    // (every number has the colour of its group: the one you are on is filled with it, and the others have it as a thin edge)
    const gc = TAB_GROUPS[groupOfPage(p)].color;
    if (on) {
      const g = ctx.createLinearGradient(0, 610 - h / 2, 0, 610 + h / 2);
      g.addColorStop(0, gc.light);
      g.addColorStop(1, gc.mid);
      ctx.fillStyle = g;
    } else ctx.fillStyle = "rgba(20,10,4,0.38)";
    roundRect(ctx, cx - wk / 2, 610 - h / 2, wk, h, h / 2);
    ctx.fill();
    ctx.lineWidth = on ? 1.4 : 1.6;
    ctx.strokeStyle = on ? gc.edge : gc.mid;
    ctx.stroke();
    write(ctx, String(p + 1), cx, 610.5, 11.5 * s, on ? gc.ink : "#f3ecdd", "center", 700);
  });
}

/** The spiral that holds the booklet together: a wire that comes up over the edge of the cover and goes down into a hole in the pages. */
function drawSpiral(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  for (const hy of SPIRAL_AT) {
    const wy = y + hy;
    const wire = () => {
      ctx.beginPath();
      ctx.moveTo(x - 9, wy + 7);
      ctx.bezierCurveTo(x - 8, wy - 4, x + 5, wy - 8, x + HOLE_X, wy - 0.5);
    };
    ctx.lineCap = "round";
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.save();
    ctx.translate(1, 2.4);
    wire();
    ctx.stroke();
    ctx.restore();
    const metal = ctx.createLinearGradient(x - 9, wy - 8, x + 13, wy + 6);
    metal.addColorStop(0, "#8d949e");
    metal.addColorStop(0.45, "#f4f6f8");
    metal.addColorStop(1, "#7b828c");
    ctx.strokeStyle = metal;
    wire();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.save();
    ctx.translate(0, -1.1);
    wire();
    ctx.stroke();
    ctx.restore();
  }
}

export function drawBook(ctx: CanvasRenderingContext2D, b: Book, g: GameState, time: number): void {
  const {x, y, w, h} = BOOK;

  if (ui.headerRows === 2) {
    // Room above: the title on a row of its own, across the whole width.
    logoTitleFit(ctx, "PERFECT10", W / 2, 22 + ui.titleDy, W - 48, ui.titleMax);
  } else {
    // The keys stand under the coins at the top right, and the title fills the room to the left of them, as big as it fits.
    const size = 46;
    const left = 4;
    // (the top of the coins is level with the top of the title: the cap height of the title is about 0.36 of its size over its middle, the coin 9 over its own)
    const wFull = logoWidth(ctx, "PERFECT10", size);
    HEADER.coinsDy = 0;
    const box0 = coinsPillBox(ctx, ui.coins);
    const wLogo = Math.min(box0.x - 8 - left, wFull);
    const shown = Math.min(size, (size * wLogo) / wFull);
    const cy = 38 + ui.titleDy;
    HEADER.coinsDy = cy - shown * 0.36 - (box0.y + box0.h / 2 - 9) - ui.headerDy;
    const coinsBox = coinsPillBox(ctx, ui.coins);
    ENERGY_PILL.w = coinsBox.w;
    ENERGY_PILL.x = coinsBox.x;
    ENERGY_PILL.y = coinsBox.y + coinsBox.h - 6;
    logoTitleFit(ctx, "PERFECT10", left + wLogo / 2, cy, wLogo, size);
  }

  // The book lying on the table: its shadow, the green leather cover, and the edges of the pages under the top one.
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  roundRect(ctx, x - 6, y + 8, w + 22, h + 23, 14);
  ctx.fill();
  // (the cover reaches as far below the pages as above them: the same green at the bottom as at the top)
  const cover = ctx.createLinearGradient(x, y, x + w, y + h);
  cover.addColorStop(0, "#37563f");
  cover.addColorStop(1, "#203828");
  ctx.fillStyle = cover;
  roundRect(ctx, x - 10, y - 8, w + 20, h + 22, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,213,74,0.4)";
  ctx.lineWidth = 1.2;
  roundRect(ctx, x - 6, y - 4, w + 12, h + 14, 11);
  ctx.stroke();
  // (the edges of the pages that lie under the top one: not at the back cover, where there are none)
  const edges = b.jump ? 1 : Math.min(1, Math.max(0, (LAST - b.pos) * 2));
  if (edges > 0) {
    ctx.save();
    ctx.globalAlpha = edges;
    ctx.fillStyle = "#c9bd9d";
    roundRect(ctx, x + 5, y + 7, w, h, 12);
    ctx.fill();
    ctx.fillStyle = "#ddd3b8";
    roundRect(ctx, x + 2.5, y + 3.5, w, h, 12);
    ctx.fill();
    ctx.restore();
  }

  // At the front cover the cover is as big as the back of the book (it lies over the edges of the pages under it).
  if (b.pos < 0.02 && !b.jump) {
    const front = ctx.createLinearGradient(x, y, x + w, y + h);
    front.addColorStop(0, "#3d5f46");
    front.addColorStop(1, "#1f3626");
    ctx.fillStyle = front;
    roundRect(ctx, x - 10, y - 8, w + 20, h + 22, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,213,74,0.4)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, x - 6, y - 4, w + 12, h + 14, 11);
    ctx.stroke();
  }

  // The pages: the next one lies underneath, and the one on top is turned.
  const pos = Math.min(LAST, Math.max(0, b.pos));
  let i = Math.min(LAST, Math.floor(pos));
  let f = pos - i;
  let under = i + 1;
  let turning = f > 0.001 && i < LAST;
  if (b.jump) {
    // A jump over several pages: the page that was open turns over the page that is jumped to (or, going back, the page jumped to turns back over the open one).
    const forward = b.jump.to > b.jump.from;
    i = forward ? b.jump.from : b.jump.to;
    under = forward ? b.jump.to : b.jump.from;
    f = forward ? b.jump.f : 1 - b.jump.f;
    turning = true;
  }
  if (turning) {
    ui.registering = false;
    ctx.save();
    ctx.translate(x, y);
    paintPage(ctx, under, b, g, time);
    ctx.restore();
    drawSpiral(ctx, x, y);
    drawTurning(ctx, pictureOfPage(i, b, g, time), f, time, PAGES[i] === "cover");
    ui.registering = true;
  } else {
    ctx.save();
    ctx.translate(x, y);
    paintPage(ctx, i, b, g, time);
    ctx.restore();
  }

  // The spine of the book, over the left edge of the pages.
  const rib = ctx.createLinearGradient(x - 10, 0, x + 6, 0);
  rib.addColorStop(0, "rgba(0,0,0,0.45)");
  rib.addColorStop(0.5, "rgba(255,255,255,0.08)");
  rib.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rib;
  ctx.fillRect(x - 10, y - 8, 16, h + 17);

  // The spiral is in front of the page that lies still; the page that is being turned goes over it.
  if (!turning) drawSpiral(ctx, x, y);

  drawNav(ctx, b);
  if (ui.layout === "groups" && !ui.coverIntro) drawTabs(ctx, b);
}

/** The biggest size (at most `size`) the words can be written in and still be no wider than `maxW`. */
function fitSize(ctx: CanvasRenderingContext2D, s: string, size: number, maxW: number): number {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  const tw = ctx.measureText(s).width;
  ctx.restore();
  return tw > maxW ? Math.max(8, (size * maxW) / tw) : size;
}

/**
 * The rules of a page: each part (they are split by "|") is wrapped to the width there is, and if that makes more lines than there is room for
 * (`maxLines`) the text is made smaller until it fits. (x, y) is the middle of the first line.
 */
function drawRules(ctx: CanvasRenderingContext2D, rules: string, x: number, y: number, maxW: number, maxLines: number): void {
  let size = 15;
  let lines: string[] = [];
  for (;;) {
    ctx.save();
    ctx.font = `700 ${size}px ${FONT}`;
    lines = rules.split("|").flatMap((part) => wrapLines(ctx, part, maxW));
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.restore();
    if ((lines.length <= maxLines && widest <= maxW) || size <= 10) break;
    size -= 0.5;
  }
  const step = Math.min(20, size * 1.3);
  lines.forEach((line, i) => write(ctx, line, x, y + i * step, size, INK, "center", 700));
}

/** How far apart the buttons of the slider are. */
const SLIDE_PITCH = 80;

/**
 * The match modes over the bar, in a slider: a dark panel with a row of round buttons (a sign and the name under each) that the finger scrolls sideways,
 * with the page the book is open at lit in the colour of the group and marked, soft edges where there is more to scroll to, and a row of dots under it
 * that shows which one is chosen and how far along the row the window is. It slides up as it opens. A tap on a button goes to the page.
 */
function drawSlider(ctx: CanvasRenderingContext2D, b: Book, group: number, top: number, here: number): void {
  const pages = subPages(group);
  const c = TAB_GROUPS[group].color;
  const age = performance.now() / 1000 - ui.barOpenAt;
  const p = Math.min(1, Math.max(0, age / 0.24));
  const ease = 1 - Math.pow(1 - p, 3);
  const px = 10;
  const pw = W - 20;
  const ph = 132;
  const py = top - ph - 14 + (1 - ease) * 40;
  const viewX = px + 14;
  const viewW = pw - 28;
  const total = pages.length * SLIDE_PITCH;
  const maxScroll = Math.max(0, total - viewW);
  // (when it opens, the page the book is open at is put in the middle)
  if (ui.subScroll < 0) {
    const at = Math.max(0, pages.indexOf(here));
    ui.subScroll = at * SLIDE_PITCH + SLIDE_PITCH / 2 - viewW / 2;
  }
  // (after a quick flick it rolls on, slower and slower, and stops at the ends)
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, Math.max(0, now - ui.subT));
  ui.subT = now;
  if (ui.subVel !== 0) {
    ui.subScroll += ui.subVel * dt;
    ui.subVel *= Math.pow(0.04, dt);
    if (Math.abs(ui.subVel) < 8 || ui.subScroll <= 0 || ui.subScroll >= maxScroll) ui.subVel = 0;
  }
  ui.subScroll = Math.min(maxScroll, Math.max(0, ui.subScroll));
  const scroll = ui.subScroll;

  ctx.save();
  ctx.globalAlpha = ease;
  // (no panel: the buttons stand right on the dimmed screen; a tap between them does not close it, only a tap outside the row does)
  registerHit(ctx, "subStrip", {x: px, y: py, w: pw, h: ph});
  // Which one of how many is chosen.
  const chosen = pages.indexOf(here);
  if (chosen >= 0) write(ctx, `${chosen + 1} / ${pages.length}`, px + pw - 18, py + 17, 11, "rgba(255,246,230,0.6)", "right", 700);

  // The row of buttons, clipped to the window.
  const rowY = py + 60;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewX, py + 26, viewW, 90);
  ctx.clip();
  pages.forEach((index, k) => {
    const x = viewX + k * SLIDE_PITCH + SLIDE_PITCH / 2 - scroll;
    if (x < viewX - SLIDE_PITCH || x > viewX + viewW + SLIDE_PITCH) return;
    const page = PAGES[index];
    const lit = index === here;
    const locked = subLocked(b, page);
    const r = lit ? 27 : 24;
    if (x > viewX && x < viewX + viewW) registerHit(ctx, `sub:${index}`, {x: x - SLIDE_PITCH / 2, y: rowY - 34, w: SLIDE_PITCH, h: 84});
    ctx.save();
    ctx.globalAlpha = ease * (locked ? 0.55 : 1);
    if (lit) {
      // (the chosen one: a soft glow round it in the colour of the group)
      const glow = ctx.createRadialGradient(x, rowY, r, x, rowY, r + 16);
      glow.addColorStop(0, c.mid);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = ease * 0.55;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, rowY, r + 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = ease;
    }
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.arc(x, rowY + 3, r, 0, Math.PI * 2);
    ctx.fill();
    const fill = ctx.createLinearGradient(0, rowY - r, 0, rowY + r);
    fill.addColorStop(0, lit ? c.light : "#5a3d27");
    fill.addColorStop(1, lit ? c.deep : "#2c1c10");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, rowY, r, 0, Math.PI * 2);
    ctx.fill();
    if (!lit) {
      ctx.save();
      ctx.clip();
      applyTint(ctx, ui.look.tint, x - r, rowY - r, r * 2, r * 2);
      ctx.restore();
    }
    // (a highlight over the top of the button)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, rowY, r, 0, Math.PI * 2);
    ctx.clip();
    const shine = ctx.createLinearGradient(0, rowY - r, 0, rowY);
    shine.addColorStop(0, "rgba(255,255,255,0.28)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(x - r, rowY - r, r * 2, r);
    ctx.restore();
    ctx.lineWidth = lit ? 3 : 1.6;
    ctx.strokeStyle = lit ? "#ffffff" : c.mid;
    ctx.beginPath();
    ctx.arc(x, rowY, r, 0, Math.PI * 2);
    ctx.stroke();
    const icon = SUB_ICON[page];
    if (icon) {
      ctx.save();
      const k2 = r / 27;
      ctx.translate(x - 12 * k2, rowY - 12 * k2);
      ctx.scale(k2, k2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.translate(0, 1);
      ctx.stroke(new Path2D(icon));
      ctx.translate(0, -1);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke(new Path2D(icon));
      ctx.restore();
    }
    // (a padlock on the ones that are shut)
    if (locked) {
      ctx.fillStyle = "#1c120a";
      ctx.beginPath();
      ctx.arc(x + r * 0.7, rowY - r * 0.7, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffe27a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x + r * 0.7, rowY - r * 0.7 - 1.5, 2.6, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#ffe27a";
      ctx.fillRect(x + r * 0.7 - 3.5, rowY - r * 0.7 - 1, 7, 5);
    }
    ctx.restore();
    // The name under it (smaller if it is long), and a short bar under the chosen one.
    const name = pageName(page);
    const size = fitSize(ctx, name, 11, SLIDE_PITCH - 8);
    ctx.save();
    ctx.globalAlpha = ease * (locked ? 0.7 : 1);
    write(ctx, name, x, rowY + 38, size, "rgba(0,0,0,0.6)", "center", 700);
    write(ctx, name, x, rowY + 37, size, lit ? c.light : "#fff6e6", "center", 700);
    if (lit) {
      ctx.fillStyle = c.light;
      roundRect(ctx, x - 12, rowY + 47, 24, 3, 1.5);
      ctx.fill();
    }
    ctx.restore();
  });
  ctx.restore();
  // (no arrows at the sides: the dots under the row show that there is more to scroll to)
  // The dots: one for each page, the chosen one long and in the colour of the group; the ones in the window are lighter.
  const dotY = py + ph - 12;
  const dw = 6;
  const gap = 5;
  const totalW = pages.length * (dw + gap) - gap + 8;
  let dx = W / 2 - totalW / 2;
  pages.forEach((index, k) => {
    const x = viewX + k * SLIDE_PITCH + SLIDE_PITCH / 2 - scroll;
    const seen = x > viewX && x < viewX + viewW;
    const on = index === here;
    const ww = on ? dw + 8 : dw;
    ctx.fillStyle = on ? c.light : seen ? "rgba(255,246,230,0.55)" : "rgba(255,246,230,0.2)";
    roundRect(ctx, dx, dotY - dw / 2, ww, dw, dw / 2);
    ctx.fill();
    dx += ww + gap;
  });
  ctx.restore();
}
