import {PERKS, PERK_LIMIT, PERK_SLOWER, SPECIAL_PERKS, SPECIAL_PERK_CHANCE, dayKey, rungEnds, rungsDone, seedOfDay, seededRandom} from "./daily";
import {BIG_LIMIT, GOLD_FACTOR, LASER_COOLDOWN, LASER_HALF_WIDTH, MAGNET_REACH} from "./cups";
import {SAUCER_EFFECT, type SaucerKind, saucerPower} from "./saucers";
import {DAILY_RUNGS, DIAMOND_TEN_CHANCE} from "./constants";
import {BONUS_POINTS, BOMB_RADIUS, PAUSE_SECONDS, CHAIN_LENGTH, GHOST_PERIOD, ICE_HITS, COLS, PLUS_COLS, TWO_COLS, WIN_DELAY, COMBO_SECONDS, COMBO_BONUS, SCREEN_MAX, SWEEP_DOWN, SWEEP_HOLD, SWEEP_UP, SWEEP_EDGE, CUP_H, CUP_START_Y, SLOW_FACTOR, SLOW_SECONDS, ERASER_MAX, DIVE_GRAVITY, DIVE_HOP, CUP_W, MISS_Y, STAGES, TAP_RADIUS, TARGET, TUTORIAL_STEPS, W} from "./constants";
import type {Bonus, Cup, Feature, GameOverReason, GameState, Mode, NumberTile, Op, PerkId, Pickup, Variant, Weapon, WeaponPath} from "./types";

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
  const saucers = 1 - SAUCER_EFFECT.slow * saucerStrength(g, "slow"); // (each slow saucer: 5% slower, and more for two, three or four of them)
  if (g.mode === "endless") return saucers * variantRamp(g) * (endlessLevel(g) >= 4 ? LATER_LEVELS_SLOWER : 1) * (endlessLevel(g) >= 2 ? LEVEL_2_UP_SLOWER : 1) * g.speedMul;
  return saucers * stageSpeedFactor(g.stage) * (g.stage >= 2 ? LEVEL_2_UP_SLOWER : 1);
}

/** Every level from 2 up (in the chapters and in the endless game) falls another 10% slower; level 1 is as it was. */
const LEVEL_2_UP_SLOWER = 0.9;

/** In Save the cup the numbers fall faster and faster: from a bit faster than the endless game at the start, and more with the seconds of the round (up to five and a half times as fast). */
export function variantRamp(g: GameState): number {
  if (g.variant === "jet") return Math.min(4, 1.2 + g.variantTime / 45); // (Fighter jet: faster and faster)
  if (g.variant === "comet") return Math.min(4, 1.5 + g.variantTime / 45); // (Comet belt: the comets come fast)
  if (g.variant === "shield") return Math.min(5, 1.3 + g.variantTime / 40); // (Shield up: faster and faster, and on for long)
  if (g.variant === "defend") return Math.min(3.5, 1.25 + g.variantTime / 60); // (Defend the cups: a bit faster from the start)
  if (g.variant === "ice") return 0.85; // (Ice world: a little slower, since every number takes two taps)
  if (g.variant === "fast") return 1.8; // (Fast fingers: a skull that falls falls fast)
  return g.variant === "save" ? Math.min(5.5, 1.15 + g.variantTime / 36) : 1;
}

/** And more and more of them come (up to seven times as often): the time between the numbers is divided by this. */
export function variantRate(g: GameState): number {
  if (g.variant === "jet") return Math.min(5, 1.2 + g.variantTime / 35);
  if (g.variant === "comet") return Math.min(5, 1.3 + g.variantTime / 30);
  if (g.variant === "shield") return Math.min(6, 1.1 + g.variantTime / 35);
  if (g.variant === "defend") return Math.min(4, 1.3 + g.variantTime / 50); // (and a few more numbers)
  if (g.variant === "ice") return 0.8; // (and a few fewer numbers)
  if (g.variant === "fast") return Math.min(3, 1 + g.variantTime / 40); // (more and more of them)
  return g.variant === "save" ? Math.min(7, 1.3 + g.variantTime / 30) : 1;
}

/** How many saucers of a kind are under the cups in play (the ones from the shop; not in the tutorial). They add up. */
export function saucerCount(g: GameState, kind: SaucerKind): number {
  if (g.mode === "tutorial") return 0;
  return g.saucerLoadout.slice(0, g.cols.length).filter((k) => k === kind).length;
}

/** How many times a perk has been taken in the daily challenge. */
function perkCount(g: GameState, perk: PerkId): number {
  return g.perks.filter((p) => p === perk).length;
}

/** How many saucers of a kind they work like: the bonus for two, three or four of a kind is counted in. */
export function saucerStrength(g: GameState, kind: SaucerKind): number {
  return saucerPower(saucerCount(g, kind));
}

/** How many times as many special numbers come (the orange 0 and 10, and the bonus balls): 10% more for every special saucer and special perk. */
function luck(g: GameState): number {
  return 1 + SAUCER_EFFECT.special * (saucerStrength(g, "special") + perkCount(g, "special"));
}

/** The points of something, with the points saucers counted in: 50% more for every one. */
function scaled(g: GameState, points: number): number {
  return Math.round(points * (1 + SAUCER_EFFECT.points * (saucerStrength(g, "points") + perkCount(g, "points"))));
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
  return mode === "plus" || mode === "minus" || mode === "mixed" || mode === "times" || mode === "divide" || mode === "space";
}

/** How much harder a level of the book starts than the one before it. */
function baseFor(mode: Mode, stage: number): number {
  if (mode === "tutorial") return 3; // the numbers drift a bit faster than at the very start, so there is not much waiting
  return mode === "endless" ? 0 : (stage - 1) * 1.25;
}

/**
 * How many cups have to reach 10 to clear a game (infinity: it never ends). Every row of the book needs one more than the row
 * before: levels 1-3 need 4, levels 4-6 need 5, levels 7-9 need 6 and levels 10-11 need 7. The levels of the space chapter need two
 * more than that: 6, 7, 8 and 9. Level 12 of every chapter (the last one) needs 8.
 */
export function goalFor(mode: Mode, stage = 1): number {
  if (mode === "endless" || mode === "tutorial") return Infinity;
  if (stage >= STAGES) return 8;
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
  // (in the daily challenge the levels are the rungs of the ladder, which need two more cups each: 5, 7, 9 ...)
  if (g.daily) return rungsDone(g.level - 1) + 1;
  // (what has faded of the progress is not counted: the bar has to be filled again)
  return endlessLevelOf(Math.max(0, progressOf(g)));
}

/** The most cups a level of the endless game needs: every level after it needs as many. */
export const ENDLESS_GOAL_MAX = 20;

/** How many cups a level of the endless game (and the match modes) needs: five on the first, and one more on every level after it (5, 6, 7 ...), at most 20. */
export function endlessGoal(level: number): number {
  return Math.min(ENDLESS_GOAL_MAX, ENDLESS_CUPS_PER_LEVEL - 1 + Math.max(1, Math.floor(level)));
}

/** How many cups the levels before this one need together (0, 5, 11, 18 ...). */
export function endlessCupsBefore(level: number): number {
  let n = 0;
  for (let l = 1; l < level; l++) n += endlessGoal(l);
  return n;
}

/** The level that this many cups done (with what has faded taken off) is on. */
export function endlessLevelOf(cups: number): number {
  let l = 1;
  while (endlessCupsBefore(l + 1) <= cups + 1e-9) l++;
  return l;
}

/**
 * For the bar of the endless game: the level that cup number `cupsDone` is on, the cups it needs, and how many of them are done (the cup that finishes a level
 * still shows a full bar). `cupsDone` may have a fraction (what has faded).
 */
