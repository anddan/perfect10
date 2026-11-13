import {BONUS_POINTS, CHAIN_FROM_STAGE, CHAIN_LENGTH, GHOST_FROM_STAGE, GHOST_PERIOD, ICE_FROM_STAGE, ICE_HITS, COLS, CUP_H, CUP_START_Y, SLOW_FACTOR, SLOW_SECONDS, DIVE_GRAVITY, DIVE_HOP, CUP_W, MISS_Y, STAGES, TAP_RADIUS, TARGET, TUTORIAL_STEPS, W} from "./constants";
import type {Bonus, Cup, GameOverReason, GameState, Mode, NumberTile, Op} from "./types";

// ---- Difficulty -----------------------------------------------------------------------

/** How fast the numbers drift down (game units per second). */
export function fallSpeed(level: number): number {
  return Math.min(150, 42 + (level - 1) * 9);
}

/** Seconds between new numbers. */
export function spawnInterval(level: number): number {
  return Math.max(0.7, 1.7 - (level - 1) * 0.08);
}

/** The biggest number that can fall at this level (1..9). */
export function maxNumber(level: number): number {
  return Math.min(9, 3 + level);
}

/** How hard the numbers are right now: the cups cleared so far, plus how hard this level of the book starts. */
function hardness(g: GameState): number {
  return g.level + g.base;
}

/** The modes that are levels of the book (twelve of them on each page). */
function isLevelMode(mode: Mode): boolean {
  return mode === "plus" || mode === "mixed" || mode === "times" || mode === "divide";
}

/** How much harder a level of the book starts than the one before it. */
function baseFor(mode: Mode, stage: number): number {
  if (mode === "tutorial") return 3; // the numbers drift a bit faster than at the very start, so there is not much waiting
  return mode === "endless" ? 0 : (stage - 1) * 1.25;
}

/**
 * How many cups have to reach 10 to clear a game (infinity: it never ends). Every row of the book needs one cup more
 * than the row before: levels 1-3 need 3 cups, 4-6 need 4, 7-9 need 5 and 10-12 need 6.
 */
export function goalFor(mode: Mode, stage = 1): number {
  if (mode === "endless" || mode === "tutorial") return Infinity;
  return 3 + Math.floor((Math.max(1, stage) - 1) / 3);
}

/** In the endless game, how many cups make one level. */
export const ENDLESS_CUPS_PER_LEVEL = 5;

/**
 * The level of the endless game: every five full cups is one level. (`g.level` itself counts every cup, and is what the
 * numbers' speed follows.) The endless game walks through the whole book: level 1 has only plus numbers (like the first
 * chapter), level 2 brings minus numbers (chapter 2), level 3 the blue ones (chapter 3), and after that everything keeps
 * getting harder.
 */
export function endlessLevel(g: GameState): number {
  return Math.floor((g.level - 1) / ENDLESS_CUPS_PER_LEVEL) + 1;
}

/** How far along minus numbers a round is, counted like the levels of a chapter (1 to 12 and on). */
function chapterStage(g: GameState): number {
  return g.mode === "endless" ? Math.max(1, endlessLevel(g) - 1) : g.stage;
}

/** The same for the blue numbers, which come one level later in the endless game. */
function timesStage(g: GameState): number {
  return g.mode === "endless" ? Math.max(1, endlessLevel(g) - 2) : g.stage;
}

/** The same for the yellow numbers, which come one level after the blue ones in the endless game. */
function divStage(g: GameState): number {
  return g.mode === "endless" ? Math.max(1, endlessLevel(g) - 3) : g.stage;
}

/** Which kinds of numbers fall now: minus numbers, blue multiplication numbers, and yellow division numbers. */
function kinds(g: GameState): {minus: boolean; times: boolean; div: boolean} {
  if (g.mode === "endless") return {minus: endlessLevel(g) >= 2, times: endlessLevel(g) >= 3, div: endlessLevel(g) >= 4};
  return {
    minus: g.mode === "mixed" || g.mode === "times" || g.mode === "divide",
    times: g.mode === "times" || g.mode === "divide",
    div: g.mode === "divide",
  };
}

