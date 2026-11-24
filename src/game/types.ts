import type {SaucerKind} from "./saucers";

/** "menu": the book. "intro": a new kind of number is being presented (the round waits). "play": a round. "over": lost. "won": cleared a level of the book. */
export type Phase = "menu" | "intro" | "perk" | "play" | "over" | "won";

/** The new kinds of number a chapter brings in, one at a time: the pull-down screen, the fourth cup, the 0, three bonus balls, chains, ice, ghosts, the black number, the star, the steel number and the chain of three. */
export type Feature = "screen" | "cups" | "zero" | "ten" | "points" | "life" | "slow" | "pause" | "bomb" | "cloth" | "shield" | "chain" | "ice" | "ghost" | "fog" | "star" | "steel" | "chain3" | "diamond" | "cup3" | "vchain" | "fade" | "wand" | "reverse" | "eraser" | "skull";

/**
 * "tutorial": a guided round where you try each thing. "plus": the plus levels (only plus numbers). "minus": only minus numbers (reach −10).
 * "mixed": the plus and minus levels. "times": the same, with blue multiplication numbers as well.
 * "divide": all of those, with yellow division numbers as well.
 * "space": all of them at once, on a spaceship.
 * "endless": plus and minus, with no end.
 */
/**
 * The match modes, which are the endless game with rules of their own: "save" (Save the cup: one of the four cups is dead from the start, only 1s fall, and a 1
 * that gets into the dead cup is the end; it gets faster and faster) and "sixeight" (Even numbers: only 2s, 4s, 8s, times 2 and divided by 2 fall).
 */
export type Variant = "save" | "sixeight" | "defend" | "ice" | "fast" | "find" | "shield" | "jet" | "comet" | "snake" | "cannon" | "line" | "mine" | "ninja";

export type Mode = "tutorial" | "plus" | "minus" | "mixed" | "times" | "divide" | "space" | "endless";

/** What a number does to the cup it lands in: adds itself (green and red), multiplies it (blue), divides it (yellow), sets it to 0 (orange), sets it to 10 (orange, with a 10 on it), adds itself and hides the number of the cup (black), or is a steel number that adds itself but cannot be tapped. */
export type Op = "add" | "mul" | "div" | "zero" | "ten" | "dim" | "steel" | "skull" | "trap";

/**
 * The bonus balls, with a gold border: "life" brings a dead cup back, "points" gives points, "slow" slows the numbers down, "pause"
 * stops them for a few seconds, "bomb" blows away the numbers close to it, "cloth" gives one more pull-down screen, "shield" puts a shield on the
 * nearest cup (it takes the number that would have killed the cup), and a "star" (which jumps between the columns) clears all the cups.
 */
export type Bonus = "life" | "points" | "slow" | "pause" | "bomb" | "cloth" | "shield" | "star" | "diamond" | "wand" | "reverse";

/** The perks of the daily challenge: "slow" (the numbers fall slower), "shield" (a shield on a cup), "cloth" (one more pull-down screen), "life" (a dead cup is back), "bonus" (more bonus balls), "help" (more numbers that finish a cup), "remove" (a dead cup is taken away), or a cup with a property (it replaces an ordinary cup). */
export type PerkId = "slow" | "shield" | "cloth" | "life" | "bonus" | "help" | "remove" | "gold" | "thermos" | "magnet" | "big" | "laser" | "sparse" | "special" | "points" | "time" | "helpers";

/** What the guide says in the tutorial after something happened: "good" when it went right, "retry" when it has to be done again. */
export type TutorialNote = "" | "good" | "retry";

/** The kinds of cup: an ordinary one, and the four of the shop (gold: double points; thermos: starts with a shield; magnet: takes a number that would have killed another cup; big: does not die until it is over 12; laser: a double tap clears its column). */
export type CupKind = "plain" | "gold" | "thermos" | "magnet" | "big" | "laser";

