import {PERKS, PERK_LIMIT, PERK_SLOWER, dayKey, rungEnds, rungsDone, seedOfDay, seededRandom} from "./daily";
import {BIG_LIMIT, GOLD_FACTOR, LASER_COOLDOWN, LASER_HALF_WIDTH, MAGNET_REACH} from "./cups";
import {DAILY_RUNGS, DIAMOND_TEN_CHANCE} from "./constants";
import {BONUS_POINTS, BOMB_RADIUS, PAUSE_SECONDS, CHAIN_LENGTH, GHOST_PERIOD, ICE_HITS, COLS, PLUS_COLS, WIN_DELAY, COMBO_SECONDS, COMBO_BONUS, SCREEN_MAX, SWEEP_DOWN, SWEEP_HOLD, SWEEP_UP, SWEEP_EDGE, CUP_H, CUP_START_Y, SLOW_FACTOR, SLOW_SECONDS, DIVE_GRAVITY, DIVE_HOP, CUP_W, MISS_Y, STAGES, TAP_RADIUS, TARGET, TUTORIAL_STEPS, W} from "./constants";
import type {Bonus, Cup, Feature, GameOverReason, GameState, Mode, NumberTile, Op, PerkId} from "./types";

// ---- Difficulty -----------------------------------------------------------------------

/** How fast the numbers drift down (game units per second). */
export function fallSpeed(level: number): number {
  return Math.min(76.8, 23.04 + (level - 1) * 4.48); // (20% slower, twice: it was 36 + 7 per level, at most 120)
}

/**
 * How much slower the numbers fall on the later levels of a chapter (the same in every chapter): levels 4 to 6 fall 5% slower,
 * levels 7 to 9 10% slower and levels 10 to 12 about 28% slower; and on top of that every level from 4 up falls another 15% slower
 * (so 19%, 24% and 39% slower than levels 1 to 3). The tutorial (stage 0) is not slowed down; the endless game has its own rule (`speedFactorOf`).
 */
export function stageSpeedFactor(stage: number): number {
  if (stage < 4) return 1;
  const row = stage >= 10 ? 0.85 * 0.85 : stage >= 7 ? 0.9 : 0.95;
  return row * LATER_LEVELS_SLOWER * (stage >= 7 ? LEVELS_7_UP_SLOWER : 1);
}

/** Levels 4 and up (in every chapter, and in the endless game from its level 4) fall another 15% slower than the row of the chapter says. */
const LATER_LEVELS_SLOWER = 0.85;
/** And levels 7 to 12 another 10% slower on top of that. */
const LEVELS_7_UP_SLOWER = 0.9;

/** The same for the round that is being played: the book follows its level, and the endless game its own level (from level 4). */
export function speedFactorOf(g: GameState): number {
  if (g.mode === "endless") return (endlessLevel(g) >= 4 ? LATER_LEVELS_SLOWER : 1) * g.speedMul;
  return stageSpeedFactor(g.stage);
}

/** Levels 10 to 12 get 20% fewer numbers: the time between new numbers is 1 / 0.8 = 1.25 times as long. */
export function stageSpawnFactor(stage: number): number {
  return stage >= 10 ? 1.25 : 1;
}

/** Seconds between new numbers. */
export function spawnInterval(level: number): number {
  return Math.max(0.7, 1.7 - (level - 1) * 0.08);
}

/** The biggest number that can fall at this level (1..6): 15% lower than it was (which was 2 + level, at most 7, and before that 3 + level, at most 9). */
export function maxNumber(level: number): number {
  return Math.max(2, Math.round(0.85 * Math.min(7, 2 + level)));
}

/** How hard the numbers are right now: the cups cleared so far, plus how hard this level of the book starts. */
function hardness(g: GameState): number {
  return g.level + g.base;
}

/**
 * In the endless game the speed of the numbers, and how often they come, climb this much for every cup that has been filled (in the
 * book they follow `hardness`, a whole step for every cup): 0.4 means they reach the top speed after about 30 cups and not after 13.
 */
export const ENDLESS_PACE = 0.4;

/** How hard the speed of the numbers, and how often they come, are right now (the same as `hardness` in the book). */
export function paceOf(g: GameState): number {
  return g.mode === "endless" ? 1 + (g.level - 1) * ENDLESS_PACE : hardness(g);
}

/** The modes that are levels of the book (twelve of them on each page). */
function isLevelMode(mode: Mode): boolean {
  return mode === "plus" || mode === "mixed" || mode === "times" || mode === "divide" || mode === "space";
}

/** How much harder a level of the book starts than the one before it. */
function baseFor(mode: Mode, stage: number): number {
  if (mode === "tutorial") return 3; // the numbers drift a bit faster than at the very start, so there is not much waiting
  return mode === "endless" ? 0 : (stage - 1) * 1.25;
}

/**
 * How many cups have to reach 10 to clear a game (infinity: it never ends). Every row of the book needs one more than the row
 * before: levels 1-3 need 4, levels 4-6 need 5, levels 7-9 need 6 and levels 10-12 need 7 (one more than they used to). The levels of the
 * space chapter need two more than that: 6, 7, 8 and 9.
 */
export function goalFor(mode: Mode, stage = 1): number {
  if (mode === "endless" || mode === "tutorial") return Infinity;
  return 4 + Math.floor((Math.max(1, stage) - 1) / 3) + (mode === "space" ? 2 : 0);
}

/**
 * How many stars (1 to 3) the points of a cleared level are worth. A level that is cleared is worth one star; two stars take
 * about the points a steady run gets (the "par" of the level, which grows with the number of cups it needs), and three stars
 * a good run (with bonus balls and the like).
 */
export function starsFor(mode: Mode, stage: number, score: number): 1 | 2 | 3 {
  const cups = goalFor(mode, stage);
  if (!Number.isFinite(cups)) return 1;
  let par = 0;
  for (let i = 1; i <= cups; i++) par += 12 * i + 50 * (i + 1);
  return score >= par * 1.4 ? 3 : score >= par ? 2 : 1;
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
  // (in the daily challenge the levels are the rungs of the ladder, which need one more cup each: 5, 6, 7 ...)
  if (g.daily) return rungsDone(g.level - 1) + 1;
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
    minus: g.mode === "mixed" || g.mode === "times" || g.mode === "divide" || g.mode === "space",
    times: g.mode === "times" || g.mode === "divide" || g.mode === "space",
    div: g.mode === "divide" || g.mode === "space",
  };
}

// ---- The new kinds of number ----------------------------------------------------------

/** The chance that a new number is a 0, when there is a cup it can help. */
const ZERO_CHANCE = 0.12;

/** The chance that a new number is an orange 10 (which sets a cup to exactly 10), when there is a cup it can help. */
const TEN_CHANCE = 0.06;

/** All of the new kinds of number, in the order the book brings them in. */
export const FEATURES: Feature[] = ["screen", "cups", "zero", "ten", "life", "slow", "pause", "chain", "points", "bomb", "cloth", "ice", "shield", "ghost", "diamond", "fog", "star", "steel", "chain3", "reverse"];