/** How far along the hard parts a round is: the level of the chapter (1 to 12), or the level of the endless game. 0 in the tutorial. */
function hardStage(g: GameState): number {
  if (g.mode === "tutorial") return 0;
  return g.mode === "endless" ? endlessLevel(g) : g.stage;
}

/** From level 4 of every chapter, two numbers sometimes fall chained together: the chance that a new number brings a chain. */
function chainChance(g: GameState): number {
  const s = hardStage(g);
  return s < CHAIN_FROM_STAGE ? 0 : Math.min(0.4, 0.14 + 0.04 * (s - CHAIN_FROM_STAGE));
}

/** From level 7 of every chapter, some numbers are ghosts: the chance that a new number is one. */
function ghostChance(g: GameState): number {
  const s = hardStage(g);
  return s < GHOST_FROM_STAGE ? 0 : Math.min(0.35, 0.12 + 0.06 * (s - GHOST_FROM_STAGE));
}

/** From level 10 of every chapter, some numbers are frozen in ice: the chance that a new (ordinary) number is one. */
function iceChance(g: GameState): number {
  const s = hardStage(g);
  return s < ICE_FROM_STAGE ? 0 : Math.min(0.35, 0.18 + 0.06 * (s - ICE_FROM_STAGE));
}

/**
 * How much of a ghost number can be seen right now, from 0 (hidden) to 1 (all of it). A ghost goes round and round: seen,
 * then hidden for a short while, then seen again. A number that has been tapped shows itself. Any other number is always seen.
 */
export function ghostShow(n: NumberTile, time: number): number {
  if (!n.ghost || n.state === "dive") return 1;
  const u = (((time + n.phase) / GHOST_PERIOD) % 1 + 1) % 1;
  const d = Math.min(u, 1 - u); // 0 when it is right in the middle of being seen, 0.5 in the middle of being hidden
  return Math.min(1, Math.max(0, (0.34 - d) / 0.1));
}

/** The chance that a number is a minus number (it grows the further along you are). */
function minusChance(g: GameState): number {
  return Math.min(0.5, 0.3 + 0.03 * (chapterStage(g) - 1));
}

/** The chance that a number is one that finishes a cup: the help thins out in the later levels. */
function helpChance(g: GameState): number {
  return isLevelMode(g.mode) ? Math.max(0.15, 0.4 - 0.03 * (g.stage - 1)) : 0.35;
}

// ---- Creating and restarting ----------------------------------------------------------

export function createGame(rng: () => number = Math.random, best = 0): GameState {
  const g: GameState = {
    phase: "menu",
    mode: "plus",
    stage: 1,
    base: 0,
    tutorialStep: 0,
    tutorialDelay: 0,
    tutorialNote: "",
    slow: 0,
    bonusTimer: 25,
    cups: [],
    numbers: [],
    level: 1,
    score: 0,
    best,
    newBest: false,
    spawnTimer: 0.6,
    overTimer: 0,
    overReason: null,
    banner: 0,
    shake: 0,
    time: 0,
    nextId: 1,
    events: [],
    rng,
  };
  // The menu shows four cups with some coffee in them, steaming.
  resetCups(g, [2, 5, 7, 9]);
  return g;
}

function resetCups(g: GameState, values?: number[]): void {
  g.cups = COLS.map((x, i): Cup => ({
    id: g.nextId++,
    x,
    y: CUP_START_Y,
    value: values?.[i] ?? 0,
    dead: false,
    bump: 0,
    ripple: 0,
    showTen: 0,
    tenSign: 1,
    flash: 0,
    seed: g.rng() * 10,
  }));
}

/** Back to the book: no round going, the cups steaming on the desk behind it. */
export function showMenu(g: GameState): void {
  g.phase = "menu";
  g.numbers = [];
  g.banner = 0;
  g.shake = 0;
  g.slow = 0;
  resetCups(g, [2, 5, 7, 9]);
}

