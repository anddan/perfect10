/** "menu": the book. "play": a round. "over": lost. "won": cleared a level of the book. */
export type Phase = "menu" | "play" | "over" | "won";

/**
 * "tutorial": a guided round where you try each thing. "plus": the plus levels (only plus numbers).
 * "mixed": the plus and minus levels. "times": the same, with blue multiplication numbers as well.
 * "divide": all of those, with yellow division numbers as well.
 * "endless": plus and minus, with no end.
 */
export type Mode = "tutorial" | "plus" | "mixed" | "times" | "divide" | "endless";

/** What a number does to the cup it lands in: adds itself (green and red), multiplies it (blue) or divides it (yellow). */
export type Op = "add" | "mul" | "div";

/** The bonus balls, with a gold border: "life" brings a dead cup back, "points" gives points, "slow" slows the numbers down. */
export type Bonus = "life" | "points" | "slow";

/** What the guide says in the tutorial after something happened: "good" when it went right, "retry" when it has to be done again. */
export type TutorialNote = "" | "good" | "retry";

export type GameOverReason = "deadCup" | "allDead";

export interface Cup {
  id: number;
  x: number;
  y: number;
  /** The sum in the cup. Beyond 10 or beyond minus 10 means the cup is dead. */
  value: number;
  dead: boolean;
  /** 1 -> 0 after a number lands: the cup squashes a little. */
  bump: number;
  /** 1 -> 0: the ring spreading over the coffee. */
  ripple: number;
  /** Seconds left of showing the golden 10 before the cup starts over at 0. */
  showTen: number;
  /** Whether that golden number is 10 (1) or minus 10 (-1). */
  tenSign: 1 | -1;
  /** 1 -> 0: a white flash (revived). */
  flash: number;
  seed: number;
}

export interface NumberTile {
  id: number;
  col: number;
  x: number;
  y: number;
  prevY: number;
  v: number;
  /** What it does to the cup: add `v` to it, multiply it by `v`, or divide it by `v`. */
  op: Op;
  /** A bonus ball (a number tile with a gold border that is tapped to collect it, and never lands in a cup), or null. */
  bonus: Bonus | null;
  /** The id of the number this one is chained to (the two fall side by side, and tapping one pulls the other down too), or null. */
  chain: number | null;
  /** A ghost number is sometimes hidden (turned over, or see-through) while it falls; null for an ordinary one. */
  ghost: Ghost | null;
  /** How many taps are left to crack the ice a number is frozen in (0: no ice). A number in ice only dives when the ice is gone. */
  ice: number;
  /** "fall": drifting down on its own. "dive": tapped, on its way into a cup. */
  state: "fall" | "dive";
  target: number | null;
  /** The sideways place a tapped number is heading for: the column of the cup it was sent to. It keeps to it even if the cups are swapped on the way. */
  aim: number;
  /** Vertical speed while diving (negative is up: the hop after a tap, then gravity turns it down). */
  speed: number;
  /** The id of the tapped number whose chain this one hangs on until the chain goes taut and drags it down after it, or null. */
  hang: number | null;
  /** Which way a tapped number tilts while it hops: -1 to the left, 1 to the right (0 until it is tapped). */
  tilt: -1 | 0 | 1;
  phase: number;
  scale: number;
  done: boolean;
}

/** A ghost number comes and goes: "flip" turns over to show its back, "fade" turns see-through. */
export type Ghost = "flip" | "fade";

/** What happened, for the screen and the sound to react to. The engine only adds to the list. */
export type GameEvent =
  | {t: "tap"}
  | {t: "ice"; x: number; y: number; broke: boolean}
  | {t: "land"; x: number; y: number; v: number; op: Op; cupId: number}
  | {t: "levelUp"; cupId: number; level: number}
  | {t: "revive"; cupId: number}
  | {t: "bust"; cupId: number}
  | {t: "miss"; x: number; y: number}
  | {t: "gameOver"; reason: GameOverReason; newBest: boolean}
  | {t: "bonus"; kind: Bonus; x: number; y: number; amount: number}
  | {t: "won"};

export interface GameState {
  phase: Phase;
  /** Which of the book's games is being played (or was played last). */
  mode: Mode;
  /** Which of the twelve levels of a level page (1 to 12); 0 in the tutorial and the endless game. */
  stage: number;
  /** Added to the level when working out how hard the numbers are: every level of the book starts harder than the last. */
  base: number;
  /** The tutorial: which step it is on (0 to 3, and 4 when it is done), the pause before the next step starts, and what the guide says. */
  tutorialStep: number;
  tutorialDelay: number;
  tutorialNote: TutorialNote;
  /** Seconds of slow motion left, and seconds until the next bonus ball comes. */
  slow: number;
  bonusTimer: number;
  cups: Cup[];
  numbers: NumberTile[];
  level: number;
  score: number;
  best: number;
  newBest: boolean;
  spawnTimer: number;
  /** Seconds since the round ended, lost or won (the screen waits a moment before its buttons work). */
  overTimer: number;
  overReason: GameOverReason | null;
  /** Seconds left of the LEVEL UP banner. */
  banner: number;
  shake: number;
  time: number;
  nextId: number;
  events: GameEvent[];
  rng: () => number;
}