export type GameOverReason = "deadCup" | "allDead" | "crash" | "swarm" | "time" | "lava" | "stuck" | "ninja";

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
  /** Fast fingers: the seconds it still hangs still in the air (then a 10 or a 0 pops, and a skull falls). Not set for any other number. */
  hover?: number;
  /** Knocked away by the shield (Shield up): it flies off sideways at this speed and lands nowhere. */
  vx?: number;
  /** Shield up: a boss skull (big): how many seconds the shield still has to hold it up before it pops, and how many it had. */
  boss?: {hp: number; max: number};
  /** Already turned by the magic wand (into a 0 or a 10), so it is not turned again. */
  wanded?: boolean;
  /** The fighter jet: what it gets if it flies into this ball (it is no number). */
  pickup?: Pickup;
  /** A weapon ball of the fighter jet: the weapon it gives (two of them come side by side when a way is to be chosen: the one not taken goes). */
  weapon?: Weapon;
  /** How much the laser or the flame of the jet has burned it so far (it pops at 1). */
  burn?: number;
  /** The comet belt: a 1 that is a comet (it has a tail of fire). */
  comet?: boolean;
  /** Balls that hang together in a chain (a row of comets, or skulls one over the other): the same number for all of them. */
  link?: number;
  /** The snake: how far along the track it is (it is on the track, in the train, while this is set). */
  track?: number;
  /** The snake: the head of the train (a skull that cannot be taken: in a cup it kills it). */
  snakeHead?: boolean;
  /** The snake: a golden 10 (two numbers that met and made 10): it gives extra points when it is taken. */
  gold?: boolean;
  /** The snake: it is sliding up to close a gap in the train (when it gets there, it may melt together with the one in front). */
  closing?: boolean;
  /** The snake: a ghost number: the seconds until it turns into another number. */
  shift?: number;
  /** The snake: a bomb that another bomb has set off: the seconds until it goes off too. */
  fuse?: number;
  /** Comet belt: a giant planet (it is as wide as two columns, and falls slowly). */
  planet?: boolean;
  /** Fighter jet: a skull with a shield in front (towards the jet): the shield (it wears down, and breaks), and the little life the skull has behind it. */
  guard?: {hp: number; max: number; life: number};
  /** Comet belt: a moon (smaller than a planet, bigger than a comet; it falls slowly too). */
  moon?: boolean;
  /** Thin ice (Ice world): it looks like any ice, but one tap breaks all of it. */
  thin?: boolean;
  /** "fall": drifting down on its own. "dive": tapped, on its way into a cup. */
  /** Falling on its own, tapped and on its way down into a cup, or tapped while the reverse is on and flying up and away. */
  state: "fall" | "dive" | "rise";
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
  | {t: "steel"; x: number; y: number}
  | {t: "erasers"; n: number}
  | {t: "pop"; x: number; y: number}
  | {t: "skull"; x: number; y: number}
  | {t: "boom"; x: number; y: number; big: boolean}
  | {t: "comets"; hits: {x: number; y: number; size: number}[]}
  | {t: "pickup"; x: number; y: number; kind: Pickup}
  | {t: "weaponDown"; x: number; y: number; empty: boolean}
  | {t: "hurt"; x: number; y: number; hp: number}
  | {t: "snakeFaster"; x: number; y: number}
  | {t: "bombChain"; x: number; y: number; fromX: number; fromY: number}
  | {t: "tenMade"; balls: {x: number; y: number; v: number}[]; chain: number}
  | {t: "bubblePop"; x: number; y: number; v: number}
  | {t: "swarmDown"}
  | {t: "lineTen"; pts: {x: number; y: number}[]}
  | {t: "lineFail"}
  | {t: "mineDig"; x: number; y: number; v: number}
  | {t: "mineTen"; x: number; y: number}
  | {t: "ninjaCut"; x: number; y: number; v: number; n: number}
  | {t: "ninjaToss"}
  | {t: "mineTip"; x: number; y: number}
  | {t: "mineHeavy"; x: number; y: number}
  | {t: "mineGate"; x: number; y: number}
  | {t: "mineGem"; x: number; y: number}
  | {t: "mineErase"; pts: {x: number; y: number}[]}
  | {t: "mineRestore"; pts: {x: number; y: number}[]}
  | {t: "guardHit"; x: number; y: number}
  | {t: "guardBreak"; x: number; y: number}
  | {t: "magnet"; x: number; y: number; balls: {x: number; y: number}[]}
  | {t: "lineChain"; pts: {x: number; y: number}[]; n: number}
  | {t: "ghostShift"; x: number; y: number}
  | {t: "laserCross"; x: number; y: number}
  | {t: "lineTick"; s: number}
  | {t: "lineBolt"; x: number; y: number; hits: {x: number; y: number}[]}
  | {t: "lineStep"; n: number}
  | {t: "lineLevel"};