/** Starts a round. Without a mode (and level) it plays the same game again. */
export function startGame(g: GameState, mode: Mode = g.mode, stage: number = g.stage): void {
  g.mode = mode;
  g.stage = isLevelMode(mode) ? Math.min(STAGES, Math.max(1, stage)) : 0;
  g.base = baseFor(mode, g.stage);
  g.tutorialStep = 0;
  g.tutorialDelay = 0;
  g.tutorialNote = "";
  g.phase = "play";
  g.numbers = [];
  g.level = 1;
  g.score = 0;
  g.newBest = false;
  g.spawnTimer = 0.6;
  g.overTimer = 0;
  g.overReason = null;
  g.banner = 0;
  g.shake = 0;
  g.slow = 0;
  g.bonusTimer = nextBonusIn(g);
  resetCups(g);
  if (mode === "tutorial") tutorialSetup(g);
}

function endGame(g: GameState, reason: GameOverReason): void {
  if (g.phase !== "play") return;
  g.phase = "over";
  g.overReason = reason;
  g.overTimer = 0;
  g.shake = 1;
  // The best score is the endless game's; the levels of the book are cleared or not.
  g.newBest = g.mode === "endless" && g.score > g.best;
  if (g.newBest) g.best = g.score;
  g.events.push({t: "gameOver", reason, newBest: g.newBest});
}

// ---- Cups -----------------------------------------------------------------------------

export function cupById(g: GameState, id: number | null): Cup | undefined {
  return id === null ? undefined : g.cups.find((c) => c.id === id);
}

/** The living cup closest sideways to x (the lower one if they are equally close). */
export function nearestAliveCup(g: GameState, x: number): Cup | undefined {
  let best: Cup | undefined;
  for (const c of g.cups) {
    if (c.dead) continue;
    if (!best) {
      best = c;
      continue;
    }
    const d = Math.abs(c.x - x);
    const bd = Math.abs(best.x - x);
    if (d < bd - 0.5 || (Math.abs(d - bd) <= 0.5 && c.y > best.y)) best = c;
  }
  return best;
}

/** The cup under a finger, if any (a cup in front wins over one behind it). */
export function cupAt(g: GameState, x: number, y: number): Cup | undefined {
  return [...g.cups]
    .sort((a, b) => b.y - a.y)
    .find((c) => Math.abs(x - c.x) < CUP_W / 2 + 10 && Math.abs(y - c.y) < CUP_H / 2 + 14);
}

/** The column (an index into COLS) a cup belongs to: the one no other cup stands in. */
function homeColumn(g: GameState, c: Cup): number {
  const free = COLS.findIndex((x) => g.cups.every((o) => o === c || o.x !== x));
  if (free >= 0) return free;
  let best = 0;
  for (let i = 1; i < COLS.length; i++) if (Math.abs(COLS[i] - c.x) < Math.abs(COLS[best] - c.x)) best = i;
  return best;
}

/**
 * Drags a cup sideways. The cups stand in four fixed columns: when the dragged cup reaches
 * another column, the cup standing there swaps places with it (and takes the column it left).
 */
export function moveCup(g: GameState, c: Cup, nx: number): void {
  if (!g.cups.includes(c)) return;
  const home = homeColumn(g, c);
  c.x = Math.min(Math.max(nx, CUP_W / 2 + 6), W - CUP_W / 2 - 6);
  let col = 0;
  for (let i = 1; i < COLS.length; i++) if (Math.abs(COLS[i] - c.x) < Math.abs(COLS[col] - c.x)) col = i;
  if (col === home) return;
  const other = g.cups.find((o) => o !== c && o.x === COLS[col]);
  if (other) other.x = COLS[home];
}

/** The finger let go: the cup settles in its column. */
export function dropCup(g: GameState, c: Cup): void {
  if (!g.cups.includes(c)) return;
  c.x = COLS[homeColumn(g, c)];
}

// ---- Numbers --------------------------------------------------------------------------