/**
 * Where the book presents each new kind of number, and where it starts to come: the chapter and the level of it. The first chapter
 * has three cups, brings the pull-down screen (level 2) and the orange 0 (level 4), a life ball (level 7) and a slow motion ball (level 10), plus and minus brings chains (level 4)
 * and the points ball (level 7) and, at level 10 of plus and minus, the pause ball that stops the numbers for a few seconds, times brings ice
 * (level 4), the bomb that blows away the numbers round it (level 7) and the cloth ball that gives one more pull-down screen (level 10),
 * divide brings the shield ball that protects a cup (level 7) and ghosts and space brings the black number that hides the number of a cup (level 4) the star that clears all the cups (level 1), the steel number that cannot be tapped (level 7) and the chain of three (level 10). A new kind stays in the chapters after the one that brought it.
 */
export const FEATURE_AT: Record<Feature, {mode: Mode; stage: number}> = {
  screen: {mode: "plus", stage: 2},
  cups: {mode: "mixed", stage: 1},
  zero: {mode: "plus", stage: 4},
  ten: {mode: "plus", stage: 12},
  life: {mode: "plus", stage: 7},
  slow: {mode: "plus", stage: 10},
  pause: {mode: "mixed", stage: 10},
  chain: {mode: "mixed", stage: 4},
  points: {mode: "mixed", stage: 7},
  bomb: {mode: "times", stage: 7},
  cloth: {mode: "times", stage: 10},
  shield: {mode: "divide", stage: 7},
  ice: {mode: "times", stage: 4},
  ghost: {mode: "divide", stage: 4},
  diamond: {mode: "divide", stage: 10},
  reverse: {mode: "space", stage: 12},
  fog: {mode: "space", stage: 4},
  star: {mode: "space", stage: 1},
  steel: {mode: "space", stage: 7},
  chain3: {mode: "space", stage: 10},
};

/** In the endless game (which comes after the whole book): the level each one comes from. */
const ENDLESS_FEATURE_FROM: Record<Feature, number> = {screen: 1, cups: 1, zero: 2, ten: 3, points: 1, life: 1, slow: 1, pause: 5, bomb: 9, shield: 6, cloth: 11, chain: 4, ghost: 7, ice: 10, fog: 12, star: 8, steel: 11, chain3: 14, diamond: 13, reverse: 15};

const CHAPTERS: Mode[] = ["plus", "mixed", "times", "divide", "space"];

/** How far along the book a level is (the first level of the first chapter is 1). */
function bookPlace(mode: Mode, stage: number): number {
  return CHAPTERS.indexOf(mode) * STAGES + stage;
}

/** How many levels ago a new kind of number came in: 0 on the level that presents it, and -1 if it has not come yet. */
export function featureAge(g: GameState, f: Feature): number {
  if (g.mode === "tutorial") return -1;
  if (g.mode === "endless") {
    const level = endlessLevel(g);
    return level >= ENDLESS_FEATURE_FROM[f] ? level - ENDLESS_FEATURE_FROM[f] : -1;
  }
  const at = FEATURE_AT[f];
  return Math.max(-1, bookPlace(g.mode, g.stage) - bookPlace(at.mode, at.stage));
}

/** The new kinds of number a level presents (the ones whose own level this is). */
function presentedAt(mode: Mode, stage: number): Feature[] {
  return FEATURES.filter((f) => FEATURE_AT[f].mode === mode && FEATURE_AT[f].stage === stage);
}

/** Two numbers sometimes fall chained together: the chance that a new number brings a chain. */
function chainChance(g: GameState): number {
  const age = featureAge(g, "chain");
  return age < 0 ? 0 : Math.min(0.4, 0.14 + 0.04 * Math.min(age, 8));
}

/** Some numbers are ghosts: the chance that a new number is one. */
function ghostChance(g: GameState): number {
  const age = featureAge(g, "ghost");
  return age < 0 ? 0 : Math.min(0.35, 0.12 + 0.06 * Math.min(age, 8));
}

/** Some numbers are black (they hide the number of the cup they land in): the chance that a new number is one. */
function fogChance(g: GameState): number {
  const age = featureAge(g, "fog");
  return age < 0 ? 0 : Math.min(0.22, 0.1 + 0.02 * Math.min(age, 8));
}

/** Some numbers are made of steel (they cannot be tapped): the chance that a new number is one. */
function steelChance(g: GameState): number {
  const age = featureAge(g, "steel");
  return age < 0 ? 0 : Math.min(0.2, 0.1 + 0.02 * Math.min(age, 8));
}

/** The very last kind: some numbers have reversed colours (a plus number is red, a minus number green). The chance that a new number is one. */
function reverseChance(g: GameState): number {
  const age = featureAge(g, "reverse");
  return age < 0 ? 0 : Math.min(0.35, 0.18 + 0.04 * Math.min(age, 8));
}

/** Some numbers are frozen in ice: the chance that a new (ordinary) number is one. */
function iceChance(g: GameState): number {
  const age = featureAge(g, "ice");
  return age < 0 ? 0 : Math.min(0.35, 0.18 + 0.06 * Math.min(age, 8));
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
  return isLevelMode(g.mode) ? Math.max(0.15, 0.4 - 0.03 * (g.stage - 1)) : 0.35 + 0.12 * g.perks.filter((p) => p === "help").length;
}

// ---- Creating and restarting ----------------------------------------------------------

/** The columns of a mode: three in the first chapter (so only three cups), four everywhere else. */
export function columnsFor(mode: Mode): readonly number[] {
  return mode === "plus" ? PLUS_COLS : COLS;
}

export function createGame(rng: () => number = Math.random, best = 0): GameState {
  const g: GameState = {
    phase: "menu",
    mode: "plus",
    stage: 1,
    base: 0,
    extra: 0,
    zap: null,
    loadout: [],
    daily: false,
    perks: [],
    perkChoices: [],
    speedMul: 1,
    tutorialStep: 0,
    tutorialDelay: 0,
    tutorialNote: "",
    slow: 0,
    pause: 0,
    bonusTimer: 25,
    showcase: [],
    showTimer: 0,
    cols: COLS,
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
    combo: 0,
    comboTimer: 0,
    continuesLeft: 0,
    screens: 0,
    screenWon: false,
    sweep: -1,
    lifeDue: false,
    intro: [],
    hideIntros: new Set(),
  };
  // The menu shows four cups with some coffee in them, steaming.
  resetCups(g, [2, 5, 7, 9]);
  return g;
}

function resetCups(g: GameState, values?: number[]): void {
  g.cups = g.cols.map((x, i): Cup => ({
    id: g.nextId++,
    x,
    y: CUP_START_Y,
    value: values?.[i] ?? 0,
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
    seed: g.rng() * 10,
  }));
}

/** Back to the book: no round going, the cups steaming on the desk behind it. */
export function showMenu(g: GameState): void {
  g.phase = "menu";
  g.intro = [];
  g.lifeDue = false;
  g.combo = 0;
  g.comboTimer = 0;
  g.sweep = -1;
  g.zap = null;
  g.cols = COLS;
  g.numbers = [];
  g.banner = 0;
  g.shake = 0;
  g.slow = 0;
  g.pause = 0;
  resetCups(g, [2, 5, 7, 9]);
}

