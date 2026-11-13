// The start menu: a book that fills the screen. Drag a page sideways to turn it, or press the next button.
// Page 1 is the tutorial, page 2 the plus levels (nine, three on every row), page 3 the plus and minus levels,
// and the last page is the endless game. Every page of the book is in its own room (see background.ts).
import {W, STAGES} from "../game/constants";
import {goalFor} from "../game/engine";
import type {GameState, Mode} from "../game/types";
import {roomOfMode, type Room} from "./background";
import {t} from "./i18n";
import {
  type Button,
  FONT,
  GOLD,
  INK,
  TAU,
  drawBall,
  drawButton,
  registerHit,
  roundRect,
  softShadow,
  text,
  title,
  ui,
  write,
} from "./draw";

/** Where the book is (game units): nearly the whole screen, so a whole page is shown. */
export const BOOK = {x: 14, y: 62, w: 332, h: 514};

/** What each page of the book is. */
export const PAGE_MODES: Mode[] = ["tutorial", "plus", "mixed", "times", "divide", "endless"];

/** Which chapter of the book a game is in (1 to 4). */
export function chapterOf(mode: Mode): number {
  return mode === "plus" ? 1 : mode === "mixed" ? 2 : mode === "times" ? 3 : 4;
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
}

export function createBook(page = 0, cleared: Iterable<string> = [], unlockAll = false, bestCups: Record<string, number> = {}): Book {
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

export function markCleared(b: Book, mode: Mode, stage: number): void {
  b.cleared.add(clearedKey(mode, stage));
}

/** The page a mode lives on. */
export function pageOfMode(mode: Mode): number {
  return Math.max(0, PAGE_MODES.indexOf(mode));
}

/**
 * Whether a level can be played. The levels come one after the other: the first plus level is open, every other
 * level opens when the one before it has been cleared, and the first level of a chapter when the last level of the
 * chapter before it has. The tutorial and the endless game are always open.
 */
export function isUnlocked(b: Book, mode: Mode, stage: number): boolean {
  if (b.unlockAll) return true;
  if (mode === "plus") return stage <= 1 || b.cleared.has(clearedKey("plus", stage - 1));
  if (mode === "mixed") return b.cleared.has(clearedKey(stage <= 1 ? "plus" : "mixed", stage <= 1 ? STAGES : stage - 1));
  if (mode === "times") return b.cleared.has(clearedKey(stage <= 1 ? "mixed" : "times", stage <= 1 ? STAGES : stage - 1));
  if (mode === "divide") return b.cleared.has(clearedKey(stage <= 1 ? "times" : "divide", stage <= 1 ? STAGES : stage - 1));
  return true;
}

/** The room behind a page of the book. */
export function roomOfPage(page: number): Room {
  return roomOfMode(PAGE_MODES[Math.min(LAST, Math.max(0, page))]);
}

/** The game that follows another in the book: level after level, then the next page, ending in the endless game. */
export function nextGame(mode: Mode, stage: number): {mode: Mode; stage: number} | undefined {
  if (mode === "tutorial") return {mode: "plus", stage: 1};
  if (mode === "plus") return stage < STAGES ? {mode, stage: stage + 1} : {mode: "mixed", stage: 1};
  if (mode === "mixed") return stage < STAGES ? {mode, stage: stage + 1} : {mode: "times", stage: 1};
  if (mode === "times") return stage < STAGES ? {mode, stage: stage + 1} : {mode: "divide", stage: 1};
  if (mode === "divide") return stage < STAGES ? {mode, stage: stage + 1} : {mode: "endless", stage: 0};
  return undefined;
}

/**
 * The page the player is on: the tutorial page until the tutorial has been cleared, then the page of the first level that
 * has not been cleared yet (the endless page when every level has been).
 */
export function currentPage(b: Book): number {
  if (!b.cleared.has(clearedKey("tutorial", 0))) return 0;
  let game: {mode: Mode; stage: number} | undefined = {mode: "plus", stage: 1};
  while (game && game.mode !== "endless" && b.cleared.has(clearedKey(game.mode, game.stage))) game = nextGame(game.mode, game.stage);
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
  b.target = Math.min(LAST, Math.max(0, Math.round(page)));
  b.windupFrom = b.pos;
  b.windup = fromButton && Math.abs(b.target - b.pos) > 0.5 ? WINDUP : 0;
}

export function beginDrag(b: Book): void {
  b.dragging = true;
  b.windup = 0;
  b.dragFrom = b.pos;
}

/** The finger has moved `dx` game units sideways since the drag began: dragging left turns the page forwards. */
export function dragBy(b: Book, dx: number): void {
  b.pos = Math.min(LAST, Math.max(0, b.dragFrom - dx / BOOK.w));
}

/** The finger let go: the page turns the rest of the way if it has gone far enough, otherwise it falls back. */
export function endDrag(b: Book): void {
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
function drawCupIcon(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, ink: string, dead = false, scale = 1): void {
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
  ctx.strokeStyle = dead ? "#6f6b66" : "#b3aa97";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(18, 1, 7, 8, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
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
function drawSwapArrow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = "#5b4a36";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x + 11, y);
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x - 6, y - 4.5);
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x - 6, y + 4.5);
  ctx.moveTo(x + 11, y);
  ctx.lineTo(x + 6, y - 4.5);
  ctx.moveTo(x + 11, y);
  ctx.lineTo(x + 6, y + 4.5);
  ctx.stroke();
}