/** The biggest factor a blue number can have: it grows through the levels of the chapter. */
function maxFactor(g: GameState): number {
  const s = timesStage(g);
  return s < 3 ? 2 : s < 6 ? 3 : 4;
}

/** The chance that a number is a blue one (when there is a cup to multiply). */
function mulChance(g: GameState): number {
  return 0.25 + 0.02 * (timesStage(g) - 1);
}

/** The biggest number a yellow one divides by: it grows through the levels of the chapter. */
function maxDivisor(g: GameState): number {
  const s = divStage(g);
  return s < 3 ? 2 : s < 6 ? 3 : 4;
}

/** The chance that a number is a yellow one (when there is a cup it would change). */
function divChance(g: GameState): number {
  return 0.2 + 0.02 * (divStage(g) - 1);
}

interface Pick {
  v: number;
  op: Op;
}

function pickNumber(g: GameState): Pick {
  const max = maxNumber(hardness(g));
  const {minus, times: timesOn, div: divOn} = kinds(g);
  // Blue numbers only fall when there is something to multiply: a cup on 0 stays on 0.
  const times = timesOn && g.cups.some((c) => !c.dead && c.value !== 0);
  // Yellow numbers only fall when a cup has enough in it for the division to change it.
  const div = divOn && g.cups.some((c) => !c.dead && Math.abs(c.value) >= 2);
  // Often a number that finishes one of the cups (at 10, or at minus 10 when minus numbers are in, or by
  // multiplying), or that saves a cup that is nearly full by dividing it: the game is about choosing, not about luck.
  if (g.rng() < helpChance(g)) {
    const finishing: Pick[] = [];
    for (const c of g.cups) {
      if (c.dead) continue;
      const up = TARGET - c.value;
      if (up >= 1 && up <= max) finishing.push({v: up, op: "add"});
      const down = -TARGET - c.value;
      if (minus && down <= -1 && down >= -max) finishing.push({v: down, op: "add"});
      if (times) for (let f = 2; f <= maxFactor(g); f++) if (Math.abs(c.value * f) === TARGET) finishing.push({v: f, op: "mul"});
      if (div && Math.abs(c.value) >= 6) for (let f = 2; f <= maxDivisor(g); f++) if (c.value % f === 0) finishing.push({v: f, op: "div"});
    }
    if (finishing.length > 0) return finishing[Math.floor(g.rng() * finishing.length)];
  }
  if (times && g.rng() < mulChance(g)) return {v: 2 + Math.floor(g.rng() * (maxFactor(g) - 1)), op: "mul"};
  if (div && g.rng() < divChance(g)) return {v: 2 + Math.floor(g.rng() * (maxDivisor(g) - 1)), op: "div"};
  const v = 1 + Math.floor(g.rng() * max);
  return {v: minus && g.rng() < minusChance(g) ? -v : v, op: "add"};
}

function newNumber(g: GameState, col: number, x: number, v: number, op: Op = "add", bonus: Bonus | null = null): NumberTile {
  return {
    id: g.nextId++,
    col,
    x,
    y: -26,
    prevY: -26,
    v,
    op,
    bonus,
    chain: null,
    ghost: null,
    ice: 0,
    state: "fall",
    target: null,
    aim: x,
    speed: 0,
    hang: null,
    tilt: 0,
    phase: g.rng() * 6,
    scale: 1,
    done: false,
  };
}

/**
 * A new ordinary number in a column; in the later levels it may be a ghost, and in the last ones it may be frozen in ice
 * (never both). A number that is part of a chain is always `plain`: no ghost and no ice.
 */
function makeNumber(g: GameState, col: number, plain = false): NumberTile {
  const pick = pickNumber(g);
  const n = newNumber(g, col, COLS[col], pick.v, pick.op);
  if (plain) return n;
  const ghost = ghostChance(g);
  if (ghost > 0 && g.rng() < ghost) {
    n.ghost = g.rng() < 0.5 ? "flip" : "fade";
    n.phase = -g.time; // it starts out seen
    return n;
  }
  const ice = iceChance(g);
  if (ice > 0 && g.rng() < ice) n.ice = ICE_HITS;
  return n;
}

