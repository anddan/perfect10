import {describe, expect, it} from "vitest";
import {BONUS_POINTS, COLS, CUP_H, CUP_START_Y, CUP_W, SLOW_SECONDS, STAGES, W} from "./constants";
import {createGame, cupAt, dropCup, fallSpeed, ghostShow, goalFor, maxNumber, moveCup, nearestAliveCup, endlessLevel, showMenu, spawnInterval, startGame, tapAt, update} from "./engine";
import type {GameState, NumberTile} from "./types";

/** A game that is running, with no random numbers falling on their own. */
function playing(): GameState {
  const g = createGame(() => 0.5);
  startGame(g);
  g.spawnTimer = 1e9;
  return g;
}

/** Puts a number in the air. */
function drop(g: GameState, x: number, y: number, v: number): NumberTile {
  const n: NumberTile = {
    id: g.nextId++,
    col: 0,
    x,
    y,
    prevY: y,
    v,
    op: "add",
    bonus: null,
    chain: null,
    ghost: null,
    ice: 0,
    state: "fall",
    target: null,
    aim: x,
    speed: 0,
    hang: null,
    tilt: 0,
    phase: 0,
    scale: 1,
    done: false,
  };
  g.numbers.push(n);
  return n;
}

/** Taps a number and runs the game until it has landed. */
function tapAndSettle(g: GameState, n: NumberTile): void {
  expect(tapAt(g, n.x, n.y)).toBe(true);
  for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
  expect(g.numbers).toHaveLength(0);
}

describe("a new game", () => {
  it("starts with four empty cups, level 1 and no score", () => {
    const g = playing();
    expect(g.cups).toHaveLength(4);
    expect(g.cups.map((c) => c.value)).toEqual([0, 0, 0, 0]);
    expect(g.cups.map((c) => c.x)).toEqual([...COLS]);
    expect(g.level).toBe(1);
    expect(g.score).toBe(0);
    expect(g.phase).toBe("play");
  });

  it("gets harder with the level", () => {
    expect(fallSpeed(5)).toBeGreaterThan(fallSpeed(1));
    expect(spawnInterval(5)).toBeLessThan(spawnInterval(1));
    expect(maxNumber(1)).toBe(4);
    expect(maxNumber(99)).toBe(9);
  });

  it("lets numbers fall on its own", () => {
    const g = createGame(() => 0.5);
    startGame(g);
    for (let i = 0; i < 60 * 3; i++) update(g, 1 / 60);
    expect(g.numbers.length).toBeGreaterThan(0);
  });
});