/** Starts a round. Without a mode (and level) it plays the same game again. */
export function startGame(g: GameState, mode: Mode = g.mode, stage: number = g.stage): void {
  g.mode = mode;
  g.zap = null;
  g.daily = false;
  g.perks = [];
  g.perkChoices = [];
  g.speedMul = 1;
  g.stage = isLevelMode(mode) ? Math.min(STAGES, Math.max(1, stage)) : 0;
  g.base = baseFor(mode, g.stage);
  g.tutorialStep = 0;
  g.tutorialDelay = 0;
  g.tutorialNote = "";
  g.phase = "play";
  g.intro = [];
  g.screenWon = false;
  g.continuesLeft = mode === "tutorial" ? 0 : 1;
  g.lifeDue = false;
  g.combo = 0;
  g.comboTimer = 0;
  g.sweep = -1;
  if (mode === "endless") g.screens = 1; // (the endless game starts with one; the levels of the book keep what has been collected)
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
  g.pause = 0;
  g.bonusTimer = nextBonusIn(g);
  g.cols = columnsFor(mode);
  resetCups(g);
  // The cups from the shop (not in the tutorial): the first one chosen stands furthest to the left. A thermos starts with its shield on.
  if (mode !== "tutorial") {
    g.cups.forEach((c, i) => {
      c.kinds = [...(g.loadout[i] ?? [])];
      c.charge = 0;
      if (c.kinds.includes("thermos")) c.shield = true;
    });
  }
  if (mode === "tutorial") tutorialSetup(g);
  // A level that brings in a new kind of number starts by presenting it (unless the player has asked not to see it again).
  g.showcase = [];
  if (isLevelMode(mode)) {
    g.intro = presentedAt(mode, g.stage).filter((f) => !g.hideIntros.has(f));
    if (g.intro.length > 0) g.phase = "intro";
    // Whether it is presented or not, the new kind is made to fall a few seconds into the level, so that it is seen where it is new.
    planShowcase(g, presentedAt(mode, g.stage));
  }
}

/** Starts the daily challenge of a day: the endless game, with random numbers that are the same for everyone on that day. */
export function startDaily(g: GameState, day: string = dayKey()): void {
  g.rng = seededRandom(seedOfDay(day));
  startGame(g, "endless");
  g.daily = true;
}

/** The perks that can be offered now: the ones that would do something, and have not been taken as many times as they can be. */
function perkOptions(g: GameState): PerkId[] {
  const living = g.cups.filter((c) => !c.dead);
  return PERKS.filter((p) => {
    if (g.perks.filter((q) => q === p).length >= PERK_LIMIT[p]) return false;
    if (p === "shield") return living.some((c) => !c.shield);
    if (p === "cloth") return g.screens < SCREEN_MAX;
    if (p === "life") return g.cups.some((c) => c.dead);
    if (p === "gold" || p === "thermos" || p === "magnet" || p === "big" || p === "laser") return living.some((c) => !c.kinds.includes(p));
    return true;
  });
}

/** Takes the perk that was chosen (0 to 2 of the three on offer), and the round goes on. */
export function choosePerk(g: GameState, index: number): boolean {
  const perk = g.perkChoices[index];
  if (g.phase !== "perk" || perk === undefined) return false;
  g.perks.push(perk);
  g.perkChoices = [];
  g.phase = "play";
  if (perk === "slow") g.speedMul *= PERK_SLOWER;
  else if (perk === "cloth") giveScreens(g, 1);
  else if (perk === "shield") {
    const cup = g.cups.find((c) => !c.dead && !c.shield);
    if (cup) {
      cup.shield = true;
      cup.flash = 0.6;
      g.events.push({t: "shield", cupId: cup.id, x: cup.x, y: cup.y - CUP_H / 2, on: true});
    }
  } else if (perk === "life") {
    const dead = g.cups.find((c) => c.dead);
    if (dead) {
      dead.dead = false;
      dead.value = 0;
      dead.hidden = false;
      dead.flash = 1;
      dead.ripple = 1;
    }
  } else if (perk === "gold" || perk === "thermos" || perk === "magnet" || perk === "big" || perk === "laser") {
    // The property goes on the cup that is fullest and does not have it yet (it matters most there), on top of what the cup has.
    let cup: Cup | undefined;
    for (const c of g.cups) if (!c.dead && !c.kinds.includes(perk) && (!cup || c.value > cup.value)) cup = c;
    if (cup) {
      cup.kinds.push(perk);
      cup.charge = 0;
      cup.flash = 1;
      if (perk === "thermos") cup.shield = true;
    }
  }
  return true;
}

/** Three perks to choose between (as many as there are, if there are fewer). */
function offerPerks(g: GameState): void {
  const options = perkOptions(g);
  const choices: PerkId[] = [];
  while (choices.length < 3 && options.length > 0) choices.push(options.splice(Math.floor(g.rng() * options.length), 1)[0]);
  if (choices.length === 0) return;
  g.perkChoices = choices;
  g.phase = "perk";
  g.overTimer = 0;
}

/** Adds new kinds of number to the ones that are to be made to fall a few seconds from now (the screen and the fourth cup do not fall, so they are left out). */
function planShowcase(g: GameState, features: Feature[]): void {
  const list = features.filter((f) => f !== "screen" && f !== "cups");
  if (list.length === 0) return;
  if (g.showcase.length === 0) g.showTimer = 3 + g.rng() * 2;
  g.showcase = [...g.showcase, ...list];
}

/** The kinds that are bonus balls (their names are the same as the bonus kinds). */
const BONUS_FEATURES: Feature[] = ["life", "points", "slow", "pause", "bomb", "cloth", "shield", "star", "diamond"];

/** Makes one of the new kinds fall now, in a free column (false if there is no room for it just now: it is tried again soon). */
function spawnShowcase(g: GameState, f: Feature): boolean {
  if (BONUS_FEATURES.includes(f)) return spawnBonus(g, f as Bonus);
  const free = g.cols.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < spawnY(g) + 96));
  if (free.length === 0) return false;
  if (f === "chain" || f === "chain3") {
    const size = f === "chain" ? 2 : 3;
    const starts = free.filter((i) => Array.from({length: size}, (_, k) => i + k).every((j) => free.includes(j)));
    if (starts.length === 0) return false;
    const first = starts[Math.floor(g.rng() * starts.length)];
    const tiles = Array.from({length: size}, (_, k) => makeNumber(g, first + k, true));
    tiles[0].chain = tiles[1].id;
    tiles[1].chain = tiles[0].id;
    if (size === 3) {
      tiles[1].chain2 = tiles[2].id;
      tiles[2].chain = tiles[1].id;
    }
    g.numbers.push(...tiles);
    return true;
  }
  const col = free[Math.floor(g.rng() * free.length)];
  const x = g.cols[col];
  const v = 1 + Math.floor(g.rng() * maxNumber(hardness(g)));
  const n =
    f === "zero"
      ? newNumber(g, col, x, 0, "zero")
      : f === "ten"
        ? newNumber(g, col, x, TARGET, "ten")
        : f === "fog"
          ? newNumber(g, col, x, v, "dim")
          : f === "steel"
            ? newNumber(g, col, x, 1 + Math.floor(g.rng() * 3), "steel")
            : newNumber(g, col, x, v, "add");
  if (f === "ice") n.ice = ICE_HITS;
  if (f === "reverse") n.flip = true;
  if (f === "ghost") {
    n.ghost = g.rng() < 0.5 ? "flip" : "fade";
    n.phase = -g.time; // it starts out seen
  }
  g.numbers.push(n);
  return true;
}