function spawn(g: GameState): void {
  const free = COLS.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < 70));
  if (free.length === 0) return;
  // Sometimes two numbers come chained together, side by side in two columns that are both free.
  const chain = chainChance(g);
  if (chain > 0 && g.rng() < chain) {
    const pairs = free.filter((i) => free.includes(i + 1));
    if (pairs.length > 0) {
      const col = pairs[Math.floor(g.rng() * pairs.length)];
      const a = makeNumber(g, col, true);
      const b = makeNumber(g, col + 1, true);
      a.chain = b.id;
      b.chain = a.id;
      g.numbers.push(a, b);
      return;
    }
  }
  g.numbers.push(makeNumber(g, free[Math.floor(g.rng() * free.length)]));
}

/** Seconds until the next bonus ball (somewhere between 18 and 32). */
function nextBonusIn(g: GameState): number {
  return 18 + g.rng() * 14;
}

/** A bonus ball falls in a column that is free. A ball that brings a cup back only comes when there is a dead cup. */
function spawnBonus(g: GameState): void {
  if (g.numbers.some((n) => n.bonus)) return;
  const free = COLS.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < 70));
  if (free.length === 0) return;
  const col = free[Math.floor(g.rng() * free.length)];
  const hasDead = g.cups.some((c) => c.dead);
  const r = g.rng();
  const kind: Bonus = hasDead ? (r < 0.4 ? "life" : r < 0.75 ? "points" : "slow") : r < 0.55 ? "points" : "slow";
  g.numbers.push(newNumber(g, col, COLS[col], 0, "add", kind));
}

/** A bonus ball has been tapped: it does its thing at once. */
function collectBonus(g: GameState, n: NumberTile): void {
  g.numbers = g.numbers.filter((x) => x !== n);
  let kind = n.bonus ?? "points";
  let amount = 0;
  if (kind === "life") {
    const dead = g.cups.find((c) => c.dead);
    if (dead) {
      dead.dead = false;
      dead.value = 0;
      dead.flash = 1;
      dead.ripple = 1;
    } else {
      kind = "points"; // nothing to bring back any more (another ball did it): points instead
    }
  }
  if (kind === "points") {
    amount = BONUS_POINTS * g.level;
    g.score += amount;
  }
  if (kind === "slow") g.slow = SLOW_SECONDS;
  g.events.push({t: "bonus", kind, x: n.x, y: n.y, amount});
}

/** A tap at (x, y). Sends the number there into the nearest living cup. Returns true if it hit one. */
export function tapAt(g: GameState, x: number, y: number): boolean {
  if (g.phase !== "play") return false;
  let hit: NumberTile | undefined;
  let bd = TAP_RADIUS;
  for (const n of g.numbers) {
    if (n.state !== "fall" || n.y < -8) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      hit = n;
    }
  }
  if (!hit) return false;
  // A bonus ball is collected at once.
  if (hit.bonus) {
    collectBonus(g, hit);
    return true;
  }
  // A number frozen in ice: every tap cracks the ice a bit more, and the tap that breaks it sends the number down.
  if (hit.ice > 0) {
    hit.ice -= 1;
    g.events.push({t: "ice", x: hit.x, y: hit.y, broke: hit.ice === 0});
    if (hit.ice > 0) return true;
  }
  if (!sendDown(g, hit, null)) return false;
  // A number on a chain pulls the one it is chained to down after it: it goes into the cup under its own column,
  // but it hangs where it is until the chain goes taut, and is then dragged down behind the tapped one.
  const mate = hit.chain === null ? undefined : g.numbers.find((m) => m.id === hit.chain && m.state === "fall");
  if (mate && sendDown(g, mate, hit.id)) mate.tilt = hit.tilt === 1 ? -1 : 1;
  return true;
}