export function endlessOfCup(cupsDone: number): {level: number; goal: number; into: number} {
  if (cupsDone <= 0) return {level: 1, goal: endlessGoal(1), into: 0};
  const level = endlessLevelOf(Math.ceil(cupsDone - 1e-9) - 1);
  return {level, goal: endlessGoal(level), into: cupsDone - endlessCupsBefore(level)};
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

/** Which kinds of numbers fall now: minus numbers (and whether they are the only ones: the minus chapter), blue multiplication numbers, and yellow division numbers. */
function kinds(g: GameState): {minus: boolean; onlyMinus: boolean; times: boolean; div: boolean} {
  if (g.mode === "endless") return {minus: endlessLevel(g) >= 2, onlyMinus: false, times: endlessLevel(g) >= 3, div: endlessLevel(g) >= 4};
  return {
    onlyMinus: g.mode === "minus",
    minus: g.mode === "minus" || g.mode === "mixed" || g.mode === "times" || g.mode === "divide" || g.mode === "space",
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
export const FEATURES: Feature[] = ["screen", "cup3", "cups", "fade", "zero", "ten", "life", "slow", "pause", "chain", "vchain", "points", "bomb", "cloth", "ice", "shield", "ghost", "diamond", "fog", "star", "steel", "chain3", "wand", "reverse", "eraser", "skull"];

/**
 * Where the book presents each new kind of number, and where it starts to come: the chapter and the level of it. The first chapter
 * has three cups, brings the pull-down screen (level 2) and the orange 0 (level 4), a life ball (level 7) and a slow motion ball (level 10), plus and minus brings chains (level 4)
 * and the points ball (level 7) and, at level 10 of plus and minus, the pause ball that stops the numbers for a few seconds, times brings ice
 * (level 4), the bomb that blows away the numbers round it (level 7) and the cloth ball that gives one more pull-down screen (level 10),
 * minus brings the magic wand that makes every number a 1 for a while (level 7) and the reverse that sends tapped numbers up and away (level 10), divide brings the shield ball that protects a cup (level 7) and ghosts and space brings the star that clears all the cups (level 1), the steel number that cannot be tapped (level 7), the chain of three (level 10) and, on the very last level, the black number that hides the number of a cup (level 12). A new kind stays in the chapters after the one that brought it.
 */
export const FEATURE_AT: Record<Feature, {mode: Mode; stage: number}> = {
  screen: {mode: "plus", stage: 2},
  cup3: {mode: "plus", stage: 3},
  cups: {mode: "mixed", stage: 1},
  fade: {mode: "mixed", stage: 3},
  zero: {mode: "plus", stage: 4},
  ten: {mode: "plus", stage: 12},
  life: {mode: "plus", stage: 7},
  slow: {mode: "plus", stage: 10},
  wand: {mode: "minus", stage: 7},
  reverse: {mode: "minus", stage: 10},
  eraser: {mode: "mixed", stage: 5},
  skull: {mode: "divide", stage: 1}, // (and it is shown when Defend the cups starts)
  pause: {mode: "mixed", stage: 10},
  chain: {mode: "mixed", stage: 4},
  vchain: {mode: "times", stage: 1},
  points: {mode: "mixed", stage: 7},
  bomb: {mode: "times", stage: 7},
  cloth: {mode: "times", stage: 10},
  shield: {mode: "divide", stage: 7},
  ice: {mode: "times", stage: 4},
  ghost: {mode: "divide", stage: 4},
  diamond: {mode: "divide", stage: 10},
  fog: {mode: "space", stage: 12},
  star: {mode: "space", stage: 1},
  steel: {mode: "space", stage: 7},
  chain3: {mode: "space", stage: 10},
};

/** In the endless game (which comes after the whole book): the level each one comes from. */
const ENDLESS_FEATURE_FROM: Record<Feature, number> = {fade: 3, screen: 1, cup3: 1, cups: 1, zero: 2, ten: 3, points: 1, life: 1, slow: 1, pause: 5, bomb: 9, shield: 6, cloth: 11, chain: 4, vchain: 6, ghost: 7, ice: 10, fog: 12, star: 8, steel: 11, chain3: 14, diamond: 13, wand: 4, reverse: 6, eraser: 5, skull: 9};

const CHAPTERS: Mode[] = ["plus", "minus", "mixed", "times", "divide", "space"];

/** How far along the book a level is (the first level of the first chapter is 1). */
function bookPlace(mode: Mode, stage: number): number {
  return CHAPTERS.indexOf(mode) * STAGES + stage;
}

/** How many levels ago a new kind of number came in: 0 on the level that presents it, and -1 if it has not come yet. */
export function featureAge(g: GameState, f: Feature): number {
  if (g.mode === "tutorial" || g.variant || mixNow(g)) return -1; // (the match modes have none of the new kinds of number, nor the daily ladder, which is one)
  if (g.mode === "endless") {
    const level = endlessLevel(g);
    return level >= ENDLESS_FEATURE_FROM[f] ? level - ENDLESS_FEATURE_FROM[f] : -1;
  }
  const at = FEATURE_AT[f];
  return Math.max(-1, bookPlace(g.mode, g.stage) - bookPlace(at.mode, at.stage));
}

/** How many steps one perfect 10 is worth in the progress (one step is 5%). */
export const FADE_TICKS = 20;

/** In the endless game a whole perfect 10 of the progress takes 24 seconds to fade at first, and never fewer than 10, however far it has gone. */
const ENDLESS_FADE_START = 24;
const ENDLESS_FADE_MIN = 10;

/**
 * The progress fades with time: from level 3 of plus & minus on (and in the chapters after, and in the endless game from its third level), the
 * perfect 10s that have been made slowly fade away, until a new perfect 10 comes. Not in the daily challenge.
 */
export function fadeOn(g: GameState): boolean {
  // (the fighter jet has it from the start: its weapons stay, but the perfect 10s of the bar slowly fade away)
  if (g.variant === "jet" || snakeOn(g)) return true; // (and the snake: a perfect 10 that fades away makes it faster)
  return (isLevelMode(g.mode) || (g.mode === "endless" && !g.daily)) && featureAge(g, "fade") >= 0;
}

/**
 * How many seconds it takes for a whole perfect 10 of the progress to fade away: in the book 22 on levels 1-3 of a chapter, 20 on 4-6, 18 on 7-9
 * and 16 on 10-12. The endless game goes on: it starts at 24 and keeps getting faster, two seconds every third level, down to 10.
 */
export function fadeSeconds(g: GameState): number {
  if (snakeOn(g)) return 1.8 * Math.max(ENDLESS_FADE_MIN, ENDLESS_FADE_START - 2 * Math.floor((endlessLevel(g) - 1) / 3)); // (the snake: slower, there is time to fill the cups)
  if (g.mode === "endless") return Math.max(ENDLESS_FADE_MIN, ENDLESS_FADE_START - 2 * Math.floor((endlessLevel(g) - 1) / 3));
  return 22 - 2 * Math.floor((Math.max(1, g.stage) - 1) / 3);
}

/** How much can have faded at most (in steps): not more than there is, and in the endless game not more than the cups of the level the bar is on. */
export function fadeCap(g: GameState): number {
  const start = g.mode === "endless" && !g.daily ? endlessCupsBefore(endlessLevel(g)) : 0;
  return Math.max(0, (g.level - 1 - start) * FADE_TICKS);
}

/** How many cups of a level count now, with what has faded taken off (a whole number as long as nothing has faded). */
export function progressOf(g: GameState): number {
  return ((g.level - 1) * FADE_TICKS - g.drain) / FADE_TICKS;
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

/** Two small numbers sometimes hang on a chain one above the other: the chance that a new number brings such a pair. */
function vchainChance(g: GameState): number {
  const age = featureAge(g, "vchain");
  return age < 0 ? 0 : Math.min(0.3, 0.12 + 0.03 * Math.min(age, 8));
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

/**
 * How many other numbers come at least between two numbers that finish a cup (Infinity: no help any more). With two or three cups: 2. With four, in the book:
 * 2 at the start of plus & minus, then one more every third level, and none from the divide chapter on; in the endless game and the daily ladder: 2 on the
 * first level, one more every level, and none from the ninth. Each help perk of the daily challenge takes one off.
 */
export function helpGap(g: GameState): number {
  if (g.cols.length <= 3) return 2;
  const perks = g.perks.filter((p) => p === "help").length;
  let gap: number;
  if (isLevelMode(g.mode)) {
    const place = bookPlace(g.mode, g.stage);
    const from = bookPlace("mixed", 1);
    if (place >= bookPlace("divide", 1)) return Infinity;
    gap = 2 + Math.max(0, Math.floor((place - from) / 3));
  } else if (g.mode === "endless") {
    const level = endlessLevel(g);
    if (level >= 9 && perks === 0) return Infinity;
    gap = 1 + level;
  } else return Infinity;
  return Math.max(1, gap - perks);
}


// ---- Creating and restarting ----------------------------------------------------------

/** The columns of a mode: three in the first two chapters (so only three cups), four everywhere else. */
export function columnsFor(mode: Mode, stage = 3): readonly number[] {
  // (the first chapter starts with two cups, on the first two levels, and has three from the third level; the other chapters have four)
  if (mode === "plus") return stage <= 2 ? TWO_COLS : PLUS_COLS;
  if (mode === "minus") return PLUS_COLS;
  return COLS;
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
    saucerLoadout: [],
    daily: false,
    perks: [],
    perkChoices: [],
    perkTimes: [],
    speedMul: 1,
    tutorialStep: 0,
    tutorialDelay: 0,
    tutorialNote: "",
    slow: 0,
    wand: 0,
    shieldX: W / 2,
    shieldY: SHIELD_AREA.y1,
    shieldW: SHIELD_W0,
    shieldGrew: 99,
    shieldPower: 0,
    jetWeapons: {a: null, b: null, c: null},
    jetLv: {a: 0, b: 0, c: 0},
    jetBase: 1,
    jetDecay: 0,
    jetDown: 99,
    jetBeam: null,
    jetFlame: false,
    shipHp: 3,
    shipHurt: 0,
    jetShield: false,
    jetStun: 0,
    jetHeld: false,
    fuel: 1,
    fuelOut: false,
    enemyShots: [],
    craftTo: null,
    craftTrail: [],
    jetFire: 0,
    jetMissileFire: 0,
    shots: [],
    jetGot: 99,
    jetGotKind: "weapon",
    jetGotWeapon: null,
    bossLevel: 0,
    snakeBuilt: -1,
    snakeEnd: W / 2,
    snakeBack: 0,
    snakeSlow: 0,
    snakeRecoil: 0,
    snakeStun: 0,
    snakeHearts: 0,
    snakeBoost: 0,
    snakeFastT: 99,
    reverse: 0,
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
    dailyIntro: 0,
    shake: 0,
    time: 0,
    nextId: 1,
    events: [],
    rng,
    combo: 0,
    comboTimer: 0,
    drain: 0,
    drainClock: 0,
    variant: null,
    variantTime: 0,
    countdown: 0,
    mixRung: 0,
    helpDue: false,
    sinceHelp: 2,
    findTimer: 0,
    findTotal: 0,
    findAnswer: -1,
    continuesLeft: 0,
    screens: 0,
    screenWon: false,
    eraserWon: false,
    erasers: 0,
    erase: 0,
    dailyMix: null,
    dailyDay: "",
    landed: {},
    sweep: -1,
    lifeDue: false,
    intro: [],
    hideIntros: new Set(),
  };
  // The menu shows four cups with some coffee in them, steaming.
  resetCups(g, [2, 5, 7, 9]);
  return g;
}

function makeCup(g: GameState, x: number, value = 0): Cup {
  return {
    id: g.nextId++,
    x,
    y: CUP_START_Y,
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
    seed: g.rng() * 10,
  };
}

function resetCups(g: GameState, values?: number[]): void {
  g.cups = g.cols.map((x, i): Cup => makeCup(g, x, values?.[i] ?? 0));
}

/** The cups from the shop (not in the tutorial) go on the cups: the first one chosen stands furthest to the left. A thermos starts with its shield on. The saucers go under them. */
function dressCups(g: GameState): void {
  if (g.mode === "tutorial") return;
  g.cups.forEach((c, i) => dressCup(g, c, i));
}

function dressCup(g: GameState, c: Cup, index: number): void {
  c.kinds = [...(g.loadout[index] ?? [])];
  c.saucer = g.saucerLoadout[index] ?? undefined;
  c.charge = 0;
  if (c.kinds.includes("thermos")) c.shield = true;
}

/** Back to the book: no round going, the cups steaming on the desk behind it. */
export function showMenu(g: GameState): void {
  g.phase = "menu";
  g.intro = [];
  g.lifeDue = false;
  g.combo = 0;
  g.comboTimer = 0;
  g.drain = 0;
  g.drainClock = 0;
  g.sweep = -1;
  g.zap = null;
  g.cols = COLS;
  g.numbers = [];
  g.banner = 0;
  g.shake = 0;
  g.slow = 0;
  g.wand = 0;
  g.reverse = 0;
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
  g.perkTimes = [];
  g.variant = null;
  g.variantTime = 0;
  g.dailyIntro = 0;
  resetShield(g);
  g.countdown = 0;
  g.findTimer = 0;
  g.findAnswer = -1;
  g.speedMul = 1;
  g.stage = isLevelMode(mode) ? Math.min(STAGES, Math.max(1, stage)) : 0;
  g.base = baseFor(mode, g.stage);
  g.tutorialStep = 0;
  g.tutorialDelay = 0;
  g.tutorialNote = "";
  g.phase = "play";
  g.intro = [];
  g.screenWon = false;
  g.eraserWon = false;
  g.erase = 0;
  g.landed = {};
  g.continuesLeft = mode === "tutorial" ? 0 : 1;
  g.lifeDue = false;
  g.combo = 0;
  g.comboTimer = 0;
  g.drain = 0;
  g.drainClock = 0;
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
  g.wand = 0;
  g.reverse = 0;
  g.pause = 0;
  g.cols = columnsFor(mode, g.stage);
  g.bonusTimer = nextBonusIn(g);
  resetCups(g);
  dressCups(g);
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

/** The match modes in the order the even rungs of the daily ladder play them on a day (a random order, the same for everyone that day). */
export function dailyMixesOf(day: string = dayKey()): Variant[] {
  const list: Variant[] = ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake"];
  const rng = seededRandom(seedOfDay(day) ^ 0x5bd1e995);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** How many seconds the title with the match mode of the day is shown when the daily ladder starts. */
export const DAILY_INTRO = 2.6;

/** The rung of the daily ladder that is played as usual (with no match mode): every other rung has a match mode of its own. */
export const DAILY_PLAIN_RUNG = 3;

/** Whether a rung of the daily ladder is played with a match mode: all of them are (the whole ladder is the match mode of the day). */
export function dailyMixed(_rung: number): boolean {
  return true;
}

/** The match mode of a day: one, picked at random (the same for everyone that day), for every rung of the whole ladder. */
export function dailyMixOf(day: string = dayKey(), _rung = 1): Variant {
  return dailyMixesOf(day)[0];
}

/** The match mode the daily ladder is being played with right now (on every rung but the third), or null. */
function mixNow(g: GameState): Variant | null {
  if (!g.daily || !g.dailyDay) return null;
  const rung = endlessLevel(g);
  return dailyMixed(rung) ? dailyMixOf(g.dailyDay, rung) : null;
}

/** Starts the daily challenge of a day: the endless game, with random numbers that are the same for everyone on that day. */
export function startDaily(g: GameState, day: string = dayKey()): void {
  g.rng = seededRandom(seedOfDay(day));
  startGame(g, "endless");
  g.daily = true;
  // (every other rung is played as one of the match modes: which one goes with the day)
  g.dailyDay = day;
  g.dailyMix = dailyMixOf(day);
  g.dailyIntro = DAILY_INTRO; // (the title with the match mode of the day)
  g.mixRung = 0;
  // The ladder starts with two cups: a third comes after the first rung, and a fourth after the third.
  g.cols = dailyColumns(1);
  resetCups(g);
  dressCups(g);
  g.bonusTimer = nextBonusIn(g);
}

/**
 * Starts a match mode: the endless game, with rules of its own. No new kinds of number and no bonus balls (so no hearts and no pull-down screens) come in either.
 * In "save" every cup is a regular one (nothing from the shop), and one of the four is dead from the start; there is no carrying on after an ad.
 * In "sixeight" (Even numbers) the cups and saucers from the shop are on.
 */
export function startVariant(g: GameState, variant: Variant): void {
  startGame(g, "endless");
  g.variant = variant;
  g.screens = 0;
  g.bonusTimer = nextBonusIn(g);
  // (Defend the cups starts with the presentation of the skull, unless it has been hidden)
  // (Fast fingers starts with a count down: 3, 2, 1, 0.6 seconds each)
  if (variant === "fast" || variant === "find" || variant === "jet" || variant === "comet" || variant === "snake") g.countdown = FAST_COUNT * 3;
  if (variant === "defend" && !g.hideIntros.has("skull")) {
    g.intro = ["skull"];
    g.phase = "intro";
  }
  // (Sequence 10 is plain cups only: a big cup, a magnet or a saucer would make other sums count)
  if (variant === "find") {
    for (const c of g.cups) {
      c.kinds = [];
      c.saucer = undefined;
      c.shield = false;
      c.charge = 0;
    }
  }
  if (variant === "shield") resetShield(g);
  if (variant === "save") {
    g.continuesLeft = 0;
    for (const c of g.cups) {
      c.kinds = [];
      c.saucer = undefined;
      c.shield = false;
      c.charge = 0;
    }
    const dead = g.cups[Math.floor(g.rng() * g.cups.length)];
    dead.dead = true;
    dead.value = TARGET + 1;
  }
}

/** The columns (and so the cups) of the daily challenge on a rung of the ladder: two on the first, three on the next two, and four after that. */
export function dailyColumns(rung: number): readonly number[] {
  return rung <= 1 ? TWO_COLS : rung <= 3 ? PLUS_COLS : COLS;
}

/**
 * The ladder has been climbed one rung, and there is room for one more cup: the cups that are there move over, and a new one comes in on the
 * right (with what it is to have from the shop, and the saucer). The numbers in the air go to the columns that are there now.
 */
function growCups(g: GameState): void {
  const cols = dailyColumns(endlessLevel(g));
  if (cols.length <= g.cols.length) return;
  const added = cols.length - g.cols.length;
  g.cols = cols;
  const sorted = [...g.cups].sort((a, b) => a.x - b.x);
  sorted.forEach((c, i) => {
    c.x = cols[i];
  });
  for (let k = 0; k < added; k++) {
    const at = sorted.length + k;
    const cup = makeCup(g, cols[at]);
    dressCup(g, cup, g.cups.length);
    cup.flash = 1;
    cup.bump = 1;
    cup.ripple = 1;
    g.cups.push(cup);
  }
  for (const n of g.numbers) {
    if (n.state !== "fall") continue;
    n.col = Math.min(n.col, cols.length - 1);
    n.x = cols[n.col];
    n.aim = n.x;
  }
}

/** The perks that can be offered now: the ones that would do something, and have not been taken as many times as they can be. */
function perkOptions(g: GameState): PerkId[] {
  const living = g.cups.filter((c) => !c.dead);
  return PERKS.filter((p) => {
    if (g.perks.filter((q) => q === p).length >= PERK_LIMIT[p]) return false;
    if (p === "shield") return living.some((c) => !c.shield);
    if (p === "cloth") return g.screens < SCREEN_MAX;
    if (p === "life") return g.cups.some((c) => c.dead);
    if (p === "remove") return g.cups.some((c) => c.dead) && living.length > 0;
    if (p === "gold" || p === "thermos" || p === "magnet" || p === "big" || p === "laser") return living.some((c) => !c.kinds.includes(p));
    return true;
  });
}

/** Takes the perk that was chosen (0 to 2 of the three on offer), and the round goes on. */
export function choosePerk(g: GameState, index: number): boolean {
  const perk = g.perkChoices[index];
  if (g.phase !== "perk" || perk === undefined) return false;
  // (sometimes a perk is offered as x2 or x3: it is taken that many times, so that x2 of the shield puts a shield on two cups)
  const times = Math.max(1, g.perkTimes[index] ?? 1);
  for (let i = 0; i < times; i++) g.perks.push(perk);
  g.perkChoices = [];
  g.perkTimes = [];
  g.phase = "play";
  for (let i = 0; i < times; i++) applyPerk(g, perk);
  if (g.daily) growCups(g);
  return true;
}

/** What a perk does, once. */
function applyPerk(g: GameState, perk: PerkId): void {
  if (perk === "slow") g.speedMul *= PERK_SLOWER;
  else if (perk === "cloth") giveScreens(g, 1);
  else if (perk === "shield") {
    const cup = g.cups.find((c) => !c.dead && !c.shield);
    if (cup) {
      cup.shield = true;
      cup.flash = 0.6;
      g.events.push({t: "shield", cupId: cup.id, x: cup.x, y: cup.y - CUP_H / 2, on: true});
    }
  } else if (perk === "remove") {
    // A dead cup is taken away: nothing can fall into it any more (the numbers of its column go to the cups that are left).
    const at = g.cups.findIndex((c) => c.dead);
    if (at >= 0 && g.cups.some((c) => !c.dead)) g.cups.splice(at, 1);
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
}

/** How many times a perk can be taken at most right now (x2 of the shield needs two cups that have none). */
function perkMax(g: GameState, perk: PerkId): number {
  const living = g.cups.filter((c) => !c.dead);
  const dead = g.cups.filter((c) => c.dead).length;
  if (perk === "shield") return living.filter((c) => !c.shield).length;
  if (perk === "cloth") return SCREEN_MAX - g.screens;
  if (perk === "life" || perk === "remove") return dead;
  if (perk === "gold" || perk === "thermos" || perk === "magnet" || perk === "big" || perk === "laser") return living.filter((c) => !c.kinds.includes(perk)).length;
  return PERK_LIMIT[perk] - g.perks.filter((q) => q === perk).length;
}

/** Now and then a perk is offered as x2 (about one in four) or x3 (about one in twelve), as far as it can be used that many times. */
function rollTimes(g: GameState, perk: PerkId): number {
  const r = g.rng();
  const want = r < 0.08 ? 3 : r < 0.3 ? 2 : 1;
  return Math.max(1, Math.min(want, perkMax(g, perk)));
}

/** Three perks to choose between (as many as there are, if there are fewer). */
function offerPerks(g: GameState): void {
  const options = perkOptions(g);
  const choices: PerkId[] = [];
  while (choices.length < 3 && options.length > 0) choices.push(options.splice(Math.floor(g.rng() * options.length), 1)[0]);
  if (choices.length === 0) return;
  // With a bit of luck one of them is a special perk (the ones the saucers have): it takes the place of one of the others.
  if (g.rng() < SPECIAL_PERK_CHANCE) {
    const special = SPECIAL_PERKS.filter((p) => perkMax(g, p) > 0);
    if (special.length > 0) choices[Math.floor(g.rng() * choices.length)] = special[Math.floor(g.rng() * special.length)];
  }
  g.perkChoices = choices;
  g.perkTimes = choices.map((p) => rollTimes(g, p));
  g.phase = "perk";
  g.overTimer = 0;
}

/** Adds new kinds of number to the ones that are to be made to fall a few seconds from now (the screen and the fourth cup do not fall, so they are left out). */
function planShowcase(g: GameState, features: Feature[]): void {
  const list = features.filter((f) => f !== "screen" && f !== "cups" && f !== "cup3" && f !== "fade");
  if (list.length === 0) return;
  if (g.showcase.length === 0) g.showTimer = 3 + g.rng() * 2;
  g.showcase = [...g.showcase, ...list];
}

/** The kinds that are bonus balls (their names are the same as the bonus kinds). */
const BONUS_FEATURES: Feature[] = ["life", "points", "slow", "pause", "bomb", "cloth", "shield", "star", "diamond", "wand", "reverse"];

/** Makes one of the new kinds fall now, in a free column (false if there is no room for it just now: it is tried again soon). */
function spawnShowcase(g: GameState, f: Feature): boolean {
  if (BONUS_FEATURES.includes(f)) return spawnBonus(g, f as Bonus);
  const free = g.cols.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < spawnY(g) + 96));
  if (free.length === 0) return false;
  if (f === "vchain") {
    spawnHangingPair(g, free[Math.floor(g.rng() * free.length)]);
    return true;
  }
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
  if (f === "ghost") {
    n.ghost = g.rng() < 0.5 ? "flip" : "fade";
    n.phase = -g.time; // it starts out seen
  }
  g.numbers.push(n);
  return true;
}

function giveErasers(g: GameState, n: number): void {
  const before = g.erasers;
  g.erasers = Math.min(ERASER_MAX, g.erasers + n);
  if (g.erasers !== before) g.events.push({t: "erasers", n: g.erasers});
}

/** Takes an eraser: for as long as slow motion lasts, every number that is tapped pops. False if there is none, or one is already in use. */
export function useEraser(g: GameState): boolean {
  if (g.phase !== "play" || g.zap || g.erasers <= 0 || g.erase > 0 || g.mode === "tutorial") return false;
  g.erasers -= 1;
  g.erase = SLOW_SECONDS;
  g.events.push({t: "erasers", n: g.erasers});
  return true;
}

function giveScreens(g: GameState, n: number): void {
  const before = g.screens;
  g.screens = Math.min(SCREEN_MAX, g.screens + n);
  if (g.screens !== before) g.events.push({t: "screens", n: g.screens});
}

/** The magic wand is waved: every number that is falling becomes a +1 (minus numbers, "times", "divided by", the 0 and the 10 too; a steel number stays steel, as a 1). The bonus balls and the skulls are left alone. */
function wave(g: GameState): void {
  for (const n of g.numbers) {
    if (n.bonus || n.state !== "fall" || n.op === "skull" || n.op === "trap" || n.wanded) continue;
    // (each number becomes a 0 (70%) or a 10 (30%), once)
    n.wanded = true;
    if (g.rng() < 0.7) {
      n.op = "zero";
      n.v = 0;
    } else {
      n.op = "ten";
      n.v = TARGET;
    }
  }
}

/**
 * Pulls the screen down: it comes down from the ceiling and wipes away every number that is falling (not the ones that have
 * been tapped and are on their way into a cup, and not the bonus balls), then stays a moment and rolls up again.
 * False if there is none to pull down, or it is not time for one.
 */
export function useScreen(g: GameState): boolean {
  if (g.mode === "tutorial") {
    // The cloth of the tutorial is only there to be tried on its fifth step, and costs nothing (the screens the player has are left alone).
    if (g.phase !== "play" || g.zap || g.sweep >= 0 || g.tutorialStep !== 4 || g.tutorialNote) return false;
    g.sweep = 0;
    g.events.push({t: "sweep"});
    return true;
  }
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
  if (g.intro.includes("eraser") && g.erasers === 0) giveErasers(g, 1);
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
  g.wand = 0;
  g.reverse = 0;
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
  const {minus, onlyMinus, times: timesOn, div: divOn} = kinds(g);
  // (the sign of a new number: always minus in the minus chapter, otherwise sometimes, where minus numbers are in)
  const signed = (v: number) => (onlyMinus || (minus && g.rng() < minusChance(g)) ? -v : v);
  // Blue numbers only fall when there is something to multiply: a cup on 0 stays on 0.
  const times = timesOn && g.cups.some((c) => !c.dead && c.value !== 0);
  // Yellow numbers only fall when a cup has enough in it for the division to change it.
  const div = divOn && g.cups.some((c) => !c.dead && Math.abs(c.value) >= 2);
  // Often a number that finishes one of the cups (at 10, or at minus 10 when minus numbers are in, or by
  // multiplying), or that saves a cup that is nearly full by dividing it: the game is about choosing, not about luck.
  // After a number has landed, one number that finishes a cup comes, with at least helpGap(g) other numbers between two such helps: often with two or
  // three cups and on the first levels with four, less and less often after that, and not at all further on.
  const gap = helpGap(g);
  const helpNow = g.helpDue && g.sinceHelp >= gap;
  g.sinceHelp += 1;
  if (helpNow) {
    g.helpDue = false;
    g.sinceHelp = 0;
  }
  if (helpNow) {
    const finishing: Pick[] = [];
    for (const c of g.cups) {
      if (c.dead) continue;
      const up = TARGET - c.value;
      if (!onlyMinus && up >= 1 && up <= max) finishing.push({v: up, op: "add"});
      const down = -TARGET - c.value;
      if (minus && down <= -1 && down >= -max) finishing.push({v: down, op: "add"});
      if (times) for (let f = 2; f <= maxFactor(g); f++) if (Math.abs(c.value * f) === TARGET) finishing.push({v: f, op: "mul"});
      if (div && Math.abs(c.value) >= 6) for (let f = 2; f <= maxDivisor(g); f++) if (c.value % f === 0) finishing.push({v: f, op: "div"});
    }
    if (finishing.length > 0) return finishing[Math.floor(g.rng() * finishing.length)];
  }
  // From the level that presents it, an orange 0 sometimes falls (when a living cup has something in it that is worth wiping out).
  if (featureAge(g, "zero") >= 0 && g.cups.some((c) => !c.dead && Math.abs(c.value) >= 4) && g.rng() < ZERO_CHANCE * luck(g)) return {v: 0, op: "zero"};
  // From the level that presents it, an orange 10 sometimes falls (when a living cup is low enough for it to be worth a lot): it sets the cup to 10.
  if (featureAge(g, "ten") >= 0 && g.cups.some((c) => !c.dead && Math.abs(c.value) <= 5) && g.rng() < TEN_CHANCE * luck(g)) return {v: TARGET, op: "ten"};
  // From the last chapter's level 4, a black number sometimes falls: it adds like any plus or minus number.
  if (featureAge(g, "fog") >= 0 && g.rng() < fogChance(g)) {
    return {v: signed(1 + Math.floor(g.rng() * max)), op: "dim"};
  }
  // From the level that presents it, a skull sometimes falls: tap it and it pops, but in a cup it kills the cup.
  if (allowSteel && featureAge(g, "skull") >= 0 && g.rng() < Math.min(0.15, 0.08 + 0.01 * featureAge(g, "skull"))) {
    return {v: 99, op: "skull"};
  }
  // From the level that presents it, a steel number sometimes falls: a small number (1 to 3) that cannot be tapped, only let go down.
  if (allowSteel && featureAge(g, "steel") >= 0 && g.rng() < steelChance(g)) {
    return {v: signed(1 + Math.floor(g.rng() * 3)), op: "steel"};
  }
  if (times && g.rng() < mulChance(g)) return {v: 2 + Math.floor(g.rng() * (maxFactor(g) - 1)), op: "mul"};
  if (div && g.rng() < divChance(g)) return {v: 2 + Math.floor(g.rng() * (maxDivisor(g) - 1)), op: "div"};
  return {v: signed(1 + Math.floor(g.rng() * max)), op: "add"};
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
  if (plain || pick.op === "steel") return n;
  if (pick.op === "skull") {
    const ice = iceChance(g);
    if (ice > 0 && g.rng() < ice * 0.6) n.ice = ICE_HITS;
    return n;
  }
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

/** How far apart (game units) the two numbers of a hanging pair start: the one that is lower comes first. */
const HANG_GAP = 62;

/** Two small numbers (1 to 3, with the sign of the chapter) on a chain, one above the other, in a column. */
function spawnHangingPair(g: GameState, col: number): void {
  const {minus, onlyMinus} = kinds(g);
  const small = () => {
    const v = 1 + Math.floor(g.rng() * 3);
    return onlyMinus || (minus && g.rng() < minusChance(g)) ? -v : v;
  };
  const low = newNumber(g, col, g.cols[col], small());
  const high = newNumber(g, col, g.cols[col], small());
  high.y -= HANG_GAP;
  high.prevY = high.y;
  low.chain = high.id;
  high.chain = low.id;
  g.numbers.push(low, high);
}

/**
 * The numbers of a match mode: Save the cup has only 1s in any column (a 1 over the dead cup cannot be saved by a tap: the dead cup has to be moved away, by dragging
 * it to swap places with another cup), and after its third level some of them are steel (which cannot be tapped at all). Even numbers has only 2s, 4s and 8s
 * (four in ten of what falls, the three about as often), "times 2" (a quarter) and "divided by 2" (the rest); after its third level some are steel too (a 2 or a 4),
 * and after its fourth "times 4" and "divided by 4" join the 2s (four in ten of those).
 */
const SAVE_STEEL_FROM = 4;
const EVEN_STEEL_FROM = 4;
const EVEN_FOUR_FROM = 5;
function spawnVariant(g: GameState, free: number[], variant: Variant): void {
  let col = free[Math.floor(g.rng() * free.length)];
  if (variant === "defend") {
    spawnDefend(g, col);
    return;
  }
  if (variant === "fast") {
    spawnFast(g, col);
    return;
  }
  if (variant === "shield") {
    spawnShieldMode(g, col);
    return;
  }
  if (variant === "jet") {
    spawnJet(g, col);
    return;
  }
  if (variant === "comet") {
    spawnComet(g);
    return;
  }
  if (variant === "snake") return; // (the snake sets out its own train: see updateSnake)
  if (variant === "ice") {
    // Ice world: every number is frozen in ice (it has to be cracked free before it can be sent down): plus numbers at first, minus numbers too from the
    // third level, and blue "times" numbers too from the fifth.
    const level = endlessLevel(g);
    const v = 1 + Math.floor(g.rng() * 4); // (small numbers: 1 to 4)
    const n = level >= 5 && g.rng() < 0.2 ? newNumber(g, col, g.cols[col], 2, "mul") : newNumber(g, col, g.cols[col], level >= 3 && g.rng() < 0.4 ? -v : v);
    n.ice = ICE_HITS;
    n.thin = true; // (thin ice: it looks whole, but one tap breaks it)
    g.numbers.push(n);
    return;
  }
  if (variant === "save") {
    const level = endlessLevel(g);
    const steel = level >= SAVE_STEEL_FROM && g.rng() < Math.min(0.2, 0.1 + 0.02 * (level - SAVE_STEEL_FROM));
    g.numbers.push(newNumber(g, col, g.cols[col], 1, steel ? "steel" : "add"));
    return;
  }
  const level = endlessLevel(g);
  if (level >= EVEN_STEEL_FROM && g.rng() < Math.min(0.2, 0.1 + 0.02 * (level - EVEN_STEEL_FROM))) {
    g.numbers.push(newNumber(g, col, g.cols[col], g.rng() < 0.5 ? 2 : 4, "steel"));
    return;
  }
  const r = g.rng();
  // (from the fifth level the factor of "times" and "divided by" is sometimes 4)
  const factor = () => (level >= EVEN_FOUR_FROM && g.rng() < 0.4 ? 4 : 2);
  // (most of what falls is a 2: a 10 always needs one, since 4, 8, times and halves alone never make it)
  if (r < 0.6) g.numbers.push(newNumber(g, col, g.cols[col], r < 0.45 ? 2 : r < 0.53 ? 4 : 8));
  else if (r < 0.78) g.numbers.push(newNumber(g, col, g.cols[col], factor(), "mul"));
  else g.numbers.push(newNumber(g, col, g.cols[col], factor(), "div"));
}

function spawn(g: GameState): void {
  // (Find the Perfect 10 sets out its own puzzles: see update)
  if (g.variant === "find") return;
  // (Fast fingers comes in waves, not one number at a time)
  if (g.variant === "fast" || mixNow(g) === "fast") {
    spawnFastWave(g);
    return;
  }
  const free = g.cols.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < spawnY(g) + 96));
  if (free.length === 0) return;
  if (g.variant) {
    spawnVariant(g, free, g.variant);
    return;
  }
  // The daily ladder: every other rung (the second, the fourth and the sixth) is played with the numbers of today's match mode.
  const mix = mixNow(g);
  if (mix) {
    spawnVariant(g, free, mix);
    return;
  }
  // Sometimes two small numbers come on a chain one above the other, in one column (they fall into the same cup).
  const vchain = vchainChance(g);
  if (vchain > 0 && g.rng() < vchain) {
    spawnHangingPair(g, free[Math.floor(g.rng() * free.length)]);
    return;
  }
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
  if (g.variant || mixNow(g)) return 1e9; // (no bonus balls in the match modes, nor in the daily ladder)
  return ((11 + g.rng() * 9) * 0.6 ** g.perks.filter((p) => p === "bonus").length) / luck(g);
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
  if (featureAge(g, "wand") >= 0) options.push({kind: "wand", weight: 0.3});
  if (featureAge(g, "reverse") >= 0) options.push({kind: "reverse", weight: 0.25});
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
    amount = scaled(g, BONUS_POINTS * g.level);
    g.score += amount;
  }
  if (kind === "slow") g.slow = SLOW_SECONDS;
  if (kind === "wand") {
    g.wand = SLOW_SECONDS;
    wave(g);
  }
  if (kind === "reverse") g.reverse = SLOW_SECONDS;
  if (kind === "pause") g.pause = PAUSE_SECONDS;
  if (kind === "cloth") {
    if (g.screens < SCREEN_MAX) giveScreens(g, 1);
    else {
      kind = "points"; // no room for another one (it was got some other way meanwhile): points instead
      amount = scaled(g, BONUS_POINTS * g.level);
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
      amount = scaled(g, BONUS_POINTS * g.level);
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
    amount = scaled(g, amount);
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
  if (jetOn(g) || cometOn(g)) return false; // (the jet and the ship are flown: nothing falling is tapped)
  if (snakeOn(g)) return tapSnake(g, x, y, skip);
  // Sequence 10: a tap on a number makes it fall into the cup under its column (the order the numbers are tapped in is the sequence).
  if (findOn(g)) {
    let best: NumberTile | undefined;
    let bd = TAP_RADIUS * 1.3;
    for (const n of g.numbers) {
      if (n.state !== "fall" || n.hover === undefined || skip?.has(n.id)) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (!best) return false;
    skip?.add(best.id);
    best.hover = undefined;
    const cup = cupOfColumn(g, best.col);
    if (cup && !cup.dead) startDive(g, best, cup.id, cup.x);
    else startDive(g, best, null, best.x);
    return true;
  }
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
  // An eraser is in use: the number pops, and is gone (a chain it is on lets go of it).
  if (g.erase > 0) {
    for (const m of g.numbers) {
      if (m.chain === hit.id) m.chain = null;
      if (m.chain2 === hit.id) m.chain2 = null;
    }
    hit.done = true;
    g.numbers = g.numbers.filter((m) => m !== hit);
    g.events.push({t: "pop", x: hit.x, y: hit.y});
    return true;
  }
  // (Shield up: the steel skulls cannot be tapped, only the shield takes them: a tap only goes "clink", like on a steel number)
  if (hit.op === "skull" && shieldOn(g)) {
    g.events.push({t: "steel", x: hit.x, y: hit.y});
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
    hit.ice = hit.thin ? 0 : hit.ice - 1;
    g.events.push({t: "ice", x: hit.x, y: hit.y, broke: hit.ice === 0});
    return true;
  }
  // The skull of Defend the cups: a tap pops it (it is gone, and a few points are got).
  // The trap skull of Fast fingers (red ring): a tap makes it fall, into the cup under it (which it kills). It has to be left alone.
  if (hit.op === "trap") {
    hit.hover = undefined;
    startDive(g, hit, null, hit.x);
    return true;
  }
  if (hit.op === "skull") {
    g.numbers = g.numbers.filter((m) => m !== hit);
    g.score += scaled(g, 2 * g.level);
    g.events.push({t: "skull", x: hit.x, y: hit.y});
    return true;
  }
  // The reverse is on: the number flies up and away instead (a chain it is on lets go of it).
  if (g.reverse > 0) {
    for (const m of g.numbers) {
      if (m.chain === hit.id) m.chain = null;
      if (m.chain2 === hit.id) m.chain2 = null;
    }
    hit.chain = null;
    hit.chain2 = null;
    hit.state = "rise";
    hit.target = null;
    hit.hang = null;
    hit.speed = -DIVE_HOP;
    hit.tilt = g.rng() < 0.5 ? -1 : 1;
    g.events.push({t: "tap"});
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
        // (a number that hangs below the tapped one, on a vertical chain, does not wait for the chain to go taut: it falls ahead of it)
        if (mate.y > cur.y + 20) mate.hang = null;
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
 * Defend the cups: seven in ten of what falls is the skull (tap it and it pops; in a cup it kills it), and the other half is numbers: plus numbers at first,
 * minus numbers too from the third level, and blue "times" numbers too from the fifth.
 */
// ---- Find the Perfect 10 ---------------------------------------------------------------

/** How many seconds a puzzle of Find the Perfect 10 gives at first, and at the least (it gets shorter and shorter). */
const FIND_START = 15;
const FIND_MIN = 6;

/** How long the next puzzle may take: from fifteen seconds down to six, with the seconds of the round. */
export function findTime(g: GameState): number {
  return Math.max(FIND_MIN, FIND_START - g.variantTime / 20);
}

/** What a column of numbers comes to, done from the top down, starting from 0 (like numbers falling into an empty cup one after the other). */
export function columnValue(list: {v: number; op: Op}[]): number {
  let v = 0;
  for (const n of list) v = valueAfter({value: v} as Cup, n as NumberTile);
  return v;
}

/** The numbers of one column of a puzzle: 2 of them at first, 3 from the third level and 4 from the sixth; minus numbers from the third, "times 2" from the fifth. */
function findColumn(g: GameState, level: number): {v: number; op: Op}[] {
  const count = level >= 6 ? 4 : level >= 3 ? 3 : 2;
  const list: {v: number; op: Op}[] = [];
  for (let i = 0; i < count; i++) {
    if (level >= 5 && i > 0 && g.rng() < 0.25) list.push({v: 2, op: "mul"});
    else {
      const v = 1 + Math.floor(g.rng() * 7);
      list.push({v: level >= 3 && i > 0 && g.rng() < 0.35 ? -v : v, op: "add"});
    }
  }
  return list;
}

/**
 * A new puzzle of Sequence 10: a column of numbers over every living cup, standing still, and the cups empty. At least one column makes 10 when its numbers
 * are tapped from the top down (more can: any way that makes a perfect 10 counts). Tap the numbers to send them into the cup under them; a perfect 10 brings
 * the next puzzle. Over 10 and the cup dies, as always; and with no perfect 10 in time (or no numbers left to tap), a cup dies.
 */
function newFindPuzzle(g: GameState): void {
  g.numbers = [];
  const level = endlessLevel(g);
  const alive = g.cols.map((_, i) => i).filter((i) => g.cups.some((c) => !c.dead && Math.abs(c.x - g.cols[i]) < 20));
  if (alive.length === 0) return;
  for (const c of g.cups) if (!c.dead) c.value = 0;
  const answer = alive[Math.floor(g.rng() * alive.length)];
  for (const c of alive) {
    let list = findColumn(g, level);
    if (c === answer) {
      // (the last number is what is missing up to 10: drawn again until it is a number that can come)
      for (let tries = 0; tries < 200; tries++) {
        const head = list.slice(0, -1);
        const missing = TARGET - columnValue(head);
        if (missing !== 0 && Math.abs(missing) <= 9 && (missing > 0 || level >= 3)) {
          list = [...head, {v: missing, op: "add"}];
          break;
        }
        list = findColumn(g, level);
      }
    }
    list.forEach((it, i) => {
      const n = newNumber(g, c, g.cols[c], it.v, it.op);
      n.y = 120 + i * 64; // (a bit down from the top, clear of the score and the clock)
      n.prevY = n.y;
      n.hover = 1e9; // (they stand still until they are tapped)
      g.numbers.push(n);
    });
  }
  g.findAnswer = g.level; // (the level the puzzle started at: a perfect 10 makes it go up)
  g.findTotal = findTime(g);
  g.findTimer = g.findTotal;
}

/** The cup under a column. */
function cupOfColumn(g: GameState, col: number): Cup | undefined {
  return g.cups.find((c) => Math.abs(c.x - g.cols[col]) < 20);
}

/** No perfect 10 in time (or nothing left to tap): a cup dies (the one with the most in it), and the next puzzle comes (or the round is over). */
function failFind(g: GameState): void {
  for (const n of g.numbers) g.events.push({t: "pop", x: n.x, y: n.y});
  g.numbers = [];
  const alive = g.cups.filter((c) => !c.dead);
  const victim = alive.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  if (victim) {
    victim.dead = true;
    victim.value = TARGET + 1;
    g.shake = Math.max(g.shake, 0.7);
    g.events.push({t: "bust", cupId: victim.id});
  }
  if (g.cups.every((c) => c.dead) || g.variant === "find") {
    endGame(g, "allDead");
    return;
  }
  if (findOn(g)) newFindPuzzle(g);
}

/** Find the Perfect 10 is being played: the match mode, or an even rung of the daily ladder on a day of it. */
function findOn(g: GameState): boolean {
  return g.variant === "find" || mixNow(g) === "find";
}

/** Fast fingers: the seconds of each step of the count down, and how long a number hangs still at first and at the most (it gets shorter and shorter). */
export const FAST_COUNT = 0.6;
const FAST_HOVER_START = 2.6;
const FAST_HOVER_MIN = 0.9;

/** How long a new number of Fast fingers hangs still in the air: shorter and shorter with the seconds of the round. */
export function fastHover(g: GameState): number {
  return Math.max(FAST_HOVER_MIN, FAST_HOVER_START - g.variantTime / 40);
}

/**
 * Fast fingers: an orange 10 or an orange 0, or a skull, comes up somewhere in the air and hangs still there for a moment. Tap the 10 and it goes into a
 * cup (a perfect 10); a 0 empties the cup it goes into. If nobody taps them they pop and are gone, but a skull that is not popped in time falls, and kills
 * the cup it lands in. More and more skulls come.
 */
function spawnFast(g: GameState, col: number, y: number = 40 + g.rng() * 260): void {
  // (a skull that has to be popped, a trap skull with a red ring that must be left alone, a 10 or a 0: more skulls as the round goes on)
  const skulls = Math.min(0.45, 0.25 + g.variantTime / 200);
  const traps = Math.min(0.25, 0.12 + g.variantTime / 300);
  const r = g.rng();
  const n =
    r < skulls
      ? newNumber(g, col, g.cols[col], 99, "skull")
      : r < skulls + traps
        ? newNumber(g, col, g.cols[col], 99, "trap")
        : g.rng() < 0.7
          ? newNumber(g, col, g.cols[col], TARGET, "ten")
          : newNumber(g, col, g.cols[col], 0, "zero");
  n.y = y;
  n.prevY = n.y;
  n.hover = fastHover(g);
  g.numbers.push(n);
}

/** How many come at once in a wave of Fast fingers: two at first, and more and more (up to eight). */
export function fastWave(g: GameState): number {
  return Math.min(8, 2 + Math.floor(g.variantTime / 12));
}

/** A wave of Fast fingers: several at once, each in its own place (a column and a height), and the next wave only when they are all gone. */
function spawnFastWave(g: GameState): void {
  if (g.numbers.some((n) => n.hover !== undefined)) return;
  const slots: [number, number][] = [];
  for (let c = 0; c < g.cols.length; c++) for (const y of [60, 160, 260]) slots.push([c, y]);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(g.rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  let count = fastWave(g);
  // (later on, a 10 or a 0 sometimes comes on a chain with a red skull beside it: send the number down and the skull goes with it)
  if (g.variantTime >= FAST_CHAIN_FROM && g.cols.length >= 2 && g.rng() < 0.45) {
    const c = Math.floor(g.rng() * (g.cols.length - 1));
    const y = [60, 160, 260][Math.floor(g.rng() * 3)];
    const num = g.rng() < 0.7 ? newNumber(g, c, g.cols[c], TARGET, "ten") : newNumber(g, c, g.cols[c], 0, "zero");
    const trap = newNumber(g, c + 1, g.cols[c + 1], 99, "trap");
    for (const n of [num, trap]) {
      n.y = y;
      n.prevY = y;
      n.hover = fastHover(g);
      g.numbers.push(n);
    }
    num.chain = trap.id;
    trap.chain = num.id;
    count -= 2;
    for (let i = slots.length - 1; i >= 0; i--) if (slots[i][1] === y && (slots[i][0] === c || slots[i][0] === c + 1)) slots.splice(i, 1);
  }
  for (const [c, y] of slots.slice(0, Math.max(0, count))) spawnFast(g, c, y + (g.rng() - 0.5) * 30);
}

/** From how many seconds into Fast fingers a 10 or a 0 can come chained to a red skull. */
const FAST_CHAIN_FROM = 30;

function spawnDefend(g: GameState, col: number): void {
  if (g.rng() < 0.7) {
    g.numbers.push(newNumber(g, col, g.cols[col], 99, "skull"));
    return;
  }
  const level = endlessLevel(g);
  if (level >= 5 && g.rng() < 0.25) {
    g.numbers.push(newNumber(g, col, g.cols[col], 2, "mul"));
    return;
  }
  const v = 1 + Math.floor(g.rng() * 4); // (small numbers: 1 to 4)
  g.numbers.push(newNumber(g, col, g.cols[col], level >= 3 && g.rng() < 0.4 ? -v : v));
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
  let stunned = false;
  for (const n of g.numbers) {
    if (n.state !== "fall" || n.bonus || Math.abs(n.x - c.x) > LASER_HALF_WIDTH) continue;
    // (the snake: the laser does not burn it away, it stuns it: the train stands still for a while)
    // (a steel number of the snake is shot to pieces, though: it is gone, and the train closes the gap)
    // (only a hit on the head makes it dizzy: a hit on its body does nothing)
    if (n.track !== undefined) {
      if (n.snakeHead) stunned = true;
      if (n.op === "steel") {
        n.done = true;
        hits.push({x: n.x, y: n.y});
      }
      continue;
    }
    if (n.ice > 0) {
      n.ice = 0;
      g.events.push({t: "ice", x: n.x, y: n.y, broke: true});
      continue;
    }
    n.done = true;
    hits.push({x: n.x, y: n.y});
  }
  if (stunned) g.snakeStun = SNAKE_STUN;
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
  // (counted for the card after the round)
  const kind = n.op === "add" ? (n.v < 0 ? "minus" : "plus") : n.op;
  g.landed[kind] = (g.landed[kind] ?? 0) + 1;
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
  g.helpDue = true; // (the cups have changed: with two or three cups the next number helps)
  if (n.op === "zero" || n.op === "ten") c.hidden = false; // (a cup that is back at 0, or at 10, is easy to count again)
  else if (n.op === "dim") c.hidden = true;
  c.bump = 1;
  c.ripple = 1;
  g.score += n.op === "skull" || n.op === "trap" ? 0 : scaled(g, (n.op === "mul" ? n.v * 3 : n.op === "div" ? n.v * 2 : n.op === "zero" ? 2 : Math.abs(n.v)) * g.level * (c.kinds.includes("gold") ? GOLD_FACTOR : 1));
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
    // (in Sequence 10 one dead cup is the end: with fewer cups it would only get easier)
    if (g.cups.every((k) => k.dead) || g.variant === "find") endGame(g, "allDead");
  }
  if (g.mode === "tutorial") tutorialAfterLand(g, result);
}

function levelUp(g: GameState, c: Cup): void {
  const levelBefore = endlessLevel(g);
  g.level += 1;

  // A new perfect 10 refills what had faded of the progress so far (the part of a cup that was gone, and the time starts over); a whole cup that has faded away stays gone.
  g.drain -= g.drain % FADE_TICKS;
  g.drainClock = 0;
  // A perfect 10 soon after the one before it builds a combo: the points of the perfect 10 go times 2, then times 3, and so on (and a combo is worth twice as much per step as an ordinary perfect 10).
  // (the snake: a perfect 10 calms it down again: its own pace and colour are back)
  if (snakeOn(g)) g.snakeBoost = 0;
  g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
  g.comboTimer = COMBO_SECONDS;
  const bonus = scaled(g, (g.combo >= 2 ? COMBO_BONUS : 50) * g.level * g.combo * (c.kinds.includes("gold") ? GOLD_FACTOR : 1));
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
  // (in the endless game: when the bar has been filled, what has faded counted off)
  const newLevel = g.daily ? rungEnds(g.level - 1) : endlessLevel(g) > levelBefore;
  // Comet belt: a new level (level 2, 3 ...) pops every comet there is.
  if (cometOn(g) && newLevel) {
    const hits = g.numbers.filter((n) => n.comet && !n.done).map((n) => ({x: n.x, y: n.y, size: n.scale || 1}));
    if (hits.length > 0) {
      for (const n of g.numbers) if (n.comet) n.done = true;
      g.numbers = g.numbers.filter((n) => !n.done);
      g.shake = Math.max(g.shake, 0.3);
      g.events.push({t: "comets", hits});
    }
  }
  // The snake: a new level does not start it over (the train goes on as it is, numbers and all): it only gets back its own pace (what faded perfect 10s
  // had added is gone), and on every tenth level its head becomes a boss.
  if (newLevel && snakeOn(g)) {
    g.snakeBoost = 0;
    const head = g.numbers.find((n) => n.snakeHead && !n.done);
    if (head && endlessLevel(g) % 10 === 0) head.boss = {hp: SNAKE_BOSS_HP, max: SNAKE_BOSS_HP};
  }
  if (g.mode === "endless" && newLevel) {
    g.banner = 1.6;
    if (!g.variant) giveScreens(g, 1); // (the whole bar is full: a new screen)
    // What this level of the endless game brings in is made to fall a few seconds in.
    if (!g.variant && !mixNow(g)) planShowcase(g, FEATURES.filter((f) => ENDLESS_FEATURE_FROM[f] === endlessLevel(g)));
  }
  g.events.push({t: "levelUp", cupId: c.id, level: g.level, done: progressOf(g)});
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
    if (g.phase !== "perk") growCups(g); // (no perk to choose: the new cup comes at once)
  }
  // A level of the book is cleared when enough cups have reached 10.
  if ((g.level - 1) * FADE_TICKS - g.drain >= goalFor(g.mode, g.stage) * FADE_TICKS) {
    // A level cleared with three stars gives a pull-down screen or an eraser (one or the other, at random; the one there is room for).
    const three = isLevelMode(g.mode) && starsFor(g.mode, g.stage, g.score) === 3;
    const roomScreen = g.screens < SCREEN_MAX;
    // (an eraser only once the book has presented it)
    const roomEraser = g.erasers < ERASER_MAX && featureAge(g, "eraser") >= 0;
    const eraser = three && roomEraser && (!roomScreen || g.rng() < 0.5);
    g.eraserWon = eraser;
    g.screenWon = three && !eraser && roomScreen;
    if (g.screenWon) giveScreens(g, 1);
    if (g.eraserWon) giveErasers(g, 1);
    g.phase = "won";
    g.overTimer = -WIN_DELAY; // (the card waits for the progress bar: it comes up when this has counted up to 0)
    g.numbers = [];
    g.banner = 0;
    g.events.push({t: "won", stars: starsFor(g.mode, g.stage, g.score)});
  }
}

// ---- Every frame ----------------------------------------------------------------------

/** Comet belt: how much faster the time goes while a finger holds the ship (and it has fuel). */
export const COMET_HELD_PACE = 1.6;
/** Comet belt: how much faster than the numbers a comet of the usual size falls (a smaller one falls faster, a bigger one slower). */
export const COMET_FAST = 1.6;

/** Comet belt: how many seconds a full tank lasts while the ship is held, how many it takes to fill up again while it is let go, and how full it must be to fly again once it ran out. */
export const FUEL_SECONDS = 6;
export const FUEL_REFILL = 8;
const FUEL_AGAIN = 0.3;

/** Comet belt: how many seconds a full tank lasts: more on every new level (a bigger tank), at most 15. */
export function fuelCapacity(g: GameState): number {
  return Math.min(15, FUEL_SECONDS + 1.5 * (endlessLevel(g) - 1));
}

/** Comet belt: whether the ship is flying (held, and with fuel): then the time goes faster and it has its big flame. */
export function shipFlying(g: GameState): boolean {
  return g.jetHeld && !g.fuelOut;
}

export function update(g: GameState, dt: number): void {
  flyCraft(g, dt);
  g.shipHurt = Math.max(0, g.shipHurt - dt);
  if (g.phase === "play" && cometOn(g) && g.countdown <= 0) {
    // (the fuel: used while the ship is flown, filled up while it is let go)
    if (shipFlying(g)) {
      g.fuel = Math.max(0, g.fuel - dt / fuelCapacity(g));
      if (g.fuel === 0) g.fuelOut = true;
    } else if (!g.jetHeld) {
      g.fuel = Math.min(1, g.fuel + dt / FUEL_REFILL);
      if (g.fuelOut && g.fuel >= FUEL_AGAIN) g.fuelOut = false;
    }
  }
  // (Comet belt: while the ship is flown everything goes 1.5 times as fast)
  if (g.phase === "play" && shipFlying(g) && cometOn(g)) dt *= COMET_HELD_PACE;
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
  g.dailyIntro = Math.max(0, g.dailyIntro - dt);

  if (g.phase === "over" || g.phase === "won") {
    g.overTimer += dt;
    return;
  }
  if (g.phase === "intro" || g.phase === "perk") {
    g.overTimer += dt; // (how long it has been shown: its buttons wait a moment, as the ones after a round do)
    return;
  }
  if (g.phase !== "play") return;
  if (g.variant) g.variantTime += dt;

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
  // The magic wand: as long as it is at work every number (the ones that come too) is a 1.
  if (g.wand > 0) {
    g.wand = Math.max(0, g.wand - dt);
    wave(g);
  }
  g.reverse = Math.max(0, g.reverse - dt);
  g.shieldGrew += dt;
  if ((shieldOn(g) || jetOn(g)) && g.phase === "play" && g.countdown <= 0) maybeBoss(g);
  if (jetOn(g) && g.phase === "play" && g.countdown <= 0) updateJet(g, sdt);
  g.erase = Math.max(0, g.erase - dt);

  // The progress fades with time (see fadeOn): a step off every so often, so that a whole perfect 10 is gone in 22 to 16 seconds (the slow motion
  // slows it down, and the pause ball stops it).
  if (fadeOn(g)) {
    g.drainClock += sdt;
    const step = fadeSeconds(g) / FADE_TICKS;
    while (g.drainClock >= step) {
      g.drainClock -= step;
      const before = g.drain;
      g.drain = Math.min(fadeCap(g), g.drain + 1);
      // (Fighter jet: a whole perfect 10 of the bar has faded away: the weapons go down a step)
      if (jetOn(g) && g.drain > before && g.drain % FADE_TICKS === 0) jetWeaponDown(g);
      if (snakeOn(g) && g.drain > before && g.drain % FADE_TICKS === 0) snakeFaster(g);
    }
  } else g.drainClock = 0;

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
      for (const n of g.numbers) if (n.state === "fall" && !n.bonus && !n.snakeHead && n.y <= edge) n.done = true;
    }
    if (g.sweep >= SWEEP_DOWN + SWEEP_HOLD + SWEEP_UP) {
      g.sweep = -1;
      // (the cloth is up again: that was the last step of the tutorial)
      if (g.mode === "tutorial" && g.tutorialStep === 4) tutorialNext(g);
    }
  }

  // The daily ladder: an even rung of Fast fingers or Sequence 10 starts with the count down (3, 2, 1).
  const mixed = mixNow(g);
  if ((mixed === "fast" || mixed === "find" || mixed === "jet" || mixed === "comet" || mixed === "snake") && g.phase === "play") {
    const rung = endlessLevel(g);
    if (rung !== g.mixRung) {
      g.mixRung = rung;
      g.countdown = FAST_COUNT * 3;
    }
  }

  if (g.mode === "tutorial") {
    // The tutorial sets out its own numbers, one at a time.
    if (g.tutorialDelay > 0) {
      g.tutorialDelay -= dt;
      if (g.tutorialDelay <= 0) tutorialSetup(g);
    } else if (g.numbers.length === 0 && g.sweep < 0) {
      tutorialSetup(g);
    }
  } else if ((findOn(g) || g.numbers.some((n) => (n.hover ?? 0) > 1e8)) && g.countdown <= 0) {
    // Sequence 10: a puzzle at a time, against the clock (and in the daily ladder, the last puzzle of a rung is cleared away when the rung is done).
    const flying = g.numbers.some((n) => n.state === "dive");
    const waiting = g.numbers.some((n) => n.hover !== undefined);
    if (g.numbers.length === 0) newFindPuzzle(g);
    else if (g.level > g.findAnswer) {
      // (a perfect 10: when what is on its way has landed, the rest pops and the next puzzle comes)
      if (!flying) {
        for (const n of g.numbers) g.events.push({t: "pop", x: n.x, y: n.y});
        g.numbers = [];
        if (findOn(g)) newFindPuzzle(g);
      }
    } else if (!flying) {
      g.findTimer -= dt;
      if (g.findTimer <= 0 || !waiting) failFind(g);
    }
  } else if (g.daily && g.dailyIntro > 0) {
    // (the title with the match mode of the day is shown: the count down and the numbers wait for it)
  } else if (g.countdown > 0) {
    // (Fast fingers: nothing comes until the count down is over)
    g.countdown = Math.max(0, g.countdown - dt);
    if (g.countdown === 0) g.spawnTimer = 0;
  } else if (g.sweep < 0) {
    // (nothing new comes while the screen is down)
    g.spawnTimer -= sdt;
    if (g.spawnTimer <= 0 && !paused) {
      g.spawnTimer = (spawnInterval(paceOf(g)) * stageSpawnFactor(g.stage) * (0.85 + g.rng() * 0.3)) / Math.max(0.3, 1 - SAUCER_EFFECT.sparse * (saucerStrength(g, "sparse") + perkCount(g, "sparse"))) / variantRate(g);
      spawn(g);
    }
    // Every now and then a bonus ball comes.
    if (!paused) g.bonusTimer -= dt;
    if (g.bonusTimer <= 0) {
      g.bonusTimer = nextBonusIn(g);
      spawnBonus(g);
    }
    // The new kinds that this level brings in are made to fall, one at a time, a few seconds in.
    if (g.showcase.length > 0 && !paused && !mixNow(g)) {
      g.showTimer -= dt;
      if (g.showTimer <= 0) {
        if (spawnShowcase(g, g.showcase[0])) {
          g.showcase.shift();
          g.showTimer = 4 + g.rng() * 2;
        } else g.showTimer = 0.5;
      }
    }
  }

  // The snake: the train slides along its track.
  if (snakeOn(g) && g.phase === "play" && g.countdown <= 0) updateSnake(g, sdt);
  for (const n of g.numbers) {
    if (g.phase !== "play") break;
    if (n.state === "fall") fall(g, n, sdt);
    else if (n.state === "rise") rise(g, n, dt);
    else dive(g, n, dt);
  }
  g.numbers = g.numbers.filter((n) => !n.done);
}

function fall(g: GameState, n: NumberTile, dt: number): void {
  if (n.track !== undefined) return; // (in the train of the snake: it is moved along the track, see updateSnake)
  // Fast fingers: it hangs still for a moment; then a 10 or a 0 pops and is gone, and a skull falls.
  if (n.hover !== undefined) {
    n.hover -= dt;
    if (n.hover > 0) return;
    n.hover = undefined;
    if (n.op !== "skull") {
      n.done = true;
      g.events.push({t: "pop", x: n.x, y: n.y});
      return;
    }
  }
  if (n.boss) {
    bossFall(g, n, dt);
    return;
  }
  // Knocked away by the shield: it flies off in an arc and is gone.
  if (n.vx !== undefined) {
    n.prevY = n.y;
    n.x += n.vx * dt;
    n.speed += DIVE_GRAVITY * 0.6 * dt;
    n.y += n.speed * dt;
    if (n.y > MISS_Y + 60 || n.x < -50 || n.x > W + 50) n.done = true;
    return;
  }
  n.prevY = n.y;
  n.y += fallSpeed(paceOf(g)) * speedFactorOf(g) * (n.comet ? COMET_FAST / (n.scale || 1) : 1) * dt;
  if (shieldOn(g) && hitShield(g, n)) return;
  if (jetOn(g) && touchJet(g, n)) return;
  if (cometOn(g) && n.pickup) {
    touchJet(g, n);
    return;
  }
  if (cometOn(g) && (n.comet || n.op === "steel" || n.op === "ten") && touchesCraft(g, n, SHIP_R)) {
    crash(g, n);
    return;
  }
  // (a comet never lands in a cup: it falls past them, in front of them, and is gone)
  if (n.comet) {
    if (n.y > MISS_Y + 40) n.done = true;
    return;
  }
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

/** Tapped while the reverse is on: the number flies up, faster and faster, and is gone over the top of the screen. */
function rise(g: GameState, n: NumberTile, dt: number): void {
  n.prevY = n.y;
  n.speed -= DIVE_GRAVITY * 0.5 * dt;
  n.y += n.speed * dt;
  if (n.y < spawnY(g) - 40) n.done = true;
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
// Five things to try, one at a time, in the real game: tap a number, fill a cup to exactly 10,
// see a cup die from going over, swap places to keep a number out of a dead cup, and pull the cloth down to wipe the numbers away.

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
    case 4: {
      // The cloth: every cup is alive and empty, and a few small numbers are in the air. Pull the cloth down and they are wiped away.
      for (const c of g.cups) {
        c.dead = false;
        c.value = 0;
      }
      [[0, 170, 2], [1, 235, 3], [2, 150, 1], [3, 215, 2]].forEach(([col, y, v]) => {
        const n = newNumber(g, col, g.cols[col], v);
        n.y = y;
        n.prevY = n.y;
        g.numbers.push(n);
      });
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

// ---- Shield up ----------------------------------------------------------------------------

/** Shield up: the area over the cups that the shield can be moved in (by the finger), its half width at the start and at most, and how much a shield ball makes it grow. */
export const SHIELD_AREA = {x0: 20, x1: W - 20, y0: 90, y1: 470}; // (the whole field over the cups)
export const SHIELD_W0 = 34;
export const SHIELD_W_MAX = 60;
const SHIELD_GROW = 6.5;
/** How many power upgrades the shield can take after its full size, and how much more each one hurts a boss. */
export const SHIELD_POWER_MAX = 30;
const SHIELD_POWER_STEP = 0.25;
/** How far the arc of the shield bends down at its ends. */
export const SHIELD_BEND = 14;

/** Shield up is being played: the match mode, or a rung of the daily ladder with its numbers. */
export function shieldOn(g: GameState): boolean {
  return g.variant === "shield" || mixNow(g) === "shield";
}

function resetShield(g: GameState): void {
  g.shieldX = W / 2;
  g.shieldY = SHIELD_AREA.y1;
  g.shieldW = SHIELD_W0;
  g.shieldPower = 0;
  g.jetWeapons = {a: null, b: null, c: null};
  g.jetLv = {a: 0, b: 0, c: 0};
  g.jetBase = 1;
  g.jetDecay = 0;
  g.jetDown = 99;
  g.jetBeam = null;
  g.jetFlame = false;
  g.shipHp = SHIP_HP;
  g.shipHurt = 0;
  g.jetShield = false;
  g.jetStun = 0;
  g.jetHeld = false;
  g.fuel = 1;
  g.fuelOut = false;
  g.enemyShots = [];
  g.craftTo = null;
  g.craftTrail = [];
  g.jetFire = 0;
  g.jetMissileFire = 0;
  g.shots = [];
  g.jetGot = 99;
  g.snakeBuilt = -1;
  g.snakeEnd = W / 2;
  g.snakeBack = 0;
  g.snakeSlow = 0;
  g.snakeRecoil = 0;
  g.snakeStun = 0;
  g.snakeBoost = 0;
  g.snakeFastT = 99;
  g.snakeHearts = 0;
  // (the cups keep what they have from the shop)
}

/**
 * The finger moves the shield (it stays in its area over the cups). The way from where it was to where it is now is swept in small steps, so that a shield that is
 * moved fast still meets what it passes over (and does not jump past a skull).
 */
export function moveShield(g: GameState, x: number, y: number): void {
  if (cometOn(g) && g.fuelOut && g.phase === "play") return; // (no fuel: the ship cannot be flown)
  // (the jet and the ship can fly over the whole screen; the shield stays over the cups)
  const area = jetOn(g) || cometOn(g) ? {x0: 16, x1: W - 16, y0: -g.extra + 40, y1: 600} : SHIELD_AREA;
  const nx = Math.min(area.x1, Math.max(area.x0, x));
  const ny = Math.min(area.y1, Math.max(area.y0, y));
  const steps = Math.max(1, Math.ceil(Math.hypot(nx - g.shieldX, ny - g.shieldY) / 6));
  const x0 = g.shieldX;
  const y0 = g.shieldY;
  for (let k = 1; k <= steps; k++) {
    g.shieldX = x0 + ((nx - x0) * k) / steps;
    g.shieldY = y0 + ((ny - y0) * k) / steps;
    if (g.phase !== "play") continue;
    if (jetOn(g) || cometOn(g)) {
      for (const n of g.numbers) {
        if (n.state !== "fall" || n.done || g.phase !== "play") continue;
        if (jetOn(g)) touchJet(g, n);
        else if (n.pickup) touchJet(g, n);
        else if ((n.comet || n.op === "steel" || n.op === "ten") && touchesCraft(g, n, SHIP_R)) crash(g, n);
      }
      continue;
    }
    if (!shieldOn(g)) continue;
    for (const n of g.numbers) {
      if (n.state !== "fall" || n.done || n.vx !== undefined || !touchesShield(g, n)) continue;
      // (a boss is not popped by a touch: the shield pushes it up, and holds it)
      if (n.boss) n.y = Math.min(n.y, (shieldTop(g, n.x, BOSS_R) ?? n.y) - BOSS_R);
      else meetShield(g, n);
    }
  }
  g.numbers = g.numbers.filter((n) => !n.done);
}

/** How big a falling ball is (its radius), for the shield. */
const BALL_R = 18;

/** The height of the top of the shield at x (it is an arc, highest in the middle), or null if a ball at x is not over it (its edge counts too). */
function shieldTop(g: GameState, x: number, r: number = BALL_R): number | null {
  const dx = x - g.shieldX;
  if (Math.abs(dx) > g.shieldW + r * 0.8) return null;
  const d = Math.min(1, Math.abs(dx) / g.shieldW);
  return g.shieldY + d * d * SHIELD_BEND;
}

/** Whether a ball touches the shield: it overlaps the band of the arc, or it has just fallen through it. */
function touchesShield(g: GameState, n: NumberTile): boolean {
  const r = ballR(n);
  const top = shieldTop(g, n.x, r);
  if (top === null) return false;
  const overlaps = n.y + r >= top - 2 && n.y - r <= top + 12;
  const passed = n.prevY + r <= top + 6 && n.y + r >= top;
  return overlaps || passed;
}

/**
 * Shield up: what falls is a steel skull (a skull in a cup kills it), an orange 10 (a 10 in a cup is a perfect 10), or now and then a shield ball (it makes the shield
 * grow). Nothing can be tapped: the shield, held by the finger, knocks away whatever it meets: the skulls (good), the 10s too (a lost perfect 10), and it takes the
 * shield balls.
 */
function spawnShieldMode(g: GameState, col: number): void {
  const x = g.cols[col] + (g.rng() - 0.5) * 30;
  if ((g.shieldW < SHIELD_W_MAX || g.shieldPower < SHIELD_POWER_MAX) && g.rng() < 0.08) {
    g.numbers.push(newNumber(g, col, x, 0, "add", "shield"));
    return;
  }
  const skull = g.rng() < Math.min(0.7, 0.5 + g.variantTime / 300);
  g.numbers.push(skull ? newNumber(g, col, x, 99, "skull") : newNumber(g, col, x, TARGET, "ten"));
}

/** Whether the falling number has just met the shield: then it pops (a skull), is knocked away (a 10) or, a shield ball, is taken. */
function hitShield(g: GameState, n: NumberTile): boolean {
  if (n.bonus && n.bonus !== "shield") return false;
  if (!touchesShield(g, n)) return false;
  meetShield(g, n);
  return true;
}

function meetShield(g: GameState, n: NumberTile): void {
  const top = shieldTop(g, n.x) ?? g.shieldY;
  if (n.bonus === "shield") {
    n.done = true;
    // (it grows to its full size, and after that only its power goes up)
    if (g.shieldW >= SHIELD_W_MAX) g.shieldPower = Math.min(SHIELD_POWER_MAX, g.shieldPower + 1);
    else g.shieldW = Math.min(SHIELD_W_MAX, g.shieldW + SHIELD_GROW);
    g.shieldGrew = 0;
    g.events.push({t: "pop", x: n.x, y: n.y});
    g.score += scaled(g, 5 * g.level);
    return;
  }
  if (n.bonus) return;
  // A steel skull that touches the shield pops.
  if (n.op === "skull") {
    n.done = true;
    g.score += scaled(g, 2 * g.level);
    g.events.push({t: "skull", x: n.x, y: n.y});
    return;
  }
  // (a 10 is knocked off the arc: the further out it hits, the harder it is thrown to that side)
  const d = (n.x - g.shieldX) / g.shieldW;
  const side = d === 0 ? (g.rng() < 0.5 ? -1 : 1) : Math.sign(d);
  n.vx = side * (140 + Math.min(1, Math.abs(d)) * 160);
  n.speed = -280;
  n.y = Math.min(n.y, top - BALL_R);
  g.events.push({t: "pop", x: n.x, y: top});
}

/** The radius of a boss skull of Shield up, and how much slower than the rest it falls. */
const BOSS_R = 38;
const BOSS_SLOW = 0.55;

function ballR(n: NumberTile): number {
  return n.boss ? BOSS_R : BALL_R;
}

/**
 * Shield up: at every tenth level a boss comes, a big skull (it falls slower). A touch does not pop it: the shield has to hold it up for a while (more seconds at every
 * boss), and then it bursts, for a lot of points. If it gets to a cup, the cup dies.
 */
function maybeBoss(g: GameState): void {
  if (g.level % 10 !== 0 || g.bossLevel === g.level || g.numbers.some((n) => n.boss)) return;
  g.bossLevel = g.level;
  const col = Math.floor(g.rng() * g.cols.length);
  const n = newNumber(g, col, g.cols[col], 99, "skull");
  // (the jet shoots it: a number of hits, more at every boss)
  const hp = jetOn(g) ? 18 + g.level * 1.2 : 2 + (g.level / 10) * 1.5;
  n.boss = {hp, max: hp};
  n.scale = BOSS_R / 20;
  n.y = spawnY(g) - 20;
  n.prevY = n.y;
  g.numbers.push(n);
  g.shake = Math.max(g.shake, 0.4);
}

/** How fast the shield hurts a boss: twice as fast at full size, and a quarter more for every power upgrade after that. */
export function shieldDamage(g: GameState): number {
  return g.shieldW >= SHIELD_W_MAX ? 2 + SHIELD_POWER_STEP * g.shieldPower : 1;
}

function burstBoss(g: GameState, n: NumberTile): void {
  n.done = true;
  g.score += scaled(g, 50 * g.level * (jetOn(g) ? endlessLevel(g) : 1));
  g.shake = Math.max(g.shake, 0.6);
  for (let k = 0; k < 5; k++) g.events.push({t: "skull", x: n.x + Math.cos(k * 1.26) * 22, y: n.y + Math.sin(k * 1.26) * 22});
  g.events.push({t: "boom", x: n.x, y: n.y, big: true});
}

function bossFall(g: GameState, n: NumberTile, dt: number): void {
  n.prevY = n.y;
  n.y += fallSpeed(paceOf(g)) * speedFactorOf(g) * BOSS_SLOW * dt;
  if (shieldOn(g) && touchesShield(g, n)) {
    // (held up by the shield: it rests on it and loses its life)
    n.y = Math.min(n.y, (shieldTop(g, n.x, BOSS_R) ?? n.y) - BOSS_R);
    n.prevY = n.y;
    n.boss!.hp -= dt * shieldDamage(g);
    if (n.boss!.hp <= 0) burstBoss(g, n);
    return;
  }
  landOrMiss(g, n);
}

// ---- Fighter jet and Comet belt ----------------------------------------------------------
// The finger flies a craft over the cups (where the shield of Shield up is: g.shieldX and g.shieldY), and it is moved with moveShield.

/** The fighter jet is being played: the match mode, or a rung of the daily ladder with it. */
export function jetOn(g: GameState): boolean {
  return g.variant === "jet" || mixNow(g) === "jet";
}

/** The comet belt is being played: the match mode, or a rung of the daily ladder with it. */
export function cometOn(g: GameState): boolean {
  return g.variant === "comet" || mixNow(g) === "comet";
}

/** A finger takes hold of the craft, or lets go of it (the jet only shoots while it is held). */
export function holdCraft(g: GameState, held: boolean): void {
  g.jetHeld = held;
}

/** A craft is flown by the finger: the shield, the jet or the ship. */
export function craftOn(g: GameState): boolean {
  return shieldOn(g) || jetOn(g) || cometOn(g);
}

/** How big the jet and the ship are, for what touches them (a little smaller than they look: a near miss is a miss). */
export const JET_R = 18;
export const SHIP_R = 12;
/** Comet belt: the lives of the ship, and how long it cannot be hurt again after a hit (it blinks). */
export const SHIP_HP = 3;
const SHIP_HURT = 1.3;
const BULLET_SPEED = 620;
const MISSILE_SPEED = 380;
/** How long the jet is knocked out (cannot shoot) when a skull hits it with no shield on. */
const JET_STUN = 1.4;

/**
 * The shape of the ship and of the jet, for what touches them: circles (x, y from the middle of the craft, and radius) that cover the body, the nose and the fins as
 * they are drawn.
 */
const SHIP_SHAPE: readonly [number, number, number][] = [[0, -27, 3], [0, -17, 6], [0, -4, 8], [0, 9, 8], [-15, 20, 3.5], [15, 20, 3.5], [0, 21, 6]];
const JET_SHAPE: readonly [number, number, number][] = [[0, -28, 4], [0, -16, 6], [0, -2, 8], [0, 14, 8], [-14, 9, 6], [14, 9, 6], [-24, 14, 4], [24, 14, 4], [0, 26, 6]];

function touchesCraft(g: GameState, n: NumberTile, r: number): boolean {
  // (a ball counts a little smaller than it looks, so a near miss is a miss: a comet is a bit smaller than a numbered ball)
  // (the ship of the comet belt is fair: only a real touch counts)
  const br = (n.comet ? 15 * (n.scale || 1) : ballR(n)) * (r === SHIP_R ? 0.7 : 0.85);
  const shape = r === SHIP_R ? SHIP_SHAPE : r === JET_R ? JET_SHAPE : null;
  if (!shape) return Math.hypot(n.x - g.shieldX, n.y - g.shieldY) < r + br;
  return shape.some(([dx, dy, cr]) => Math.hypot(n.x - (g.shieldX + dx), n.y - (g.shieldY + dy)) < cr + br);
}

/** The column whose cup is nearest to x. */
function colNear(g: GameState, x: number): number {
  return g.cols.reduce((b, cx, k) => (Math.abs(cx - x) < Math.abs(g.cols[b] - x) ? k : b), 0);
}

/** The way each weapon belongs to, and the two weapons of each way (one of them is chosen). */
export const WEAPON_PATH: Record<Weapon, WeaponPath> = {bullet: "a", laser: "a", flame: "b", missile: "b", ricochet: "c", rapid: "c"};
export const PATH_WEAPONS: Record<WeaponPath, [Weapon, Weapon]> = {a: ["bullet", "laser"], b: ["flame", "missile"], c: ["ricochet", "rapid"]};
const PATHS: readonly WeaponPath[] = ["a", "b", "c"];
/** The most upgrades a way can have. */
export const WEAPON_MAX = 3;

/**
 * What the next weapon ball of the jet offers: two weapons side by side when a new way is to be chosen (the first way at once, the next ones when the ways chosen so
 * far have two upgrades each), otherwise one more upgrade of the way that has the fewest; nothing when everything is at the top.
 */
export function nextOffer(g: GameState): Weapon[] {
  const chosen = PATHS.filter((p) => g.jetWeapons[p]);
  const open = PATHS.find((p) => !g.jetWeapons[p]);
  if (open && chosen.every((p) => g.jetLv[p] >= 2)) return [...PATH_WEAPONS[open]];
  const low = chosen.filter((p) => g.jetLv[p] < WEAPON_MAX).sort((p, q) => g.jetLv[p] - g.jetLv[q])[0];
  if (low) return [g.jetWeapons[low]!];
  if (g.jetBase === 0) return [g.jetWeapons.a ?? "bullet"];
  return [];
}

/** The weapon of a way, when it has at least one upgrade (or null). */
function armed(g: GameState, p: WeaponPath): Weapon | null {
  return g.jetLv[p] > 0 ? g.jetWeapons[p] : null;
}

/** Rapid fire: how much faster everything shoots (and how much more the laser and the flame burn). */
function rapid(g: GameState): number {
  return armed(g, "c") === "rapid" ? [1, 1.3, 1.6, 2][g.jetLv.c] : 1;
}

/**
 * Fighter jet: steel skulls (now and then three chained one over the other, all to be shot), orange 10s (they should get past: a shot 10 is lost), weapon balls
 * (two side by side when a way is to be chosen) and a shield ball.
 */
function spawnJet(g: GameState, col: number): void {
  const x = g.cols[col] + (g.rng() - 0.5) * 30;
  const offer = nextOffer(g);
  // (weapons come more often when the jet has none left at all)
  if (offer.length > 0 && g.rng() < (g.jetBase === 0 ? 0.2 : 0.075)) {
    const mid = Math.min(W - 70, Math.max(70, x));
    let link = 0;
    offer.forEach((w, k) => {
      const n = newNumber(g, col, offer.length === 2 ? mid + (k === 0 ? -45 : 45) : x, 0, "add");
      n.pickup = "weapon";
      n.weapon = w;
      if (offer.length === 2) {
        if (k === 0) link = n.id;
        n.link = link;
      }
      g.numbers.push(n);
    });
    return;
  }
  if (!g.jetShield && g.rng() < 0.025) {
    const n = newNumber(g, col, x, 0, "add");
    n.pickup = "shield";
    g.numbers.push(n);
    return;
  }
  if (g.variantTime > 12 && g.rng() < 0.14) {
    // (three skulls chained together, one over the other)
    let link = 0;
    for (let k = 0; k < 3; k++) {
      const n = newNumber(g, col, x, 99, "skull");
      n.y -= k * 42;
      n.prevY = n.y;
      if (k === 0) link = n.id;
      n.link = link;
      g.numbers.push(n);
    }
    return;
  }
  const skull = g.rng() < Math.min(0.72, 0.55 + g.variantTime / 300);
  g.numbers.push(skull ? newNumber(g, col, x, 99, "skull") : newNumber(g, col, x, TARGET, "ten"));
}

/** The jet takes a weapon ball: the way gets that weapon (if it had none) and one upgrade more, the basic shot is back, and the ball beside it (the other choice) is gone. */
function takeWeapon(g: GameState, n: NumberTile): void {
  const w = n.weapon!;
  const p = WEAPON_PATH[w];
  if (!g.jetWeapons[p]) g.jetWeapons[p] = w;
  if (g.jetWeapons[p] === w && g.jetBase > 0) g.jetLv[p] = Math.min(WEAPON_MAX, g.jetLv[p] + 1);
  g.jetBase = 1;
  g.jetDecay = 0;
  g.jetGotWeapon = w;
  if (n.link !== undefined) {
    for (const m of g.numbers) {
      if (m === n || m.link !== n.link || m.done) continue;
      m.done = true;
      g.events.push({t: "pop", x: m.x, y: m.y});
    }
  }
}

/** The damage of a hit that reaches everything in its way (the laser and the flame), per second, with the technique and a combo. */
function burnDamage(g: GameState, base: number): number {
  const ricochet = armed(g, "c") === "ricochet" ? 1 + 0.2 * g.jetLv.c : 1;
  return base * rapid(g) * ricochet * shotPower(g);
}

/** Whatever the laser or the flame reaches is hurt (a bit every moment) and the missiles of the skulls in it are burned away. */
function burn(g: GameState, inside: (x: number, y: number, r: number) => boolean, damage: number): void {
  for (const n of g.numbers) {
    if (n.done || n.state !== "fall" || n.pickup || n.vx !== undefined) continue;
    if (!inside(n.x, n.y, ballR(n))) continue;
    if (n.boss) shoot(g, n, damage);
    else {
      // (a number takes a moment to burn: it has a little life too)
      n.burn = (n.burn ?? 0) + damage;
      if (n.burn >= 1) shoot(g, n, 1);
    }
  }
  for (const e of g.enemyShots) if (e.age >= 0 && inside(e.x, e.y, 4)) e.age = -1;
}

/** The jet: while a finger holds it, it shoots with what it has (bullets or the laser, the flame or missiles), and its shots fly and hit. */
function updateJet(g: GameState, dt: number): void {
  g.jetGot += dt;
  g.jetDown += dt;
  g.jetStun = Math.max(0, g.jetStun - dt);
  g.jetBeam = null;
  g.jetFlame = false;
  const firing = g.jetStun <= 0 && g.jetHeld && g.jetBase > 0;
  if (firing) {
    const gun = armed(g, "a");
    const lvA = g.jetLv.a;
    if (gun === "laser") {
      // (a beam straight up: it burns everything over the jet, wider and hotter with every upgrade)
      const half = 3 + 2 * lvA;
      g.jetBeam = spawnY(g) - 40;
      burn(g, (x, y, r) => y < g.shieldY - 20 && Math.abs(x - g.shieldX) < half + r * 0.7, burnDamage(g, 3 + 2.5 * lvA) * dt);
    } else {
      g.jetFire -= dt;
      if (g.jetFire <= 0) {
        const lv = gun === "bullet" ? lvA : 0;
        g.jetFire = (0.3 - 0.045 * lv) / rapid(g);
        const y = g.shieldY - 30;
        // (from the nose; from the guns beside the body too, and from the guns on the wings at the top)
        const guns = lv >= 3 ? [-16, -5.5, 0, 5.5, 16] : lv === 2 ? [-5.5, 0, 5.5] : lv === 1 ? [-5.5, 5.5] : [0];
        const power = shotPower(g) * (1 + 0.3 * lv);
        const bounces = armed(g, "c") === "ricochet" ? g.jetLv.c : 0;
        for (const dx of guns) g.shots.push({x: g.shieldX + dx, y, vx: lv >= 3 ? dx * 4 : 0, vy: -BULLET_SPEED, missile: false, power, age: 0, trail: [], bounces, hit: []});
      }
    }
    const special = armed(g, "b");
    const lvB = g.jetLv.b;
    if (special === "flame") {
      // (a cone of plasma flame in front of the nose: longer and hotter with every upgrade)
      const reach = 80 + 30 * lvB;
      g.jetFlame = true;
      burn(
        g,
        (x, y, r) => {
          const dy = g.shieldY - 30 - y;
          if (dy < -r || dy > reach + r) return false;
          return Math.abs(x - g.shieldX) < 10 + Math.max(0, dy) * 0.45 + r * 0.6;
        },
        burnDamage(g, 2.5 + 2 * lvB) * dt,
      );
    } else if (special === "missile") {
      g.jetMissileFire -= dt;
      if (g.jetMissileFire <= 0) {
        g.jetMissileFire = (1.3 - 0.2 * (lvB - 1)) / rapid(g);
        const sides = lvB >= 3 ? [-1, -1, 1, 1] : [-1, 1];
        sides.forEach((side, k) => g.shots.push({x: g.shieldX + side * (28 - (k >= 2 ? 10 : 0)), y: g.shieldY, vx: side * 120, vy: -MISSILE_SPEED * 0.6, missile: true, power: shotPower(g), age: 0, trail: []}));
      }
    }
  }
  const top = spawnY(g) - 60;
  for (const sh of g.shots) {
    sh.age += dt;
    if (sh.missile) {
      // (it steers after the nearest skull over it)
      let best: NumberTile | undefined;
      let bd = Infinity;
      for (const n of g.numbers) {
        if (n.done || n.state !== "fall" || n.op !== "skull" || n.vx !== undefined || n.y > sh.y + 20) continue;
        const d = Math.hypot(n.x - sh.x, n.y - sh.y);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      const want = best ? Math.atan2(best.y - sh.y, best.x - sh.x) : -Math.PI / 2;
      const now = Math.atan2(sh.vy, sh.vx);
      let turn = want - now;
      while (turn > Math.PI) turn -= 2 * Math.PI;
      while (turn < -Math.PI) turn += 2 * Math.PI;
      const a = now + Math.max(-5 * dt, Math.min(5 * dt, turn));
      const speed = Math.min(MISSILE_SPEED * 1.4, Math.hypot(sh.vx, sh.vy) + 400 * dt);
      sh.vx = Math.cos(a) * speed;
      sh.vy = Math.sin(a) * speed;
      sh.trail.push({x: sh.x, y: sh.y});
      if (sh.trail.length > 10) sh.trail.shift();
    }
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    if (sh.y < top || sh.y > MISS_Y + 40 || sh.x < -30 || sh.x > W + 30 || sh.age > 4) {
      sh.dead = true;
      continue;
    }
    // (a shot of the jet takes down a missile of the skulls)
    // (checked along the whole way the shot went in this frame, so that a fast shot does not fly through a missile between two frames)
    const hit = g.enemyShots.find((e) => e.age >= 0 && segDist(e.x, e.y, sh.x - sh.vx * dt, sh.y - sh.vy * dt, sh.x, sh.y) < 14);
    if (hit) {
      hit.age = -1;
      sh.dead = true;
      g.events.push({t: "pop", x: hit.x, y: hit.y});
      continue;
    }
    for (const n of g.numbers) {
      if (n.done || n.state !== "fall" || n.pickup || n.vx !== undefined || sh.hit?.includes(n.id)) continue;
      if (Math.hypot(n.x - sh.x, n.y - sh.y) > ballR(n) + (sh.missile ? 6 : 3)) continue;
      shoot(g, n, (sh.missile ? 4 : 1) * (sh.power ?? 1));
      if (sh.missile) {
        g.events.push({t: "boom", x: sh.x, y: sh.y, big: false});
        // (ricochet: a missile blows up the skulls round it too)
        const splash = armed(g, "c") === "ricochet" ? 20 + 15 * g.jetLv.c : 0;
        if (splash > 0) for (const m of g.numbers) if (m !== n && !m.done && m.op === "skull" && m.state === "fall" && Math.hypot(m.x - sh.x, m.y - sh.y) < splash + ballR(m)) shoot(g, m, 2 * (sh.power ?? 1));
        sh.dead = true;
      } else if ((sh.bounces ?? 0) > 0) {
        // (ricochet: the bullet bounces off to the nearest skull it has not hit yet)
        sh.bounces = (sh.bounces ?? 0) - 1;
        sh.hit = [...(sh.hit ?? []), n.id];
        let next: NumberTile | undefined;
        let nd = 220;
        for (const m of g.numbers) {
          if (m.done || m.state !== "fall" || m.op !== "skull" || sh.hit.includes(m.id)) continue;
          const d = Math.hypot(m.x - sh.x, m.y - sh.y);
          if (d < nd) {
            nd = d;
            next = m;
          }
        }
        if (next) {
          const a = Math.atan2(next.y - sh.y, next.x - sh.x);
          sh.vx = Math.cos(a) * BULLET_SPEED;
          sh.vy = Math.sin(a) * BULLET_SPEED;
          g.events.push({t: "pop", x: sh.x, y: sh.y});
        } else sh.dead = true;
      } else sh.dead = true;
      break;
    }
  }
  g.shots = g.shots.filter((sh) => !sh.dead);
  enemyFire(g, dt);
  g.numbers = g.numbers.filter((n) => !n.done);
}

/** How far the point (px, py) is from the line from (ax, ay) to (bx, by). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const u = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/** How hard the shots of the jet hit: half as hard again for every step of a combo (up to 3.5 times), and a tenth more for every level. */
export function shotPower(g: GameState): number {
  const combo = g.combo >= 2 ? 1 + 0.5 * (Math.min(6, g.combo) - 1) : 1;
  return combo * (1 + 0.1 * (endlessLevel(g) - 1));
}

/** From which level (perfect 10) the skulls shoot back at the jet. */
export const ENEMY_FIRE_FROM = 10;

/**
 * Fighter jet, from level 10: the skulls shoot slow missiles at the jet (more of them, faster and harder the further it gets; a boss shoots three at a time). A missile
 * that hits the jet knocks it out (longer the further it gets) unless its shield takes the hit; the shots of the jet can take them down.
 */
function enemyFire(g: GameState, dt: number): void {
  if (g.level >= ENEMY_FIRE_FROM) {
    const over = g.level - ENEMY_FIRE_FROM;
    const rate = Math.min(0.5, 0.1 + 0.012 * over);
    const speed = Math.min(220, 120 + 3 * over);
    for (const n of g.numbers) {
      if (n.done || n.state !== "fall" || n.op !== "skull" || n.vx !== undefined || n.y < 20 || n.y > g.shieldY - 60) continue;
      if (g.rng() >= (n.boss ? 0.9 : rate) * dt) continue;
      const a = Math.atan2(g.shieldY - n.y, g.shieldX - n.x);
      for (const spread of n.boss ? [-0.3, 0, 0.3] : [0]) g.enemyShots.push({x: n.x, y: n.y + ballR(n) * 0.6, vx: Math.cos(a + spread) * speed, vy: Math.sin(a + spread) * speed, age: 0});
    }
  }
  for (const e of g.enemyShots) {
    if (e.age < 0) continue;
    e.age += dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.y > MISS_Y + 40 || e.x < -30 || e.x > W + 30 || e.age > 8) {
      e.age = -1;
      continue;
    }
    if (JET_SHAPE.some(([dx, dy, r]) => Math.hypot(e.x - (g.shieldX + dx), e.y - (g.shieldY + dy)) < r + 4)) {
      e.age = -1;
      g.events.push({t: "boom", x: e.x, y: e.y, big: false});
      g.shake = Math.max(g.shake, 0.3);
      if (g.jetShield) g.jetShield = false;
      else g.jetStun = JET_STUN + Math.min(1.2, 0.04 * (g.level - ENEMY_FIRE_FROM));
    }
  }
  g.enemyShots = g.enemyShots.filter((e) => e.age >= 0);
}

/** How fast the jet and the ship fly on their own to where the finger was put down. */
const CRAFT_TRAVEL = 1500;

/** The finger is put down (or moved) somewhere away from the jet or the ship: it flies there, fast, instead of jumping. */
export function flyCraftTo(g: GameState, x: number, y: number): void {
  if (!jetOn(g) && !cometOn(g)) {
    moveShield(g, x, y);
    return;
  }
  g.craftTo = {x, y};
}

/** The jet or the ship on its way to where the finger is: a step closer (what it passes on the way is met as always), with a trail of light behind it. */
function flyCraft(g: GameState, dt: number): void {
  for (const p of g.craftTrail) p.age += dt;
  g.craftTrail = g.craftTrail.filter((p) => p.age < 0.25);
  const to = g.craftTo;
  if (!to) return;
  if (g.phase !== "play" || (!jetOn(g) && !cometOn(g)) || (cometOn(g) && g.fuelOut)) {
    g.craftTo = null;
    return;
  }
  const dx = to.x - g.shieldX;
  const dy = to.y - g.shieldY;
  const d = Math.hypot(dx, dy);
  const step = CRAFT_TRAVEL * dt;
  const x0 = g.shieldX;
  const y0 = g.shieldY;
  if (d <= step) {
    moveShield(g, to.x, to.y);
    g.craftTo = null;
  } else moveShield(g, g.shieldX + (dx / d) * step, g.shieldY + (dy / d) * step);
  if (Math.hypot(g.shieldX - x0, g.shieldY - y0) > 0.5) g.craftTrail.push({x: g.shieldX, y: g.shieldY, age: 0});
  if (g.shieldX === x0 && g.shieldY === y0) g.craftTo = null; // (it cannot get any closer: at the edge of where it can fly)
}

/** Fighter jet: the points for a skull that is shot: more for every perfect 10, and many more on the higher levels (so it pays to level up). */
export function jetKillPoints(g: GameState): number {
  return 2 * g.level * endlessLevel(g);
}

/** A shot hits: a skull pops, a 10 is lost (shot to bits), and a boss loses some of its life. */
function shoot(g: GameState, n: NumberTile, damage: number): void {
  if (n.boss) {
    n.boss.hp -= damage;
    if (n.boss.hp <= 0) burstBoss(g, n);
    return;
  }
  n.done = true;
  if (n.op === "skull") {
    g.score += scaled(g, jetKillPoints(g));
    g.events.push({t: "skull", x: n.x, y: n.y});
  } else g.events.push({t: "pop", x: n.x, y: n.y});
}

/** What touches the jet: a ball is picked up, and a skull (or a boss) knocks out the jet for a moment, unless its shield takes the hit. True if it is dealt with. */
function touchJet(g: GameState, n: NumberTile): boolean {
  if (n.pickup) {
    if (touchesCraft(g, n, JET_R + 6)) {
      n.done = true;
      if (n.pickup === "weapon") takeWeapon(g, n);
      else if (n.pickup === "heart") g.shipHp = Math.min(SHIP_HP, g.shipHp + 1);
      else if (n.pickup === "fuel") {
        g.fuel = 1;
        g.fuelOut = false;
      } else g.jetShield = true;
      g.jetGot = 0;
      g.jetGotKind = n.pickup;
      g.score += scaled(g, 5 * g.level);
      g.events.push({t: "pickup", x: n.x, y: n.y, kind: n.pickup});
    } else if (n.y > MISS_Y + 40) n.done = true;
    return true; // (a ball for the jet never lands in a cup)
  }
  if (n.op !== "skull" || !touchesCraft(g, n, JET_R)) return false;
  g.events.push({t: "boom", x: (n.x + g.shieldX) / 2, y: (n.y + g.shieldY) / 2, big: false});
  g.shake = Math.max(g.shake, 0.35);
  if (g.jetShield) g.jetShield = false;
  else g.jetStun = JET_STUN;
  if (n.boss) {
    // (a boss is not popped: it is knocked back up a bit)
    n.y -= 50;
    n.prevY = n.y;
    return true;
  }
  n.done = true;
  return true;
}

/**
 * Comet belt: steel 2s fall down the columns into the cups (five 2s make a perfect 10), now and then a shield ball (it takes the next hit), and comets (balls of fire, no number) fall beside the columns, in front of
 * the cups, now and then a whole row of them chained together with one gap to fly through. The ship must not touch a comet or a 2.
 */
function spawnComet(g: GameState): void {
  // (now and then a shield ball, when the ship has no shield: fly into it, and it takes the next hit; and a fuel ball, that fills up the tank)
  // (and a heart, when the ship has lost a life: it gives one back)
  const extra: Pickup | null = g.shipHp < SHIP_HP && g.rng() < 0.05 ? "heart" : !g.jetShield && g.rng() < 0.05 ? "shield" : g.rng() < 0.06 ? "fuel" : null;
  if (extra) {
    const x = 30 + g.rng() * (W - 60);
    const n = newNumber(g, colNear(g, x), x, 0, "add");
    n.pickup = extra;
    g.numbers.push(n);
    return;
  }
  // (the 2s, of steel, come down the columns and land in the cups: two in three of what falls; the rest are comets)
  if (g.rng() < 0.22) {
    const col = Math.floor(g.rng() * g.cols.length);
    g.numbers.push(newNumber(g, col, g.cols[col], TARGET, "ten"));
    return;
  }
  // (from the second level, now and then a giant planet: as wide as two columns, slow, between them)
  if (endlessLevel(g) >= 2 && g.cols.length >= 2 && g.rng() < 0.08) {
    const k = 1 + Math.floor(g.rng() * (g.cols.length - 1));
    const x = (g.cols[k - 1] + g.cols[k]) / 2;
    const n = newNumber(g, colNear(g, x), x, 0, "add");
    n.comet = true;
    n.planet = true;
    n.scale = PLANET_SCALE;
    n.y -= 40;
    n.prevY = n.y;
    g.numbers.push(n);
    return;
  }
  // (the comets come down beside the columns, between the cups and at the sides: a row of them, chained together, has one gap to fly through)
  const beside: number[] = [];
  const c = g.cols;
  beside.push(Math.max(12, c[0] - 40));
  for (let k = 1; k < c.length; k++) beside.push((c[k - 1] + c[k]) / 2);
  beside.push(Math.min(W - 12, c[c.length - 1] + 40));
  // (the comets are of different sizes: the smaller one is, the faster it falls; a row has one size)
  const size = 0.6 + g.rng() * 0.7;
  const comet = (x: number): NumberTile => {
    const n = newNumber(g, colNear(g, x), x, 0, "add");
    n.comet = true;
    n.scale = size;
    g.numbers.push(n);
    return n;
  };
  if (g.variantTime > 8 && g.rng() < 0.18) {
    const gap = Math.floor(g.rng() * beside.length);
    let link = 0;
    beside.forEach((x, k) => {
      if (k === gap) return;
      const n = comet(x);
      if (link === 0) link = n.id;
      n.link = link;
    });
    return;
  }
  comet(Math.min(W - 12, Math.max(12, beside[Math.floor(g.rng() * beside.length)] + (g.rng() - 0.5) * 12)));
}

/** The ship touched a comet: a big explosion, and the round is over. */
function crash(g: GameState, n: NumberTile): void {
  n.done = true;
  if (g.shipHurt > 0) return; // (just hit: it cannot be hurt again for a moment)
  if (g.jetShield) {
    // (the shield takes the hit: it is gone, and the ship flies on)
    g.jetShield = false;
    g.shake = Math.max(g.shake, 0.35);
    g.events.push({t: "boom", x: n.x, y: n.y, big: false});
    return;
  }
  // (a life is lost; the last one is the end)
  g.shipHp -= 1;
  if (g.shipHp > 0) {
    g.shipHurt = SHIP_HURT;
    g.shake = Math.max(g.shake, 0.5);
    g.events.push({t: "boom", x: n.x, y: n.y, big: false});
    g.events.push({t: "hurt", x: g.shieldX, y: g.shieldY, hp: g.shipHp});
    return;
  }
  g.shake = Math.max(g.shake, 0.8);
  g.events.push({t: "boom", x: g.shieldX, y: g.shieldY, big: true});
  endGame(g, "crash");
}

// ---- The snake --------------------------------------------------------------------------

/** Whether the snake is played (as the match mode, or on a rung of the daily ladder). */
export function snakeOn(g: GameState): boolean {
  return g.variant === "snake" || mixNow(g) === "snake";
}

/** The track of the snake: rows across the screen, from the top down, one way and back the other way, joined by half circles at the sides; the last row ends over a cup. */
const SNAKE_TOP = 20;
const SNAKE_ROWS = 7;
const SNAKE_ROW = 70;
const SNAKE_R = SNAKE_ROW / 2;
const SNAKE_LEFT = 42;
const SNAKE_RIGHT = W - 42;
/** Where the track ends: a little way down from the last row, over the cup it ends at. */
const SNAKE_END_Y = SNAKE_TOP + (SNAKE_ROWS - 1) * SNAKE_ROW + 40;
const SNAKE_STEP = 2;
/** How far apart the numbers of the train are along the track. */
export const SNAKE_GAP = 54;
/** How fast the front of the train (with the head) slides back while there is a gap in the train. */
const SNAKE_PULL = 110;
/** How fast the numbers behind a gap slide up to close it (only off the screen, before the start of the track). */
const SNAKE_CATCH = 190;
/** A back ball: how many seconds the train goes back, and how fast. */
export const SNAKE_BACK_TIME = 1.6;
const SNAKE_BACK_SPEED = 90;
/** A slow ball: how many seconds the train goes slowly, and how much slower. */
export const SNAKE_SLOW_TIME = 5;
const SNAKE_SLOW = 0.35;
/** Every number that is taken: the snake slides slowly back for this many seconds (at most SNAKE_RECOIL_MAX in all), at this speed. */
export const SNAKE_RECOIL = 0.6;
const SNAKE_RECOIL_MAX = 3;
const SNAKE_RECOIL_SPEED = 25;
/** How many seconds the laser of a cup stuns the snake. */
export const SNAKE_STUN = 3;
/** The extra chance that a new number of the snake is a bomb: more, the more steel there is in the train (a bomb is the way to get rid of it). */
export function snakeBombChance(g: GameState): number {
  const steel = g.numbers.filter((m) => m.track !== undefined && m.op === "steel" && !m.done).length;
  return Math.min(0.3, 0.035 * steel);
}
/** The chance that a new number of the snake is a heart, while a cup is dead. */
export const SNAKE_HEART_CHANCE = 0.025;
/** At most this many hearts come in a round of the snake. */
export const SNAKE_HEARTS_MAX = 5;
/** How far a bomb of the snake reaches. */
const SNAKE_BOMB_REACH = 95;
/** How many taps the head of a boss (every tenth level) takes. */
export const SNAKE_BOSS_HP = 3;
/** The extra points of a golden 10 when it is taken (times the level). */
const SNAKE_GOLD_POINTS = 30;

let snakeCache: {end: number; pts: {x: number; y: number}[]} | null = null;

/** The points of the track (one every SNAKE_STEP along it), from where it comes in at the top right to where it ends over a cup. */
export function snakePath(g: GameState): {x: number; y: number}[] {
  const end = g.snakeEnd;
  if (snakeCache && snakeCache.end === end) return snakeCache.pts;
  const pts: {x: number; y: number}[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / SNAKE_STEP));
    for (let i = 0; i < n; i++) pts.push({x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n});
  };
  const arc = (cx: number, cy: number, a0: number, a1: number): void => {
    const n = Math.max(1, Math.round((Math.abs(a1 - a0) * SNAKE_R) / SNAKE_STEP));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push({x: cx + SNAKE_R * Math.cos(a), y: cy + SNAKE_R * Math.sin(a)});
    }
  };
  for (let r = 0; r < SNAKE_ROWS; r++) {
    const y = SNAKE_TOP + r * SNAKE_ROW;
    const left = r % 2 === 0; // (the first row goes to the left)
    const x0 = r === 0 ? W + 40 : left ? SNAKE_RIGHT : SNAKE_LEFT;
    if (r === SNAKE_ROWS - 1) {
      line(x0, y, end, y);
      line(end, y, end, SNAKE_END_Y);
      pts.push({x: end, y: SNAKE_END_Y});
      break;
    }
    line(x0, y, left ? SNAKE_LEFT : SNAKE_RIGHT, y);
    if (left) arc(SNAKE_LEFT, y + SNAKE_R, -Math.PI / 2, -1.5 * Math.PI);
    else arc(SNAKE_RIGHT, y + SNAKE_R, -Math.PI / 2, Math.PI / 2);
  }
  snakeCache = {end, pts};
  return pts;
}

/** How long the track is. */
export function snakeLength(g: GameState): number {
  return (snakePath(g).length - 1) * SNAKE_STEP;
}

/** Where on the screen a place of the track is (before its start it goes on straight, off the screen to the right), and which way it goes there. */
export function snakePoint(g: GameState, s: number): {x: number; y: number; a: number} {
  const pts = snakePath(g);
  if (s <= 0) return {x: pts[0].x - s, y: pts[0].y, a: Math.PI};
  const i = Math.min(pts.length - 2, Math.floor(s / SNAKE_STEP));
  const u = Math.min(1, s / SNAKE_STEP - i);
  const p = pts[i];
  const q = pts[i + 1];
  return {x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, a: Math.atan2(q.y - p.y, q.x - p.x)};
}

/** How fast the train goes: faster on every level. */
export function snakeSpeed(g: GameState): number {
  return Math.min(95, 36 + 4 * (endlessLevel(g) - 1)) * (1 + SNAKE_BOOST * g.snakeBoost);
}

/** How much faster the snake gets for every perfect 10 that fades off the bar (until the next level). */
export const SNAKE_BOOST = 0.2;

/** A whole perfect 10 has faded off the bar: the snake gets faster (and it shows, at its head). */
export function snakeFaster(g: GameState): void {
  g.snakeBoost += 1;
  g.snakeFastT = 0;
  const head = g.numbers.find((n) => n.snakeHead && n.track !== undefined);
  const p = head ? {x: head.x, y: head.y} : {x: W / 2, y: 300};
  g.events.push({t: "snakeFaster", x: p.x, y: p.y});
}

/** How many numbers the train has behind its head: more on every level (half as many again behind the head of a boss). */
export function snakeTrainLength(g: GameState): number {
  const level = endlessLevel(g);
  return Math.round(Math.min(60, 16 + 4 * (level - 1)) * (level % 10 === 0 ? 1.5 : 1));
}

/** A new number for the train: mostly plain numbers (minus numbers too from the fourth level), and now and then a back ball, a slow ball, or (from the second level) a steel number. */
function snakeTile(g: GameState, s: number): NumberTile {
  const level = endlessLevel(g);
  // (the more steel there is in the train, the more bombs come: a bomb is the way to get rid of it)
  // (a heart now and then while a cup is dead, and never two at a time: tapped, it goes down into the dead cup and brings it back)
  if (g.cups.some((c) => c.dead) && !g.numbers.some((m) => m.track !== undefined && m.bonus === "life" && !m.done) && g.rng() < SNAKE_HEART_CHANCE) {
    const heart = newNumber(g, 0, W + 40, 0, "add", "life");
    g.snakeHearts += 1;
    heart.track = s;
    return heart;
  }
  if (g.rng() < snakeBombChance(g)) {
    const bomb = newNumber(g, 0, W + 40, 0, "add", "bomb");
    bomb.track = s;
    return bomb;
  }
  const r = g.rng();
  let n: NumberTile;
  if (level >= 2 && r < 0.045) {
    n = newNumber(g, 0, W + 40, 0, "add");
    n.pickup = "back";
  } else if (r >= 0.9 && r < 0.95) {
    // (a bomb: tapped, it blows up the numbers round it, and they are gone)
    n = newNumber(g, 0, W + 40, 0, "add", "bomb");
  } else if (level >= 2 && r >= 0.86 && r < 0.9) {
    n = newNumber(g, 0, W + 40, 0, "zero");
  } else if (level >= 3 && r >= 0.8 && r < 0.86) {
    n = newNumber(g, 0, W + 40, 2, "mul");
  } else if (r < 0.09) {
    n = newNumber(g, 0, W + 40, 0, "add");
    n.pickup = "slow";
  } else if (level >= 2 && r < 0.2) {
    n = newNumber(g, 0, W + 40, 1 + Math.floor(g.rng() * 3), "steel");
  } else {
    const v = 1 + Math.floor(g.rng() * Math.min(7, 3 + level));
    n = newNumber(g, 0, W + 40, level >= 4 && g.rng() < 0.25 ? -v : v, "add");
    // (from the third level some are frozen in ice: a tap cracks it, the next tap takes the number)
    if (level >= 3 && g.rng() < 0.12) n.ice = 1;
  }
  n.track = s;
  return n;
}

/** A new train for the level: the head (a boss on every tenth level) and the numbers behind it, coming in from the top right; the track ends over one of the living cups. */
function buildSnake(g: GameState): void {
  for (const n of g.numbers) if (n.track !== undefined) n.done = true;
  g.numbers = g.numbers.filter((n) => !n.done);
  const level = endlessLevel(g);
  g.snakeBuilt = level;
  g.snakeBack = 0;
  g.snakeSlow = 0;
  g.snakeRecoil = 0;
  g.snakeStun = 0;
  g.snakeBoost = 0;
  g.snakeFastT = 99;
  const alive = g.cups.filter((c) => !c.dead);
  const end = alive.length > 0 ? alive[Math.floor(g.rng() * alive.length)] : g.cups[0];
  g.snakeEnd = end ? end.x : W / 2;
  const head = newNumber(g, 0, W + 40, 99, "skull");
  head.snakeHead = true;
  head.track = 0;
  if (level % 10 === 0) head.boss = {hp: SNAKE_BOSS_HP, max: SNAKE_BOSS_HP};
  g.numbers.push(head);
  const len = snakeTrainLength(g);
  for (let k = 1; k <= len; k++) g.numbers.push(snakeTile(g, -k * SNAKE_GAP));
  placeSnake(g);
}

/** Puts every number of the train where its place on the track is. */
function placeSnake(g: GameState): void {
  for (const n of g.numbers) {
    if (n.track === undefined) continue;
    const p = snakePoint(g, n.track);
    n.prevY = n.y;
    n.x = p.x;
    n.y = p.y;
  }
}

/** The numbers of the train, the one furthest along first. */
export function snakeTrain(g: GameState): NumberTile[] {
  return g.numbers.filter((n) => n.track !== undefined && n.state === "fall" && !n.done).sort((a, b) => b.track! - a.track!);
}

/**
 * The snake, every frame: the front of the train goes on at its pace (or back, after a back ball; or slowly, after a slow ball), and every number behind it follows SNAKE_GAP
 * behind the one in front of it; behind a gap (a number that was taken) they slide up faster until it is closed. Two numbers that meet that way and make 10 melt together into a
 * golden 10. New numbers come in at the back as numbers go, so the train stays as long. What gets to the end of the track leaves it and lands in the nearest living cup there:
 * the head too, which kills the cup.
 */
function updateSnake(g: GameState, dt: number): void {
  if (g.snakeBuilt < 0) buildSnake(g); // (only once: a new level does not start it over)
  g.snakeBack = Math.max(0, g.snakeBack - dt);
  g.snakeSlow = Math.max(0, g.snakeSlow - dt);
  g.snakeRecoil = Math.max(0, g.snakeRecoil - dt);
  g.snakeStun = Math.max(0, g.snakeStun - dt);
  g.snakeFastT += dt;
  for (const n of g.numbers) {
    if (n.fuse === undefined || n.done) continue;
    n.fuse -= dt;
    if (n.fuse <= 0) snakeBlast(g, n);
  }
  for (const n of g.numbers) if (n.track !== undefined && n.chain !== null && !g.numbers.some((m) => m.id === n.chain && !m.done && m.state === "fall")) n.chain = null;
  // (stunned by a laser it does not go on, but it can still be pushed back)
  const pace = g.snakeBack > 0 ? -SNAKE_BACK_SPEED : g.snakeRecoil > 0 ? -SNAKE_RECOIL_SPEED : snakeSpeed(g) * (g.snakeSlow > 0 ? SNAKE_SLOW : 1);
  const v = g.snakeStun > 0 ? Math.min(0, pace) : pace;
  const train = snakeTrain(g);
  if (train.length > 0) {
    // (as long as the train does not hang together (a number was taken, or blown away), the part in front, with the head, slides back to the rest, which
    // goes on at its own pace: until they meet again)
    // (a gap counts wherever it is, at the start of the track too, where the part behind it has not come onto the screen yet)
    const at = train.findIndex((n, i) => i > 0 && train[i - 1].track! - n.track! > SNAKE_GAP + 0.5);
    const gap = at > 0;
    const front = gap ? Math.min(v, -SNAKE_PULL) : v;
    train[0].track! = Math.max(0, train[0].track! + front * dt);
    let ahead = train[0];
    for (let i = 1; i < train.length; i++) {
      const n = train[i];
      const want = ahead.track! - SNAKE_GAP;
      if (want - n.track! > 2) n.closing = true;
      // (off the screen, before the start of the track, a number that has come in behind a gap slides up fast)
      // (behind the gap the rest of the train stays where it is, until the head has come back to it)
      const step = gap && i >= at ? (g.snakeBack > 0 ? v : 0) : v;
      n.track = Math.min(want, n.track! + (step + (n.track! < 0 && !gap ? SNAKE_CATCH : 0)) * dt);
      if (n.closing && n.track >= want - 0.01) {
        n.closing = false;
        // (two plain numbers that meet and make 10: they melt together into a golden 10)
        if (!ahead.snakeHead && !ahead.pickup && !n.pickup && !ahead.bonus && !n.bonus && ahead.ice === 0 && n.ice === 0 && ahead.chain === null && n.chain === null && ahead.op === "add" && n.op === "add" && ahead.v + n.v === TARGET) {
          ahead.op = "ten";
          ahead.v = TARGET;
          ahead.gold = true;
          n.done = true;
          const p = snakePoint(g, ahead.track!);
          g.events.push({t: "pickup", x: p.x, y: p.y, kind: "weapon"});
          continue;
        }
      }
      ahead = n;
    }
  }
  // (new numbers come in at the back, so that the train stays as long as it is)
  // (always at the start of the track, behind the last one: never in the middle of the track, however long the train has got)
  const rest = g.numbers.filter((n) => n.track !== undefined && !n.done);
  const last = rest.reduce((m, n) => Math.min(m, n.track!), Infinity);
  if (last === Infinity || last > -SNAKE_GAP) {
    const n = snakeTile(g, Math.min(last === Infinity ? 0 : last - SNAKE_GAP, -SNAKE_GAP));
    n.closing = false;
    // (from the fourth level two plain numbers next to each other are sometimes chained: a tap on one takes both)
    const tail = rest.find((m) => m.track === last);
    const plain = (m: NumberTile): boolean => m.op === "add" && !m.pickup && !m.bonus && !m.snakeHead && m.ice === 0 && m.chain === null;
    if (endlessLevel(g) >= 4 && tail && plain(tail) && plain(n) && g.rng() < 0.15) {
      n.chain = tail.id;
      tail.chain = n.id;
    }
    g.numbers.push(n);
  }
  placeSnake(g);
  // What gets to the end of the track lands in the nearest living cup (a back ball or a slow ball is gone).
  const end = snakeLength(g);
  for (const n of g.numbers) {
    if (n.track === undefined || n.done || n.track < end) continue;
    n.track = undefined;
    n.closing = false;
    if (n.pickup || n.bonus) {
      n.done = true;
      g.events.push({t: "pop", x: n.x, y: n.y});
      continue;
    }
    n.state = "dive";
    n.target = null;
    n.aim = n.x;
    n.hang = null;
    n.speed = 40;
    n.tilt = 1;
  }
  g.numbers = g.numbers.filter((n) => !n.done);
}

/**
 * A tap in the snake: a number of the train jumps out and goes down into the nearest living cup (a golden 10 gives extra points); the head cannot be taken (a boss head loses a
 * life, and pops after its last one); a steel number cannot be tapped; a back ball sends the train back a bit, and a slow ball slows it down.
 */
function tapSnake(g: GameState, x: number, y: number, skip?: Set<number>): boolean {
  let hit: NumberTile | undefined;
  let bd = TAP_RADIUS;
  for (const n of g.numbers) {
    if (n.track === undefined || n.state !== "fall" || n.done || skip?.has(n.id)) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      hit = n;
    }
  }
  if (!hit) return false;
  skip?.add(hit.id);
  if (hit.snakeHead) {
    if (hit.boss) {
      hit.boss.hp -= 1;
      g.shake = Math.max(g.shake, 0.3);
      if (hit.boss.hp <= 0) {
        hit.done = true;
        g.score += scaled(g, 100 * g.level);
        g.shake = Math.max(g.shake, 0.6);
        for (let k = 0; k < 5; k++) g.events.push({t: "skull", x: hit.x + Math.cos(k * 1.26) * 22, y: hit.y + Math.sin(k * 1.26) * 22});
        g.events.push({t: "boom", x: hit.x, y: hit.y, big: true});
        g.numbers = g.numbers.filter((n) => !n.done);
      } else g.events.push({t: "boom", x: hit.x, y: hit.y, big: false});
    } else g.events.push({t: "steel", x: hit.x, y: hit.y});
    return true;
  }
  if (hit.op === "steel") {
    g.events.push({t: "steel", x: hit.x, y: hit.y});
    return true;
  }
  if (hit.bonus === "life") {
    // (a heart goes down into the dead cup nearest to it, and brings it back)
    const dead = nearestDeadCup(g, hit.x);
    if (!dead) return false;
    hit.track = undefined;
    hit.closing = false;
    startDive(g, hit, dead.id, dead.x);
    return true;
  }
  if (hit.bonus === "bomb") {
    snakeBlast(g, hit);
    return true;
  }
  if (hit.pickup) {
    hit.done = true;
    if (hit.pickup === "back") g.snakeBack = SNAKE_BACK_TIME;
    else g.snakeSlow = SNAKE_SLOW_TIME;
    g.events.push({t: "pickup", x: hit.x, y: hit.y, kind: hit.pickup});
    g.numbers = g.numbers.filter((n) => !n.done);
    return true;
  }
  if (hit.ice > 0) {
    hit.ice -= 1;
    g.events.push({t: "ice", x: hit.x, y: hit.y, broke: hit.ice === 0});
    return true;
  }
  if (!g.cups.some((c) => !c.dead)) return false;
  if (hit.gold) g.score += scaled(g, SNAKE_GOLD_POINTS * g.level);
  hit.track = undefined;
  hit.closing = false;
  // (taking a number pushes the snake slowly back a little)
  g.snakeRecoil = Math.min(SNAKE_RECOIL_MAX, g.snakeRecoil + SNAKE_RECOIL);
  sendDown(g, hit, null);
  // (a number on a chain takes the one it is chained to with it, into its own cup, when the chain goes taut)
  const mate = hit.chain !== null ? g.numbers.find((m) => m.id === hit.chain && m.track !== undefined && m.state === "fall" && !m.done) : undefined;
  if (mate) {
    mate.track = undefined;
    mate.closing = false;
    mate.ice = 0;
    sendDown(g, mate, hit.id);
  }
  return true;
}

/**
 * Fighter jet: a whole perfect 10 has faded off the bar, and the weapons go down a step: the way with the most upgrades loses one (the technique first, then the special, then the
 * gun, when they have as many); a way with none left loses its weapon. The basic shot always stays.
 */
export function jetWeaponDown(g: GameState): void {
  let best: WeaponPath | null = null;
  for (const p of ["c", "b", "a"] as WeaponPath[]) {
    if (!g.jetWeapons[p]) continue;
    if (!best || g.jetLv[p] > g.jetLv[best]) best = p;
  }
  if (!best) return;
  g.jetLv[best] -= 1;
  if (g.jetLv[best] <= 0) {
    g.jetLv[best] = 0;
    g.jetWeapons[best] = null;
  }
  g.jetDown = 0;
  g.events.push({t: "weaponDown", x: g.shieldX, y: g.shieldY, empty: !g.jetWeapons.a && !g.jetWeapons.b && !g.jetWeapons.c});
}

/**
 * A bomb of the snake goes off: the numbers of the train round it are blown away (not the head, which is only made dizzy if it is near), each one pushing the
 * snake back a little. A bomb that the blast reaches is set off too, a moment later (a chain of blasts).
 */
function snakeBlast(g: GameState, bomb: NumberTile): void {
  bomb.done = true;
  bomb.fuse = undefined;
  for (const m of g.numbers) {
    if (m === bomb || m.done || m.track === undefined || m.snakeHead || Math.hypot(m.x - bomb.x, m.y - bomb.y) > SNAKE_BOMB_REACH) continue;
    if (m.bonus === "bomb") {
      // (another bomb: its fuse is lit, it goes off in a moment)
      if (m.fuse === undefined) {
        m.fuse = SNAKE_FUSE;
        g.events.push({t: "bombChain", x: m.x, y: m.y, fromX: bomb.x, fromY: bomb.y});
      }
      continue;
    }
    m.done = true;
    g.score += scaled(g, g.level);
    g.events.push({t: "pop", x: m.x, y: m.y});
    g.snakeRecoil = Math.min(SNAKE_RECOIL_MAX, g.snakeRecoil + SNAKE_RECOIL);
  }
  const head = g.numbers.find((m) => m.snakeHead && !m.done && m.track !== undefined);
  if (head && Math.hypot(head.x - bomb.x, head.y - bomb.y) <= SNAKE_BOMB_REACH) g.snakeStun = SNAKE_STUN;
  g.shake = Math.max(g.shake, 0.5);
  g.events.push({t: "boom", x: bomb.x, y: bomb.y, big: true});
  g.numbers = g.numbers.filter((n) => !n.done);
}

/** How long after a blast reaches it another bomb goes off. */
const SNAKE_FUSE = 0.22;

/** Comet belt: how big a giant planet is, next to a comet of the usual size (it is as wide as two columns). */
export const PLANET_SCALE = 3.2;
