import type {SaucerKind} from "./saucers";

/** "menu": the book. "intro": a new kind of number is being presented (the round waits). "play": a round. "over": lost. "won": cleared a level of the book. */
export type Phase = "menu" | "intro" | "perk" | "play" | "over" | "won";

/** The new kinds of number a chapter brings in, one at a time: the pull-down screen, the fourth cup, the 0, three bonus balls, chains, ice, ghosts, the black number, the star, the steel number and the chain of three. */
export type Feature = "screen" | "cups" | "zero" | "ten" | "points" | "life" | "slow" | "pause" | "bomb" | "cloth" | "shield" | "chain" | "ice" | "ghost" | "fog" | "star" | "steel" | "chain3" | "diamond" | "cup3" | "vchain" | "fade";

/**
 * "tutorial": a guided round where you try each thing. "plus": the plus levels (only plus numbers). "minus": only minus numbers (reach −10).
 * "mixed": the plus and minus levels. "times": the same, with blue multiplication numbers as well.
 * "divide": all of those, with yellow division numbers as well.
 * "space": all of them at once, on a spaceship.
 * "endless": plus and minus, with no end.
 */
/**
 * The match modes, which are the endless game with rules of their own: "save" (Save the cup: one of the four cups is dead from the start, only 1s fall, and a 1
 * that gets into the dead cup is the end; it gets faster and faster) and "sixeight" (6 or 8: only 6s, 8s and numbers that divide by 2 fall).
 */
export type Variant = "save" | "sixeight";

export type Mode = "tutorial" | "plus" | "minus" | "mixed" | "times" | "divide" | "space" | "endless";

/** What a number does to the cup it lands in: adds itself (green and red), multiplies it (blue), divides it (yellow), sets it to 0 (orange), sets it to 10 (orange, with a 10 on it), adds itself and hides the number of the cup (black), or is a steel number that adds itself but cannot be tapped. */
export type Op = "add" | "mul" | "div" | "zero" | "ten" | "dim" | "steel";

/**
 * The bonus balls, with a gold border: "life" brings a dead cup back, "points" gives points, "slow" slows the numbers down, "pause"
 * stops them for a few seconds, "bomb" blows away the numbers close to it, "cloth" gives one more pull-down screen, "shield" puts a shield on the
 * nearest cup (it takes the number that would have killed the cup), and a "star" (which jumps between the columns) clears all the cups.
 */
export type Bonus = "life" | "points" | "slow" | "pause" | "bomb" | "cloth" | "shield" | "star" | "diamond";

/** The perks of the daily challenge: "slow" (the numbers fall slower), "shield" (a shield on a cup), "cloth" (one more pull-down screen), "life" (a dead cup is back), "bonus" (more bonus balls), "help" (more numbers that finish a cup), "remove" (a dead cup is taken away), or a cup with a property (it replaces an ordinary cup). */
export type PerkId = "slow" | "shield" | "cloth" | "life" | "bonus" | "help" | "remove" | "gold" | "thermos" | "magnet" | "big" | "laser" | "sparse" | "special" | "points";

/** What the guide says in the tutorial after something happened: "good" when it went right, "retry" when it has to be done again. */
export type TutorialNote = "" | "good" | "retry";

/** The kinds of cup: an ordinary one, and the four of the shop (gold: double points; thermos: starts with a shield; magnet: takes a number that would have killed another cup; big: does not die until it is over 12; laser: a double tap clears its column). */
export type CupKind = "plain" | "gold" | "thermos" | "magnet" | "big" | "laser";

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
  /** What the cup started over with after the perfect 10 (0, or what was over for a big cup): the golden 10 is shown until something else lands in it. */
  tenCarry: number;
  /** Whether that golden number is 10 (1) or minus 10 (-1). */
  tenSign: 1 | -1;
  /** 1 -> 0: a white flash (revived). */
  flash: number;
  /** A black number has landed in it: its number is hidden until it starts over, so the player has to count in their head. */
  hidden: boolean;
  /** The properties of the cup (see CupKind): none for an ordinary cup, and any number of them (they can be combined). */
  kinds: CupKind[];
  /** The saucer the cup stands on (from the shop): see saucers.ts. */
  saucer?: SaucerKind;
  /** A laser cup: seconds until it can be fired again (0: ready). */
  charge: number;
  /** A shield (from a shield ball): the next number that would have killed the cup is stopped, and the shield is gone. */
  shield: boolean;
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
  | {t: "levelUp"; cupId: number; level: number; done: number}
  | {t: "revive"; cupId: number}
  | {t: "bust"; cupId: number}
  | {t: "miss"; x: number; y: number}
  | {t: "gameOver"; reason: GameOverReason; newBest: boolean}
  | {t: "bonus"; kind: Bonus; x: number; y: number; amount: number}
  | {t: "blast"; x: number; y: number; hits: {x: number; y: number}[]}
  | {t: "shield"; cupId: number; x: number; y: number; on: boolean}
  | {t: "laser"; x: number; y: number; hits: {x: number; y: number}[]}
  | {t: "zap"; x: number; y: number; hits: {x: number; y: number; at: number; ten: boolean}[]}
  | {t: "zapHit"; x: number; y: number; ten: boolean}
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
  /** The properties the player has put on the cups on the desk (from the shop), cup by cup from the left, when a round starts (the rest are ordinary). */
  loadout: CupKind[][];
  /** The saucers the player has put on the desk (from the shop), under the cups from the left, when a round starts (null: an ordinary saucer). */
  saucerLoadout: (SaucerKind | null)[];
  /** The daily challenge is being played (it is the endless game, with the same numbers for everyone, and perks after every level). The perks taken, the three to choose between now (phase "perk"), and how much the "slower" perks have slowed the numbers (1: not at all). */
  daily: boolean;
  /** The match mode that is being played (it is the endless game, with rules of its own), and the seconds it has been going. */
  variant: Variant | null;
  variantTime: number;
  perks: PerkId[];
  perkChoices: PerkId[];
  /** How many times each of them is taken if it is chosen (sometimes a perk is offered as x2 or x3: x2 of the shield puts a shield on two cups). */
  perkTimes: number[];
  speedMul: number;
  /** How many game units the playfield reaches above the top of the usual 640 (a tall phone has more room): the numbers start falling from up there. 0 on a short screen. */
  extra: number;
  /** The diamond is changing the numbers: seconds since it began, where it hangs, and the numbers that are to be changed (when, and to a 10 or a 0). Everything else waits. Null when no diamond is at work. */
  zap: {time: number; x: number; y: number; end: number; steps: {id: number; at: number; ten: boolean; done: boolean}[]} | null;
  /** Seconds of slow motion left, seconds the numbers are stopped for (a pause ball), and seconds until the next bonus ball comes. */
  slow: number;
  pause: number;
  bonusTimer: number;
  /** The new kinds of number that this level (or this level of the endless game) brings in and that have not been shown yet, and the seconds until the next one is made to fall. */
  showcase: Feature[];
  showTimer: number;
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
  /** How much of the progress has faded away (from level 3 of plus & minus, and in the endless game): in twentieths of a perfect 10, one every so often. */
  drain: number;
  /** The seconds since the last step of it (the progress fades with time). */
  drainClock: number;
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