function giveScreens(g: GameState, n: number): void {
  const before = g.screens;
  g.screens = Math.min(SCREEN_MAX, g.screens + n);
  if (g.screens !== before) g.events.push({t: "screens", n: g.screens});
}

/**
 * Pulls the screen down: it comes down from the ceiling and wipes away every number that is falling (not the ones that have
 * been tapped and are on their way into a cup, and not the bonus balls), then stays a moment and rolls up again.
 * False if there is none to pull down, or it is not time for one.
 */
export function useScreen(g: GameState): boolean {
  if (g.phase !== "play" || g.zap || g.screens <= 0 || g.sweep >= 0 || featureAge(g, "screen") < 0) return false;
  g.screens -= 1;
  g.sweep = 0;
  g.events.push({t: "sweep"});
  g.events.push({t: "screens", n: g.screens});
  return true;
}

/** How far down the lower edge of the screen is (0 when it is all the way up), or -1 when no screen is down. */
export function sweepEdge(g: GameState): number {
  if (g.sweep < 0) return -1;
  const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  if (g.sweep < SWEEP_DOWN) return SWEEP_EDGE * ease(g.sweep / SWEEP_DOWN);
  if (g.sweep < SWEEP_DOWN + SWEEP_HOLD) return SWEEP_EDGE;
  return SWEEP_EDGE * (1 - ease((g.sweep - SWEEP_DOWN - SWEEP_HOLD) / SWEEP_UP));
}

/** Where the lower edge of the screen is on the playfield (the screen comes down from the top, which is higher up on a tall phone); above the top when no screen is down. */
export function sweepBottom(g: GameState): number {
  const e = sweepEdge(g);
  if (e < 0) return -g.extra - 1;
  return (e * (SWEEP_EDGE + g.extra)) / SWEEP_EDGE - g.extra;
}

/** The presentation of a new kind of number is over: the round starts. With "never" it is not shown again. */
export function endIntro(g: GameState, never = false): void {
  if (g.phase !== "intro") return;
  // The presentation of the screen hands you one to try if you have none (so it can be tried at once).
  if (g.intro.includes("screen") && g.screens === 0) giveScreens(g, 1);
  if (never) {
    for (const f of g.intro) g.hideIntros.add(f);
    g.events.push({t: "introHide", features: [...g.intro]});
  }
  g.intro = [];
  g.phase = "play";
}

function endGame(g: GameState, reason: GameOverReason): void {
  if (g.phase !== "play") return;
  g.zap = null;
  g.phase = "over";
  g.overReason = reason;
  g.overTimer = 0;
  g.shake = 1;
  // The best score is the endless game's; the levels of the book are cleared or not.
  g.newBest = g.mode === "endless" && !g.daily && g.score > g.best;
  if (g.newBest) g.best = g.score;
  g.events.push({t: "gameOver", reason, newBest: g.newBest});
}

/**
 * The endless round is left before it has ended (to the book from the pause page, or the app is closed): the score so far is the
 * record if it is higher than the old one. True if it was a new record (and `g.best` has been raised).
 */
export function recordBest(g: GameState): boolean {
  if (g.mode !== "endless" || g.daily || g.phase === "menu" || g.score <= g.best) return false;
  g.best = g.score;
  return true;
}

/** Whether the player can carry on from where the round was lost (once in a round, never in the tutorial). */
export function canContinue(g: GameState): boolean {
  return g.phase === "over" && g.continuesLeft > 0;
}

/**
 * Carries on from where the round was lost (the screen has shown an ad for it): the dead cups are back at 0 and the numbers in the
 * air are gone, but the score, the level, the progress and the cups that were alive are as they were. False if it cannot be done.
 */
