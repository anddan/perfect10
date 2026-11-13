import {describe, expect, it} from "vitest";
import {COLS, CUP_H, CUP_START_Y, CUP_W, W} from "./constants";
import {createGame, cupAt, dropCup, fallSpeed, maxNumber, moveCup, nearestAliveCup, spawnInterval, startGame, tapAt, update} from "./engine";
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
    state: "fall",
    target: null,
    speed: 0,
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

  it("skips a dead cup", () => {
    const g = playing();
    g.cups[1].dead = true;
    g.cups[1].value = 12;
    const n = drop(g, 135, 200, 3); // right above the dead cup
    tapAndSettle(g, n);
    expect(g.phase).toBe("play");
    expect(g.cups[1].value).toBe(12);
    expect(g.cups[0].value + g.cups[2].value).toBe(3);
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

  it("brings one dead cup back to life", () => {
    const g = playing();
    g.cups[0].dead = true;
    g.cups[0].value = 13;
    g.cups[2].value = 5;
    tapAndSettle(g, drop(g, 225, 200, 5));
    expect(g.cups[0].dead).toBe(false);
    expect(g.cups[0].value).toBe(0);
    expect(g.events.some((e) => e.t === "revive" && e.cupId === g.cups[0].id)).toBe(true);
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

  it("remembers the best score", () => {
    const g = playing();
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