describe("tapping a number", () => {
  it("sends it into the nearest living cup and adds it up", () => {
    const g = playing();
    const n = drop(g, 100, 200, 4); // closest to the second cup (x = 135)
    tapAndSettle(g, n);
    expect(g.cups[1].value).toBe(4);
    expect(g.cups.filter((c) => c.value > 0)).toHaveLength(1);
    expect(g.score).toBe(4);
  });

  it("skips a dead cup for a number that is not above it", () => {
    const g = playing();
    g.cups[1].dead = true;
    g.cups[1].value = 12;
    const n = drop(g, 90, 200, 3); // between the first and the dead cup, not over the dead one
    tapAndSettle(g, n);
    expect(g.phase).toBe("play");
    expect(g.cups[1].value).toBe(12);
    expect(g.cups[0].value + g.cups[2].value).toBe(3);
  });

  it("sends a tapped number over a dead cup straight down into it: game over", () => {
    const g = playing();
    g.cups[1].dead = true;
    g.cups[1].value = 12;
    const n = drop(g, 135, 200, 3); // right above the dead cup
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(n.target).toBeNull();
    for (let i = 0; i < 60 * 3 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(n.x).toBe(135); // straight down, it did not go sideways to a living cup
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("deadCup");
    expect(g.cups[0].value + g.cups[2].value + g.cups[3].value).toBe(0);
  });

  it("tilts to the left or to the right when tapped", () => {
    const g = playing();
    const a = drop(g, 45, 200, 3);
    g.rng = () => 0.1;
    expect(tapAt(g, a.x, a.y)).toBe(true);
    expect(a.tilt).toBe(-1);
    const b = drop(g, 225, 200, 3);
    g.rng = () => 0.9;
    expect(tapAt(g, b.x, b.y)).toBe(true);
    expect(b.tilt).toBe(1);
  });

  it("hops up before it falls", () => {
    const g = playing();
    const n = drop(g, 135, 200, 3);
    expect(tapAt(g, n.x, n.y)).toBe(true);
    update(g, 1 / 60);
    expect(n.y).toBeLessThan(200); // first upwards
    for (let i = 0; i < 20; i++) update(g, 1 / 60);
    expect(n.y).toBeGreaterThan(200 - 40); // then gravity has turned it down
    expect(n.speed).toBeGreaterThan(0);
  });

  it("does nothing when the tap misses every number", () => {
    const g = playing();
    drop(g, 100, 200, 4);
    expect(tapAt(g, 300, 300)).toBe(false);
  });

  it("picks the nearest of the living cups by sideways distance", () => {
    const g = playing();
    expect(nearestAliveCup(g, 10)?.id).toBe(g.cups[0].id);
    expect(nearestAliveCup(g, 340)?.id).toBe(g.cups[3].id);
    g.cups.forEach((c) => (c.dead = true));
    expect(nearestAliveCup(g, 10)).toBeUndefined();
  });
});

describe("reaching 10", () => {
  it("is a level up: the cup starts over at 0", () => {
    const g = playing();
    g.cups[1].value = 6;
    tapAndSettle(g, drop(g, 135, 200, 4));
    expect(g.level).toBe(2);
    expect(g.cups[1].value).toBe(0);
    expect(g.cups[1].dead).toBe(false);
    expect(g.cups[1].showTen).toBeGreaterThan(0);
    expect(g.events.some((e) => e.t === "levelUp" && e.level === 2)).toBe(true);
  });

  it("no longer brings a dead cup back after a perfect 10 (only a bonus ball does)", () => {
    const g = playing();
    g.cups[0].dead = true;
    g.cups[0].value = 13;
    g.cups[2].value = 5;
    tapAndSettle(g, drop(g, 225, 200, 5));
    expect(g.level).toBe(2); // the cup did reach 10
    expect(g.cups[0].dead).toBe(true);
    expect(g.cups[0].value).toBe(13);
  });
});

describe("going over 10", () => {
  it("kills the cup but not the game while another cup lives", () => {
    const g = playing();
    g.cups[1].value = 8;
    tapAndSettle(g, drop(g, 135, 200, 5));
    expect(g.cups[1].dead).toBe(true);
    expect(g.cups[1].value).toBe(13);
    expect(g.phase).toBe("play");
    expect(g.events.some((e) => e.t === "bust")).toBe(true);
  });

  it("is game over when the last living cup dies", () => {
    const g = playing();
    for (const c of g.cups.slice(0, 3)) {
      c.dead = true;
      c.value = 11;
    }
    g.cups[3].value = 9;
    tapAndSettle(g, drop(g, 315, 200, 4));
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("allDead");
  });
});

describe("a number landing in a dead cup", () => {
  it("is game over", () => {
    const g = playing();
    const dead = g.cups[2];
    dead.dead = true;
    dead.value = 12;
    // Falls on its own, straight down towards the dead cup.
    drop(g, dead.x, dead.y - CUP_H / 2 - 5, 2);
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("deadCup");
  });

  it("remembers the best score (in the endless game)", () => {
    const g = playing();
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    g.score = 123;
    const dead = g.cups[2];
    dead.dead = true;
    drop(g, dead.x, dead.y - CUP_H / 2 - 5, 1);
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.best).toBe(123);
    expect(g.newBest).toBe(true);
  });
});

describe("numbers nobody taps", () => {
  it("land in a living cup they fall over", () => {
    const g = playing();
    drop(g, g.cups[0].x, 300, 3);
    for (let i = 0; i < 60 * 8 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[0].value).toBe(3);
  });

  it("hit the desk and vanish when no cup is under them", () => {
    const g = playing();
    drop(g, 90, 300, 3); // between the first and second cup
    for (let i = 0; i < 60 * 12 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.numbers).toHaveLength(0);
    expect(g.cups.every((c) => c.value === 0)).toBe(true);
    expect(g.events.some((e) => e.t === "miss")).toBe(true);
  });
});