export function continueGame(g: GameState): boolean {
  if (!canContinue(g)) return false;
  g.continuesLeft -= 1;
  g.phase = "play";
  g.overReason = null;
  g.overTimer = 0;
  g.newBest = false;
  g.numbers = [];
  g.spawnTimer = 1;
  g.bonusTimer = nextBonusIn(g);
  g.combo = 0;
  g.comboTimer = 0;
  g.lifeDue = false;
  g.sweep = -1;
  g.slow = 0;
  g.pause = 0;
  g.shake = 0;
  for (const c of g.cups) {
    if (!c.dead) continue;
    c.dead = false;
    c.value = 0;
    c.hidden = false;
    c.flash = 1;
    c.ripple = 1;
    g.events.push({t: "revive", cupId: c.id});
  }
  return true;
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

/** The column (an index into g.cols) a cup belongs to: the one no other cup stands in. */
function homeColumn(g: GameState, c: Cup): number {
  const free = g.cols.findIndex((x) => g.cups.every((o) => o === c || o.x !== x));
  if (free >= 0) return free;
  let best = 0;
  for (let i = 1; i < g.cols.length; i++) if (Math.abs(g.cols[i] - c.x) < Math.abs(g.cols[best] - c.x)) best = i;
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
  for (let i = 1; i < g.cols.length; i++) if (Math.abs(g.cols[i] - c.x) < Math.abs(g.cols[col] - c.x)) col = i;
  if (col === home) return;
  const other = g.cups.find((o) => o !== c && o.x === g.cols[col]);
  if (other) other.x = g.cols[home];
}

/** The finger let go: the cup settles in its column. */
export function dropCup(g: GameState, c: Cup): void {
  if (!g.cups.includes(c)) return;
  c.x = g.cols[homeColumn(g, c)];
  untangleCups(g);
}

/**
 * A safety net for when no cup is being held: every cup stands in a column of its own. If two cups have ended up in the same column
 * (drawn on top of each other), or a cup is left in between the columns, the cups are given the columns again in the order they stand
 * in from left to right. Returns whether anything moved.
 */
export function untangleCups(g: GameState): boolean {
  if (g.cups.length !== g.cols.length) return false;
  const used = new Set<number>();
  let tangled = false;
  for (const c of g.cups) {
    if (used.has(c.x) || !g.cols.includes(c.x)) tangled = true;
    used.add(c.x);
  }
  if (!tangled) return false;
  [...g.cups].sort((a, b) => a.x - b.x).forEach((c, i) => (c.x = g.cols[i]));
  return true;
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

function pickNumber(g: GameState, allowSteel = true): Pick {
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
  // From the level that presents it, an orange 0 sometimes falls (when a living cup has something in it that is worth wiping out).
  if (featureAge(g, "zero") >= 0 && g.cups.some((c) => !c.dead && Math.abs(c.value) >= 4) && g.rng() < ZERO_CHANCE) return {v: 0, op: "zero"};
  // From the level that presents it, an orange 10 sometimes falls (when a living cup is low enough for it to be worth a lot): it sets the cup to 10.
  if (featureAge(g, "ten") >= 0 && g.cups.some((c) => !c.dead && Math.abs(c.value) <= 5) && g.rng() < TEN_CHANCE) return {v: TARGET, op: "ten"};
  // From the last chapter's level 4, a black number sometimes falls: it adds like any plus or minus number.
  if (featureAge(g, "fog") >= 0 && g.rng() < fogChance(g)) {
    const v = 1 + Math.floor(g.rng() * max);
    return {v: minus && g.rng() < minusChance(g) ? -v : v, op: "dim"};
  }
  // From the level that presents it, a steel number sometimes falls: a small number (1 to 3) that cannot be tapped, only let go down.
  if (allowSteel && featureAge(g, "steel") >= 0 && g.rng() < steelChance(g)) {
    const v = 1 + Math.floor(g.rng() * 3);
    return {v: minus && g.rng() < minusChance(g) ? -v : v, op: "steel"};
  }
  if (times && g.rng() < mulChance(g)) return {v: 2 + Math.floor(g.rng() * (maxFactor(g) - 1)), op: "mul"};
  if (div && g.rng() < divChance(g)) return {v: 2 + Math.floor(g.rng() * (maxDivisor(g) - 1)), op: "div"};
  const v = 1 + Math.floor(g.rng() * max);
  return {v: minus && g.rng() < minusChance(g) ? -v : v, op: "add"};
}

/** Where a new number starts: just above the top of the playfield (which reaches higher on a tall phone). */
function spawnY(g: GameState): number {
  return -26 - g.extra;
}

function newNumber(g: GameState, col: number, x: number, v: number, op: Op = "add", bonus: Bonus | null = null): NumberTile {
  const y = spawnY(g);
  return {
    id: g.nextId++,
    col,
    x,
    y,
    prevY: y,
    v,
    op,
    bonus,
    chain: null,
    chain2: null,
    ghost: null,
    flip: false,
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
  const pick = pickNumber(g, !plain);
  const n = newNumber(g, col, g.cols[col], pick.v, pick.op);
  // (a number that adds, multiplies or divides can have reversed colours; the random numbers are only asked for once that kind has come in)
  const flipChance = pick.op === "add" || pick.op === "mul" || pick.op === "div" ? reverseChance(g) : 0;
  if (flipChance > 0 && g.rng() < flipChance) n.flip = true;
  if (plain || pick.op === "steel") return n;
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
  const free = g.cols.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < spawnY(g) + 96));
  if (free.length === 0) return;
  // Sometimes two numbers come chained together, side by side in two columns that are both free.
  const chain = chainChance(g);
  if (chain > 0 && g.rng() < chain) {
    const pairs = free.filter((i) => free.includes(i + 1));
    // From the level that presents it, a chain sometimes has three numbers, in three columns next to each other.
    const triples = pairs.filter((i) => free.includes(i + 2));
    if (featureAge(g, "chain3") >= 0 && triples.length > 0 && g.rng() < 0.45) {
      const col = triples[Math.floor(g.rng() * triples.length)];
      const a = makeNumber(g, col, true);
      const b = makeNumber(g, col + 1, true);
      const c = makeNumber(g, col + 2, true);
      a.chain = b.id;
      b.chain = a.id;
      b.chain2 = c.id;
      c.chain = b.id;
      g.numbers.push(a, b, c);
      return;
    }
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

/** Seconds until the next bonus ball (somewhere between 11 and 20). */
function nextBonusIn(g: GameState): number {
  return (11 + g.rng() * 9) * 0.6 ** g.perks.filter((p) => p === "bonus").length;
}

/**
 * A bonus ball falls in a column that is free. Only the kinds the book has brought in yet come (none on the first levels),
 * and a ball that brings a cup back only comes when there is a dead cup.
 */
function spawnBonus(g: GameState, forced: Bonus | null = null): boolean {
  if (g.numbers.some((n) => n.bonus)) return false;
  const hasDead = g.cups.some((c) => c.dead);
  const options: {kind: Bonus; weight: number}[] = [];
  if (hasDead && featureAge(g, "life") >= 0) options.push({kind: "life", weight: 0.4});
  if (featureAge(g, "points") >= 0) options.push({kind: "points", weight: hasDead ? 0.35 : 0.55});
  if (featureAge(g, "slow") >= 0) options.push({kind: "slow", weight: hasDead ? 0.25 : 0.45});
  if (featureAge(g, "pause") >= 0) options.push({kind: "pause", weight: 0.3});
  if (featureAge(g, "bomb") >= 0) options.push({kind: "bomb", weight: 0.3});
  // (a cloth is only worth coming when there is room for one more, and a shield when a living cup has none)
  if (featureAge(g, "cloth") >= 0 && g.screens < SCREEN_MAX) options.push({kind: "cloth", weight: 0.25});
  if (featureAge(g, "shield") >= 0 && g.cups.some((c) => !c.dead && !c.shield)) options.push({kind: "shield", weight: hasDead ? 0.3 : 0.45});
  if (featureAge(g, "star") >= 0) options.push({kind: "star", weight: 0.3});
  // (the diamond is the best ball there is, so it is rare)
  if (featureAge(g, "diamond") >= 0) options.push({kind: "diamond", weight: 0.16});
  if (options.length === 0 && !forced) return false;
  const free = g.cols.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < spawnY(g) + 96));
  if (free.length === 0) return false;
  const col = free[Math.floor(g.rng() * free.length)];
  let r = g.rng() * options.reduce((sum, o) => sum + o.weight, 0);
  let kind = forced ?? options[options.length - 1].kind;
  for (const o of forced ? [] : options) {
    if (r < o.weight) {
      kind = o.kind;
      break;
    }
    r -= o.weight;
  }
  // After a cup has died, the next bonus ball is the heart that brings it back.
  if (!hasDead) g.lifeDue = false;
  if (!forced && g.lifeDue && options.some((o) => o.kind === "life")) kind = "life";
  if (kind === "life") g.lifeDue = false;
  const ball = newNumber(g, col, g.cols[col], 0, "add", kind);
  if (kind === "star") ball.speed = 0.5 + g.rng() * 0.5; // (seconds until it first jumps to another column)
  g.numbers.push(ball);
  return true;
}

/** The dead cup that stands nearest to an x (undefined if no cup is dead). */
function nearestDeadCup(g: GameState, x: number): Cup | undefined {
  let best: Cup | undefined;
  for (const c of g.cups) if (c.dead && (!best || Math.abs(c.x - x) < Math.abs(best.x - x))) best = c;
  return best;
}

/** A bonus ball has been tapped: it does its thing at once (the heart first goes down into the dead cup, and does it when it lands). */
function collectBonus(g: GameState, n: NumberTile): void {
  g.numbers = g.numbers.filter((x) => x !== n);
  let kind = n.bonus ?? "points";
  let amount = 0;
  if (kind === "life") {
    const dead = nearestDeadCup(g, n.x);
    if (dead) {
      dead.dead = false;
      dead.value = 0;
      dead.hidden = false;
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
  if (kind === "pause") g.pause = PAUSE_SECONDS;
  if (kind === "cloth") {
    if (g.screens < SCREEN_MAX) giveScreens(g, 1);
    else {
      kind = "points"; // no room for another one (it was got some other way meanwhile): points instead
      amount = BONUS_POINTS * g.level;
      g.score += amount;
    }
  }
  if (kind === "shield") {
    // The shield goes on the living cup that stands nearest to the ball (one that has no shield yet).
    let cup: Cup | undefined;
    for (const c of g.cups) if (!c.dead && !c.shield && (!cup || Math.abs(c.x - n.x) < Math.abs(cup.x - n.x))) cup = c;
    if (cup) {
      cup.shield = true;
      cup.flash = 0.6;
      cup.ripple = 1;
      g.events.push({t: "shield", cupId: cup.id, x: cup.x, y: cup.y - CUP_H / 2, on: true});
    } else {
      kind = "points"; // every living cup has one already: points instead
      amount = BONUS_POINTS * g.level;
      g.score += amount;
    }
  }
  if (kind === "bomb") {
    // Every number close to the bomb is blown away (a number that is on its way into a cup, and the bonus balls, are not touched).
    const hits: {x: number; y: number}[] = [];
    for (const m of g.numbers) {
      if (m.state !== "fall" || m.bonus || m.y < -8 - g.extra) continue;
      if (Math.hypot(m.x - n.x, m.y - n.y) <= BOMB_RADIUS) {
        m.done = true;
        hits.push({x: m.x, y: m.y});
      }
    }
    g.numbers = g.numbers.filter((m) => !m.done);
    g.shake = Math.max(g.shake, 0.8);
    amount = hits.length;
    g.events.push({t: "blast", x: n.x, y: n.y, hits});
  }
  if (kind === "diamond") amount = startZap(g, n);
  if (kind === "star") {
    // Every living cup is cleared (back to 0, and its number shown again); a dead cup stays dead. The points are for what was in them.
    for (const c of g.cups) {
      if (c.dead) continue;
      amount += Math.abs(c.value) * g.level;
      c.value = 0;
      c.hidden = false;
      c.flash = 1;
      c.ripple = 1;
      c.bump = 1;
    }
    g.score += amount;
  }
  g.events.push({t: "bonus", kind, x: n.x, y: n.y, amount});
}

/**
 * A tap at (x, y). Sends the number there into the nearest living cup. Returns true if it hit one.
 * A finger that is dragged across the screen taps along its way: `skip` holds the numbers that this stroke has already touched (a number is
 * only touched once per stroke, so that a swipe across a number in ice does not break all of it at once, or clink on steel over and over).
 */
export function tapAt(g: GameState, x: number, y: number, skip?: Set<number>): boolean {
  if (g.phase !== "play" || g.zap) return false; // (nothing can be tapped while the diamond is at work)
  let hit: NumberTile | undefined;
  let bd = TAP_RADIUS;
  for (const n of g.numbers) {
    if (n.state !== "fall" || n.y < -8 - g.extra || skip?.has(n.id)) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      hit = n;
    }
  }
  if (!hit) return false;
  skip?.add(hit.id);
  // A heart goes down into the dead cup, like a number, and brings it back when it lands there.
  if (hit.bonus === "life") {
    const dead = nearestDeadCup(g, hit.x);
    if (dead) {
      startDive(g, hit, dead.id, dead.x);
      return true;
    }
  }
  // Any other bonus ball is collected at once.
  if (hit.bonus) {
    collectBonus(g, hit);
    return true;
  }
  // A steel number cannot be tapped: it only goes "clink" (it has to be let go down at its own pace).
  if (hit.op === "steel") {
    g.events.push({t: "steel", x: hit.x, y: hit.y});
    return true;
  }
  // A number frozen in ice: every tap cracks the ice a bit more, and the tap that breaks it only clears the ice away: it takes one more
  // tap, on the bare number, to send it down (so the player can see when it is free).
  if (hit.ice > 0) {
    hit.ice -= 1;
    g.events.push({t: "ice", x: hit.x, y: hit.y, broke: hit.ice === 0});
    return true;
  }
  if (!sendDown(g, hit, null)) return false;
  // A number on a chain pulls the ones it is chained to down after it, and they pull the ones chained to them (a chain of three goes
  // like that, one after the other): each goes into the cup under its own column, but hangs where it is until the chain goes taut.
  const queue: NumberTile[] = [hit];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const id of [cur.chain, cur.chain2]) {
      if (id === null) continue;
      const mate = g.numbers.find((m) => m.id === id && m.state === "fall");
      if (mate && sendDown(g, mate, cur.id)) {
        mate.tilt = cur.tilt === 1 ? -1 : 1;
        queue.push(mate);
      }
    }
  }
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
  // A magnet cup takes a number that would have killed the cup under it, if it can take it (from up to two columns away).
  let target = cup;
  const killed = (c: Cup) => Math.abs(valueAfter(c, n)) > cupLimit(c);
  if (killed(cup) && !cup.kinds.includes("magnet") && !cup.shield) {
    let pull: Cup | undefined;
    for (const m of g.cups) {
      if (m.dead || !m.kinds.includes("magnet") || killed(m) || Math.abs(m.x - n.x) > MAGNET_REACH) continue;
      if (!pull || Math.abs(m.x - n.x) < Math.abs(pull.x - n.x)) pull = m;
    }
    if (pull) target = pull;
  }
  startDive(g, n, target.id, target.x, leader);
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

/**
 * The diamond has been tapped: it stays where it is and changes every falling number (not the bonus balls) to an orange 10 (one in five)
 * or an orange 0, the one nearest to it first (see update). Returns how many numbers there are to change.
 */
function startZap(g: GameState, diamond: NumberTile): number {
  const targets = g.numbers
    .filter((m) => m.state === "fall" && !m.bonus)
    .sort((a, b) => Math.hypot(a.x - diamond.x, a.y - diamond.y) - Math.hypot(b.x - diamond.x, b.y - diamond.y));
  const gap = Math.min(0.16, 1.4 / Math.max(1, targets.length));
  const steps = targets.map((m, i) => ({id: m.id, at: 0.35 + i * gap, ten: g.rng() < DIAMOND_TEN_CHANCE, done: false}));
  const end = (steps.length > 0 ? steps[steps.length - 1].at : 0.35) + 0.55;
  g.zap = {time: 0, x: diamond.x, y: diamond.y, end, steps};
  g.events.push({t: "zap", x: diamond.x, y: diamond.y, hits: steps.map((s, i) => ({x: targets[i].x, y: targets[i].y, at: s.at, ten: s.ten}))});
  return targets.length;
}

/**
 * A laser cup is fired (a double tap on it): every falling number in its column goes, with a beam up the column. A number frozen in ice only loses its
 * ice (the laser melts it, and the number stays). False if it is not ready (or not a laser cup).
 */
export function fireLaser(g: GameState, c: Cup): boolean {
  if (g.phase !== "play" || !c.kinds.includes("laser") || c.dead || c.charge > 0 || !g.cups.includes(c)) return false;
  const hits: {x: number; y: number}[] = [];
  for (const n of g.numbers) {
    if (n.state !== "fall" || n.bonus || Math.abs(n.x - c.x) > LASER_HALF_WIDTH) continue;
    if (n.ice > 0) {
      n.ice = 0;
      g.events.push({t: "ice", x: n.x, y: n.y, broke: true});
      continue;
    }
    n.done = true;
    hits.push({x: n.x, y: n.y});
  }
  g.numbers = g.numbers.filter((n) => !n.done);
  c.charge = LASER_COOLDOWN;
  c.flash = 0.6;
  g.events.push({t: "laser", x: c.x, y: c.y - CUP_H / 2, hits});
  return true;
}

/** How far from 0 the sum in a cup can go before the cup dies: 10 (12 for the big cup). */
export function cupLimit(c: Cup): number {
  return c.kinds.includes("big") ? BIG_LIMIT : TARGET;
}

/** What the sum in a cup would be after this number has landed in it. */
function valueAfter(c: Cup, n: NumberTile): number {
  if (n.op === "mul") return c.value * n.v;
  if (n.op === "div") return Math.trunc(c.value / n.v) + 0; // + 0: never a minus zero
  if (n.op === "zero") return 0;
  if (n.op === "ten") return TARGET;
  return c.value + n.v;
}

function land(g: GameState, c: Cup, n: NumberTile): void {
  n.done = true;
  // A cup with a shield: a number that would have killed it is stopped instead (the cup stays as it was, and the shield is used up).
  if (!c.dead && c.shield && Math.abs(valueAfter(c, n)) > cupLimit(c)) {
    c.shield = false;
    c.bump = 1;
    c.ripple = 1;
    g.shake = Math.max(g.shake, 0.3);
    g.events.push({t: "shield", cupId: c.id, x: c.x, y: c.y - CUP_H / 2, on: false});
    return;
  }
  g.events.push({t: "land", x: c.x, y: c.y - CUP_H / 2, v: n.v, op: n.op, cupId: c.id});
  // A number in a dead cup: that is the end.
  if (c.dead) {
    // In the tutorial it is just done again.
    if (g.mode === "tutorial") tutorialRetry(g);
    else endGame(g, "deadCup");
    return;
  }
  // A blue number multiplies, a yellow one divides, an orange 0 sets the cup to 0, any other adds. (A minus cup is multiplied like any other number:
  // -4 times 2 is -8. A division that does not come out even rounds the size of the cup down: 7 / 2 is 3, and -7 / 2 is -3.)
  const next = valueAfter(c, n);
  c.value = next;
  if (n.op === "zero" || n.op === "ten") c.hidden = false; // (a cup that is back at 0, or at 10, is easy to count again)
  else if (n.op === "dim") c.hidden = true;
  c.bump = 1;
  c.ripple = 1;
  g.score += (n.op === "mul" ? n.v * 3 : n.op === "div" ? n.v * 2 : n.op === "zero" ? 2 : Math.abs(n.v)) * g.level * (c.kinds.includes("gold") ? GOLD_FACTOR : 1);
  let result: "levelUp" | "bust" | "none" = "none";
  // (a big cup has a margin: 10, 11 and 12 are all a perfect 10, and what is over stays in the cup)
  if (Math.abs(c.value) >= TARGET && Math.abs(c.value) <= cupLimit(c)) {
    levelUp(g, c);
    result = "levelUp";
  } else if (Math.abs(c.value) > cupLimit(c)) {
    c.dead = true;
    result = "bust";
    // A dead cup: a heart comes soon (the next bonus ball), if hearts have come in.
    if (featureAge(g, "life") >= 0 && g.mode !== "tutorial") {
      g.lifeDue = true;
      g.bonusTimer = Math.min(g.bonusTimer, 4 + g.rng() * 3);
    }
    g.shake = Math.max(g.shake, 0.7);
    g.events.push({t: "bust", cupId: c.id});
    if (g.cups.every((k) => k.dead)) endGame(g, "allDead");
  }
  if (g.mode === "tutorial") tutorialAfterLand(g, result);
}

function levelUp(g: GameState, c: Cup): void {
  g.level += 1;
  // A perfect 10 soon after the one before it builds a combo: the points of the perfect 10 go times 2, then times 3, and so on (and a combo is worth twice as much per step as an ordinary perfect 10).
  g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
  g.comboTimer = COMBO_SECONDS;
  const bonus = (g.combo >= 2 ? COMBO_BONUS : 50) * g.level * g.combo * (c.kinds.includes("gold") ? GOLD_FACTOR : 1);
  g.score += bonus;
  if (g.combo >= 2 && g.mode !== "tutorial") g.events.push({t: "combo", n: g.combo, x: c.x, y: c.y - CUP_H / 2, bonus});
  // The cup starts over at 0 (the golden 10 stays on it for a moment).
  c.tenSign = c.value < 0 ? -1 : 1;
  c.value -= c.tenSign * TARGET; // (0, or what was over 10 in a big cup: 12 starts over at 2, and -12 at -2)
  c.tenCarry = c.value;
  c.hidden = false;
  c.showTen = 0.9;
  c.flash = 1;
  // The big LEVEL banner is for the endless game, when a new level of it begins (every fifth cup). In the book
  // the progress bar shows how far you have come.
  const newLevel = g.daily ? rungEnds(g.level - 1) : (g.level - 1) % ENDLESS_CUPS_PER_LEVEL === 0;
  if (g.mode === "endless" && newLevel) {
    g.banner = 1.6;
    giveScreens(g, 1); // (the whole bar is full: a new screen)
    // What this level of the endless game brings in is made to fall a few seconds in.
    planShowcase(g, FEATURES.filter((f) => ENDLESS_FEATURE_FROM[f] === endlessLevel(g)));
  }
  g.events.push({t: "levelUp", cupId: c.id, level: g.level});
  // The daily challenge: every rung of the ladder that is climbed (5 cups, then 6, then 7 ...) gives a perk to choose, and the last one wins the day.
  if (g.daily && g.mode === "endless" && newLevel) {
    if (rungsDone(g.level - 1) >= DAILY_RUNGS) {
      g.phase = "won";
      g.overTimer = -WIN_DELAY;
      g.numbers = [];
      g.banner = 0;
      g.events.push({t: "won", stars: 3});
      return;
    }
    offerPerks(g);
  }
  // A level of the book is cleared when enough cups have reached 10.
  if (g.level - 1 >= goalFor(g.mode, g.stage)) {
    // A level cleared with three stars gives a pull-down screen (if there is room for one more).
    g.screenWon = isLevelMode(g.mode) && starsFor(g.mode, g.stage, g.score) === 3 && g.screens < SCREEN_MAX;
    if (g.screenWon) giveScreens(g, 1);
    g.phase = "won";
    g.overTimer = -WIN_DELAY; // (the card waits for the progress bar: it comes up when this has counted up to 0)
    g.numbers = [];
    g.banner = 0;
    g.events.push({t: "won", stars: starsFor(g.mode, g.stage, g.score)});
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
    if (g.phase === "play") c.charge = Math.max(0, c.charge - dt);
  }
  g.shake = Math.max(0, g.shake - dt * 2.2);
  g.banner = Math.max(0, g.banner - dt);

  if (g.phase === "over" || g.phase === "won") {
    g.overTimer += dt;
    return;
  }
  if (g.phase === "intro" || g.phase === "perk") {
    g.overTimer += dt; // (how long it has been shown: its buttons wait a moment, as the ones after a round do)
    return;
  }
  if (g.phase !== "play") return;

  // The time to make the next perfect 10 for the combo runs out (in real time, also while the numbers are slowed down).
  if (g.comboTimer > 0) {
    g.comboTimer = Math.max(0, g.comboTimer - dt);
    if (g.comboTimer === 0) g.combo = 0;
  }

  // Slow motion: the numbers fall, and new ones come, at a fraction of the speed.
  // A pause ball stops them dead (no number falls and no new one comes; taps and numbers already on their way into a cup carry on).
  const paused = g.pause > 0 || g.zap !== null;
  const sdt = paused ? 0 : g.slow > 0 ? dt * SLOW_FACTOR : dt;
  g.slow = Math.max(0, g.slow - dt);
  g.pause = Math.max(0, g.pause - dt);

  // The diamond at work: one number after the other is changed to an orange 10 or an orange 0 (the numbers wait where they are), and when it is
  // done the diamond is gone and everything carries on falling.
  if (g.zap) {
    g.zap.time += dt;
    for (const s of g.zap.steps) {
      if (s.done || g.zap.time < s.at) continue;
      s.done = true;
      const n = g.numbers.find((m) => m.id === s.id && m.state === "fall");
      if (!n) continue;
      n.op = s.ten ? "ten" : "zero";
      n.v = s.ten ? TARGET : 0;
      n.ice = 0;
      n.ghost = null;
      for (const m of g.numbers) {
        if (m.chain === n.id) m.chain = null;
        if (m.chain2 === n.id) m.chain2 = null;
      }
      n.chain = null;
      n.chain2 = null;
      g.events.push({t: "zapHit", x: n.x, y: n.y, ten: s.ten});
    }
    if (g.zap.time >= g.zap.end) g.zap = null;
  }

  // The screen that wipes the numbers away: every falling number it reaches is gone.
  if (g.sweep >= 0) {
    g.sweep += dt;
    const edge = sweepBottom(g);
    if (g.sweep < SWEEP_DOWN + SWEEP_HOLD) {
      for (const n of g.numbers) if (n.state === "fall" && !n.bonus && n.y <= edge) n.done = true;
    }
    if (g.sweep >= SWEEP_DOWN + SWEEP_HOLD + SWEEP_UP) g.sweep = -1;
  }

  if (g.mode === "tutorial") {
    // The tutorial sets out its own numbers, one at a time.
    if (g.tutorialDelay > 0) {
      g.tutorialDelay -= dt;
      if (g.tutorialDelay <= 0) tutorialSetup(g);
    } else if (g.numbers.length === 0) {
      tutorialSetup(g);
    }
  } else if (g.sweep < 0) {
    // (nothing new comes while the screen is down)
    g.spawnTimer -= sdt;
    if (g.spawnTimer <= 0 && !paused) {
      g.spawnTimer = spawnInterval(paceOf(g)) * stageSpawnFactor(g.stage) * (0.85 + g.rng() * 0.3);
      spawn(g);
    }
    // Every now and then a bonus ball comes.
    if (!paused) g.bonusTimer -= dt;
    if (g.bonusTimer <= 0) {
      g.bonusTimer = nextBonusIn(g);
      spawnBonus(g);
    }
    // The new kinds that this level brings in are made to fall, one at a time, a few seconds in.
    if (g.showcase.length > 0 && !paused) {
      g.showTimer -= dt;
      if (g.showTimer <= 0) {
        if (spawnShowcase(g, g.showcase[0])) {
          g.showcase.shift();
          g.showTimer = 4 + g.rng() * 2;
        } else g.showTimer = 0.5;
      }
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
  n.y += fallSpeed(paceOf(g)) * speedFactorOf(g) * dt;
  // A bonus ball never lands in a cup: if nobody taps it, it just falls past.
  if (n.bonus) {
    if (n.bonus === "star") {
      // The star is tricky: every now and then it jumps to another column.
      n.speed -= dt;
      if (n.speed <= 0) {
        const others = g.cols.map((_, i) => i).filter((i) => i !== n.col);
        n.col = others[Math.floor(g.rng() * others.length)];
        n.aim = g.cols[n.col];
        n.speed = 0.6 + g.rng() * 0.6;
      }
      n.x += (n.aim - n.x) * Math.min(1, 8 * dt);
    }
    if (n.y > MISS_Y + 40) n.done = true;
    return;
  }
  // On its own the number lands in whatever cup it passes over (a living one, or a dead one: game over).
  landOrMiss(g, n);
}

/**
 * A number that has just moved down from n.prevY: lands in a cup that it is over (or that is under it) while it is in the upper half
 * of the cup, or hits the desk. The whole upper half counts, not only the moment it passes the mouth: a cup that is dragged under a
 * number that has already passed the mouth still catches it, and the number does not fall straight through the cup.
 */
function landOrMiss(g: GameState, n: NumberTile): void {
  for (const c of g.cups) {
    const mouth = c.y - CUP_H / 2;
    if (n.prevY < c.y && n.y >= mouth && Math.abs(n.x - c.x) <= CUP_W / 2 - 4) {
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
    // A heart brings the dead cup it lands in back (if the cups were swapped on the way, the dead cup that is nearest).
    if (n.bonus) {
      if (!cup.dead) cup = nearestDeadCup(g, n.aim) ?? cup;
      n.x = cup.x;
      n.y = mouth;
      n.done = true;
      collectBonus(g, n);
      return;
    }
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
  return g.cups.reduce((best, c) => (Math.abs(c.x - g.cols[col]) < Math.abs(best.x - g.cols[col]) ? c : best));
}

/** Sets out the number (and the cups) for the step the tutorial is on. */
function tutorialSetup(g: GameState): void {
  g.numbers = [];
  g.tutorialNote = "";
  g.tutorialDelay = 0;
  switch (g.tutorialStep) {
    case 0:
      // Tap it and it lands in the cup under it.
      g.numbers.push(newNumber(g, 1, g.cols[1], 4));
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
    g.events.push({t: "won", stars: 3}); // (the tutorial is always cleared with three stars)
  }
}

/** It did not go as the step wanted (or the number was lost): the step starts again after a moment. */
function tutorialRetry(g: GameState): void {
  g.tutorialNote = "retry";
  g.tutorialDelay = 1.5;
  g.numbers = [];
}
