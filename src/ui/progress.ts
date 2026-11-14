// The progress bar along the bottom of the screen: one segment for every cup a level needs.
// It lies under the cups, where it does not hide any of the numbers falling above them.
import {W} from "../game/constants";
import {rungOfCup} from "../game/daily";
import {ENDLESS_CUPS_PER_LEVEL, goalFor} from "../game/engine";
import type {GameState} from "../game/types";

/** Where the bar is (game units). */
export const BAR = {x: 10, y: 615, w: W - 20, h: 18};

/** Segments in the endless game: it has no end, so the bar fills five cups at a time. */
const ENDLESS_SEGMENTS = ENDLESS_CUPS_PER_LEVEL;
/** Room for the "NIVÅ" label at the left end of the endless game's bar. */
const LABEL_W = 70;
const GAP = 4;

/** How many segments the bar has (`cupsDone` is how many cups are done: in the daily challenge each rung needs one more cup than the last). */
export function segmentCount(g: GameState, cupsDone: number = g.level - 1): number {
  if (g.daily) return rungOfCup(cupsDone).goal;
  return g.mode === "endless" ? ENDLESS_SEGMENTS : goalFor(g.mode, g.stage);
}

/** Where the segments start, how wide each one is, and the gap between them. */
export function segmentLayout(g: GameState, cupsDone: number = g.level - 1): {x0: number; segW: number; gap: number; count: number} {
  const count = segmentCount(g, cupsDone);
  const x0 = BAR.x + 7 + (g.mode === "endless" ? LABEL_W : 0);
  const total = BAR.x + BAR.w - 7 - x0;
  return {x0, segW: (total - GAP * (count - 1)) / count, gap: GAP, count};
}

/** The middle of a segment. */
export function segmentCenter(g: GameState, index: number, cupsDone: number = g.level - 1): {x: number; y: number} {
  const {x0, segW, gap} = segmentLayout(g, cupsDone);
  return {x: x0 + index * (segW + gap) + segW / 2, y: BAR.y + BAR.h / 2};
}

/** Which segment a cup that has just reached 10 fills, given the level the game is on now (it has gone up by one). */
export function segmentFilledBy(g: GameState, levelNow: number): number {
  if (g.daily) return rungOfCup(levelNow - 1).into - 1;
  return g.mode === "endless" ? (levelNow - 2) % ENDLESS_SEGMENTS : levelNow - 2;
}

/** How many segments are lit, given how many cups are done (the endless game starts over after five, keeping a full bar until the next cup). */
export function litSegments(g: GameState, cupsDone: number): number {
  if (cupsDone <= 0) return 0;
  if (g.daily) return rungOfCup(cupsDone).into;
  return g.mode === "endless" ? ((cupsDone - 1) % ENDLESS_SEGMENTS) + 1 : Math.min(cupsDone, segmentCount(g));
}
