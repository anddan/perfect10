import {DAILY_BONUS, DAILY_REWARD, DAILY_RUNGS} from "./constants";
import type {PerkId} from "./types";

// The daily challenge: everyone gets the same numbers on the same day, and one try.

/** The perks, and how many times each can be taken in one round (the ones that are cups can be taken once each: there is only one of each). */
export const PERK_LIMIT: Record<PerkId, number> = {slow: 4, shield: 99, cloth: 99, life: 99, bonus: 3, help: 3, gold: 1, thermos: 1, magnet: 1, big: 1, laser: 1};
export const PERKS = Object.keys(PERK_LIMIT) as PerkId[];

/** How much slower the numbers fall for every "slower" perk taken. */
export const PERK_SLOWER = 0.92;

/** How many cups a rung of the ladder needs: five on the first, and one more on every rung after it (5, 6, 7 ...). */
export function rungGoal(rung: number): number {
  return 4 + Math.max(1, Math.floor(rung));
}

/** How many cups it takes to climb the first `rungs` rungs (5, 11, 18 ...). */
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
