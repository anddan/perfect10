// The game's own coordinate system: 360 x 640, portrait. The canvas scales it to the screen.
export const W = 360;
export const H = 640;
/** A tall phone has room for the playfield to reach this many units higher than the top of the 640 (an iPhone 16 has about 140). A shorter screen shows less of it. */
export const EXTRA_MAX = 140;

/** The four columns the numbers fall in (x centres). */
export const COLS = [45, 135, 225, 315] as const;
/** The first chapter has only three columns (and three cups), in the middle of the screen. */
export const PLUS_COLS = [90, 180, 270] as const;

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
export const SLOW_SECONDS = 10;
export const SLOW_FACTOR = 0.25;
export const BONUS_POINTS = 100;
/** The pause ball stops the numbers dead for this many seconds (you can still tap). */
export const PAUSE_SECONDS = 3;
/** The bomb blows away every number (not bonus balls) within this many game units of it: the columns next to it, and the ones two columns away when they are at about the same height (the columns are 90 apart). */
export const BOMB_RADIUS = 190;

/** How many taps it takes to crack the ice a number is frozen in. */
export const ICE_HITS = 2;
/** Seconds one ghost number takes to go from seen to hidden and back. */
export const GHOST_PERIOD = 2.6;
/** How far apart (game units) the two numbers of a chain can be before the chain is pulled straight. */
export const CHAIN_LENGTH = 100;

/** Seconds the progress bar gets to finish its effect (the star that flies to it, and its pop) before the CLEARED card comes up. */
export const WIN_DELAY = 1.7;

/** A perfect 10 within this many seconds of the one before it builds a combo: the points of the perfect 10 go times 2, then times 3, and so on. */
export const COMBO_SECONDS = 5;
/** The bonus of a perfect 10 that is part of a combo (times the level and times the combo): twice the 50 of an ordinary perfect 10. */
export const COMBO_BONUS = 100;

/**
 * The pull-down screen (like the projector screen of a classroom) that wipes away every number in the air: how many you can keep,
 * how long it takes to come down, how long it stays down, how long it takes to roll up again, and how far down it reaches.
 */
/** The diamond ball changes every number in the air to an orange 10 (this chance for each) or an orange 0 (the rest). */
export const DIAMOND_TEN_CHANCE = 0.2;
export const SCREEN_MAX = 3;
export const SWEEP_DOWN = 0.55;
export const SWEEP_HOLD = 0.3;
export const SWEEP_UP = 0.5;
export const SWEEP_EDGE = 520;

/** How close (game units) a finger has to be to a number to tap it. */
export const TAP_RADIUS = 34;

/**
 * The daily challenge: a ladder of this many rungs (a rung is a level of the endless game: five cups). After every rung you choose
 * one of three perks to take along; each rung you get to pays coins, and the last one pays a bonus on top.
 */
export const DAILY_RUNGS = 6;
export const DAILY_REWARD = [10, 15, 20, 25, 30, 50] as const;
export const DAILY_BONUS = 100;
