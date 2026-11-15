// The progress bar along the bottom of the screen: one segment for every cup a level needs.
// It lies under the cups, where it does not hide any of the numbers falling above them.
import {W} from "../game/constants";
import {rungOfCup} from "../game/daily";
import {ENDLESS_CUPS_PER_LEVEL, FADE_TICKS, fadeCap, goalFor} from "../game/engine";
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

/**
 * Which segment a cup that has just reached 10 fills, given the level the game is on now (it has gone up by one). `done` is how many cups count
 * with what has faded taken off: the segment that is partly filled when the progress fades is the one that gets filled.
 */
export function segmentFilledBy(g: GameState, levelNow: number, done = levelNow - 1): number {
  if (!g.daily) {
    const seg = Math.max(0, Math.ceil(done - 1e-9) - 1);
    return g.mode === "endless" ? seg % ENDLESS_CUPS_PER_LEVEL : Math.min(segmentCount(g) - 1, seg);
  }
  if (g.daily) return rungOfCup(levelNow - 1).into - 1;
  return g.mode === "endless" ? (levelNow - 2) % ENDLESS_SEGMENTS : levelNow - 2;
}

/**
 * How many cups the bar shows when the progress fades, with a fraction for the segment that is partly gone: `pending` is how many stars are still on
 * their way, and `drain` what has faded so far (in twentieths of a cup, and it may be a fraction while it is shown fading away smoothly).
 */
export function shownProgress(g: GameState, pending: number, drain: number): number {
  return Math.max(0, g.level - 1 - pending - Math.min(drain, fadeCap(g)) / FADE_TICKS);
}

/** In the endless game the bar holds five cups: how much of the bar is filled, with a bar that has just been filled still full. */
export function barFill(g: GameState, progress: number): number {
  if (g.mode !== "endless" || progress <= 0) return progress;
  return progress - ENDLESS_CUPS_PER_LEVEL * (Math.ceil(progress / ENDLESS_CUPS_PER_LEVEL - 1e-9) - 1);
}

/** How many segments are lit, given how many cups are done (the endless game starts over after five, keeping a full bar until the next cup). */
export function litSegments(g: GameState, cupsDone: number): number {
  if (cupsDone <= 0) return 0;
  if (g.daily) return rungOfCup(cupsDone).into;
  return g.mode === "endless" ? ((cupsDone - 1) % ENDLESS_SEGMENTS) + 1 : Math.min(cupsDone, segmentCount(g));
}