describe("moving the cups", () => {
  it("keeps them on the desk, standing in their row", () => {
    const g = playing();
    const c = g.cups[0];
    moveCup(g, c, -500);
    expect(c.x).toBeGreaterThanOrEqual(CUP_W / 2);
    expect(c.y).toBe(CUP_START_Y);
    moveCup(g, g.cups[3], 5000);
    expect(g.cups[3].x).toBeLessThanOrEqual(W - CUP_W / 2);
  });

  it("swaps places with the cup in the column it is dragged to", () => {
    const g = playing();
    const [a, b, c, d] = g.cups;
    moveCup(g, a, COLS[2]);
    dropCup(g, a);
    expect([a.x, b.x, c.x, d.x]).toEqual([COLS[2], COLS[1], COLS[0], COLS[3]]);
  });

  it("swaps along the way when dragged past several cups, and always ends in four different columns", () => {
    const g = playing();
    const [a, b, c, d] = g.cups;
    for (let x = COLS[0]; x <= COLS[3]; x += 5) moveCup(g, a, x);
    dropCup(g, a);
    expect([a.x, b.x, c.x, d.x]).toEqual([COLS[3], COLS[0], COLS[1], COLS[2]]);
  });

  it("goes back to its own column when it is let go where it started", () => {
    const g = playing();
    const a = g.cups[1];
    moveCup(g, a, COLS[1] + 20);
    dropCup(g, a);
    expect(g.cups.map((c) => c.x)).toEqual([...COLS]);
  });

  it("finds the cup under a finger", () => {
    const g = playing();
    expect(cupAt(g, g.cups[2].x + 5, CUP_START_Y)?.id).toBe(g.cups[2].id);
    expect(cupAt(g, 90, CUP_START_Y)).toBeUndefined();
  });

  it("moves a cup under a falling number so it lands there", () => {
    const g = playing();
    const moved = g.cups[0];
    moveCup(g, moved, COLS[1]); // swaps with the second cup, so it now stands in the second column
    dropCup(g, moved);
    drop(g, COLS[1], 300, 2);
    for (let i = 0; i < 60 * 8 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(moved.value).toBe(2);
    expect(g.cups[1].value).toBe(0);
  });
});

describe("restarting", () => {
  it("starts over clean but keeps the best score", () => {
    const g = playing();
    g.score = 50;
    g.best = 50;
    g.level = 4;
    g.cups[0].dead = true;
    startGame(g);
    expect(g.score).toBe(0);
    expect(g.level).toBe(1);
    expect(g.best).toBe(50);
    expect(g.cups.every((c) => !c.dead && c.value === 0)).toBe(true);
    expect(g.numbers).toHaveLength(0);
  });
});

describe("minus numbers", () => {
  /** A running game of this mode, with no random numbers falling on their own. */
  function playingMode(mode: "plus" | "mixed" | "endless"): GameState {
    const g = createGame(() => 0.5);
    startGame(g, mode);
    g.spawnTimer = 1e9;
    return g;
  }

  it("take a cup down to minus 10, which levels it up just like 10 does", () => {
    const g = playingMode("mixed");
    g.cups[1].value = -6;
    tapAndSettle(g, drop(g, 135, 200, -4));
    expect(g.level).toBe(2);
    expect(g.cups[1].value).toBe(0);
    expect(g.cups[1].dead).toBe(false);
    expect(g.cups[1].tenSign).toBe(-1);
    expect(g.cups[1].showTen).toBeGreaterThan(0);
    expect(g.events.some((e) => e.t === "levelUp" && e.level === 2)).toBe(true);
  });

  it("a cup that goes below minus 10 is dead", () => {
    const g = playingMode("mixed");
    g.cups[1].value = -8;
    tapAndSettle(g, drop(g, 135, 200, -5));
    expect(g.cups[1].dead).toBe(true);
    expect(g.cups[1].value).toBe(-13);
    expect(g.phase).toBe("play");
  });

  it("let a cup go back from plus towards minus without dying on the way", () => {
    const g = playingMode("mixed");
    g.cups[1].value = 7;
    tapAndSettle(g, drop(g, 135, 200, -9));
    expect(g.cups[1].value).toBe(-2);
    expect(g.cups[1].dead).toBe(false);
  });

  it("count as points just like plus numbers", () => {
    const g = playingMode("mixed");
    tapAndSettle(g, drop(g, 135, 200, -3));
    expect(g.score).toBe(3);
  });

  it("only fall in the games that have them", () => {
    const spawned = (mode: "plus" | "mixed" | "endless", level = 1) => {
      const g = createGame(() => 0.1);
      startGame(g, mode);
      g.level = level;
      g.spawnTimer = 0;
      update(g, 1 / 60);
      expect(g.numbers).toHaveLength(1);
      return g.numbers[0].v;
    };
    expect(spawned("plus")).toBeGreaterThan(0);
    expect(spawned("mixed")).toBeLessThan(0);
    expect(spawned("endless")).toBeGreaterThan(0); // the endless game starts with plus, like the first chapter
    expect(spawned("endless", 6)).toBeLessThan(0); // and gets minus numbers on level 2, which is after five cups
  });
});

describe("the levels of the book", () => {
  function cupAtNine(g: GameState): void {
    g.cups[1].value = 6;
    tapAndSettle(g, drop(g, 135, 200, 4));
  }

  it("are cleared when enough cups have reached 10", () => {
    const g = createGame(() => 0.5);
    startGame(g, "plus");
    g.spawnTimer = 1e9;
    g.level = goalFor("plus", 1); // one cup left to fill
    cupAtNine(g);
    expect(g.phase).toBe("won");
    expect(g.events.some((e) => e.t === "won")).toBe(true);
    expect(g.numbers).toHaveLength(0);
  });

  it("are not cleared one cup too early", () => {
    const g = createGame(() => 0.5);
    startGame(g, "mixed");
    g.spawnTimer = 1e9;
    g.level = goalFor("mixed", 1) - 1;
    cupAtNine(g);
    expect(g.phase).toBe("play");
  });

  it("never end in the endless game", () => {
    const g = createGame(() => 0.5);
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    g.level = 50;
    cupAtNine(g);
    expect(g.phase).toBe("play");
  });

  it("only the endless game keeps a best score", () => {
    const g = createGame(() => 0.5, 10);
    startGame(g, "plus");
    g.spawnTimer = 1e9;
    g.score = 500;
    g.cups[2].dead = true;
    drop(g, g.cups[2].x, g.cups[2].y - CUP_H / 2 - 5, 1);
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(g.newBest).toBe(false);
    expect(g.best).toBe(10);
  });

  it("play the same game again when no mode is given", () => {
    const g = createGame(() => 0.5);
    startGame(g, "mixed");
    startGame(g);
    expect(g.mode).toBe("mixed");
  });

  it("go back to the book with the cups steaming and no round going", () => {
    const g = createGame(() => 0.5);
    startGame(g, "plus");
    drop(g, 135, 100, 3);
    showMenu(g);
    expect(g.phase).toBe("menu");
    expect(g.numbers).toHaveLength(0);
    expect(g.cups.map((c) => c.value)).toEqual([2, 5, 7, 9]);
  });
});

describe("the nine levels of a page", () => {
  it("need more cups the later they are, and never fewer than the one before", () => {
    const goals = Array.from({length: STAGES}, (_, i) => goalFor("plus", i + 1));
    for (let i = 1; i < goals.length; i++) expect(goals[i]).toBeGreaterThanOrEqual(goals[i - 1]);
    expect(goals[STAGES - 1]).toBeGreaterThan(goals[0]);
  });

  it("need one cup more on every row of the book: 3, 4, 5 and 6", () => {
    for (const mode of ["plus", "mixed", "times", "divide"] as const) {
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => goalFor(mode, s))).toEqual([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6]);
    }
  });

  it("start with faster and bigger numbers the later they are", () => {
    const fast = createGame(() => 0.5);
    startGame(fast, "plus", 1);
    const faster = createGame(() => 0.5);
    startGame(faster, "plus", STAGES);
    // The same fall speed and biggest number that the engine uses at the start of each level.
    expect(fallSpeed(faster.level + faster.base)).toBeGreaterThan(fallSpeed(fast.level + fast.base));
    expect(maxNumber(faster.level + faster.base)).toBeGreaterThanOrEqual(maxNumber(fast.level + fast.base));
    expect(spawnInterval(faster.level + faster.base)).toBeLessThan(spawnInterval(fast.level + fast.base));
  });

  it("keep their level number, and the same level is played again without one", () => {
    const g = createGame(() => 0.5);
    startGame(g, "mixed", 4);
    expect(g.stage).toBe(4);
    startGame(g);
    expect(g.mode).toBe("mixed");
    expect(g.stage).toBe(4);
    startGame(g, "endless");
    expect(g.stage).toBe(0);
  });

  it("stay between the first and the last", () => {
    const g = createGame(() => 0.5);
    startGame(g, "plus", 99);
    expect(g.stage).toBe(STAGES);
    startGame(g, "plus", -3);
    expect(g.stage).toBe(1);
  });
});