/** What the fighter jet can pick up: faster and more guns, missiles from its wings, or a shield (and the ship of the comet belt: a shield, or a full tank of fuel). */
export type Pickup = "weapon" | "shield" | "fuel" | "heart" | "back" | "slow";

/** The three ways the weapons of the fighter jet can be made better: the gun (a), the special weapon (b) and the technique (c). In each one of two is chosen. */
export type WeaponPath = "a" | "b" | "c";
/** The weapons: bullets or a laser (the gun), a plasma flame or missiles (the special weapon), and ricochet or rapid fire (the technique). */
export type Weapon = "bullet" | "laser" | "flame" | "missile" | "ricochet" | "rapid";

/** A shot of the fighter jet: a bullet straight up, or a missile that steers after a skull (the last few places it was, for its smoke). */
export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  missile: boolean;
  /** How hard it hits (more during a combo, and more on the later levels). */
  power?: number;
  age: number;
  trail: {x: number; y: number}[];
  /** Ricochet: how many more times it bounces on to another target, and what it has hit already. */
  bounces?: number;
  hit?: number[];
  dead?: boolean;
}

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
  /** Fast fingers: the seconds of the count down (3, 2, 1) left before the first numbers come. */
  countdown: number;
  /** A number has landed: with only two or three cups, the next number to come finishes one of them. */
  helpDue: boolean;
  /** How many numbers have come since the last one that finished a cup (with two or three cups). */
  sinceHelp: number;
  /** Find the Perfect 10: the seconds left to find the column, how many seconds it had, and the column that makes 10. */
  findTimer: number;
  findTotal: number;
  findAnswer: number;
  /** The daily ladder on a day of Fast fingers: the rung that last had its count down. */
  mixRung: number;
  perks: PerkId[];
  perkChoices: PerkId[];
  /** How many times each of them is taken if it is chosen (sometimes a perk is offered as x2 or x3: x2 of the shield puts a shield on two cups). */
  perkTimes: number[];
  speedMul: number;
  /** How many game units the playfield reaches above the top of the usual 640 (a tall phone has more room): the numbers start falling from up there. 0 on a short screen. */
  extra: number;
  /** The diamond is changing the numbers: seconds since it began, where it hangs, and the numbers that are to be changed (when, and to a 10 or a 0). Everything else waits. Null when no diamond is at work. */
  zap: {time: number; x: number; y: number; end: number; steps: {id: number; at: number; ten: boolean; done: boolean}[]} | null;
  /** Seconds of slow motion left, seconds the numbers are stopped for (a pause ball), seconds the magic wand is at work (every number is a 1: +1, −1, ×1 or ÷1), and seconds until the next bonus ball comes. */
  slow: number;
  pause: number;
  wand: number;
  /** Shield up: where the shield is (the middle of its top edge) and half of its width. */
  shieldX: number;
  shieldY: number;
  shieldW: number;
  /** Seconds since the shield last grew (a shield ball was caught), for the effect: large when it has not grown. */
  shieldGrew: number;
  /** Shield up: the power upgrades taken after the shield has reached its full size (each one hurts a boss more). */
  shieldPower: number;
  /**
   * The fighter jet: the weapon chosen in each of the three ways (null: not yet), the upgrades of each (0 to 3), its basic shot (1, or 0 when the weapons have run
   * down to nothing: then it does not shoot at all), the seconds since its weapons last went up or down (every so often they go down a step), the seconds since
   * they last went down (for the effect), whether it has a shield, and the seconds it is knocked out (cannot shoot).
   */
  jetWeapons: Record<WeaponPath, Weapon | null>;
  jetLv: Record<WeaponPath, number>;
  jetBase: number;
  jetDecay: number;
  jetDown: number;
  jetShield: boolean;
  /** What the laser and the flame reach this moment (for drawing them): the top of the beam (or null), and whether the flame is on. */
  jetBeam: number | null;
  jetFlame: boolean;
  /** Comet belt: the lives of the ship (3 at most) and the seconds it cannot be hurt again after a hit. */
  shipHp: number;
  shipHurt: number;
  jetStun: number;
  /** Whether a finger is holding the jet: it only shoots while it is held. */
  jetHeld: boolean;
  /** Comet belt: the fuel of the ship (1 is full). It is used while the ship is held, and fills up again while it is let go; when it runs out the ship cannot be flown until it has been let go and has filled up a bit. */
  fuel: number;
  fuelOut: boolean;
  /** Fighter jet: the slow missiles the skulls shoot back at the jet (from level 10). */
  enemyShots: {x: number; y: number; vx: number; vy: number; age: number; heavy?: boolean}[];
  /** The jet and the ship: where the craft is flying to on its own (the finger was put down somewhere else), and the trail of light it leaves on the way. */
  craftTo: {x: number; y: number} | null;
  craftTrail: {x: number; y: number; age: number}[];
  jetFire: number;
  jetMissileFire: number;
  shots: Shot[];
  jetGot: number;
  jetGotKind: Pickup;
  jetGotWeapon: Weapon | null;
  /** The snake: the level the train was set out for (a new train comes on every new level), the x where the track ends over the cups, and the seconds the train still goes back, or slowly. */
  snakeBuilt: number;
  snakeEnd: number;
  snakeBack: number;
  snakeSlow: number;
  /** The snake: the seconds it still slides slowly back (every number that is taken pushes it back a little). */
  snakeRecoil: number;
  /** The snake: the seconds it still stands still, stunned by the laser of a cup. */
  snakeStun: number;
  /** The snake: how many hearts have come this round (at most SNAKE_HEARTS_MAX). */
  snakeHearts: number;
  /** The cannon: the swarm of number balls (in columns hanging from the top), the ball on its way, the one in the cannon and the next, where the finger aims,
   *  the seconds to the next row of the swarm, the balls to look at again for a 10 (after the columns have closed up), and the golden 10s flying down to the cups. */
  bubbles: Bubble[];
  cannonShot: {x: number; y: number; vx: number; vy: number; v: number; kind?: CannonHelp} | null;
  cannonNow: number;
  cannonNext: number;
  /** The cannon: whether the ball in it, and the next one, is a helper instead of a number. */
  cannonNowKind: CannonHelp | null;
  cannonNextKind: CannonHelp | null;
  cannonAim: {x: number; y: number} | null;
  cannonRow: number;
  cannonCheck: number[];
  cannonWait: number;
  cannonFly: {x: number; y: number; tx: number; ty: number; age: number; chain: number}[];
  cannonChain: number;
  /** Draw to 10: the numbers lying on the board, the line that is being drawn (the ids of its tiles, in the order they were drawn), the seconds left,
   *  how many seconds the last 10 gave back (and how long ago), and how long ago a line that did not make 10 was let go. */
  tiles: LineTile[];
  linePath: number[];
  lineTime: number;
  lineGot: number;
  lineGotT: number;
  lineFail: number;
  /** Draw to 10: a line that makes 10, shown as a help on the first levels when the time is low (the ids of its tiles), or empty. */
  lineHint: number[];
  /** Draw to 10 and the cannon: how many numbers made the last 10, where it is shown, and how long ago it was made. */
  eqFx: {n: number; x: number; y: number; age: number} | null;
  /** The mine: its rows (row 0 is at the top; more are dug out as the miner goes down), where the miner is, what is in the basket, how far down the lava has come
   *  (in rows), how far down the view is (in rows, it follows the miner), the deepest row so far, and how long ago the basket tipped over. */
  mine: MineCell[][];
  miner: {c: number; r: number};
  mineSum: number;
  mineLava: number;
  mineCam: number;
  mineDeep: number;
  mineTip: number;
  /** The mine: the seconds the miner is still dazed after the basket tipped over (he cannot dig). */
  mineDaze: number;
  /** The mine: the keys the miner has (one for every perfect 10): a key opens a locked door. */
  mineKeys: number;
  /** The mine: how long ago a key was got (for its "+1 key"). */
  mineKeyT: number;
  /** Ninja: the balls in the air (thrown up from the bottom), the halves of the ones that were cut, the juice that splashed, the trail of the finger, where it
   *  was last, what the stroke has cut so far (its sum, how many, and where), the crosses (three is the end), the seconds of slow motion and of the freeze,
   *  the seconds to the next throw, the next id, the last word shown ("Too much!", "Bomb!") and how long ago. */
  ninjaBalls: NinjaBall[];
  ninjaHalves: {x: number; y: number; vx: number; vy: number; rot: number; vr: number; v: number; side: number; kind?: NinjaBall["kind"]; must?: boolean; angle: number; off: number; age: number}[];
  /** Ninja: the strokes so far (a shell hit by a stroke is not hit again by it). */
  ninjaStroke: number;
  /** Ninja: the perfect 10s in a row without a cross (every three of them is one step up of the points: ×2, ×3 ...), and how long ago the step went up. */
  ninjaCombo: number;
  ninjaComboT: number;
  ninjaSplats: {x: number; y: number; vx: number; vy: number; age: number; color: string; r: number}[];
  ninjaTrail: {x: number; y: number; age: number}[];
  ninjaLast: {x: number; y: number} | null;
  ninjaSum: number;
  ninjaCount: number;
  ninjaPts: {x: number; y: number}[];
  ninjaStrikes: number;
  ninjaSlow: number;
  ninjaFreeze: number;
  /** Ninja: the seconds of the star rain still left (a star was cut: numbers come thick and fast, and no bombs). */
  ninjaFrenzy: number;
  ninjaTimer: number;
  ninjaId: number;
  ninjaWord: {s: "too" | "bomb" | "ten" | "miss" | "life"; x: number; y: number; age: number} | null;
  /** The mine: the last swing of the pick (which way, and how long ago), where the miner last came from (and how long ago, for him to walk and fall there), and which way he looks (1 right, -1 left). */
  mineSwing: {dc: number; dr: number; t: number};
  mineFrom: {c: number; r: number; t: number};
  mineFace: number;
  /** The mine: what the basket came to when it went over 10 (shown with "Too much!"). */
  mineOver: number;
  /** Draw to 10: after a long line, the tiles that fell are looked at for a 10 on their own (a chain): the ids to look at, the seconds until then, how far the chain
   *  has gone, and the last chain shown (where, how far, and how long ago). */
  lineFell: number[];
  lineWait: number;
  lineChain: number;
  lineChainFx: {x: number; y: number; n: number; age: number} | null;
  /** The daily challenge: the seconds the title with the match mode of the day is still shown (it comes when the ladder starts). */
  dailyIntro: number;
  /** The snake: how many perfect 10s have faded off the bar on this level (each makes it faster), and the seconds since the last one did (for the effect). */
  snakeBoost: number;
  snakeFastT: number;
  /** The level the last boss of Shield up came at (one comes at every tenth level). */
  bossLevel: number;
  /** Seconds the reverse is on: a tapped number flies up and away instead of falling into a cup. */
  reverse: number;
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
  /** How many numbers of each kind have landed in the cups this round (for the card after it): plus, minus, times, divided by, 0, 10, steel, black and skull. */
  landed: Record<string, number>;
  /** The match mode that every other rung of today's daily ladder is played as (the even rungs). */
  dailyMix: Variant | null;
  /** The day of the daily challenge being played (each even rung of its ladder has a match mode of its own, picked at random for the day). */
  dailyDay: string;
  /** ...or an eraser instead (one or the other is the prize). */
  eraserWon: boolean;
  /** How many erasers there are left to use, and the seconds the one in use has left (every number that is tapped then pops). */
  erasers: number;
  erase: number;
  /** How many pull-down screens there are left to use, and how long ago the one that is down now started to come down (-1: none is down). */
  screens: number;
  sweep: number;
  /** The new kinds of number that are being presented now (phase "intro"). */
  intro: Feature[];
  /** The ones the player has asked not to be shown again (remembered by the screen, not by the rules). */
  hideIntros: Set<Feature>;
}

