// The game's own coordinate system: 360 x 640, portrait. The canvas scales it to the screen.
export const W = 360;
export const H = 640;

/** The four columns the numbers fall in (x centres). */
export const COLS = [45, 135, 225, 315] as const;

/** Where the desk begins (the cups stand on it). */
export const DESK_Y = 458;

export const CUP_W = 64;
export const CUP_H = 56;
/** Where the cups stand on the desk (their centre). They only move sideways, between the columns. */
export const CUP_START_Y = 566;

/** A number that gets this far down without landing in a cup hits the desk and is gone. */
export const MISS_Y = 618;

/** A cup that reaches exactly this (or exactly minus this, when minus numbers are in the game) is a perfect 10. */
export const TARGET = 10;

/** How many levels there are on each of the book's level pages (3 on every row, four rows). */
export const STAGES = 12;

/** How many things the tutorial lets you try. */
export const TUTORIAL_STEPS = 4;

/** A tapped number first hops up at this speed (units per second), then gravity pulls it down into the cup. */
export const DIVE_HOP = 320;
export const DIVE_GRAVITY = 1800;

/** Bonus balls: how many seconds the slow motion lasts, how slow the numbers fall in it, and the points a points ball gives per level. */
export const SLOW_SECONDS = 6;
export const SLOW_FACTOR = 0.4;
export const BONUS_POINTS = 100;

/** The hard parts of a chapter: chains come from this level of it (4 to 9), and ghost numbers from this one (7 to 9). */
export const CHAIN_FROM_STAGE = 4;
export const GHOST_FROM_STAGE = 7;
/** The last row of a chapter (levels 10 to 12) brings ice numbers: they have to be tapped this many times to crack the ice. */
export const ICE_FROM_STAGE = 10;
export const ICE_HITS = 2;
/** Seconds one ghost number takes to go from seen to hidden and back. */
export const GHOST_PERIOD = 2.6;
/** How far apart (game units) the two numbers of a chain can be before the chain is pulled straight. */
export const CHAIN_LENGTH = 100;

/** How close (game units) a finger has to be to a number to tap it. */
export const TAP_RADIUS = 34;