describe("the tutorial", () => {
  function tutorial(): GameState {
    const g = createGame(() => 0.5);
    startGame(g, "tutorial");
    return g;
  }
  /** Runs the game for a number of seconds. */
  function wait(g: GameState, seconds: number): void {
    for (let i = 0; i < seconds * 60; i++) update(g, 1 / 60);
  }
  /** Taps the one number that is in the air and lets it land. */
  function tapTheNumber(g: GameState): void {
    expect(g.numbers).toHaveLength(1);
    const n = g.numbers[0];
    for (let i = 0; i < 600 && n.y < 40; i++) update(g, 1 / 60); // wait until it has come into view
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 300 && g.numbers.length > 0 && g.phase === "play"; i++) update(g, 1 / 60);
  }

  it("starts with one number to tap and no other numbers falling on their own", () => {
    const g = tutorial();
    expect(g.tutorialStep).toBe(0);
    expect(g.numbers).toHaveLength(1);
    expect(g.numbers[0].v).toBe(4);
    wait(g, 0.5);
    expect(g.numbers).toHaveLength(1);
  });

  it("goes through every step when each thing is done, and ends as cleared", () => {
    const g = tutorial();
    tapTheNumber(g); // 1. tap a number
    expect(g.tutorialStep).toBe(1);
    expect(g.tutorialNote).toBe("good");
    wait(g, 2.2);
    expect(g.numbers).toHaveLength(1);
    expect(g.numbers[0].v).toBe(6);
    tapTheNumber(g); // 2. fill a cup to exactly 10
    expect(g.tutorialStep).toBe(2);
    wait(g, 2.2);
    expect(g.numbers[0].v).toBe(5);
    tapTheNumber(g); // 3. a cup that goes over 10 dies
    expect(g.tutorialStep).toBe(3);
    expect(g.cups.filter((c) => c.dead)).toHaveLength(1);
    wait(g, 2.2);
    // 4. a number is falling towards the dead cup: swap it out of the way
    const dead = g.cups.find((c) => c.dead)!;
    const n = g.numbers[0];
    expect(n.x).toBe(dead.x);
    const neighbour = g.cups.find((c) => !c.dead && Math.abs(c.x - dead.x) < 100)!;
    moveCup(g, dead, neighbour.x);
    dropCup(g, dead);
    wait(g, 12);
    expect(g.phase).toBe("won");
    expect(g.tutorialStep).toBe(4);
    expect(g.events.some((e) => e.t === "won")).toBe(true);
  });

  it("starts the step over, without game over, when a number lands in the dead cup", () => {
    const g = tutorial();
    tapTheNumber(g);
    wait(g, 2.2);
    tapTheNumber(g);
    wait(g, 2.2);
    tapTheNumber(g);
    wait(g, 2.2);
    expect(g.tutorialStep).toBe(3);
    // Nobody swaps the dead cup away: the number falls into it.
    let sawRetry = false;
    for (let i = 0; i < 15 * 60; i++) {
      update(g, 1 / 60);
      if (g.tutorialNote === "retry") sawRetry = true;
    }
    expect(sawRetry).toBe(true);
    expect(g.phase).toBe("play");
    expect(g.tutorialStep).toBe(3);
    expect(g.numbers.length).toBeGreaterThan(0); // and a new number is on its way
  });

  it("does not need the player to tap: a number that lands by itself counts as well", () => {
    const g = tutorial();
    wait(g, 14);
    expect(g.tutorialStep).toBeGreaterThanOrEqual(1);
  });
});

