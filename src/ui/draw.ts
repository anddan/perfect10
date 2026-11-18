// The look of the game: the typeface, the colours, and the building blocks every screen is made of
// (outlined text, titles, candy buttons that press down, panels, and the glossy number balls).
// Buttons also register where they are, so a tap can find the one under the finger.

import {applyTint} from "./tint";

/** The lettering of the logo (PERFECT10): a heavy display face, with the game font behind it. */
export const LOGO_FONT = `"Lilita One",${"\"Fredoka\",\"Trebuchet MS\",system-ui,sans-serif"}`;
export const FONT = '"Fredoka","Trebuchet MS","Segoe UI",system-ui,sans-serif';
export const TAU = Math.PI * 2;

/** The palette. Warm coffee browns and cream, with gold for what matters and green and red for plus and minus. */
export const CHALK = "#f3ecdd";
export const GOLD = "#ffd54a";
export const GOLD_DEEP = "#e0a114";
export const INK = "#3b2a1a";
export const DARK_OUTLINE = "rgba(24,12,6,0.9)";

// ---- Text -----------------------------------------------------------------------------

/** Bold text with an outline, so it can be read on anything. */
export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  outline: string = DARK_OUTLINE
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.115);
  ctx.strokeStyle = outline;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Plain writing (no outline), for text on paper. */