/** The cannon: a number ball of the swarm, in column c, row r (0 is the top row); dy is how far it is still sliding to its place, and glow the seconds
 *  until it pops when it is part of a 10. */
export interface Bubble {
  id: number;
  c: number;
  r: number;
  v: number;
  dy: number;
  glow?: number;
}

/** Draw to 10: a tile of the board, in column c, row r (0 is the top row). Its number is added (a minus number takes off), or it times or divides what the line
 *  is so far; or it is a helper (a clock gives time, a bomb blows up the tiles round it, a star is whatever number is needed), or a block of steel (it cannot
 *  be drawn through, only broken by a 10 next to it). Ice must be broken (by a 10 next to it) before the tile can be drawn through. dy: how far it is still falling. */
export interface LineTile {
  id: number;
  c: number;
  r: number;
  v: number;
  op: "add" | "mul" | "div";
  kind?: "clock" | "bomb" | "star" | "bolt" | "laser" | "steel";
  ice: number;
  dy: number;
}

/** The helpers the cannon can fire: a star (it becomes the number that makes the biggest 10 where it sticks), a bolt (it electrifies balls of the swarm at
 *  random: they are gone) and a bomb (it blows up the balls round it). */
export type CannonHelp = "star" | "bolt" | "bomb" | "laser" | "magnet";

/** The mine: a block of earth with a number (added to the basket, or a minus number taken off, or "times" it), a block of steel (it cannot be dug), or a
 *  helper (a bomb blows up the blocks round it, a star fills the basket up to 10, a laser clears its row and the column under it, a clock pushes the lava back).
 *  dug: it has been dug out (a tunnel). */
export interface MineCell {
  v: number;
  op: "add" | "mul";
  kind?: "steel" | "bomb" | "star" | "laser" | "clock" | "gate" | "gem";
  dug: boolean;
}



/** Ninja: a ball thrown up into the air, with a number (or a bomb, a star, a clock, ice). */
export interface NinjaBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  v: number;
  kind?: "bomb" | "star" | "clock" | "freeze" | "heart";
  /** It has been cut in this stroke already (so it is not cut twice). */
  cut: boolean;
  /** A golden number that must not be missed: one that falls out uncut is a cross. */
  must?: boolean;
  spin: number;
  /** A shell round the number: steel (it clinks the first time it is cut, the second cut cuts it) or ice (the first cut breaks the ice off), and the stroke that last hit it. */
  shell?: "steel" | "ice";
  hitBy?: number;
}