describe("the endless game walks through the book", () => {
  /** A steady pseudo-random generator, so the test gives the same answer every time. */
  function seeded(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    };
  }

  /** Lets 300 numbers fall (one at a time) on this level of the endless game, with cups that have something in them. */
  function numbersOnLevel(level: number): {v: number; mul: boolean}[] {
    const g = createGame(seeded(7));
    startGame(g, "endless");
    g.level = (level - 1) * 5 + 1; // the game counts every cup: five cups make a level
    g.cups[0].value = 3;
    g.cups[1].value = -4;
    const out: {v: number; mul: boolean}[] = [];
    for (let i = 0; i < 300; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 1 / 60);
      for (const n of g.numbers) out.push({v: n.v, mul: n.op === "mul"});
    }
    return out;
  }

  it("has only plus numbers on level 1, like the first chapter", () => {
    const all = numbersOnLevel(1);
    expect(all.length).toBeGreaterThan(100);
    expect(all.every((n) => n.v > 0 && !n.mul)).toBe(true);
  });

  it("brings minus numbers on level 2, but not the blue ones yet", () => {
    const all = numbersOnLevel(2);
    expect(all.some((n) => n.v < 0)).toBe(true);
    expect(all.some((n) => n.mul)).toBe(false);
  });

  it("brings the blue multiplication numbers on level 3", () => {
    const all = numbersOnLevel(3);
    expect(all.some((n) => n.mul)).toBe(true);
    expect(all.some((n) => n.v < 0)).toBe(true);
  });

  it("goes up a level after five full cups, not before", () => {
    const g = createGame(() => 0.5);
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    expect(endlessLevel(g)).toBe(1);
    for (let i = 0; i < 5; i++) {
      expect(endlessLevel(g)).toBe(1);
      g.cups[1].value = 6;
      tapAndSettle(g, drop(g, 135, 200, 4));
    }
    expect(endlessLevel(g)).toBe(2);
    expect(g.phase).toBe("play");
    // The big banner comes when the new level begins, not for every cup.
    expect(g.banner).toBeGreaterThan(0);
  });

  it("shows the level banner only on the fifth cup", () => {
    const g = createGame(() => 0.5);
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    g.cups[1].value = 6;
    tapAndSettle(g, drop(g, 135, 200, 4));
    expect(g.banner).toBe(0);
  });
});

