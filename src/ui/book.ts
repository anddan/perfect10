// The start menu: a book that fills the screen. Drag a page sideways to turn it, or press the next button.
// Page 1 is the tutorial, page 2 the plus levels (nine, three on every row), page 3 the plus and minus levels,
// and the last page is the endless game. Every page of the book is in its own room (see background.ts).
import {W, STAGES} from "../game/constants";
import {goalFor, starsFor} from "../game/engine";
import type {GameState, Mode} from "../game/types";
import {roomOfMode, type Room} from "./background";
import {t} from "./i18n";
import {playerName} from "./profile";
import {drawTrophy} from "./settings";
import {
  type Button,
  FONT,
  GOLD,
  INK,
  TAU,
  drawBall,
  drawStar,
  drawButton,
  logoTitle,
  registerHit,
  roundRect,
  softShadow,
  text,
  ui,
  write,
} from "./draw";

/** The holes along the left edge of the pages (their middle, measured from the left edge of the page and from the top), and the metal spiral that goes through them. */
const SPIRAL_AT = [60, 138, 216, 294, 372, 450];
const HOLE_X = 13;
const HOLE_R = 4.6;

/** Where the book is (game units): nearly the whole screen, so a whole page is shown. */
export const BOOK = {x: 14, y: 62, w: 332, h: 514};

/** What each page of the book is. */
export const PAGE_MODES: Mode[] = ["tutorial", "plus", "mixed", "times", "divide", "space", "endless"];

/** The chapters of the book, with twelve levels each, in order. */
export const CHAPTER_MODES = ["plus", "mixed", "times", "divide", "space"] as const;
export type ChapterMode = (typeof CHAPTER_MODES)[number];

export function isChapter(mode: Mode): mode is ChapterMode {
  return (CHAPTER_MODES as readonly Mode[]).includes(mode);
}

/** Which chapter of the book a game is in (1 to 5). */
export function chapterOf(mode: Mode): number {
  return Math.max(0, (CHAPTER_MODES as readonly Mode[]).indexOf(mode)) + 1;
}
const LAST = PAGE_MODES.length - 1;

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
  /** The most cups that have been filled in a level (the dots on its tile light up for them), as "plus-3" and so on. */
  bestCups: Map<string, number>;
  /** The most points that have been got in a cleared level (shown under its number), as "plus-3" and so on. */
  bestScores: Map<string, number>;
  /** How many times a page has been turned (to the next or the previous page): the sound of a page turning goes by it. */
  turns: number;
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
    bestCups: new Map(Object.entries(bestCups)),
    bestScores: new Map(Object.entries(bestScores)),
    turns: 0,
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
  return Math.max(0, PAGE_MODES.indexOf(mode));
}

/** The most stars there are in a chapter (three in each of its twelve levels), and how many of them open the next chapter (at least: more is fine). */
export const CHAPTER_STARS = 3 * STAGES;
export const STARS_TO_OPEN = 24;
/** How many stars, all chapters added together (180 at most), open the endless game. */
export const STARS_FOR_ENDLESS = 120;

