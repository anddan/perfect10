/** "menu": the book. "intro": a new kind of number is being presented (the round waits). "play": a round. "over": lost. "won": cleared a level of the book. */
export type Phase = "menu" | "intro" | "play" | "over" | "won";

/** The new kinds of number a chapter brings in, one at a time: the pull-down screen, the fourth cup, the 0, three bonus balls, chains, ice, ghosts, the black number, the star, the steel number and the chain of three. */
export type Feature = "screen" | "cups" | "zero" | "points" | "life" | "slow" | "chain" | "ice" | "ghost" | "fog" | "star" | "steel" | "chain3";

/**
 * "tutorial": a guided round where you try each thing. "plus": the plus levels (only plus numbers).
 * "mixed": the plus and minus levels. "times": the same, with blue multiplication numbers as well.
 * "divide": all of those, with yellow division numbers as well.
 * "space": all of them at once, on a spaceship.
 * "endless": plus and minus, with no end.
 */
export type Mode = "tutorial" | "plus" | "mixed" | "times" | "divide" | "space" | "endless";

/** What a number does to the cup it lands in: adds itself (green and red), multiplies it (blue), divides it (yellow), sets it to 0 (orange), adds itself and hides the number of the cup (black), or is a steel number that adds itself but cannot be tapped. */
export type Op = "add" | "mul" | "div" | "zero" | "dim" | "steel";

/** The bonus balls, with a gold border: "life" brings a dead cup back, "points" gives points, "slow" slows the numbers down, and a "star" (which jumps between the columns) clears all the cups. */
export type Bonus = "life" | "points" | "slow" | "star";

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
  /** A black number has landed in it: its number is hidden until it starts over, so the player has to count in their head. */
  hidden: boolean;
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
  /** The id of a second number this one is chained to (the middle number of a chain of three), or null. */
  chain2: number | null;
  /** A ghost number is sometimes hidden (turned over, or see-through) while it falls; null for an ordinary one. */
  ghost: Ghost | null;
  /** How many taps are left to crack the ice a number is frozen in (0: no ice). A number in ice only dives when the ice is gone. */
  ice: number;
  /** "fall": drifting down on its own. "dive": tapped, on its way into a cup. */
  state: "fall" | "dive";
  target: number | null;
  /** The sideways place a tapped number is heading for: the column of the cup it was sent to. It keeps to it even if the cups are swapped on the way. (A star that jumps between the columns: the column it is jumping to.) */
  aim: number;
  /** Vertical speed while diving (negative is up: the hop after a tap, then gravity turns it down). (A star: seconds until it jumps to another column.) */
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
  | {t: "won"; stars: 1 | 2 | 3}
  | {t: "introHide"; features: Feature[]}
  | {t: "combo"; n: number; x: number; y: number; bonus: number}
  | {t: "sweep"}
  | {t: "screens"; n: number}
  | {t: "steel"; x: number; y: number};

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
  /** The x of every column the numbers fall in (and the cups stand in): three in the first chapter, four in all the others. */
  cols: readonly number[];
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
  /** How many more times the player can carry on from where a round was lost (by watching an ad): one in a round, none in the tutorial. */
  continuesLeft: number;
  /** Seconds left of the LEVEL UP banner. */
  banner: number;
  shake: number;
  time: number;
  nextId: number;
  events: GameEvent[];
  rng: () => number;
  /** How many perfect 10s have come in a row, each within a few seconds of the one before it (0 when there is no combo going), and the seconds left to make the next one. */
  combo: number;
  comboTimer: number;
  /** A cup has died and the heart that brings it back has not come yet: the next bonus ball is a life ball. */
  lifeDue: boolean;
  /** The level was cleared with three stars, and that gave a pull-down screen (for the effect on the card). */
  screenWon: boolean;
  /** How many pull-down screens there are left to use, and how long ago the one that is down now started to come down (-1: none is down). */
  screens: number;
  sweep: number;
  /** The new kinds of number that are being presented now (phase "intro"). */
  intro: Feature[];
  /** The ones the player has asked not to be shown again (remembered by the screen, not by the rules). */
  hideIntros: Set<Feature>;
}