describe("swapping cups while a number is on its way", () => {
  it("does not make the number follow the cup it was sent to: it keeps to its column", () => {
    const g = playing();
    const [, b, c] = g.cups; // b stands in the second column, c in the third
    const n = drop(g, COLS[1], 200, 3);
    expect(tapAt(g, n.x, n.y)).toBe(true); // sent to b
    moveCup(g, b, COLS[2]); // quickly swap b and c
    dropCup(g, b);
    for (let i = 0; i < 300 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(n.x).toBe(COLS[1]); // it came down in the column it was sent to
    expect(c.value).toBe(3); // and landed in the cup that now stands there
    expect(b.value).toBe(0);
  });

  it("goes to the nearest living cup if the cup in its column has died on the way", () => {
    const g = playing();
    const n = drop(g, COLS[1], 200, 3);
    expect(tapAt(g, n.x, n.y)).toBe(true);
    g.cups[1].dead = true;
    g.cups[1].value = 12;
    for (let i = 0; i < 300 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.phase).toBe("play");
    expect(g.cups[1].value).toBe(12);
    expect(g.cups[0].value + g.cups[2].value).toBe(3);
  });
});

describe("division", () => {
  /** Divides a cup with this in it by a yellow number, and says what is in the cup afterwards. */
  function divideInto(value: number, divisor: number): number {
    const g = createGame(() => 0.5);
    startGame(g, "divide", 1);
    g.spawnTimer = 1e9;
    g.cups[1].value = value;
    const n = drop(g, 135, 200, divisor);
    n.op = "div";
    tapAndSettle(g, n);
    return g.cups[1].value;
  }

  it("divides a cup, like real maths", () => {
    expect(divideInto(8, 2)).toBe(4);
    expect(divideInto(9, 3)).toBe(3);
    expect(divideInto(-8, 2)).toBe(-4);
  });

  it("rounds the size of the cup down when it does not divide evenly", () => {
    expect(divideInto(7, 2)).toBe(3);
    expect(divideInto(5, 3)).toBe(1);
    expect(divideInto(-7, 2)).toBe(-3); // towards zero: the cup never gets bigger
  });

  it("never leaves a minus zero", () => {
    expect(Object.is(divideInto(-1, 2), 0)).toBe(true);
  });

  it("falls in chapter 4 only when a cup has enough in it to change", () => {
    const run = (cupValue: number): number => {
      let a = 11;
      const rng = () => ((a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296);
      const g = createGame(rng);
      startGame(g, "divide", 5);
      g.cups.forEach((c) => (c.value = 0));
      g.cups[0].value = cupValue;
      let divisions = 0;
      for (let i = 0; i < 300; i++) {
        g.numbers = [];
        g.spawnTimer = 0;
        update(g, 1 / 60);
        divisions += g.numbers.filter((n) => n.op === "div").length;
      }
      return divisions;
    };
    expect(run(0)).toBe(0);
    expect(run(1)).toBe(0);
    expect(run(8)).toBeGreaterThan(0);
  });

  it("is in the endless game from level 4", () => {
    const onLevel = (level: number): number => {
      let a = 5;
      const rng = () => ((a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296);
      const g = createGame(rng);
      startGame(g, "endless");
      g.level = (level - 1) * 5 + 1;
      g.cups[0].value = 8;
      let divisions = 0;
      for (let i = 0; i < 300; i++) {
        g.numbers = [];
        g.spawnTimer = 0;
        update(g, 1 / 60);
        divisions += g.numbers.filter((n) => n.op === "div").length;
      }
      return divisions;
    };
    expect(onLevel(3)).toBe(0);
    expect(onLevel(4)).toBeGreaterThan(0);
  });
});

describe("bonus balls", () => {
  /** A running game where a bonus ball of this kind has just come, and has fallen far enough to be tapped. */
  function withBonus(kind: "life" | "points" | "slow", deadCup = false): GameState {
    const g = playing();
    if (deadCup) {
      g.cups[0].dead = true;
      g.cups[0].value = 13;
    }
    g.rng = () => (kind === "life" ? 0.1 : kind === "points" ? 0.5 : 0.95);
    g.bonusTimer = 0.01;
    update(g, 1 / 60);
    for (let i = 0; i < 200 && g.numbers.every((n) => n.y < 20); i++) update(g, 1 / 60);
    return g;
  }
  const tapBonus = (g: GameState): boolean => {
    const n = g.numbers.find((x) => x.bonus)!;
    return tapAt(g, n.x, n.y);
  };

  it("come now and then, with a gold border, and only one at a time", () => {
    const g = withBonus("points");
    expect(g.numbers.filter((n) => n.bonus)).toHaveLength(1);
    g.bonusTimer = 0.01;
    update(g, 1 / 60);
    expect(g.numbers.filter((n) => n.bonus)).toHaveLength(1);
  });

  it("do not come in the tutorial", () => {
    const g = createGame(() => 0.5);
    startGame(g, "tutorial");
    g.bonusTimer = 0.01;
    for (let i = 0; i < 120; i++) update(g, 1 / 60);
    expect(g.numbers.some((n) => n.bonus)).toBe(false);
  });

  it("a life ball brings a dead cup back when it is tapped", () => {
    const g = withBonus("life", true);
    expect(g.numbers.find((n) => n.bonus)?.bonus).toBe("life");
    expect(tapBonus(g)).toBe(true);
    expect(g.cups[0].dead).toBe(false);
    expect(g.cups[0].value).toBe(0);
    expect(g.numbers.some((n) => n.bonus)).toBe(false);
    expect(g.events.some((e) => e.t === "bonus" && e.kind === "life")).toBe(true);
  });

  it("a life ball only comes when there is a dead cup", () => {
    const g = withBonus("life", false);
    expect(g.numbers.find((n) => n.bonus)?.bonus).not.toBe("life");
  });

  it("a points ball gives points", () => {
    const g = withBonus("points");
    g.level = 3;
    const before = g.score;
    expect(tapBonus(g)).toBe(true);
    expect(g.score).toBe(before + BONUS_POINTS * 3);
  });

  it("a slow motion ball makes the numbers fall slower for a while", () => {
    const distanceInASecond = (slow: boolean): number => {
      const g = playing();
      const n = drop(g, 135, 100, 3);
      if (slow) g.slow = SLOW_SECONDS;
      for (let i = 0; i < 60; i++) update(g, 1 / 60);
      return n.y - 100;
    };
    expect(distanceInASecond(true)).toBeLessThan(distanceInASecond(false) * 0.6);
    const g = withBonus("slow");
    expect(tapBonus(g)).toBe(true);
    expect(g.slow).toBeCloseTo(SLOW_SECONDS, 5);
    for (let i = 0; i < (SLOW_SECONDS + 1) * 60; i++) update(g, 1 / 60);
    expect(g.slow).toBe(0);
  });

  it("an untouched ball falls past the cups without landing in one, even a dead one", () => {
    const g = withBonus("points", true);
    const n = g.numbers.find((x) => x.bonus)!;
    n.x = g.cups[0].x; // right over the dead cup
    for (let i = 0; i < 60 * 22 && g.numbers.some((x) => x.bonus); i++) update(g, 1 / 60);
    expect(g.phase).toBe("play");
    expect(g.numbers.some((x) => x.bonus)).toBe(false);
    expect(g.cups[0].value).toBe(13);
  });
});

describe("chains and ghost numbers", () => {
  /** A round of the plus chapter at this level, where every random number comes out as low as it can (so the hard parts always show up). */
  function round(mode: "plus" | "endless", stage: number): GameState {
    const g = createGame(() => 0.01);
    startGame(g, mode, stage);
    g.spawnTimer = 1e9;
    return g;
  }

  /** Makes a new number come, and returns the ones that fell. */
  function spawnOne(g: GameState): NumberTile[] {
    g.numbers = [];
    g.spawnTimer = 0;
    update(g, 0.01);
    return g.numbers;
  }

  it("has no chains before level 4 (nor in the tutorial and the first endless levels)", () => {
    for (const g of [round("plus", 3), round("plus", 1), round("endless", 1)]) {
      for (let i = 0; i < 6; i++) expect(spawnOne(g).every((n) => n.chain === null)).toBe(true);
    }
    const t = createGame(() => 0.01);
    startGame(t, "tutorial");
    t.spawnTimer = 0;
    expect(t.numbers.every((n) => n.chain === null)).toBe(true);
  });

  it("brings two numbers chained together from level 4, in two columns next to each other", () => {
    const g = round("plus", 4);
    const made = spawnOne(g);
    expect(made).toHaveLength(2);
    expect(made[0].chain).toBe(made[1].id);
    expect(made[1].chain).toBe(made[0].id);
    expect(Math.abs(made[0].col - made[1].col)).toBe(1);
    expect(made.every((n) => n.ghost === null)).toBe(true); // ghosts come later
  });

  it("pulls the chained number down too, and both end up in the cup under their own column", () => {
    const g = playing();
    const a = drop(g, COLS[0], 200, 3);
    const b = drop(g, COLS[1], 200, 4);
    a.chain = b.id;
    b.chain = a.id;
    expect(tapAt(g, a.x, a.y)).toBe(true);
    expect(a.state).toBe("dive");
    expect(b.state).toBe("dive");
    for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.numbers).toHaveLength(0);
    expect(g.cups[0].value).toBe(3);
    expect(g.cups[1].value).toBe(4);
  });

  it("lets the chained number hang until the chain goes taut, then drags it down after the tapped one", () => {
    const g = playing();
    const a = drop(g, COLS[0], 200, 3);
    const b = drop(g, COLS[1], 200, 4);
    a.chain = b.id;
    b.chain = a.id;
    tapAt(g, a.x, a.y);
    let hung = 0;
    let dragged = false;
    let landedFirst = "";
    for (let i = 0; i < 300 && g.numbers.length > 0; i++) {
      const by = b.y;
      update(g, 1 / 60);
      if (b.hang !== null) {
        expect(b.y).toBe(by); // still hanging where it was
        hung++;
      } else if (!a.done) {
        dragged = true;
        expect(b.y).toBeLessThan(a.y); // behind the tapped one, never ahead of it
      }
      if (!landedFirst && (a.done || b.done)) landedFirst = a.done ? "a" : "b";
    }
    expect(hung).toBeGreaterThan(5);
    expect(dragged).toBe(true);
    expect(landedFirst).toBe("a");
    expect(g.cups[1].value).toBe(4);
  });

  it("lets go of the chained number when the tapped one lands before the chain went taut", () => {
    const g = playing();
    const a = drop(g, COLS[0], 520, 3);
    const b = drop(g, COLS[1], 520, 4);
    a.chain = b.id;
    b.chain = a.id;
    tapAt(g, a.x, a.y);
    for (let i = 0; i < 300 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.numbers).toHaveLength(0);
    expect(g.cups[0].value).toBe(3);
    expect(g.cups[1].value).toBe(4);
  });

  it("is game over when the number a chain pulls along lands in a dead cup", () => {
    const g = playing();
    g.cups[1].dead = true;
    g.cups[1].value = 12;
    const a = drop(g, COLS[0], 200, 3);
    const b = drop(g, COLS[1], 200, 4);
    a.chain = b.id;
    b.chain = a.id;
    tapAt(g, a.x, a.y);
    for (let i = 0; i < 200 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
  });

  /** A round with a spread-out (but always the same) run of random numbers, and many numbers made in it. */
  function manySpawned(stage: number, count = 300): NumberTile[] {
    let seed = 12345;
    const g = createGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    startGame(g, "plus", stage);
    const all: NumberTile[] = [];
    for (let i = 0; i < count; i++) {
      g.spawnTimer = 1e9;
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      all.push(...g.numbers);
    }
    return all;
  }

  it("only makes ghost numbers from level 7", () => {
    for (const stage of [4, 6]) expect(manySpawned(stage).every((n) => n.ghost === null)).toBe(true);
    expect(manySpawned(7).some((n) => n.ghost !== null)).toBe(true);
  });

  it("never puts a ghost or ice on a number that is chained", () => {
    for (const stage of [7, 10, 12]) {
      const made = manySpawned(stage);
      const chained = made.filter((n) => n.chain !== null);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained.every((n) => n.ghost === null && n.ice === 0)).toBe(true);
    }
  });

  it("only makes ice numbers from level 10, and never one that is a ghost too", () => {
    for (const stage of [4, 7, 9]) expect(manySpawned(stage).every((n) => n.ice === 0)).toBe(true);
    for (const stage of [10, 11, 12]) {
      const made = manySpawned(stage);
      expect(made.some((n) => n.ice > 0)).toBe(true);
      expect(made.every((n) => n.ice === 0 || (n.ice === 2 && n.ghost === null && n.bonus === null))).toBe(true);
    }
  });

  it("takes two taps to crack the ice, and the second one sends the number down", () => {
    const g = playing();
    const n = drop(g, COLS[1], 200, 4);
    n.ice = 2;
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(n.state).toBe("fall");
    expect(n.ice).toBe(1);
    expect(g.events.filter((e) => e.t === "ice")).toEqual([{t: "ice", x: n.x, y: 200, broke: false}]);
    expect(g.events.some((e) => e.t === "tap")).toBe(false);
    g.events.length = 0;
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(n.state).toBe("dive");
    expect(n.ice).toBe(0);
    expect(g.events.map((e) => e.t)).toEqual(["ice", "tap"]);
    for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[1].value).toBe(4);
  });

  it("lets an iced number that is never tapped fall into a cup like any other", () => {
    const g = playing();
    const n = drop(g, COLS[2], 200, 6);
    n.ice = 2;
    for (let i = 0; i < 60 * 12 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[2].value).toBe(6);
  });

  it("makes a ghost come and go: seen at first, hidden for a while, seen again, and always seen once it is tapped", () => {
    const g = round("plus", 7);
    const n = drop(g, COLS[1], 100, 3);
    n.ghost = "flip";
    n.phase = -g.time; // starts out seen, like a ghost that has just been made
    expect(ghostShow(n, g.time)).toBe(1);
    let min = 1;
    let max = 0;
    for (let t = 0; t < 5.2; t += 0.05) {
      const s = ghostShow(n, g.time + t);
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    expect(min).toBe(0);
    expect(max).toBe(1);
    n.state = "dive";
    expect(ghostShow(n, g.time + 1.3)).toBe(1);
    const plain = drop(g, COLS[0], 100, 2);
    expect(ghostShow(plain, g.time + 1.3)).toBe(1);
  });

  it("can still be tapped while it is hidden", () => {
    const g = playing();
    const n = drop(g, COLS[0], 200, 5);
    n.ghost = "fade";
    n.phase = -(g.time + 1.3); // in the middle of being hidden
    expect(ghostShow(n, g.time)).toBe(0);
    tapAndSettle(g, n);
    expect(g.cups[0].value).toBe(5);
  });
});