/** Sends a number into the nearest living cup (or straight down, if it is over a dead one). False if there is no cup to go to. */
function sendDown(g: GameState, n: NumberTile, leader: number | null): boolean {
  // Over a dead cup there is no saving it: the number hops and then falls straight down into it.
  if (g.cups.some((c) => c.dead && Math.abs(n.x - c.x) <= CUP_W / 2 - 4)) {
    startDive(g, n, null, n.x, leader);
    return true;
  }
  const cup = nearestAliveCup(g, n.x);
  if (!cup) return false;
  startDive(g, n, cup.id, cup.x, leader);
  return true;
}

/**
 * A tapped number hops up (and tilts a little to the right or to the left), then gravity takes it down. A number that is
 * pulled along by the chain of a tapped one (`leader`) does not hop: it hangs still until the chain is taut (see `dive`).
 */
function startDive(g: GameState, n: NumberTile, target: number | null, aim: number, leader: number | null = null): void {
  n.state = "dive";
  n.target = target;
  n.aim = aim;
  n.hang = leader;
  n.speed = leader === null ? -DIVE_HOP : 0;
  n.tilt = g.rng() < 0.5 ? -1 : 1;
  if (leader === null) g.events.push({t: "tap"});
}

// ---- Landing --------------------------------------------------------------------------

function land(g: GameState, c: Cup, n: NumberTile): void {
  n.done = true;
  g.events.push({t: "land", x: c.x, y: c.y - CUP_H / 2, v: n.v, op: n.op, cupId: c.id});
  // A number in a dead cup: that is the end.
  if (c.dead) {
    // In the tutorial it is just done again.
    if (g.mode === "tutorial") tutorialRetry(g);
    else endGame(g, "deadCup");
    return;
  }
  // A blue number multiplies, a yellow one divides, any other adds. (A minus cup is multiplied like any other number:
  // -4 times 2 is -8. A division that does not come out even rounds the size of the cup down: 7 / 2 is 3, and -7 / 2 is -3.)
  if (n.op === "mul") c.value *= n.v;
  else if (n.op === "div") c.value = Math.trunc(c.value / n.v) + 0; // + 0: never a minus zero
  else c.value += n.v;
  c.bump = 1;
  c.ripple = 1;
  g.score += (n.op === "mul" ? n.v * 3 : n.op === "div" ? n.v * 2 : Math.abs(n.v)) * g.level;
  let result: "levelUp" | "bust" | "none" = "none";
  if (Math.abs(c.value) === TARGET) {
    levelUp(g, c);
    result = "levelUp";
  } else if (Math.abs(c.value) > TARGET) {
    c.dead = true;
    result = "bust";
    g.shake = Math.max(g.shake, 0.7);
    g.events.push({t: "bust", cupId: c.id});
    if (g.cups.every((k) => k.dead)) endGame(g, "allDead");
  }
  if (g.mode === "tutorial") tutorialAfterLand(g, result);
}

function levelUp(g: GameState, c: Cup): void {
  g.level += 1;
  g.score += 50 * g.level;
  // The cup starts over at 0 (the golden 10 stays on it for a moment).
  c.tenSign = c.value < 0 ? -1 : 1;
  c.value = 0;
  c.showTen = 0.9;
  c.flash = 1;
  // The big LEVEL banner is for the endless game, when a new level of it begins (every fifth cup). In the book
  // the progress bar shows how far you have come.
  if (g.mode === "endless" && (g.level - 1) % ENDLESS_CUPS_PER_LEVEL === 0) g.banner = 1.6;
  g.events.push({t: "levelUp", cupId: c.id, level: g.level});
  // A level of the book is cleared when enough cups have reached 10.
  if (g.level - 1 >= goalFor(g.mode, g.stage)) {
    g.phase = "won";
    g.overTimer = 0;
    g.numbers = [];
    g.banner = 0;
    g.events.push({t: "won"});
  }
}

// ---- Every frame ----------------------------------------------------------------------

