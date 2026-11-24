import {DAILY_BONUS, DAILY_REWARD, DAILY_RUNGS} from "./constants";
import {SHOP_CUPS} from "./cups";
import type {CupKind, PerkId} from "./types";

// The daily challenge: everyone gets the same numbers on the same day, and one try.

/** The perks, and how many times each can be taken in one round (the ones that are cups can be taken once each: there is only one of each). */
export const PERK_LIMIT: Record<PerkId, number> = {slow: 4, shield: 99, cloth: 99, life: 99, remove: 2, bonus: 3, help: 3, gold: 1, thermos: 1, magnet: 1, big: 1, laser: 1, sparse: 3, special: 3, points: 3, time: 4, helpers: 3};

/**
 * The special perks, the ones the saucers of the shop have too (10% fewer numbers, 10% more special numbers, 50% more points): they are not in the
 * ordinary offer, but with a bit of luck one of the three perks to choose between is one of them.
 */
export const SPECIAL_PERKS: readonly PerkId[] = ["sparse", "special", "points"];
/** The chance that one of the perks on offer is a special one. */
export const SPECIAL_PERK_CHANCE = 0.2;
export const PERKS = (Object.keys(PERK_LIMIT) as PerkId[]).filter((p) => !SPECIAL_PERKS.includes(p));

/** How much slower the numbers fall for every "slower" perk taken. */
export const PERK_SLOWER = 0.92;

/** How many cups a rung of the ladder needs: five on the first, and two more on every rung after it (5, 7, 9 ...). */
export function rungGoal(rung: number): number {
  return 3 + 2 * Math.max(1, Math.floor(rung));
}

/** How many cups it takes to climb the first `rungs` rungs (5, 12, 21 ...). */
export function cupsToClimb(rungs: number): number {
  let n = 0;
  for (let r = 1; r <= rungs; r++) n += rungGoal(r);
  return n;
}

/** How many whole rungs have been climbed with this many cups done. */
export function rungsDone(cupsDone: number): number {
  let r = 0;
  while (cupsToClimb(r + 1) <= cupsDone) r++;
  return r;
}

/** Whether the cup that has just been filled (this many cups are done now) was the last one of a rung. */
export function rungEnds(cupsDone: number): boolean {
  return cupsDone > 0 && cupsToClimb(rungsDone(cupsDone)) === cupsDone;
}

/**
 * The rung that cup number `cupsDone` is on (1 and up), the cups needed on it, and how many of them are done once that cup is in
 * (so the cup that finishes a rung shows a full bar). With no cup done yet it is the start of the first rung.
 */
export function rungOfCup(cupsDone: number): {rung: number; goal: number; into: number} {
  if (cupsDone <= 0) return {rung: 1, goal: rungGoal(1), into: 0};
  const rung = rungsDone(cupsDone - 1) + 1;
  return {rung, goal: rungGoal(rung), into: cupsDone - cupsToClimb(rung - 1)};
}

/** The day as text, in the player's own time (the day changes at midnight where they are): 2026-11-14. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A number for the random numbers of a day (the same text always gives the same number). */
export function seedOfDay(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Random numbers (0 to 1) that follow from a seed: the same seed gives the same numbers every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The coins for a round: what the rungs that were climbed pay, and the bonus on top for getting to the top. */
export function dailyReward(rungsDone: number, cleared: boolean): number {
  let coins = 0;
  for (let i = 0; i < Math.min(DAILY_RUNGS, Math.max(0, Math.floor(rungsDone))); i++) coins += DAILY_REWARD[i];
  return cleared ? coins + DAILY_BONUS : coins;
}

// ---- Days in a row ----------------------------------------------------------------------

/** How many stages of the way up have to be cleared for the day to count for the streak (the red line in the pictures is drawn above this one). */
export const STREAK_RUNGS = 4;

/** How many days in a row make a week: on the last one there is a package, and then it starts over. */
export const STREAK_DAYS = 7;

/** The days in a row: the last day that was counted, how many days that made, and whether a package is waiting to be opened. */
export interface Streak {
  last: string;
  count: number;
  gift: boolean;
}

/** The day before a day (as text, 2026-03-01 gives 2026-02-28). */
export function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** Which day of the week of days in a row today is (1 to 7): the next one if yesterday was counted, the same if today is counted already, otherwise the first. */
export function streakDayFor(s: Streak | null, today: string): number {
  if (!s) return 1;
  if (s.last === today) return s.count;
  if (s.last === previousDay(today)) return s.count >= STREAK_DAYS ? 1 : s.count + 1;
  return 1;
}

/** How many days in a row there are to show: 0 when a day has been missed (it starts over). */
export function streakCount(s: Streak | null, today: string): number {
  if (!s) return 0;
  return s.last === today || s.last === previousDay(today) ? s.count : 0;
}

/** Today counts (a rung was climbed): the streak after it. A package comes on the last day of the week, and waits until it is opened. */
export function recordDay(s: Streak | null, today: string): Streak {
  if (s && s.last === today) return s;
  const day = streakDayFor(s, today);
  return {last: today, count: day, gift: (s?.gift ?? false) || day === STREAK_DAYS};
}

/** What the coins of the ladder are multiplied by on a day of the streak: a little more for every day (+10 percent a day, so +60 percent on the seventh). */
export function streakFactor(day: number): number {
  return 1 + 0.1 * (Math.min(STREAK_DAYS, Math.max(1, Math.floor(day))) - 1);
}

/** Coins with the bonus of the day. */
export function streakCoins(amount: number, day: number): number {
  return Math.round(amount * streakFactor(day));
}

/** What a rung pays on a day of the streak (the top rung has the bonus for getting all the way up in it). */
export function rungPayout(index: number, day: number): number {
  return streakCoins(DAILY_REWARD[index], day) + (index === DAILY_RUNGS - 1 ? streakCoins(DAILY_BONUS, day) : 0);
}

/** What a package can hold: coins, pull-down screens (cloths), energy, or a copy of a cup with a power. */
export type Package = {kind: "coins"; n: number} | {kind: "cloth"; n: number} | {kind: "energy"; n: number} | {kind: "cup"; cup: Exclude<CupKind, "plain">};

/** Picks what is in a package (2 in 5 coins, and one in 5 each of the others). */
export function rollPackage(rng: () => number): Package {
  const r = rng();
  if (r < 0.4) return {kind: "coins", n: 150 + 50 * Math.floor(rng() * 6)};
  if (r < 0.6) return {kind: "cloth", n: 2};
  if (r < 0.8) return {kind: "energy", n: 5};
  return {kind: "cup", cup: SHOP_CUPS[Math.min(SHOP_CUPS.length - 1, Math.floor(rng() * SHOP_CUPS.length))]};
}