export function write(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  weight = 600
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** How wide the lettering of the logo is at a size (with the air between the letters and the dark edge round them). */
export function logoWidth(ctx: CanvasRenderingContext2D, s: string, size: number): number {
  ctx.save();
  ctx.font = `700 100px ${FONT}`;
  if ("letterSpacing" in ctx) (ctx as unknown as {letterSpacing: string}).letterSpacing = "5px";
  const unit = ctx.measureText(s).width / 100;
  ctx.restore();
  return size * (unit + 0.26);
}

/** The lettering of the logo as big as it can be (at most `maxSize`) and still be `width` wide, centred on x. */
export function logoTitleFit(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, width: number, maxSize: number): void {
  const size = Math.min(maxSize, (maxSize * width) / Math.max(1, logoWidth(ctx, s, maxSize)));
  logoTitle(ctx, s, x, y, size);
}

/**
 * The lettering of the logo: a soft shadow, a dark edge, a thin golden edge, gold that goes from yellow to deep orange, and a
 * faint shine that fades out over the top half of the letters.
 */
export function logoTitle(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number): void {
  if (s !== "PERFECT10") {
    paintLogo(ctx, s, x, y, size);
    return;
  }
  // The logo: PERFECT, a 1 that leans back against the T, and the 0 in the same gold.
  ctx.save();
  ctx.font = `400 ${size}px ${LOGO_FONT}`;
  if ("letterSpacing" in ctx) (ctx as unknown as {letterSpacing: string}).letterSpacing = `${(size * 0.05).toFixed(1)}px`;
  const wWord = ctx.measureText("PERFECT").width;
  const wTen = ctx.measureText("10").width;
  ctx.restore();
  const gap = size * 0.1;
  const total = wWord + gap + wTen;
  const left = x - total / 2;
  paintLogo(ctx, "PERFECT", left + wWord / 2, y, size);
  paintLogo(ctx, "10", left + total - wTen / 2, y, size);
}

function paintLogo(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${size}px ${LOGO_FONT}`;
  ctx.lineJoin = "round";
  // A little air between the letters, so that the edges do not run into each other (where the browser can do it).
  if ("letterSpacing" in ctx) (ctx as unknown as {letterSpacing: string}).letterSpacing = `${(size * 0.05).toFixed(1)}px`;
  // A soft drop shadow under it all.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  ctx.fillStyle = "#3a1e08";
  ctx.fillText(s, x, y + size * 0.05);
  ctx.restore();
  // A slim bronze depth under the face.
  const depth = size * 0.05;
  for (let d = depth; d > 0; d -= 0.75) {
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = "#4a260a";
    ctx.strokeText(s, x, y + d);
    ctx.fillStyle = "#8a4a12";
    ctx.fillText(s, x, y + d);
  }
  // A thin dark outline round the face.
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = "#1c0f05";
  ctx.strokeText(s, x, y);
  // The face: polished gold, light at the top, a crisp horizon a little under the middle, warm amber below.
  const gold = ctx.createLinearGradient(0, y - size * 0.45, 0, y + size * 0.42);
  gold.addColorStop(0, "#fff6d0");
  gold.addColorStop(0.3, "#ffd75e");
  gold.addColorStop(0.52, "#f2a922");
  gold.addColorStop(0.54, "#c8740c");
  gold.addColorStop(1, "#f0a83a");
  ctx.fillStyle = gold;
  ctx.fillText(s, x, y);
  // A fine light bevel along the edge of the face.
  ctx.lineWidth = Math.max(1, size * 0.025);
  const rim = ctx.createLinearGradient(0, y - size * 0.45, 0, y + size * 0.42);
  rim.addColorStop(0, "rgba(255,250,225,0.95)");
  rim.addColorStop(0.5, "rgba(255,220,140,0.5)");
  rim.addColorStop(1, "rgba(120,60,10,0.6)");
  ctx.strokeStyle = rim;
  ctx.strokeText(s, x, y);
  ctx.restore();
}

/** A big title: a gradient of light to deep colour, a thick dark outline, a drop shadow and a shine along the top. */
export function title(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  light = "#fff3b0",
  deep = GOLD_DEEP
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.lineJoin = "round";
  // Shadow, then the outline.
  ctx.lineWidth = size * 0.26;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeText(s, x, y + size * 0.09);
  ctx.strokeStyle = "#3a1d08";
  ctx.strokeText(s, x, y);
  // The face.
  const face = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  face.addColorStop(0, light);
  face.addColorStop(0.55, light);
  face.addColorStop(0.56, deep);
  face.addColorStop(1, deep);
  ctx.fillStyle = face;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** A number as it is written: with a real minus sign for the negative ones. */
export function signed(v: number): string {
  return v < 0 ? `−${-v}` : String(v);
}

import type {Package} from "../game/daily";
import type {Bonus, Op} from "../game/types";
import type {Lang} from "./i18n";

// ---- Shapes ---------------------------------------------------------------------------

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A soft shadow under a shape: a few fading copies, since a canvas blur is slow on phones. */
export function softShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, spread = 6, alpha = 0.3): void {
  for (let i = spread; i >= 1; i--) {
    ctx.fillStyle = `rgba(8,4,12,${(alpha / spread) * (1 - (i - 1) / (spread + 1))})`;
    roundRect(ctx, x - i * 0.6, y - i * 0.2 + i * 0.9, w + i * 1.2, h + i * 1.2, r + i);
    ctx.fill();
  }
}

/** A small flag, with rounded corners and a little shine: (x, y) is its top left corner. */
export function drawFlag(ctx: CanvasRenderingContext2D, l: Lang, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, 0, 0, w, h, 3);
  ctx.clip();
  if (l === "sv") {
    ctx.fillStyle = "#006aa7";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fecc00";
    ctx.fillRect(w * 0.3 - h * 0.1, 0, h * 0.2, h);
    ctx.fillRect(0, h * 0.4, w, h * 0.2);
  } else if (l === "en") {
    ctx.fillStyle = "#012169";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "butt";
    for (const [color, width] of [["#ffffff", h * 0.22], ["#c8102e", h * 0.08]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h * 0.5 - h * 0.17, w, h * 0.34);
    ctx.fillRect(w * 0.5 - h * 0.17, 0, h * 0.34, h);
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(0, h * 0.5 - h * 0.1, w, h * 0.2);
    ctx.fillRect(w * 0.5 - h * 0.1, 0, h * 0.2, h);
  } else if (l === "es") {
    ctx.fillStyle = "#aa151b";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f1bf00";
    ctx.fillRect(0, h * 0.25, w, h * 0.5);
  } else {
    ctx.fillStyle = "#009246";
    ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = "#ce2b37";
    ctx.fillRect((w * 2) / 3, 0, w / 3 + 1, h);
  }
  const shine = ctx.createLinearGradient(0, 0, 0, h);
  shine.addColorStop(0, "rgba(255,255,255,0.32)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.04)");
  shine.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
  ctx.stroke();
}

// ---- Buttons --------------------------------------------------------------------------

/** Where a button is (game units). */
export interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Breaks a text into lines that are at most maxW wide (in the font that is set on the context). */
export function wrapLines(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(" ")) {
    const next = cur ? cur + " " + word : word;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** The buttons drawn this frame, and which one has a finger on it. Rebuilt on every frame. */
export const ui = {
  /** The id of the button that is being pressed (it sinks), or null. */
  pressed: null as string | null,
  /** Pixels per game unit at the start of the frame, to turn drawing coordinates back into game units. */
  px: 1,
  /** The coins in the wallet, the cups bought, the cups chosen (for the shop page of the book), and the coins got in the round that has just ended. */
  coins: 0,
  /** The tab of the shop that is showing (0: the cups, 1: the energy). */
  shopTab: 0,
  /** The very first time the game is started: the page where the language is chosen and a new game is started. */
  startOpen: false,
  /** How far the header (energy, title, settings) is moved up from right above the book, to stand in the middle of the empty space above it on a tall phone (0 or less). */
  headerDy: 0,
  /** The title on a row of its own above the energy and the settings (when there is room above the book): how many rows the header has (1 or 2), and how far the title is moved. */
  headerRows: 1,
  /** Whether the contents shows all the chapters (otherwise only the one the player is on). */
  tocOpen: false,
  titleDy: 0,
  /** Shield up is being played: its skulls are drawn in steel. */
  steelSkulls: false,
  /** The place on the top list the round that just ended got (1 to 10), or null: it is lit up on the card. */
  topPlace: null as number | null,
  /** The biggest size of the title when it has a row of its own (it follows the room there is). */
  titleMax: 44,
  /** The days in a row: which day of the week today is, how many days there are to show, whether today is counted, and whether a package is waiting. */
  streakDay: 1,
  streakCount: 0,
  streakToday: false,
  streakGift: false,
  /** The package that has just been opened (what was in it), and how long ago. */
  packageOpen: null as Package | null,
  packageAge: 0,
  /** How far the book is lifted from the bottom edge (a tall phone). */
  lift: 0,
  /** A finger is being dragged along the page numbers of the book, and how much the number that it is on has swollen (0 to 1, easing). */
  scrubbing: false,
  scrubAmt: 0,
  /** A purchase has just been made: seconds since (-1: none), where on the screen the button was, and how many coins it cost. */
  buyFx: -1,
  buyAt: {x: 0, y: 0},
  buyN: 0,
  /** Whether the effect is for coins that came in (a shower of coins and "+N") and not for coins that were spent. */
  buyGain: false,
  /** The looks that are on (cup colour, pattern, room, tone of the light, style of the numbers), the ones that have been bought, the tab of the page for them, and the pictures of the rooms (for showing them). */
  look: {cupColor: "porcelain", pattern: "none", room: "auto", tint: "none", numbers: "classic"} as Record<string, string>,
  looksOwned: [] as string[],
  lookTab: 0,
  roomPics: null as Record<string, HTMLCanvasElement> | null,
  /** Premium has been bought: everything is open, new tries are free and there are no ads. */
  premium: false,
  /** A short message over the screen (a toast), and the seconds it has left. */
  notice: "",
  noticeTime: 0,
  /** How many pull-down screens there are in the book (for the shop). */
  screens: 0,
  erasers: 0,
  owned: {} as Record<string, number>,
  /** How many saucers of each kind are under the cups in the game (two, three or four of a kind glow). */
  saucerSet: {} as Record<string, number>,
  /** The saucers that have been bought (how many of each) and the one under each cup of the desk. */
  saucers: {} as Record<string, number>,
  saucerSlots: [] as (string | null)[],
  /** The properties on each cup of the desk, the dialog for them (open or not), which cup is chosen in it, and the property that was just bought (marked there). */
  slots: [] as string[][],
  cupsOpen: false,
  cupSlot: 0,
  cupFocus: null as string | null,
  lastCoins: 0,
  /** The daily challenge: whether today's try has been used, and how many rungs of the ladder were climbed in it. */
  dailyUsed: false,
  dailyRungs: 0,
  dailyCleared: false,
  /** How far the screen reaches above the top of the usual 640 (a tall phone): the full-screen pages cover it too. */
  extra: 0,
  /** The settings page is open (the game waits behind it). */
  settingsOpen: false,
  /** The top list of a game is open, and which game's it is. */
  scoresOpen: false,
  scoresMode: "endless" as "endless" | "save" | "sixeight" | "defend" | "ice" | "fast" | "find" | "shield" | "jet" | "comet",
  /** The match modes that have been bought, the best score of every game, and whether the match modes are open in the contents. */
  modes: [] as string[],
  bests: {endless: 0, save: 0, sixeight: 0, defend: 0, ice: 0, fast: 0, find: 0, shield: 0} as Record<string, number>,
  modesOpen: false,
  /** The group of the bar at the bottom whose pages are popped out in an arc over it (-1 when none is), and when (performance.now in seconds) it was opened. */
  barOpen: -1,
  barOpenAt: 0,
  /** How the pages are reached (a setting): the bar along the bottom ("menu"), or the coloured tabs on the edge of the book ("groups"). */
  layout: "menu" as "menu" | "groups",
  /** The very first start: the book shows its front cover, and the bar at the bottom is hidden, until "Open the book" is pressed. */
  coverIntro: false,
  /** The gift of the day (the first start of a day gives coins, and an ad doubles them): it can still be taken today, its dialog is open, how long it has been open, and what was got (0 until it is taken). */
  giftReady: false,
  giftOpen: false,
  giftAge: 0,
  giftGot: 0,
  /** The match mode page that was visited last: the contents shows it, with the line that opens all the match modes under it. */
  lastMatch: "endless" as string,
  /** Whether a match mode page has been visited at all (only then does the contents say "last" on it). */
  hasLastMatch: false,
  /** How far the contents list is scrolled (game units), and how far it can be (0: it all fits). */
  tocScroll: 0,
  /** The dead cup of Save the cup shows no number (only its red cross). */
  deadBlank: false,
  tocMax: 0,
  /** The pause page is open during a round (the game waits behind it). */
  pauseOpen: false,
  /** The id of the cup that is being held and dragged (it is drawn with a yellow border), or null. */
  heldCup: null as number | null,
  /** The make-believe ad is showing (before one more try, or for energy), and how many seconds ago it started. */
  adOpen: false,
  adTime: 0,
  adFor: "continue" as "continue" | "energy" | "coins" | "retry" | "gift",
  /** Whether today's try of the daily challenge can be tried again (it did not get to the goal line, and the one retry of the day is not used). */
  dailyRetry: false,
  /** Whether the video for coins can be watched today (it can once a day). */
  videoReady: false,
  /** The energy page is open; how much energy there is, and the seconds until the next point comes back. */
  energyOpen: false,
  energyN: 10,
  /** Seconds since a point of energy was spent (the pill shakes, flashes and the bolt flies off): -1 when nothing is going on. */
  energyFx: -1,
  energyNext: 0,
  /** Off while a page is drawn into a picture for the page turn: the buttons on it cannot be tapped. */
  registering: true,
};
const hits: {id: string; b: Button}[] = [];

/** Call at the start of a frame, with the context in its base state (scaled to game units). */
export function beginUi(ctx: CanvasRenderingContext2D): void {
  ui.px = ctx.getTransform().a || 1;
  ui.registering = true;
  hits.length = 0;
}

/** Remembers that a rectangle (in the current drawing coordinates) is a button. */
export function registerHit(ctx: CanvasRenderingContext2D, id: string, b: Button): void {
  if (fitKey) fitLow = Math.max(fitLow, b.y + b.h);
  if (!ui.registering) return;
  const m = ctx.getTransform();
  const k = ui.px;
  hits.push({id, b: {x: (m.a * b.x + m.e) / k, y: (m.d * b.y + m.f) / k, w: (m.a * b.w) / k, h: (m.d * b.h) / k}});
}

/** The button under a point (the one drawn last, on top, wins). */
export function hitTest(x: number, y: number): string | null {
  for (let i = hits.length - 1; i >= 0; i--) {
    const {id, b} = hits[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return id;
  }
  return null;
}

/**
 * A pill of dark wood with a thin gold edge, the same as the bar along the bottom of the screen (the keys and the coins in the header of the book).
 * `id`: the button it is (null if it is only to look at). `content` draws what is on it, round the middle of the pill.
 */
export function drawWoodPill(ctx: CanvasRenderingContext2D, id: string | null, b: Button, content: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void, bare = false): void {
  if (id) registerHit(ctx, id, b);
  ctx.save();
  if (id && ui.pressed === id) ctx.translate(0, 1.5);
  // (bare: only what is in it, with no wood, border or shadow)
  if (bare) {
    content(ctx, b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
    return;
  }
  const r = b.h / 2;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  roundRect(ctx, b.x, b.y + 2.5, b.w, b.h, r);
  ctx.fill();
  const wood = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  wood.addColorStop(0, "#3a2616");
  wood.addColorStop(1, "#22150b");
  ctx.fillStyle = wood;
  roundRect(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fill();
  // (it follows the tone that is chosen in the Looks, like the room does)
  ctx.save();
  ctx.clip();
  applyTint(ctx, ui.look.tint, b.x, b.y, b.w, b.h);
  ctx.restore();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(255,213,74,0.35)";
  ctx.stroke();
  content(ctx, b.x + b.w / 2, b.y + b.h / 2);
  ctx.restore();
}

export type ButtonKind = "primary" | "secondary" | "round" | "green" | "blue";

const LOOKS: Record<ButtonKind, {top: string; bottom: string; lip: string; ink: string; outline: string}> = {
  primary: {top: "#ffe98f", bottom: "#f2b320", lip: "#9c610a", ink: "#43270a", outline: "rgba(255,246,206,0.75)"},
  secondary: {top: "#7a7396", bottom: "#4b4468", lip: "#2b2543", ink: "#f6efe0", outline: "rgba(14,8,24,0.85)"},
  green: {top: "#8cf0a8", bottom: "#25b457", lip: "#0f6a30", ink: "#06361a", outline: "rgba(225,255,235,0.75)"},
  blue: {top: "#9cdcff", bottom: "#2f86dc", lip: "#134f94", ink: "#06233f", outline: "rgba(228,245,255,0.75)"},
  round: {top: "#7a7396", bottom: "#4b4468", lip: "#2b2543", ink: "#f6efe0", outline: "rgba(14,8,24,0.85)"},
};

const DEPTH = 5;

/**
 * A candy button: it has a lip underneath that it sinks into when pressed, a glossy top, and an edge of light.
 * `pulse` (a time in seconds) makes it breathe gently, for the button that should be pressed next.
 * `draw` puts something in the middle instead of text (an icon).
 */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  id: string,
  b: Button,
  label: string,
  kind: ButtonKind = "primary",
  opts: {alpha?: number; pulse?: number; size?: number; ad?: boolean; draw?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string) => void} = {}
): void {
  const look = LOOKS[kind];
  const pressed = ui.pressed === id;
  const r = kind === "round" ? Math.min(b.w, b.h) / 2 : Math.min(b.h / 2, 26);
  const dy = pressed ? DEPTH - 1 : 0;
  const breathe = opts.pulse === undefined || pressed ? 1 : 1 + 0.025 * Math.sin(opts.pulse * 4);

  registerHit(ctx, id, b);

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(breathe, breathe);
  ctx.translate(-b.w / 2, -b.h / 2);

  // The lip, which is all that is left of the button's side when it is pressed.
  ctx.fillStyle = look.lip;
  roundRect(ctx, 0, DEPTH, b.w, b.h, r);
  ctx.fill();
  // The face.
  const face = ctx.createLinearGradient(0, dy, 0, dy + b.h);
  face.addColorStop(0, look.top);
  face.addColorStop(1, look.bottom);
  ctx.fillStyle = face;
  roundRect(ctx, 0, dy, b.w, b.h, r);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = look.lip;
  ctx.stroke();
  // An edge of light just inside, and a gloss over the top half.
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 1.5, dy + 1.5, b.w - 3, b.h - 3, Math.max(2, r - 1.5));
  ctx.stroke();
  ctx.save();
  roundRect(ctx, 0, dy, b.w, b.h, r);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, dy, 0, dy + b.h * 0.55);
  gloss.addColorStop(0, "rgba(255,255,255,0.5)");
  gloss.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(b.w / 2, dy + b.h * 0.02, b.w * 0.5, b.h * 0.52, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (opts.draw) opts.draw(ctx, b.w / 2, dy + b.h / 2, look.ink);
  if (label && opts.ad) {
    // A button that plays an ad: a little video camera with a play triangle in front of the words, so that it is seen that there is an ad to watch.
    const size = opts.size ?? 20;
    ctx.font = `700 ${size}px ${FONT}`;
    const iw = size * 1.3;
    const gap = 7;
    const tw = ctx.measureText(label).width;
    const left = b.w / 2 - (iw + gap + tw) / 2;
    drawAdIcon(ctx, left + iw / 2, dy + b.h / 2 + 0.5, iw, look.ink, look.bottom);
    text(ctx, label, left + iw + gap + tw / 2, dy + b.h / 2 + 1, size, look.ink, "center", look.outline);
  } else if (label) text(ctx, label, b.w / 2, dy + b.h / 2 + 1, opts.size ?? 20, look.ink, "center", look.outline);
  ctx.restore();
}

/** A little video camera with a play triangle in its body: (cx, cy) is the middle, w how wide. */
export function drawAdIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, ink: string, face: string): void {
  const h = w * 0.62;
  const bodyW = w * 0.68;
  const left = cx - w / 2;
  ctx.save();
  ctx.fillStyle = ink;
  roundRect(ctx, left, cy - h / 2, bodyW, h, h * 0.22);
  ctx.fill();
  // The lens, on the right.
  ctx.beginPath();
  ctx.moveTo(left + bodyW + 1, cy - h * 0.12);
  ctx.lineTo(left + w, cy - h * 0.38);
  ctx.lineTo(left + w, cy + h * 0.38);
  ctx.lineTo(left + bodyW + 1, cy + h * 0.12);
  ctx.closePath();
  ctx.fill();
  // The play triangle.
  const bx = left + bodyW / 2;
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.moveTo(bx - h * 0.16, cy - h * 0.24);
  ctx.lineTo(bx - h * 0.16, cy + h * 0.24);
  ctx.lineTo(bx + h * 0.26, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A rounded panel: dark glass (for the screen) or paper (for the book). */
/** The dialogs that fit their panel to what is in it: how far down their lowest button reached last time it was drawn. */
const fitLows: Record<string, number> = {};
let fitKey: string | null = null;
let fitLow = 0;

/**
 * A dialog panel that grows and shrinks with what is in it: it is as tall as its lowest button (as it was the time before) plus a margin, so that a
 * button that is not there (an ad, a retry) leaves no empty room. `h` is the height until it has been drawn once. Call endFit() after the content.
 */
export function fitPanel(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, r = 24): void {
  const low = fitLows[key];
  const hh = low !== undefined && low > y ? low - y + 22 : h;
  drawPanel(ctx, x, y, w, hh, r);
  fitKey = key;
  fitLow = 0;
}

/** The content of a fitted dialog is done: how low it reached is kept for the next time. */
export function endFit(): void {
  if (fitKey) fitLows[fitKey] = fitLow;
  fitKey = null;
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 18, kind: "glass" | "card" = "glass"): void {
  softShadow(ctx, x, y + 3, w, h, r, 8, 0.4);
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  if (kind === "glass") {
    fill.addColorStop(0, "rgba(58,48,76,0.94)");
    fill.addColorStop(1, "rgba(30,24,44,0.96)");
  } else {
    fill.addColorStop(0, "#5a4636");
    fill.addColorStop(1, "#3a2c22");
  }
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,225,160,0.35)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  roundRect(ctx, x - 1, y - 1, w + 2, h + 2, r + 1);
  ctx.stroke();
  // A line of light along the top edge.
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, y, 0, y + 26);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, 26);
  ctx.restore();
}

/** A ribbon with a title on it, for the top of a card. */
export function drawRibbon(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, label: string, light: string, deep: string): void {
  const h = 50;
  const x = cx - w / 2;
  softShadow(ctx, x, y + 3, w, h, 10, 6, 0.4);
  // The folded ends.
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 12);
  ctx.lineTo(x + 14, y + 12);
  ctx.lineTo(x + 14, y + h + 8);
  ctx.lineTo(x - 16, y + h + 8);
  ctx.lineTo(x - 6, y + h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w + 16, y + 12);
  ctx.lineTo(x + w - 14, y + 12);
  ctx.lineTo(x + w - 14, y + h + 8);
  ctx.lineTo(x + w + 16, y + h + 8);
  ctx.lineTo(x + w + 6, y + h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  // The band.
  const band = ctx.createLinearGradient(0, y, 0, y + h);
  band.addColorStop(0, light);
  band.addColorStop(1, deep);
  ctx.fillStyle = band;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(30,12,4,0.65)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, x + 3, y + 3, w - 6, h * 0.42, 8);
  ctx.fill();
  text(ctx, label, cx, y + h / 2 + 1, 28, "#ffffff", "center", "rgba(40,12,4,0.8)");
}

/**
 * A star, filled gold or empty. A `glossy` one (the stars of the card after a round) is shinier: a white gloss over its upper part
 * that is cut off by a line from the lower left up to the upper right, a glow from below and a bright edge just inside.
 * A `thin` one has a thinner border.
 */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean, glossy = false, thin = false): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.46;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  if (filled) {
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    if (glossy) {
      g.addColorStop(0, "#fff3a8");
      g.addColorStop(0.5, "#ffd23a");
      g.addColorStop(1, "#e58a0a");
    } else {
      g.addColorStop(0, "#fff0a0");
      g.addColorStop(1, "#f0a914");
    }
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
  }
  ctx.fill();
  if (filled && glossy) {
    ctx.save();
    ctx.clip();
    // The gloss: white over the upper part, cut off by a line that rises to the right.
    const edge = (px: number): number => y + r * 0.3 - (px - x) * 0.45;
    const gloss = ctx.createLinearGradient(0, y - r, 0, y + r * 0.3);
    gloss.addColorStop(0, "rgba(255,255,255,0.72)");
    gloss.addColorStop(1, "rgba(255,255,255,0.26)");
    ctx.fillStyle = gloss;
    const above = new Path2D();
    above.moveTo(x - r * 1.2, edge(x - r * 1.2));
    above.lineTo(x + r * 1.2, edge(x + r * 1.2));
    above.lineTo(x + r * 1.2, y - r * 1.2);
    above.lineTo(x - r * 1.2, y - r * 1.2);
    above.closePath();
    ctx.fill(above);
    // A glow coming up from the bottom, and a bright edge just inside the upper part.
    const glow = ctx.createRadialGradient(x, y + r * 0.85, 0, x, y + r * 0.85, r * 0.95);
    glow.addColorStop(0, "rgba(255,255,255,0.4)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    const rim = ctx.createLinearGradient(0, y - r, 0, y + r * 0.2);
    rim.addColorStop(0, "rgba(255,255,255,0.95)");
    rim.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = rim;
    ctx.lineWidth = r * 0.24;
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineWidth = thin ? Math.max(0.9, r * 0.085) : Math.max(1.5, r * 0.16); // (`thin`: a thin border, for the small stars on the level tiles)
  ctx.strokeStyle = filled ? "#8a5208" : "rgba(255,255,255,0.18)";
  ctx.stroke();
}

/** A coin: gold with a dark edge, a ring inside it and a shine. (x, y) is its middle. */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const gold = ctx.createLinearGradient(0, y - r, 0, y + r);
  gold.addColorStop(0, "#fff3a8");
  gold.addColorStop(0.5, "#ffd23a");
  gold.addColorStop(1, "#e58a0a");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.strokeStyle = "#8a5208";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.64, 0, TAU);
  ctx.strokeStyle = "rgba(138,82,8,0.5)";
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.34, r * 0.16, -0.6, 0, TAU);
  ctx.fill();
}

// ---- The bonus ball -------------------------------------------------------------------

/**
 * A bonus ball: a ball with a gold border instead of silver, a soft golden glow that pulses, and a picture on it:
 * a heart (a dead cup comes back), a star (points) or an hourglass (slow motion).
 */
/** The sign of the reverse (like the card in the game of cards): two thick bent arrows, one pointing down and one pointing up, white with a dark edge. Centred on (x, y), `k` is the size. */
/** An eraser, centred on (x, y): pink and blue, tilted, with a little shine. `k` is the size (about 24 units wide at 1). */
export function drawEraser(ctx: CanvasRenderingContext2D, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.rotate(-0.5);
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3a2030";
  ctx.fillStyle = "#ff8fb0";
  roundRect(ctx, -12, -6.5, 13, 13, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6fa8ff";
  roundRect(ctx, 0, -6.5, 12, 13, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  roundRect(ctx, -9.5, -4.5, 8, 3, 1.5);
  ctx.fill();
  ctx.restore();
}

export function drawReverseIcon(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  // (the arrows stand upright: one points down, the other up, side by side)
  ctx.rotate(Math.PI / 4);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const arrow = (pass: "edge" | "fill") => {
    // The shaft, bent once, and the head at its end (pointing down and to the right).
    ctx.beginPath();
    ctx.moveTo(-8.5, -4);
    ctx.lineTo(-5, -7.5);
    ctx.lineTo(2.5, 0);
    ctx.lineWidth = pass === "edge" ? 6.6 : 3.6;
    ctx.strokeStyle = pass === "edge" ? "#0b5e55" : "#ffffff";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7.5, 5);
    ctx.lineTo(5.5, -3.5);
    ctx.lineTo(-1, 3);
    ctx.closePath();
    if (pass === "edge") {
      ctx.lineWidth = 3.2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  };
  // (one arrow above the other, side by side across the diagonal, so that they do not run into each other)
  for (const pass of ["edge", "fill"] as const) {
    ctx.save();
    ctx.translate(3.2, -3.2);
    arrow(pass);
    ctx.restore();
    ctx.save();
    ctx.rotate(Math.PI);
    ctx.translate(3.2, -3.2);
    arrow(pass);
    ctx.restore();
  }
  ctx.restore();
}

export function drawBonusBall(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Bonus, scale = 1, time = 0): void {
  const R = 21;
  const r = R - 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (kind === "star") {
    drawBonusStar(ctx, time);
    ctx.restore();
    return;
  }
  if (kind === "diamond") {
    drawBonusDiamond(ctx, time);
    ctx.restore();
    return;
  }

  // The glow.
  const k = 0.5 + 0.5 * Math.sin(time * 5);
  const aura = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 2.2);
  aura.addColorStop(0, `rgba(255,214,90,${0.5 + 0.3 * k})`);
  aura.addColorStop(1, "rgba(255,214,90,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, R * 2.2, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();

  // The gold border.
  const gold = ctx.createLinearGradient(-R, -R, R, R);
  gold.addColorStop(0, "#fff6c0");
  gold.addColorStop(0.3, "#d99a14");
  gold.addColorStop(0.55, "#fff0a0");
  gold.addColorStop(1, "#8f5a08");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(60,30,0,0.55)";
  ctx.stroke();

  // The face, in a colour for what it does.
  const face = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  if (kind === "life") {
    face.addColorStop(0, "#ff9bb0");
    face.addColorStop(0.5, "#e0304e");
    face.addColorStop(1, "#7a0f26");
  } else if (kind === "points") {
    face.addColorStop(0, "#d7b3ff");
    face.addColorStop(0.5, "#8a4fe0");
    face.addColorStop(1, "#3f1a8a");
  } else if (kind === "pause") {
    face.addColorStop(0, "#c4f7d8");
    face.addColorStop(0.5, "#2fbf7e");
    face.addColorStop(1, "#0b6a43");
  } else if (kind === "cloth") {
    face.addColorStop(0, "#ffe3b8");
    face.addColorStop(0.5, "#f09a38");
    face.addColorStop(1, "#8f4308");
  } else if (kind === "shield") {
    face.addColorStop(0, "#c6cfff");
    face.addColorStop(0.5, "#4f62e6");
    face.addColorStop(1, "#1a1f78");
  } else if (kind === "reverse") {
    face.addColorStop(0, "#c8fff4");
    face.addColorStop(0.5, "#1fb7a6");
    face.addColorStop(1, "#0b5e55");
  } else if (kind === "wand") {
    face.addColorStop(0, "#ffd6f6");
    face.addColorStop(0.5, "#d94fbe");
    face.addColorStop(1, "#6c1258");
  } else if (kind === "bomb") {
    face.addColorStop(0, "#8d96a6");
    face.addColorStop(0.5, "#2b303a");
    face.addColorStop(1, "#07080b");
  } else {
    face.addColorStop(0, "#b8f1ff");
    face.addColorStop(0.5, "#35b7e8");
    face.addColorStop(1, "#0f5f8a");
  }
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();
  const gloss = ctx.createLinearGradient(0, -r, 0, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0.6)");
  gloss.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.52, r * 0.78, r * 0.44, 0, 0, TAU);
  ctx.fill();

  // The picture.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (kind === "life") {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-15, -2, -9, -12, 0, -5);
    ctx.bezierCurveTo(9, -12, 15, -2, 0, 8);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#7a0f26";
    ctx.stroke();
  } else if (kind === "points") {
    drawStar(ctx, 0, 1, 12, true);
  } else if (kind === "reverse") {
    drawReverseIcon(ctx, 0, 0, 1);
  } else if (kind === "wand") {
    // A magic wand: a dark stick with a gold tip, a star at its end and a few sparkles.
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#2a1030";
    ctx.beginPath();
    ctx.moveTo(-9, 10);
    ctx.lineTo(4, -3);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#f7f0ff";
    ctx.beginPath();
    ctx.moveTo(-9, 10);
    ctx.lineTo(1, 0);
    ctx.stroke();
    ctx.strokeStyle = "#ffd54a";
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(4, -3);
    ctx.stroke();
    drawStar(ctx, 7, -6, 6.5, true);
    ctx.fillStyle = "#ffffff";
    for (const [sx, sy, sr] of [[-2, -9, 1.6], [12, 3, 1.3], [-10, -2, 1.1]] as const) {
      ctx.beginPath();
      ctx.arc(sx, sy, sr + 0.4 * Math.sin(time * 6 + sx), 0, TAU);
      ctx.fill();
    }
  } else if (kind === "pause") {
    // Two bars: the pause sign.
    for (const bx of [-7, 3]) {
      roundRect(ctx, bx, -9, 5, 18, 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#07583a";
      ctx.stroke();
    }
  } else if (kind === "cloth") {
    // A pull-down screen: the roller at the top, the white cloth, the bar at the bottom and the cord with its ring.
    roundRect(ctx, -10, -12, 20, 4, 2);
    ctx.fillStyle = "#5a3a12";
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-8, -8, 16, 13);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#8f4308";
    ctx.stroke();
    roundRect(ctx, -9, 4, 18, 3, 1.5);
    ctx.fillStyle = "#5a3a12";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(0, 10);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#5a3a12";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 12, 2.2, 0, TAU);
    ctx.strokeStyle = "#ffe27a";
    ctx.stroke();
  } else if (kind === "shield") {
    // A shield.
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.quadraticCurveTo(0, -13, 9, -8);
    ctx.lineTo(9, 0);
    ctx.bezierCurveTo(9, 6, 4, 10, 0, 13);
    ctx.bezierCurveTo(-4, 10, -9, 6, -9, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1f78";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 9);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#4f62e6";
    ctx.stroke();
  } else if (kind === "bomb") {
    // A fuse that curls up from the top, with a spark on the end that flickers.
    ctx.beginPath();
    ctx.moveTo(3, -10);
    ctx.quadraticCurveTo(5, -16, 11, -15);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "#e8d3a0";
    ctx.stroke();
    const flick = 0.6 + 0.4 * Math.sin(time * 18);
    const spark = ctx.createRadialGradient(11, -15, 0, 11, -15, 7 * flick + 2);
    spark.addColorStop(0, "#ffffff");
    spark.addColorStop(0.4, "#ffd54a");
    spark.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = spark;
    ctx.beginPath();
    ctx.arc(11, -15, 7 * flick + 2, 0, TAU);
    ctx.fill();
    // A little shine on the bomb, and a white mark on it so that it is easy to tell from a number at a glance.
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-5, -3, 3, 0, TAU);
    ctx.fill();
    text(ctx, "!", 1, 4, 18, "#ffd54a", "center", "rgba(0,0,0,0.9)");
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(7, -10);
    ctx.lineTo(1, 0);
    ctx.lineTo(7, 10);
    ctx.lineTo(-7, 10);
    ctx.lineTo(-1, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#0b4a6b";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.lineTo(9, -10);
    ctx.moveTo(-9, 10);
    ctx.lineTo(9, 10);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- The number ball ------------------------------------------------------------------

/** The star that jumps between the columns: a bright five-pointed star with a glow, that twinkles (drawn at the origin). */
/** The diamond: a cut gem with a cold glow round it, facets that catch the light, and twinkles (drawn at the origin, about as big as a ball). */
function drawBonusDiamond(ctx: CanvasRenderingContext2D, time: number): void {
  const k = 0.5 + 0.5 * Math.sin(time * 6);
  const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  aura.addColorStop(0, `rgba(170,235,255,${0.6 + 0.3 * k})`);
  aura.addColorStop(1, "rgba(120,200,255,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.rotate(Math.sin(time * 2.2) * 0.08);
  ctx.lineJoin = "round";
  // The outline of the gem: the flat top (the table), the crown that widens, and the point at the bottom.
  const gem = new Path2D();
  gem.moveTo(-8, -15);
  gem.lineTo(8, -15);
  gem.lineTo(18, -5);
  gem.lineTo(0, 17);
  gem.lineTo(-18, -5);
  gem.closePath();
  const fill = ctx.createLinearGradient(-18, -15, 18, 17);
  fill.addColorStop(0, "#f2fdff");
  fill.addColorStop(0.45, "#7fdcff");
  fill.addColorStop(1, "#2f7fe0");
  ctx.fillStyle = fill;
  ctx.fill(gem);
  // The facets.
  ctx.save();
  ctx.clip(gem);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(-8, -15);
  ctx.lineTo(-3, -5);
  ctx.lineTo(-18, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(20,70,170,0.28)";
  ctx.beginPath();
  ctx.moveTo(8, -15);
  ctx.lineTo(18, -5);
  ctx.lineTo(3, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.lineTo(3, -5);
  ctx.lineTo(0, 17);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-18, -5);
  ctx.lineTo(18, -5);
  ctx.moveTo(-8, -15);
  ctx.lineTo(-3, -5);
  ctx.lineTo(0, 17);
  ctx.lineTo(3, -5);
  ctx.lineTo(8, -15);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(10,40,110,0.9)";
  ctx.stroke(gem);
  ctx.restore();
  // Twinkles.
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * k})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [dx, dy, size] of [[-22, -12, 4.4], [22, 6, 3.6], [10, -22, 3]] as const) {
    const s = size * (0.6 + 0.4 * Math.sin(time * 7 + dx));
    ctx.beginPath();
    ctx.moveTo(dx - s, dy);
    ctx.lineTo(dx + s, dy);
    ctx.moveTo(dx, dy - s);
    ctx.lineTo(dx, dy + s);
    ctx.stroke();
  }
}

function drawBonusStar(ctx: CanvasRenderingContext2D, time: number): void {
  const k = 0.5 + 0.5 * Math.sin(time * 6);
  const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  aura.addColorStop(0, `rgba(255,236,150,${0.55 + 0.3 * k})`);
  aura.addColorStop(1, "rgba(255,236,150,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, TAU);
  ctx.fill();
  const path = (outer: number, inner: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 === 0 ? outer : inner;
      if (i === 0) ctx.moveTo(rad * Math.cos(ang), rad * Math.sin(ang));
      else ctx.lineTo(rad * Math.cos(ang), rad * Math.sin(ang));
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.rotate(Math.sin(time * 2) * 0.12);
  ctx.lineJoin = "round";
  // A dark edge, the gold, and a bright middle.
  path(17, 7.6);
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = "rgba(90,45,0,0.9)";
  ctx.stroke();
  const gold = ctx.createLinearGradient(0, -17, 0, 14);
  gold.addColorStop(0, "#fff7b8");
  gold.addColorStop(0.5, "#ffd23c");
  gold.addColorStop(1, "#f08a10");
  ctx.fillStyle = gold;
  ctx.fill();
  path(9.2, 4);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.restore();
  // Twinkles.
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * k})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [dx, dy, size] of [[-20, -9, 4], [21, 7, 3.4], [12, -20, 2.8]] as const) {
    const s = size * (0.6 + 0.4 * Math.sin(time * 7 + dx));
    ctx.beginPath();
    ctx.moveTo(dx - s, dy);
    ctx.lineTo(dx + s, dy);
    ctx.moveTo(dx, dy - s);
    ctx.lineTo(dx, dy + s);
    ctx.stroke();
  }
}

/**
 * A round glossy ball with a silver border: green for plus, red for minus, blue for multiplication and yellow for division,
 * with the number on it (and orange for the 0).
 * `time` and `phase` only move the glint that sweeps across now and then.
 */
/** The three colours of a number ball: light, middle and dark (green for plus, red for minus, blue for times, yellow for divide, orange for 0 and 10). */
function ballTone(op: Op, minus: boolean): [string, string, string] {
  if (op === "steel") return ["#e8edf3", "#8a97a8", "#343c48"];
  if (op === "dim") return ["#8d8d99", "#2e2e37", "#050508"];
  if (op === "zero" || op === "ten") return ["#ffd9a0", "#f58a1f", "#a34d05"];
  if (op === "mul") return ["#a9d4ff", "#2f7fe6", "#10408f"];
  if (op === "div") return ["#fff2a6", "#f0b81c", "#a8690a"];
  if (minus) return ["#ff8f86", "#df2f28", "#8a110d"];
  return ["#82f2a4", "#22b058", "#0d6633"];
}

/** The operation whose colour a ball with reversed colours has: blue and yellow swap (the others are as they are). */
function swapOp(op: Op): Op {
  return op === "mul" ? "div" : op === "div" ? "mul" : op;
}

/** What is written on the balls instead of their number (only the balls that stand for a chapter on its page: the sign alone, + − × ÷); null for the number. */
let ballOverride: string | null = null;
export function setBallLabel(label: string | null): void {
  ballOverride = label;
}

/** What is written on a number ball, and how big. */
function ballLabel(op: Op, v: number): {s: string; size: number} {
  if (ballOverride !== null) return {s: ballOverride, size: 26};
  if (op === "zero") return {s: "=0", size: 22};
  if (op === "ten") return {s: "=10", size: 18};
  if (op === "mul") return {s: `\u00D7${v}`, size: 21};
  if (op === "div") return {s: `\u00F7${v}`, size: 21};
  return {s: signed(v), size: op === "steel" ? 20 : 22};
}

/**
 * The balls with the numbers in the other styles of the shop: "neon" is a dark ball with a glowing ring and a glowing number, "candy" a flat bright ball
 * with a thick white edge, "dark" a matte black ball with a thin ring and a clear number, "minimal" a pale ball with a colour ring, "glass" a see-through
 * coloured ball and "chalk" a slate with a chalk ring and chalk numbers. ("wood" only changes the edge of the classic ball, see drawBall.)
 */
function drawStyledBall(ctx: CanvasRenderingContext2D, style: string, v: number, op: Op, minus: boolean, reversed = false): void {
  const R = 20;
  const r = R - 3.5;
  const tone = ballTone(reversed ? swapOp(op) : op, reversed && op === "add" ? !minus : minus);
  const label = ballLabel(op, v);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();
  if (style === "neon") {
    ctx.save();
    ctx.shadowColor = tone[1];
    ctx.shadowBlur = 12;
    const disc = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, R);
    disc.addColorStop(0, "#2a2540");
    disc.addColorStop(1, "#0b0913");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R - 1.5, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = tone[0];
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.strokeStyle = tone[1];
    ctx.beginPath();
    ctx.arc(0, 0, r - 2.5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = tone[1];
    ctx.shadowBlur = 9;
    text(ctx, label.s, 0, 1, label.size, tone[0], "center", "rgba(0,0,0,0.9)");
    ctx.restore();
    return;
  }
  if (style === "dark") {
    const disc = ctx.createRadialGradient(-r * 0.3, -r * 0.45, 2, 0, 0, R);
    disc.addColorStop(0, "#2a2833");
    disc.addColorStop(1, "#0d0c12");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = tone[1];
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * 0.7, r * 0.34, 0, 0, TAU);
    ctx.fill();
    text(ctx, label.s, 0, 1, label.size, tone[0], "center", "rgba(0,0,0,0.9)");
    return;
  }
  if (style === "minimal") {
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = tone[1];
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.arc(0, 0, R - 3.2, 0, TAU);
    ctx.stroke();
    text(ctx, label.s, 0, 1, label.size, tone[2], "center", "rgba(255,255,255,0.85)");
    return;
  }
  if (style === "glass") {
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, R);
    body.addColorStop(0, "rgba(255,255,255,0.55)");
    body.addColorStop(0.35, "rgba(255,255,255,0.12)");
    body.addColorStop(1, "rgba(0,0,0,0.0)");
    ctx.fillStyle = tone[1];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.55, r * 0.4, r * 0.18, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(r * 0.3, r * 0.62, r * 0.3, r * 0.1, 0.4, 0, TAU);
    ctx.fill();
    text(ctx, label.s, 0, 1, label.size, "#ffffff", "center", tone[2]);
    return;
  }
  if (style === "chalk") {
    ctx.fillStyle = "#24332e";
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(245,240,225,0.9)";
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, R - 3.2, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.93;
    text(ctx, label.s, 0, 1, label.size, tone[0], "center", "rgba(10,20,16,0.6)");
    ctx.globalAlpha = 1;
    return;
  }
  // Candy.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.stroke();
  const face = ctx.createLinearGradient(0, -r, 0, r);
  face.addColorStop(0, tone[0]);
  face.addColorStop(0.55, tone[1]);
  face.addColorStop(1, tone[1]);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r + 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.34, -r * 0.52, r * 0.34, r * 0.17, -0.55, 0, TAU);
  ctx.fill();
  text(ctx, label.s, 0, 1, label.size, "#ffffff", "center", tone[2]);
}

/** Sun rays round a ball of radius `R` (drawn at the origin): a warm glow, and twelve rays, long and short, that turn slowly and breathe. */
function drawSunRays(ctx: CanvasRenderingContext2D, R: number, time: number): void {
  const breathe = 1 + 0.12 * Math.sin(time * 3);
  ctx.save();
  const glow = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 1.9);
  glow.addColorStop(0, "rgba(255,170,40,0.55)");
  glow.addColorStop(1, "rgba(255,170,40,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.9, 0, TAU);
  ctx.fill();
  ctx.rotate(time * 0.45);
  ctx.lineJoin = "round";
  for (let i = 0; i < 12; i++) {
    const long = i % 2 === 0;
    const a = (i * TAU) / 12;
    const from = R - 2;
    const to = R + (long ? 9 : 5.5) * breathe;
    const half = long ? 0.15 : 0.12;
    ctx.fillStyle = long ? "#ffb52e" : "#ff9a1f";
    ctx.strokeStyle = "rgba(130,60,0,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - half) * from, Math.sin(a - half) * from);
    ctx.lineTo(Math.cos(a) * to, Math.sin(a) * to);
    ctx.lineTo(Math.cos(a + half) * from, Math.sin(a + half) * from);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A skull, white with dark eyes, centred on (0, 0) (about 22 units tall at k = 1). */
export function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, k = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.fillStyle = "#f6f2ea";
  ctx.strokeStyle = "#1c1424";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -2.5, 9, Math.PI * 0.85, Math.PI * 0.15);
  ctx.lineTo(5.5, 6.5);
  ctx.lineTo(-5.5, 6.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -5, 5, 10, 5, 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1c1424";
  for (const ex of [-3.8, 3.8]) {
    ctx.beginPath();
    ctx.ellipse(ex, -1.5, 2.6, 3, 0, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-1.4, 4.2);
  ctx.lineTo(1.4, 4.2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1;
  for (const tx of [-2.5, 0, 2.5]) {
    ctx.beginPath();
    ctx.moveTo(tx, 5.5);
    ctx.lineTo(tx, 9.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, v: number, scale = 1, time = 0, phase = 0, op: Op = "add", style: string = ui.look.numbers, reversed = false): void {
  if (op === "skull" || op === "trap") {
    // The skull of Defend the cups: a dark purple ball with a silver ring and a white skull on it (the trap skull of Fast fingers has a red ring).
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.arc(2, 4, 20, 0, TAU);
    ctx.fill();
    const ring = ctx.createLinearGradient(-20, -20, 20, 20);
    const trap = op === "trap";
    ring.addColorStop(0, trap ? "#ffb3a8" : "#e6e1ee");
    ring.addColorStop(0.5, trap ? "#e0352b" : "#8c839c");
    ring.addColorStop(1, trap ? "#7a0f0a" : "#4b4458");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    const steel = ui.steelSkulls && !trap;
    const face = ctx.createRadialGradient(-6, -8, 2, 0, 0, 19);
    // (in Shield up the skull is steel: brushed grey metal with four rivets, like a steel number)
    face.addColorStop(0, steel ? "#e9eef3" : "#6b4f8a");
    face.addColorStop(0.55, steel ? "#8d99a6" : "#2c1c3c");
    face.addColorStop(1, steel ? "#46505b" : "#120a1a");
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, 16.5, 0, TAU);
    ctx.fill();
    if (steel) {
      ctx.fillStyle = "#5d6873";
      for (const k of [0, 1, 2, 3]) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.5, 0, TAU);
        ctx.fill();
      }
    }
    drawSkull(ctx, 0, 0, 1.05);
    ctx.restore();
    return;
  }
  const R = 20;
  const r = R - 3.5;
  const minus = v < 0;
  // (the colours of a ball with reversed colours: a plus number as a minus number, blue as yellow and yellow as blue)
  const rev = reversed || style === "reverse";
  const cop = rev ? swapOp(op) : op;
  const cminus = rev && op === "add" ? !minus : minus;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // The orange 10 shines like a little sun: a soft glow and rays that turn slowly, behind the ball.
  if (op === "ten") drawSunRays(ctx, R, time + phase);
  if (style === "neon" || style === "candy" || style === "dark" || style === "minimal" || style === "glass" || style === "chalk") {
    drawStyledBall(ctx, style, v, op, minus, reversed);
    ctx.restore();
    return;
  }

  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();

  // Silver border.
  const silver = ctx.createLinearGradient(-R, -R, R, R);
  silver.addColorStop(0, "#fbfcfd");
  silver.addColorStop(0.3, "#aeb4bc");
  silver.addColorStop(0.55, "#f0f2f5");
  silver.addColorStop(1, "#7d848c");
  const wood = ctx.createLinearGradient(-R, -R, R, R);
  wood.addColorStop(0, "#dfaa6c");
  wood.addColorStop(0.3, "#8a5a2c");
  wood.addColorStop(0.55, "#cc9358");
  wood.addColorStop(1, "#5e3a1a");
  ctx.fillStyle = style === "wood" ? wood : silver;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = style === "wood" ? "rgba(40,20,5,0.55)" : "rgba(0,0,0,0.4)";
  ctx.stroke();

  // The coloured face.
  const face = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  if (op === "steel") {
    face.addColorStop(0, "#e8edf3");
    face.addColorStop(0.4, "#8a97a8");
    face.addColorStop(1, "#343c48");
  } else if (op === "dim") {
    face.addColorStop(0, "#8d8d99");
    face.addColorStop(0.45, "#2e2e37");
    face.addColorStop(1, "#050508");
  } else if (op === "zero" || op === "ten") {
    face.addColorStop(0, "#ffd9a0");
    face.addColorStop(0.45, "#f58a1f");
    face.addColorStop(1, "#a34d05");
  } else if (cop === "mul") {
    face.addColorStop(0, "#a9d4ff");
    face.addColorStop(0.45, "#2f7fe6");
    face.addColorStop(1, "#10408f");
  } else if (cop === "div") {
    face.addColorStop(0, "#fff2a6");
    face.addColorStop(0.45, "#f0b81c");
    face.addColorStop(1, "#a8690a");
  } else if (cminus) {
    face.addColorStop(0, "#ff8f86");
    face.addColorStop(0.45, "#df2f28");
    face.addColorStop(1, "#8a110d");
  } else {
    face.addColorStop(0, "#82f2a4");
    face.addColorStop(0.45, "#22b058");
    face.addColorStop(1, "#0d6633");
  }
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();

  // A steel ball has four little bolts round its face.
  if (op === "steel") {
    ctx.fillStyle = "rgba(40,48,60,0.85)";
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (r - 3.2), Math.sin(a) * (r - 3.2), 1.5, 0, TAU);
      ctx.fill();
    }
  }
  // Gloss: a bright curve over the top half, and a glint that sweeps across now and then.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, -r, 0, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0.7)");
  gloss.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.52, r * 0.78, r * 0.46, 0, 0, TAU);
  ctx.fill();
  const sweep = ((time * 0.5 + phase * 0.37) % 2.2) - 0.6; // most of the time out of view
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect((sweep * 2 - 1) * r * 1.4, -r * 1.6, 5, r * 3.2);
  ctx.restore();

  // (the balls that stand for a chapter on its page have the sign alone on them)
  if (ballOverride !== null) text(ctx, ballOverride, 0, 1, 26, "#ffffff", "center", cop === "mul" ? "rgba(5,30,80,0.9)" : cop === "div" ? "rgba(90,50,0,0.9)" : cminus ? "rgba(90,8,5,0.9)" : "rgba(5,60,28,0.9)");
  else if (op === "steel") text(ctx, signed(v), 0, 1, 20, "#ffffff", "center", "rgba(20,28,40,0.95)");
  else if (op === "dim") text(ctx, signed(v), 0, 1, 22, "#ffffff", "center", "rgba(0,0,0,0.95)");
  else if (op === "zero") text(ctx, "=0", 0, 1, 22, "#ffffff", "center", "rgba(110,50,0,0.9)");
  else if (op === "ten") text(ctx, "=10", 0, 1, 18, "#ffffff", "center", "rgba(110,50,0,0.9)");
  else if (op === "mul") text(ctx, `\u00D7${v}`, 0, 1, 21, "#ffffff", "center", cop === "mul" ? "rgba(5,30,80,0.9)" : "rgba(90,50,0,0.9)");
  else if (op === "div") text(ctx, `\u00F7${v}`, 0, 1, 21, "#ffffff", "center", cop === "div" ? "rgba(90,50,0,0.9)" : "rgba(5,30,80,0.9)");
  else text(ctx, signed(v), 0, 1, 22, "#ffffff", "center", cminus ? "rgba(90,8,5,0.9)" : "rgba(5,60,28,0.9)");
  ctx.restore();
}

/**
 * A block of ice round a number ball (drawn over the ball). `hits` is how many taps are left to break it: with one left
 * the ice is cracked.
 */
export function drawIce(ctx: CanvasRenderingContext2D, x: number, y: number, hits: number, scale = 1, time = 0, phase = 0): void {
  const S = 25; // half the width of the block
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const block = () => {
    ctx.beginPath();
    ctx.moveTo(-S + 9, -S);
    ctx.lineTo(S - 7, -S);
    ctx.quadraticCurveTo(S, -S, S, -S + 8);
    ctx.lineTo(S, S - 9);
    ctx.quadraticCurveTo(S, S, S - 9, S);
    ctx.lineTo(-S + 7, S);
    ctx.quadraticCurveTo(-S, S, -S, S - 8);
    ctx.lineTo(-S, -S + 9);
    ctx.quadraticCurveTo(-S, -S, -S + 9, -S);
    ctx.closePath();
  };
  // The ice: see-through blue-white, brighter towards the top left.
  const body = ctx.createLinearGradient(-S, -S, S, S);
  body.addColorStop(0, "rgba(235,248,255,0.78)");
  body.addColorStop(0.5, "rgba(170,215,245,0.5)");
  body.addColorStop(1, "rgba(110,170,225,0.62)");
  ctx.fillStyle = body;
  block();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(235,250,255,0.95)";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(70,130,190,0.55)";
  roundRect(ctx, -S + 3, -S + 3, 2 * S - 6, 2 * S - 6, 8);
  ctx.stroke();
  // Gloss, and a glint that sweeps across now and then.
  ctx.save();
  block();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(-S, -S);
  ctx.lineTo(S * 0.15, -S);
  ctx.lineTo(-S, S * 0.15);
  ctx.closePath();
  ctx.fill();
  const sweep = ((time * 0.45 + phase * 0.31) % 2.4) - 0.7;
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect((sweep * 2 - 1) * S * 1.5, -S * 1.6, 6, S * 3.2);
  ctx.restore();
  // Cracked: white cracks run across the block.
  if (hits <= 1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const crack = (w: number, c: string) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(-S + 2, -S * 0.55);
      ctx.lineTo(-S * 0.4, -S * 0.2);
      ctx.lineTo(-S * 0.1, -S * 0.35);
      ctx.lineTo(S * 0.15, 0.05 * S);
      ctx.lineTo(S * 0.5, -0.02 * S);
      ctx.lineTo(S - 2, S * 0.3);
      ctx.moveTo(S * 0.15, 0.05 * S);
      ctx.lineTo(S * 0.05, S * 0.5);
      ctx.lineTo(S * 0.3, S - 2);
      ctx.moveTo(-S * 0.4, -S * 0.2);
      ctx.lineTo(-S * 0.55, S * 0.3);
      ctx.stroke();
    };
    crack(3, "rgba(60,110,170,0.5)");
    crack(1.4, "rgba(255,255,255,0.95)");
  }
  ctx.restore();
}

/** The back of a ghost number that has turned over: the same silver border, a dark misty face and a question mark. */
export function drawGhostBack(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1, time = 0, phase = 0): void {
  const R = 20;
  const r = R - 3.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(2, 4, R, 0, TAU);
  ctx.fill();
  const silver = ctx.createLinearGradient(-R, -R, R, R);
  silver.addColorStop(0, "#fbfcfd");
  silver.addColorStop(0.3, "#aeb4bc");
  silver.addColorStop(0.55, "#f0f2f5");
  silver.addColorStop(1, "#7d848c");
  ctx.fillStyle = silver;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.stroke();
  const face = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  face.addColorStop(0, "#9a93c4");
  face.addColorStop(0.5, "#4b4478");
  face.addColorStop(1, "#1d1940");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, -r, 0, 0);
  gloss.addColorStop(0, "rgba(255,255,255,0.45)");
  gloss.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.52, r * 0.78, r * 0.46, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  text(ctx, "?", 0, 1 + Math.sin(time * 3 + phase) * 1.2, 24, "rgba(235,230,255,0.95)", "center", "rgba(20,12,60,0.9)");
  ctx.restore();
}

/**
 * A cartoon hand with one finger out, for showing where to tap or what to drag. The tip of the finger is at (x, y).
 * `press` (0 to 1) is how hard it is pressing: it sinks a little and is a bit smaller.
 */
export function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, press = 0, scale = 1): void {
  ctx.save();
  ctx.translate(x, y + press * 5);
  ctx.rotate(-0.22);
  const k = scale * (1 - 0.05 * press);
  ctx.scale(k, k);
  // A soft shadow under the hand.
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(6, 52, 20, 9, 0, 0, TAU);
  ctx.fill();
  // The parts of the hand, as paths: the palm, the thumb, three folded fingers and the finger that points.
  const parts: (() => void)[] = [
    () => ctx.roundRect(-17, 22, 36, 42, 14),
    () => ctx.ellipse(-18, 42, 7, 12, 0.35, 0, TAU),
    () => ctx.roundRect(10, 26, 12, 20, 6),
    () => ctx.roundRect(1, 24, 12, 22, 6),
    () => ctx.roundRect(-7, 0, 14, 40, 7),
  ];
  // First all the outlines, then all the fills: the hand gets one outline round the whole of it.
  ctx.lineJoin = "round";
  ctx.lineWidth = 5.5;
  ctx.strokeStyle = "rgba(48,30,18,0.9)";
  for (const part of parts) {
    ctx.beginPath();
    part();
    ctx.stroke();
  }
  const skin = ctx.createLinearGradient(-18, 0, 22, 64);
  skin.addColorStop(0, "#fffaf0");
  skin.addColorStop(1, "#ecd9bd");
  ctx.fillStyle = skin;
  for (const part of parts) {
    ctx.beginPath();
    part();
    ctx.fill();
  }
  // Creases between the folded fingers, and a little shine on the finger.
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(120,86,56,0.55)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(10, 30);
  ctx.lineTo(10, 42);
  ctx.moveTo(1, 31);
  ctx.lineTo(1, 42);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-3, 6);
  ctx.lineTo(-3, 20);
  ctx.stroke();
  ctx.restore();
}

/**
 * The chain between two numbers: small steel links that hang in a curve while the numbers are close, and pull straight
 * when they are far apart. `length` is how far apart the numbers can be before the chain is straight.
 */
export function drawChain(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, length: number, time = 0): void {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const slack = Math.sqrt(Math.max(0, length * length - dist * dist)) * 0.5 * (1 + Math.sin(time * 3) * 0.05);
  // A curve that sags below the straight line between the two numbers.
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 + slack * 2;
  const at = (k: number): [number, number] => {
    const u = 1 - k;
    return [u * u * ax + 2 * u * k * cx + k * k * bx, u * u * ay + 2 * u * k * cy + k * k * by];
  };
  const links = Math.max(4, Math.round((dist + slack * 1.4) / 8));
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i <= links; i++) {
    const k = i / links;
    const [px, py] = at(k);
    const [qx, qy] = at(Math.min(1, k + 0.02));
    const [ox, oy] = at(Math.max(0, k - 0.02));
    const ang = Math.atan2(qy - oy, qx - ox);
    ctx.save();
    ctx.translate(px, py + 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, 3.2, ang, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    // Every other link is seen from the side.
    const ry = i % 2 === 0 ? 3.2 : 1.5;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#3d434b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, ry, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = i % 2 === 0 ? "#e4e8ee" : "#aeb4bc";
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The shield of Shield up: a steel arc (highest in the middle), x and y the middle of its top edge and half the width of it. */
/**
 * (power, 0 to 1: how far it has been upgraded. The colour goes from light blue towards purple with it, and at full power (1) it is purple and glows more.)
 */
export function drawShieldArc(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, bend = 14, power = 0, boost = 0): void {
  ctx.save();
  ctx.lineCap = "round";
  const path = (dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x - half, y + bend + dy);
    ctx.quadraticCurveTo(x, y - bend + dy, x + half, y + bend + dy);
  };
  // a glow of light round it (it breathes a little), a dark edge, the steel, and a shine along the top
  const full = power >= 1;
  const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(v + (b[i] - v) * power)).join(",");
  const glowC = mix([110, 210, 255], [190, 90, 255]);
  const pulse = (full ? 0.85 : 0.75) + 0.25 * Math.sin(performance.now() / (full ? 160 : 260));
  ctx.save();
  ctx.shadowColor = `rgba(${glowC},${pulse})`;
  // (every power upgrade after the full size makes the glow a little stronger)
  ctx.shadowBlur = (full ? 38 : 22) + 26 * boost;
  ctx.strokeStyle = `rgba(${mix([140, 220, 255], [205, 130, 255])},${Math.min(1, (full ? 0.75 : 0.55) + 0.25 * boost) * pulse})`;
  ctx.lineWidth = (full ? 26 : 20) + 8 * boost;
  path(0);
  ctx.stroke();
  ctx.restore();
  const steel = ctx.createLinearGradient(0, y - 8, 0, y + bend + 8);
  // (the same light blue as its glow, solid)
  steel.addColorStop(0, `rgb(${mix([230, 248, 255], [245, 225, 255])})`);
  steel.addColorStop(0.5, `rgb(${mix([140, 220, 255], [190, 120, 255])})`);
  steel.addColorStop(1, `rgb(${mix([79, 180, 230], [130, 60, 210])})`);
  ctx.strokeStyle = steel;
  ctx.lineWidth = 9;
  path(0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  path(-2.5);
  ctx.stroke();
  ctx.restore();
}