/** The stars got in a level (the points of its best try): none until it has been cleared. */
export function starsOfLevel(b: Book, mode: Mode, stage: number): number {
  const key = clearedKey(mode, stage);
  return b.cleared.has(key) ? starsFor(mode, stage, b.bestScores.get(key) ?? 0) : 0;
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
 * level opens when the one before it has been cleared, and the first level of a chapter when at least 24 of the 36 stars of the
 * chapter before it have been got (a level that has been cleared stays open). The endless game opens when 120 stars have been got in
 * all the chapters together. The tutorial is always open.
 */
export function isUnlocked(b: Book, mode: Mode, stage: number): boolean {
  if (b.unlockAll) return true;
  if (mode === "endless") return totalStars(b) >= STARS_FOR_ENDLESS;
  const chapter = CHAPTER_MODES.indexOf(mode as ChapterMode);
  if (chapter < 0) return true;
  if (stage <= 1) return chapter === 0 || b.cleared.has(clearedKey(mode, 1)) || chapterStars(b, CHAPTER_MODES[chapter - 1]) >= STARS_TO_OPEN;
  return b.cleared.has(clearedKey(mode, stage - 1));
}

/** The game that follows another, if it is open (the next chapter may be shut for want of stars). */
export function openNextGame(b: Book, mode: Mode, stage: number): {mode: Mode; stage: number} | undefined {
  const next = nextGame(mode, stage);
  return next && isUnlocked(b, next.mode, next.stage) ? next : undefined;
}

/** The room behind a page of the book. */
export function roomOfPage(page: number): Room {
  return roomOfMode(PAGE_MODES[Math.min(LAST, Math.max(0, page))]);
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
  if (!b.cleared.has(clearedKey("tutorial", 0))) return 0;
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
}

/** Turns to a page. From a button, the page first lifts and trembles a moment before it is pulled all the way through. */
export function goToPage(b: Book, page: number, fromButton = false): void {
  const target = Math.min(LAST, Math.max(0, Math.round(page)));
  if (target !== b.target) b.turns++;
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
  write(ctx, row.title, 146, y - 18, 19, INK, "left", 700);
  row.lines.forEach((line, k) => write(ctx, line, 146, y + 4 + k * 18, 14.5, "#5b4a36", "left", 600));
}

function drawTutorialPage(ctx: CanvasRenderingContext2D, b: Book, time: number): void {
  const w = BOOK.w;
  write(ctx, t("tutLabel"), w / 2, 38, 14, "#8a6d3b", "center", 700);
  write(ctx, t("tutorial"), w / 2, 82, 46, "#43270a", "center", 700);
  write(ctx, t("tutSub"), w / 2, 122, 16, "#5b4a36", "center", 600);
  // (the last row sits a little higher, away from the button)
  for (let i = 0; i < 4; i++) drawTutorialRow(ctx, i, 176 + i * 68 - (i === 3 ? 5 : 0), b.cleared.has(clearedKey("tutorial", 0)));
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
  ctx.lineWidth = 2;
  ctx.strokeStyle = cleared ? "#ffd54a" : space && !locked ? "#8fd8ff" : col(62, 24);
  if (space && !locked) {
    // The edge of a tile of space glows a little.
    ctx.shadowColor = "rgba(130,210,255,0.85)";
    ctx.shadowBlur = 8;
  }
  roundRect(ctx, x, y + dy, s, s, 18 * k);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
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

const SIGN_LINE = 2;
/** How far a sign reaches from its middle, and half the thickness of its arms. */
const SIGN_ARM = 16;
const SIGN_THICK = 4.5;
/** How round the corners of a sign are. */
const SIGN_SOFT = 3.5;

type Pt = [number, number];

/** A closed shape with soft (rounded) corners. */
function softShape(ctx: CanvasRenderingContext2D, pts: Pt[], r: number): void {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.arcTo(pts[i][0], pts[i][1], m[0], m[1], r);
  }
  ctx.closePath();
}

/** The corners of a plus (one closed outline, so its border never runs into itself), `arm` from the middle to the end of an arm. */
function plusPoints(cx: number, cy: number, arm: number, thick: number, turn = 0): Pt[] {
  const raw: Pt[] = [
    [-thick, -arm], [thick, -arm], [thick, -thick], [arm, -thick], [arm, thick], [thick, thick],
    [thick, arm], [-thick, arm], [-thick, thick], [-arm, thick], [-arm, -thick], [-thick, -thick],
  ];
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return raw.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

/** A bar (the minus), `half` from its middle to its end. */
function barPoints(cx: number, cy: number, half: number, thick: number): Pt[] {
  return [[cx - half, cy - thick], [cx + half, cy - thick], [cx + half, cy + thick], [cx - half, cy + thick]];
}

/** How wide the sign of a chapter is. */
function signWidth(mode: ChapterMode): number {
  if (mode === "space") return 2 * 17 + SIGN_LINE;
  if (mode === "times") return 2 * (SIGN_ARM + SIGN_THICK) * Math.SQRT1_2 + SIGN_LINE;
  return 2 * SIGN_ARM + SIGN_LINE;
}

/**
 * Fills the shape that is the current path like a glossy tile: the colour is lighter at the top and darker at the bottom (down to
 * the colour at the bottom of the tile), a soft shine fades out from the top and a bright rim runs just inside the upper edge.
 * The border is drawn by the caller.
 */
function fillGlossy(ctx: CanvasRenderingContext2D, hue: number, night: boolean, x0: number, y0: number, x1: number, y1: number): void {
  const h = y1 - y0;
  const body = ctx.createLinearGradient(0, y0, 0, y1);
  if (night) {
    body.addColorStop(0, `hsl(${hue} 60% 28%)`);
    body.addColorStop(0.5, `hsl(${hue} 56% 19%)`);
    body.addColorStop(1, `hsl(${hue} 55% 15%)`);
  } else {
    body.addColorStop(0, `hsl(${hue} 85% 58%)`);
    body.addColorStop(0.5, `hsl(${hue} 80% 44%)`);
    body.addColorStop(1, `hsl(${hue} 78% 36%)`);
  }
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Only one thing on top of the colour: a white gloss over the upper part of the shape, cut off by a line that runs from the lower
  // left up to the upper right (a little below the middle). A shape that is flat or wide gets a flatter line, since it goes by its size.
  const w = x1 - x0;
  const slope = (0.5 * h) / w; // (how much the line rises for every step to the right)
  const edge = (x: number): number => y0 + h * 0.75 - (x - x0) * slope;
  const gloss = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.75);
  gloss.addColorStop(0, "rgba(255,255,255,0.85)");
  gloss.addColorStop(1, "rgba(255,255,255,0.5)");
  ctx.fillStyle = gloss;
  // (its own path, so that the path of the shape itself stays the current one: the border the caller draws runs along it)
  const above = new Path2D();
  above.moveTo(x0 - 6, edge(x0 - 6));
  above.lineTo(x1 + 6, edge(x1 + 6));
  above.lineTo(x1 + 6, y0 - 6);
  above.lineTo(x0 - 6, y0 - 6);
  above.closePath();
  ctx.fill(above);
  ctx.restore();
}

/**
 * The sign of a chapter, centred on (cx, cy): with soft corners, filled with the colour at the bottom of a level tile and
 * with that tile's dark border (hue is the colour of one of the level tiles).
 */
function drawSign(ctx: CanvasRenderingContext2D, mode: ChapterMode, cx: number, cy: number, hue: number): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = SIGN_LINE + 0.5;
  // The colours of level 3 of the chapter: the colour at the bottom of its tile, with its dark border (no white).
  const night = mode === "space";
  ctx.fillStyle = night ? `hsl(${hue} 55% 15%)` : `hsl(${hue} 78% 36%)`;
  ctx.strokeStyle = night ? `hsl(${hue} 43% 10%)` : `hsl(${hue} 62% 24%)`;
  const border = ctx.strokeStyle;
  /** A shape made of these points (with this much rounding): glossy, with the dark border round it. */
  const shape = (pts: Pt[], soft = SIGN_SOFT) => {
    softShape(ctx, pts, soft);
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    fillGlossy(ctx, hue, night, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    ctx.strokeStyle = border;
    ctx.lineWidth = SIGN_LINE + 0.5;
    ctx.stroke();
  };
  if (mode === "plus") {
    shape(plusPoints(cx, cy, SIGN_ARM, SIGN_THICK));
  } else if (mode === "mixed") {
    // Plus and minus: the same plus as in chapter 1, with a bar under it.
    shape(plusPoints(cx, cy - 8, SIGN_ARM, SIGN_THICK));
    shape(barPoints(cx, cy + 17, SIGN_ARM, SIGN_THICK));
  } else if (mode === "times") {
    shape(plusPoints(cx, cy, SIGN_ARM, SIGN_THICK, Math.PI / 4));
  } else if (mode === "space") {
    // A five-pointed star, with only a little rounding at its points so that it still looks like a star.
    shape(
      Array.from({length: 10}, (_, k): Pt => {
        const ang = (k * Math.PI) / 5 - Math.PI / 2;
        const rad = k % 2 === 0 ? 18 : 7.6;
        return [cx + rad * Math.cos(ang), cy + 1 + rad * Math.sin(ang)];
      }),
      1.6
    );
  } else {
    // Divide: a bar with a ring above it and a ring under it.
    shape(barPoints(cx, cy, SIGN_ARM, SIGN_THICK - 1));
    for (const dy of [-13, 13]) {
      ctx.beginPath();
      ctx.arc(cx, cy + dy, 4.5, 0, TAU);
      fillGlossy(ctx, hue, night, cx - 4.5, cy + dy - 4.5, cx + 4.5, cy + dy + 4.5);
      ctx.strokeStyle = border;
      ctx.lineWidth = SIGN_LINE + 0.5;
      ctx.stroke();
    }
  }
  ctx.restore();
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
    mixed: {title: t("ch2"), size: 38, color: "#2c5f8a", sub: t("sub2")},
    times: {title: t("ch3"), size: 46, color: "#2a57b8", sub: t("sub3")},
    divide: {title: t("ch4"), size: 46, color: "#b07a00", sub: t("sub4")},
    space: {title: t("ch5"), size: 46, color: "#4a3fa0", sub: t("sub5")},
  }[mode];
  write(ctx, t("chapter", {n: chapter}), w / 2, 38, 14, "#8a6d3b", "center", 700);
  // The stars got in the chapter, out of all of them, in the top right corner (24 of them open the next chapter).
  const got = chapterStars(b, mode);
  write(ctx, `${got}/${CHAPTER_STARS}`, w - 38, 22, 15, "#5b4a36", "right", 700);
  drawStar(ctx, w - 24, 22, 8.5, true, true, true);
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
  // At the bottom: how many stars open this chapter (if it is shut), or else how many open the next one (the last chapter: the endless game).
  const hint = !isUnlocked(b, mode, 1)
    ? t("openChapter", {n: chapter - 1, m: STARS_TO_OPEN})
    : chapter < CHAPTER_MODES.length
      ? t("openChapterNext", {n: chapter + 1, m: STARS_TO_OPEN})
      : t("openEndless", {n: STARS_FOR_ENDLESS});
  writeWithStar(ctx, hint, w / 2, 497, 15, "#5b4a36");
}