/** A round green badge with a check mark, for what has been cleared. */
function drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, "#7df09c");
  g.addColorStop(1, "#1f9f4e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0f5a2a";
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.4, r * 0.28);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, y + r * 0.02);
  ctx.lineTo(x - r * 0.1, y + r * 0.34);
  ctx.lineTo(x + r * 0.46, y - r * 0.3);
  ctx.stroke();
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
        drawCupIcon(ctx, cx - 22, cy, "", INK, false, 0.62);
        drawSwapArrow(ctx, cx, cy - 2);
        drawCupIcon(ctx, cx + 22, cy, "", INK, false, 0.62);
      },
    },
  ];
  const row = rows[i];
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
  row.icon(104, y);
  write(ctx, row.title, 146, y - 18, 19, INK, "left", 700);
  row.lines.forEach((line, k) => write(ctx, line, 146, y + 4 + k * 18, 14.5, "#5b4a36", "left", 600));
  if (done) drawCheck(ctx, 304, y - 18, 11);
}

function drawTutorialPage(ctx: CanvasRenderingContext2D, b: Book, time: number): void {
  const w = BOOK.w;
  write(ctx, t("tutLabel"), w / 2, 38, 14, "#8a6d3b", "center", 700);
  write(ctx, t("tutorial"), w / 2, 82, 46, "#43270a", "center", 700);
  write(ctx, t("tutSub"), w / 2, 122, 16, "#5b4a36", "center", 600);
  for (let i = 0; i < 4; i++) drawTutorialRow(ctx, i, 176 + i * 68, b.cleared.has(clearedKey("tutorial", 0)));
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
  return mode === "plus" ? 134 - (stage - 1) * 14 : mode === "mixed" ? 205 + (stage - 1) * 15 : mode === "divide" ? 335 - (stage - 1) * 7 : 168 + (stage - 1) * 10;
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
  s = 88
): void {
  const id = `play:${mode}:${stage}`;
  const k = s / 88; // how much smaller than the biggest size the tile is drawn
  const hue = stageHue(mode, stage);
  /** A colour of this tile: grey when locked, otherwise in its own hue. */
  const col = (sat: number, light: number) => (locked ? `hsl(${hue} 6% ${light - 6}%)` : `hsl(${hue} ${sat}% ${light}%)`);
  const pressed = !locked && ui.pressed === id;
  const dy = pressed ? 4 : 0;
  if (!locked) registerHit(ctx, id, {x, y, w: s, h: s});

  // A glossy tile of glass: a rich colour, a bright hard-edged shine over the top half, a spot of light and a glow along the bottom.
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
  // The shine: the top half, with a gently curved lower edge.
  const shine = ctx.createLinearGradient(0, y + dy, 0, y + dy + s * 0.52);
  shine.addColorStop(0, locked ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)");
  shine.addColorStop(1, locked ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.22)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.moveTo(x, y + dy);
  ctx.lineTo(x + s, y + dy);
  ctx.lineTo(x + s, y + dy + s * 0.4);
  ctx.quadraticCurveTo(x + s / 2, y + dy + s * 0.58, x, y + dy + s * 0.4);
  ctx.closePath();
  ctx.fill();
  // A spot of light in the top left corner.
  ctx.fillStyle = locked ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(x + s * 0.24, y + dy + s * 0.14, s * 0.11, s * 0.05, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = cleared ? "#ffd54a" : col(62, 24);
  roundRect(ctx, x, y + dy, s, s, 18 * k);
  ctx.stroke();
  ctx.strokeStyle = locked ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 2, y + dy + 2, s - 4, s - 4, 16 * k);
  ctx.stroke();

  if (locked) {
    drawLock(ctx, x + s / 2, y + dy + s / 2 - 6 * k, k);
    return;
  }
  text(ctx, String(stage), x + s / 2, y + dy + 38 * k, Math.round(42 * k), "#ffffff", "center", `hsl(${hue} 70% 18%)`);
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
  if (cleared) drawCheck(ctx, x + s - 8 * k, y + dy + 8 * k, 13 * k);
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
function signWidth(mode: "plus" | "mixed" | "times" | "divide"): number {
  if (mode === "times") return 2 * (SIGN_ARM + SIGN_THICK) * Math.SQRT1_2 + SIGN_LINE;
  return 2 * SIGN_ARM + SIGN_LINE;
}

/**
 * The sign of a chapter, centred on (cx, cy): see-through, with soft corners and a thin border in the colour (hue) of one of
 * the level tiles.
 */
function drawSign(ctx: CanvasRenderingContext2D, mode: "plus" | "mixed" | "times" | "divide", cx: number, cy: number, hue: number): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = SIGN_LINE + 0.5;
  ctx.strokeStyle = `hsl(${hue} 78% 46%)`;
  const shape = (pts: Pt[]) => {
    softShape(ctx, pts, SIGN_SOFT);
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
  } else {
    // Divide: a bar with a ring above it and a ring under it.
    shape(barPoints(cx, cy, SIGN_ARM, SIGN_THICK - 1));
    for (const dy of [-13, 13]) {
      ctx.beginPath();
      ctx.arc(cx, cy + dy, 4.5, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLevelsPage(ctx: CanvasRenderingContext2D, b: Book, mode: "plus" | "mixed" | "times" | "divide"): void {
  const w = BOOK.w;
  const chapter = chapterOf(mode);
  const info = {
    plus: {title: t("ch1"), size: 46, color: "#23753f", sub: t("sub1")},
    mixed: {title: t("ch2"), size: 38, color: "#2c5f8a", sub: t("sub2")},
    times: {title: t("ch3"), size: 46, color: "#2a57b8", sub: t("sub3")},
    divide: {title: t("ch4"), size: 46, color: "#b07a00", sub: t("sub4")},
  }[mode];
  write(ctx, t("chapter", {n: chapter}), w / 2, 38, 14, "#8a6d3b", "center", 700);
  // The name of the chapter, and after it its sign (+, plus and minus, times or divide): see-through with a thin border in
  // the colour of the chapter's level 3.
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
      size
    );
  }
  const hint = !isUnlocked(b, mode, 1) ? t("openChapter", {n: chapter - 1}) : t("openNext");
  write(ctx, hint, w / 2, 497, 15, "#5b4a36", "center", 600);
}

function drawEndlessPage(ctx: CanvasRenderingContext2D, g: GameState, time: number): void {
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
  write(ctx, t("recordLabel"), w / 2, 357, 13, "#e8cf92", "center", 700);
  text(ctx, String(g.best), w / 2, 382, 30, GOLD);
  drawButton(ctx, "play:endless:0", {x: w / 2 - 112, y: BOOK.h - 92, w: 224, h: 56}, t("play"), "primary", {pulse: time, size: 24});
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
  // The shade next to the spine.
  const spine = ctx.createLinearGradient(0, 0, 30, 0);
  spine.addColorStop(0, "rgba(60,40,10,0.3)");
  spine.addColorStop(1, "rgba(60,40,10,0)");
  ctx.fillStyle = spine;
  ctx.fillRect(0, 0, 30, h);

  const mode = PAGE_MODES[index];
  if (mode === "tutorial") drawTutorialPage(ctx, b, time);
  else if (mode === "plus" || mode === "mixed" || mode === "times" || mode === "divide") drawLevelsPage(ctx, b, mode);
  else drawEndlessPage(ctx, g, time);
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
  // One dot for each page; the one it is on is bright and long.
  const here = Math.round(b.pos);
  for (let i = 0; i <= LAST; i++) {
    const x = W / 2 + (i - LAST / 2) * 18 - 22;
    ctx.fillStyle = i === here ? GOLD : "rgba(243,236,221,0.4)";
    ctx.strokeStyle = "rgba(20,10,4,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, 611, i === here ? 6 : 4.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawBook(ctx: CanvasRenderingContext2D, b: Book, g: GameState, time: number): void {
  const {x, y, w, h} = BOOK;

  title(ctx, "PERFECT 10", W / 2, 32, 34);

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

  drawNav(ctx, b, time);
}