export function update(g: GameState, dt: number): void {
  g.time += dt;
  for (const c of g.cups) {
    c.bump = Math.max(0, c.bump - dt * 4);
    c.ripple = Math.max(0, c.ripple - dt * 1.5);
    c.showTen = Math.max(0, c.showTen - dt);
    c.flash = Math.max(0, c.flash - dt * 1.5);
  }
  g.shake = Math.max(0, g.shake - dt * 2.2);
  g.banner = Math.max(0, g.banner - dt);

  if (g.phase === "over" || g.phase === "won") {
    g.overTimer += dt;
    return;
  }
  if (g.phase !== "play") return;

  // Slow motion: the numbers fall, and new ones come, at a fraction of the speed.
  const sdt = g.slow > 0 ? dt * SLOW_FACTOR : dt;
  g.slow = Math.max(0, g.slow - dt);

  if (g.mode === "tutorial") {
    // The tutorial sets out its own numbers, one at a time.
    if (g.tutorialDelay > 0) {
      g.tutorialDelay -= dt;
      if (g.tutorialDelay <= 0) tutorialSetup(g);
    } else if (g.numbers.length === 0) {
      tutorialSetup(g);
    }
  } else {
    g.spawnTimer -= sdt;
    if (g.spawnTimer <= 0) {
      g.spawnTimer = spawnInterval(hardness(g)) * (0.85 + g.rng() * 0.3);
      spawn(g);
    }
    // Every now and then a bonus ball comes.
    g.bonusTimer -= dt;
    if (g.bonusTimer <= 0) {
      g.bonusTimer = nextBonusIn(g);
      spawnBonus(g);
    }
  }

  for (const n of g.numbers) {
    if (g.phase !== "play") break;
    if (n.state === "fall") fall(g, n, sdt);
    else dive(g, n, dt);
  }
  g.numbers = g.numbers.filter((n) => !n.done);
}

function fall(g: GameState, n: NumberTile, dt: number): void {
  n.prevY = n.y;
  n.y += fallSpeed(hardness(g)) * dt;
  // A bonus ball never lands in a cup: if nobody taps it, it just falls past.
  if (n.bonus) {
    if (n.y > MISS_Y + 40) n.done = true;
    return;
  }
  // On its own the number lands in whatever cup it passes over (a living one, or a dead one: game over).
  landOrMiss(g, n);
}

/** A number that has just moved down from n.prevY: lands in the cup whose mouth it passed, or hits the desk. */
function landOrMiss(g: GameState, n: NumberTile): void {
  for (const c of g.cups) {
    const mouth = c.y - CUP_H / 2;
    if (n.prevY < mouth && n.y >= mouth && Math.abs(n.x - c.x) <= CUP_W / 2 - 4) {
      land(g, c, n);
      return;
    }
  }
  if (n.y > MISS_Y) {
    n.done = true;
    g.events.push({t: "miss", x: n.x, y: MISS_Y - 4});
    if (g.mode === "tutorial") tutorialRetry(g);
  }
}