function drawEndlessPage(ctx: CanvasRenderingContext2D, b: Book, g: GameState, time: number): void {
  const w = BOOK.w;
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
  text(ctx, String(g.best), w / 2, 382, 30, GOLD);
  // The trophy opens the top list.
  drawButton(ctx, "scores", {x: px + 184 + 10, y: 351, w: 44, h: 44}, "", "round", {draw: drawTrophy});
  if (isUnlocked(b, "endless", 0)) {
    drawButton(ctx, "play:endless:0", {x: w / 2 - 112, y: BOOK.h - 92, w: 224, h: 56}, t("play"), "primary", {pulse: time, size: 24});
  } else {
    // Endless opens when 120 stars have been got in all the chapters together.
    drawLock(ctx, w / 2, BOOK.h - 84, 1.1);
    writeWithStar(ctx, t("openEndless", {n: STARS_FOR_ENDLESS}), w / 2, BOOK.h - 36, 15, "#5b4a36");
  }
}

/** The paper of one page, and what is written on it. Drawn at the origin: the caller puts it where it goes. */
function paintPage(ctx: CanvasRenderingContext2D, index: number, b: Book, g: GameState, time: number): void {
  const {w, h} = BOOK;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 12);
  ctx.clip();
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

  const mode = PAGE_MODES[index];
  if (mode === "tutorial") drawTutorialPage(ctx, b, time);
  else if (isChapter(mode)) drawLevelsPage(ctx, b, mode);
  else drawEndlessPage(ctx, b, g, time);
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
function drawTurning(ctx: CanvasRenderingContext2D, picture: HTMLCanvasElement, f: number, time: number): void {
  const s = ui.px;
  const edgeF = Math.min(f, 1 - f);
  const rowH = BOOK.h / ROWS;
  for (let r = 0; r < ROWS; r++) {
    const y0 = r * rowH;
    const yc = (r + 0.5) / ROWS;
    let a = f * (1 + LEAD) - yc * LEAD;
    // A smooth ripple down the page (not noise from row to row), strongest at the top.
    if (edgeF < 0.3) a += Math.sin(time * 30 + yc * 9) * 0.017 * Math.sin((edgeF / 0.3) * Math.PI) * (1 - yc * 0.75);
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

const PREV_BUTTON: Button = {x: 14, y: 590, w: 54, h: 42};
const NEXT_BUTTON: Button = {x: W - 14 - 132, y: 590, w: 132, h: 42};

function drawNav(ctx: CanvasRenderingContext2D, b: Book, time: number): void {
  if (b.target > 0) drawButton(ctx, "prev", PREV_BUTTON, "", "round", {draw: (c, cx, cy, ink) => chevron(c, cx - 1, cy, -1, ink)});
  if (b.target < LAST) {
    const label = t("next");
    drawButton(ctx, "next", NEXT_BUTTON, "", "primary", {
      pulse: time,
      draw: (c, cx, cy, ink) => {
        c.font = `700 21px ${FONT}`;
        const tw = c.measureText(label).width;
        const start = cx - (tw + 22) / 2;
        text(c, label, start, cy + 1, 21, ink, "left", "rgba(255,246,206,0.75)");
        chevron(c, start + tw + 14, cy, 1, ink);
      },
    });
  }
  // One dot for each page, in the space between the two buttons (they sit close together now that there are so many pages); the one it is on is bright.
  const here = Math.round(b.pos);
  for (let i = 0; i <= LAST; i++) {
    const x = (PREV_BUTTON.x + PREV_BUTTON.w + NEXT_BUTTON.x) / 2 + (i - LAST / 2) * 15;
    ctx.fillStyle = i === here ? GOLD : "rgba(243,236,221,0.4)";
    ctx.strokeStyle = "rgba(20,10,4,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, 611, i === here ? 6 : 4.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
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

  logoTitle(ctx, "PERFECT 10", W / 2, 32, 34);

  // The book lying on the table: its shadow, the green leather cover, and the edges of the pages under the top one.
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  roundRect(ctx, x - 6, y + 8, w + 22, h + 18, 14);
  ctx.fill();
  const cover = ctx.createLinearGradient(x, y, x + w, y + h);
  cover.addColorStop(0, "#37563f");
  cover.addColorStop(1, "#203828");
  ctx.fillStyle = cover;
  roundRect(ctx, x - 10, y - 8, w + 20, h + 17, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,213,74,0.4)";
  ctx.lineWidth = 1.2;
  roundRect(ctx, x - 6, y - 4, w + 12, h + 9, 11);
  ctx.stroke();
  ctx.fillStyle = "#c9bd9d";
  roundRect(ctx, x + 5, y + 7, w, h, 12);
  ctx.fill();
  ctx.fillStyle = "#ddd3b8";
  roundRect(ctx, x + 2.5, y + 3.5, w, h, 12);
  ctx.fill();

  // The pages: the next one lies underneath, and the one on top is turned.
  const pos = Math.min(LAST, Math.max(0, b.pos));
  const i = Math.min(LAST, Math.floor(pos));
  const f = pos - i;
  if (f > 0.001 && i < LAST) {
    ui.registering = false;
    ctx.save();
    ctx.translate(x, y);
    paintPage(ctx, i + 1, b, g, time);
    ctx.restore();
    drawSpiral(ctx, x, y);
    drawTurning(ctx, pictureOfPage(i, b, g, time), f, time);
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
  if (!(f > 0.001 && i < LAST)) drawSpiral(ctx, x, y);

  drawNav(ctx, b, time);
}
