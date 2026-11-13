export type Phase = "menu" | "play" | "over";

export type GameOverReason = "deadCup" | "allDead";

export interface Cup {
  id: number;
  x: number;
  y: number;
  /** The sum in the cup. Above 10 means the cup is dead. */
  value: number;
  dead: boolean;
  /** 1 -> 0 after a number lands: the cup squashes a little. */
  bump: number;
  /** 1 -> 0: the ring spreading over the coffee. */
  ripple: number;
  /** Seconds left of showing the golden 10 before the cup starts over at 0. */
  showTen: number;
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
  /** "fall": drifting down on its own. "dive": tapped, on its way into a cup. */
  state: "fall" | "dive";
  target: number | null;
  speed: number;
  phase: number;
  scale: number;
  done: boolean;
}

/** What happened, for the screen and the sound to react to. The engine only adds to the list. */
export type GameEvent =
  | {t: "tap"}
  | {t: "land"; x: number; y: number; v: number; cupId: number}
  | {t: "levelUp"; cupId: number; level: number}
  | {t: "revive"; cupId: number}
  | {t: "bust"; cupId: number}
  | {t: "miss"; x: number; y: number}
  | {t: "gameOver"; reason: GameOverReason; newBest: boolean};

export interface GameState {
  phase: Phase;
  cups: Cup[];
  numbers: NumberTile[];
  level: number;
  score: number;
  best: number;
  newBest: boolean;
  spawnTimer: number;
  /** Seconds since game over (the screen waits a moment before a tap restarts). */
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
