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

/** A cup that reaches exactly this is a perfect 10. */
export const TARGET = 10;

/** How close (game units) a finger has to be to a number to tap it. */
export const TAP_RADIUS = 34;