function dive(g: GameState, n: NumberTile, dt: number): void {
  // Pulled along by a chain: it hangs still while the tapped number hops and sets off, until the chain goes taut. Then it
  // is yanked down and follows after the tapped one at the length of the chain. If the tapped one has already landed
  // (or is gone) it is let go and just falls.
  if (n.hang !== null) {
    const lead = g.numbers.find((m) => m.id === n.hang && m.state === "dive" && !m.done);
    if (lead) {
      const dx = Math.abs(lead.x - n.x);
      const reach = Math.sqrt(Math.max(30 * 30, CHAIN_LENGTH * CHAIN_LENGTH - dx * dx));
      if (lead.y - n.y < reach) return; // still slack
      n.speed = Math.max(0, lead.speed);
    }
    n.hang = null;
  }
  // Tapped over a dead cup: no cup to head for, it just hops and then falls straight down.
  if (n.target === null) {
    n.prevY = n.y;
    n.speed += DIVE_GRAVITY * dt;
    n.y += n.speed * dt;
    if (n.speed > 0) landOrMiss(g, n);
    return;
  }
  // It was sent to a column, and keeps falling there even if the cups are swapped on the way (so the cups can be
  // swapped quickly): it lands in whichever cup stands in that column when it gets down.
  const mouth = CUP_START_Y - CUP_H / 2 + 2;
  // It hopped up when tapped (speed < 0); gravity slows that down and then pulls it down.
  n.speed += DIVE_GRAVITY * dt;
  n.y += n.speed * dt;
  n.x += (n.aim - n.x) * Math.min(1, 9 * dt);
  n.scale = Math.min(1, Math.max(0.55, (mouth - n.y) / 70));
  if (n.speed > 0 && n.y >= mouth) {
    let cup = g.cups.reduce((best, c) => (Math.abs(c.x - n.aim) < Math.abs(best.x - n.aim) ? c : best));
    // A cup that has died in the meantime (from another number): the number goes to the nearest living one.
    if (cup.dead) {
      const alive = nearestAliveCup(g, n.aim);
      if (!alive) {
        n.done = true;
        return;
      }
      cup = alive;
    }
    n.x = cup.x;
    n.y = mouth;
    land(g, cup, n);
  }
}

// ---- The tutorial -----------------------------------------------------------------------
// Four things to try, one at a time, in the real game: tap a number, fill a cup to exactly 10,
// see a cup die from going over, and swap places to keep a number out of a dead cup.

/** The cup standing nearest to a column. */
function cupNearColumn(g: GameState, col: number): Cup {
  return g.cups.reduce((best, c) => (Math.abs(c.x - COLS[col]) < Math.abs(best.x - COLS[col]) ? c : best));
}

/** Sets out the number (and the cups) for the step the tutorial is on. */
function tutorialSetup(g: GameState): void {
  g.numbers = [];
  g.tutorialNote = "";
  g.tutorialDelay = 0;
  switch (g.tutorialStep) {
    case 0:
      // Tap it and it lands in the cup under it.
      g.numbers.push(newNumber(g, 1, COLS[1], 4));
      break;
    case 1: {
      // The cup with the most in it has 4: the number that makes exactly 10 is on its way.
      const cup = g.cups.reduce((best, c) => (c.value > best.value ? c : best));
      cup.value = 4;
      cup.dead = false;
      g.numbers.push(newNumber(g, 1, cup.x, 6));
      break;
    }
    case 2: {
      // A cup with 8: the 5 is too much for it.
      const cup = cupNearColumn(g, 2);
      cup.value = 8;
      cup.dead = false;
      g.numbers.push(newNumber(g, 2, cup.x, 5));
      break;
    }
    case 3: {
      // The dead cup from before, with a number falling straight towards it.
      let dead = g.cups.find((c) => c.dead);
      if (!dead) {
        dead = cupNearColumn(g, 2);
        dead.dead = true;
        dead.value = 13;
      }
      g.numbers.push(newNumber(g, 2, dead.x, 3));
      break;
    }
    default:
      break;
  }
}

/** A number has landed in the tutorial: was it what the step wanted? */
function tutorialAfterLand(g: GameState, result: "levelUp" | "bust" | "none"): void {
  const s = g.tutorialStep;
  const ok = s === 0 || s === 3 || (s === 1 && result === "levelUp") || (s === 2 && result === "bust");
  if (ok) tutorialNext(g);
  else tutorialRetry(g);
}

function tutorialNext(g: GameState): void {
  g.tutorialStep += 1;
  g.tutorialNote = "good";
  g.tutorialDelay = 1.8;
  if (g.tutorialStep >= TUTORIAL_STEPS) {
    g.phase = "won";
    g.overTimer = 0;
    g.numbers = [];
    g.banner = 0;
    g.events.push({t: "won"});
  }
}

/** It did not go as the step wanted (or the number was lost): the step starts again after a moment. */
function tutorialRetry(g: GameState): void {
  g.tutorialNote = "retry";
  g.tutorialDelay = 1.5;
  g.numbers = [];
}
