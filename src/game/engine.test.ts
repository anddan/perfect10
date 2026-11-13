import {describe, expect, it} from "vitest";
import {BONUS_POINTS, COLS, CUP_H, CUP_START_Y, CUP_W, SCREEN_MAX, SLOW_SECONDS, STAGES, SWEEP_DOWN, SWEEP_EDGE, SWEEP_HOLD, SWEEP_UP, W} from "./constants";
import {ENDLESS_PACE, FEATURES, canContinue, continueGame, createGame, cupAt, dropCup, endIntro, fallSpeed, featureAge, ghostShow, goalFor, paceOf, starsFor, sweepEdge, useScreen, maxNumber, moveCup, nearestAliveCup, endlessLevel, recordBest, showMenu, spawnInterval, stageSpawnFactor, stageSpeedFactor, startGame, tapAt, untangleCups, update} from "./engine";
import type {GameState, Mode, NumberTile} from "./types";

/** A new game where no new kind of number is presented (the round starts at once). The tests of the presentations use createGame. */
function testGame(rng?: () => number, best?: number): GameState {
  const g = createGame(rng, best);
  g.hideIntros = new Set(FEATURES);
  return g;
}

/** A game that is running (in the second chapter, with its four cups), with no random numbers falling on their own. */
function playing(): GameState {
  const g = testGame(() => 0.5);
  g.hideIntros = new Set(FEATURES);
  startGame(g, "mixed", 1);
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
    chain2: null,
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
    expect(maxNumber(1)).toBe(3);
    expect(maxNumber(99)).toBe(6);
    expect([1, 2, 3, 4, 5, 6].map(maxNumber)).toEqual([3, 3, 4, 5, 6, 6]);
  });

  it("falls a little slower on the later levels of a chapter: 5% on levels 4-6, 10% on 7-9 and 15% on 10-12 (and another 15% on top of that)", () => {
    const factors = [1, 1, 1, 0.95, 0.95, 0.95, 0.9, 0.9, 0.9, 0.7225, 0.7225, 0.7225];
    factors.forEach((f, i) => expect(stageSpeedFactor(i + 1), `level ${i + 1}`).toBe(f));
    // 20% fewer numbers on levels 10-12: 1.25 times as long between them.
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1.25, 1.25, 1.25].forEach((f, i) => expect(stageSpawnFactor(i + 1), `level ${i + 1}`).toBe(f));
    expect(stageSpawnFactor(0)).toBe(1);
    expect(stageSpeedFactor(0)).toBe(1); // (the tutorial and the endless game)
    // In a real round: the number moves by the speed of the level times the factor.
    for (const mode of ["plus", "mixed", "times", "divide", "space"] as const) {
      for (const stage of [3, 4, 7, 10, 12]) {
        const g = testGame(() => 0.5);
        startGame(g, mode, stage);
        g.spawnTimer = 1e9;
        const n = drop(g, COLS[1], 100, 3);
        update(g, 1 / 60);
        expect(n.y - 100, `${mode} level ${stage}`).toBeCloseTo((fallSpeed(g.level + g.base) * stageSpeedFactor(stage)) / 60, 6);
      }
    }
  });

  it("lets numbers fall on its own", () => {
    const g = testGame(() => 0.5);
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

describe("carrying on after the round was lost (the ad)", () => {
  /** A round that has been lost: a number has landed in a dead cup, with some score and a cup that is half full. */
  function lost(): GameState {
    const g = playing();
    g.score = 250;
    g.level = 4;
    g.cups[0].value = 6;
    g.cups[2].dead = true;
    g.cups[2].value = 12;
    drop(g, g.cups[1].x, 100, 5); // (another number in the air)
    drop(g, g.cups[2].x, g.cups[2].y - CUP_H / 2 - 5, 2);
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    return g;
  }

  it("gives one more try in a round, but not before the round is lost", () => {
    const g = playing();
    expect(canContinue(g)).toBe(false); // (still playing)
    expect(continueGame(g)).toBe(false);
    expect(g.continuesLeft).toBe(1);
    const l = lost();
    expect(canContinue(l)).toBe(true);
  });

  it("carries on where the round was lost: the dead cup is back at 0, the rest is as it was", () => {
    const g = lost();
    expect(continueGame(g)).toBe(true);
    expect(g.phase).toBe("play");
    expect(g.overReason).toBeNull();
    expect(g.cups[2].dead).toBe(false);
    expect(g.cups[2].value).toBe(0);
    expect(g.cups[0].value).toBe(6);
    expect(g.score).toBe(250);
    expect(g.level).toBe(4);
    expect(g.numbers).toHaveLength(0);
    expect(g.events.some((e) => e.t === "revive" && e.cupId === g.cups[2].id)).toBe(true);
  });

  it("brings every cup back when they were all dead", () => {
    const g = playing();
    for (const c of g.cups.slice(0, 3)) {
      c.dead = true;
      c.value = 11;
    }
    g.cups[3].value = 9;
    tapAndSettle(g, drop(g, 315, 200, 4));
    expect(g.overReason).toBe("allDead");
    expect(continueGame(g)).toBe(true);
    expect(g.cups.every((c) => !c.dead && c.value === 0)).toBe(true);
  });

  it("can be done once only, and the game can be lost again after it", () => {
    const g = lost();
    expect(continueGame(g)).toBe(true);
    g.spawnTimer = 1e9;
    g.cups[2].dead = true;
    g.cups[2].value = 12;
    drop(g, g.cups[2].x, g.cups[2].y - CUP_H / 2 - 5, 2);
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(canContinue(g)).toBe(false);
    expect(continueGame(g)).toBe(false);
    expect(g.phase).toBe("over");
  });

  it("is a new try in every new round, and never in the tutorial", () => {
    const g = lost();
    continueGame(g);
    startGame(g, "mixed", 1);
    expect(g.continuesLeft).toBe(1);
    startGame(g, "tutorial");
    expect(g.continuesLeft).toBe(0);
    g.phase = "over";
    expect(canContinue(g)).toBe(false);
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
    for (let i = 0; i < 60 * 14 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[0].value).toBe(3);
  });

  it("land in a cup that is dragged under them after they have passed its mouth, instead of falling through it", () => {
    const g = playing();
    const cup = g.cups[0];
    const n = drop(g, 90, cup.y - CUP_H / 2 + 8, 4); // already below the mouths of the cups, but between two of them
    moveCup(g, cup, 90); // the cup is dragged under it
    update(g, 1 / 60);
    expect(g.numbers).not.toContain(n);
    expect(cup.value).toBe(4);
    expect(g.events.some((e) => e.t === "miss")).toBe(false);
  });

  it("hit the desk and vanish when no cup is under them", () => {
    const g = playing();
    drop(g, 90, 300, 3); // between the first and second cup
    for (let i = 0; i < 60 * 20 && g.numbers.length > 0; i++) update(g, 1 / 60);
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
    for (let i = 0; i < 60 * 14 && g.numbers.length > 0; i++) update(g, 1 / 60);
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
    const g = testGame(() => 0.5);
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
      const g = testGame(() => 0.1);
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
    const g = testGame(() => 0.5);
    startGame(g, "mixed");
    g.spawnTimer = 1e9;
    g.level = goalFor("mixed", 1); // one cup left to fill
    cupAtNine(g);
    expect(g.phase).toBe("won");
    expect(g.events.some((e) => e.t === "won")).toBe(true);
    expect(g.numbers).toHaveLength(0);
  });

  it("says how many stars the level was cleared with, for the sound of it", () => {
    for (const [score, stars] of [[0, 1], [1e6, 3]] as const) {
      const g = testGame(() => 0.5);
      startGame(g, "mixed");
      g.spawnTimer = 1e9;
      g.level = goalFor("mixed", 1);
      g.score = score;
      cupAtNine(g);
      const won = g.events.find((e) => e.t === "won");
      expect(won && won.t === "won" ? won.stars : 0, `score ${score}`).toBe(stars);
    }
  });

  it("wait for the progress bar before the card comes up", () => {
    const g = testGame(() => 0.5);
    startGame(g, "mixed");
    g.spawnTimer = 1e9;
    g.level = goalFor("mixed", 1);
    cupAtNine(g);
    expect(g.phase).toBe("won");
    // The level is cleared at once (so it is remembered), but the card has to wait.
    expect(g.events.some((e) => e.t === "won")).toBe(true);
    expect(g.overTimer).toBeLessThan(0);
    for (let i = 0; i < 60 * 1.5; i++) update(g, 1 / 60);
    expect(g.overTimer).toBeLessThan(0);
    for (let i = 0; i < 60 * 0.4; i++) update(g, 1 / 60);
    expect(g.overTimer).toBeGreaterThanOrEqual(0);
  });

  it("are not cleared one cup too early", () => {
    const g = testGame(() => 0.5);
    startGame(g, "mixed");
    g.spawnTimer = 1e9;
    g.level = goalFor("mixed", 1) - 1;
    cupAtNine(g);
    expect(g.phase).toBe("play");
  });

  it("never end in the endless game", () => {
    const g = testGame(() => 0.5);
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    g.level = 50;
    cupAtNine(g);
    expect(g.phase).toBe("play");
  });

  it("only the endless game keeps a best score", () => {
    const g = testGame(() => 0.5, 10);
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
    const g = testGame(() => 0.5);
    startGame(g, "mixed");
    startGame(g);
    expect(g.mode).toBe("mixed");
  });

  it("go back to the book with the cups steaming and no round going", () => {
    const g = testGame(() => 0.5);
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

  it("need one cup more on every row of the book: 3, 4, 5 and 6 perfect 10s", () => {
    for (const mode of ["plus", "mixed", "times", "divide"] as const) {
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => goalFor(mode, s))).toEqual([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6]);
    }
    // The space chapter needs two more on every level.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => goalFor("space", s))).toEqual([5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8]);
    expect(goalFor("endless")).toBe(Infinity);
  });

  it("start with faster and bigger numbers the later they are", () => {
    const fast = testGame(() => 0.5);
    startGame(fast, "plus", 1);
    const faster = testGame(() => 0.5);
    startGame(faster, "plus", STAGES);
    // The same fall speed and biggest number that the engine uses at the start of each level.
    expect(fallSpeed(faster.level + faster.base)).toBeGreaterThan(fallSpeed(fast.level + fast.base));
    expect(maxNumber(faster.level + faster.base)).toBeGreaterThanOrEqual(maxNumber(fast.level + fast.base));
    expect(spawnInterval(faster.level + faster.base)).toBeLessThan(spawnInterval(fast.level + fast.base));
  });

  it("keep their level number, and the same level is played again without one", () => {
    const g = testGame(() => 0.5);
    startGame(g, "mixed", 4);
    expect(g.stage).toBe(4);
    startGame(g);
    expect(g.mode).toBe("mixed");
    expect(g.stage).toBe(4);
    startGame(g, "endless");
    expect(g.stage).toBe(0);
  });

  it("stay between the first and the last", () => {
    const g = testGame(() => 0.5);
    startGame(g, "plus", 99);
    expect(g.stage).toBe(STAGES);
    startGame(g, "plus", -3);
    expect(g.stage).toBe(1);
  });
});

describe("the tutorial", () => {
  function tutorial(): GameState {
    const g = testGame(() => 0.5);
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
    wait(g, 20);
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
    wait(g, 22);
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
    const g = testGame(seeded(7));
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
    const g = testGame(() => 0.5);
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
    const g = testGame(() => 0.5);
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
    const g = testGame(() => 0.5);
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
      const g = testGame(rng);
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
      const g = testGame(rng);
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
    const g = testGame(() => 0.5);
    g.hideIntros = new Set(FEATURES);
    startGame(g, "mixed", 7); // (from level 7 of the second chapter all the bonus balls have come)
    g.spawnTimer = 1e9;
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

  it("come with the kinds the book has brought in: a life from level 7 and slow motion from level 10 of plus, points from level 7 of plus and minus", () => {
    /** The kinds of ball that can come on a level (a dead cup is there, so that the life ball can come too). */
    const kindsOn = (mode: Mode, stage: number): Set<string> => {
      const kinds = new Set<string>();
      for (let i = 0; i < 400; i++) {
        let a = i * 7919 + 13;
        const g = testGame(() => {
          a = (a * 1664525 + 1013904223) % 4294967296;
          return a / 4294967296;
        });
        g.hideIntros = new Set(FEATURES);
        startGame(g, mode, stage);
        g.spawnTimer = 1e9;
        g.cups[0].dead = true;
        g.bonusTimer = 0.01;
        update(g, 1 / 60);
        for (const n of g.numbers) if (n.bonus) kinds.add(n.bonus);
      }
      return kinds;
    };
    expect([...kindsOn("plus", 1)]).toEqual([]);
    expect([...kindsOn("plus", 6)]).toEqual([]);
    expect([...kindsOn("plus", 7)]).toEqual(["life"]);
    expect([...kindsOn("plus", 9)]).toEqual(["life"]);
    expect([...kindsOn("plus", 10)].sort()).toEqual(["life", "slow"]);
    expect([...kindsOn("mixed", 1)].sort()).toEqual(["life", "slow"]);
    expect([...kindsOn("mixed", 6)].sort()).toEqual(["life", "slow"]);
    expect([...kindsOn("mixed", 7)].sort()).toEqual(["life", "points", "slow"]);
    expect([...kindsOn("divide", 1)].sort()).toEqual(["life", "points", "slow"]);
    expect([...kindsOn("endless", 0)].sort()).toEqual(["life", "points", "slow"]);
  });

  it("do not come in the tutorial", () => {
    const g = testGame(() => 0.5);
    startGame(g, "tutorial");
    g.bonusTimer = 0.01;
    for (let i = 0; i < 120; i++) update(g, 1 / 60);
    expect(g.numbers.some((n) => n.bonus)).toBe(false);
  });

  it("a life ball goes down into the dead cup when it is tapped, and brings it back when it lands", () => {
    const g = withBonus("life", true);
    expect(g.numbers.find((n) => n.bonus)?.bonus).toBe("life");
    expect(tapBonus(g)).toBe(true);
    // On its way: the heart is a tapped ball in the air and the cup is still dead.
    const heart = g.numbers.find((n) => n.bonus)!;
    expect(heart.state).toBe("dive");
    expect(g.cups[0].dead).toBe(true);
    expect(g.events.some((e) => e.t === "bonus")).toBe(false);
    for (let i = 0; i < 300 && g.numbers.some((n) => n.bonus); i++) update(g, 1 / 60);
    expect(g.phase).toBe("play"); // (a heart in a dead cup is not game over)
    expect(g.cups[0].dead).toBe(false);
    expect(g.cups[0].value).toBe(0);
    expect(g.numbers.some((n) => n.bonus)).toBe(false);
    const got = g.events.find((e) => e.t === "bonus" && e.kind === "life");
    expect(got).toBeDefined();
    if (got && got.t === "bonus") expect(got.x).toBe(g.cups[0].x); // (it happens in the cup)
  });

  it("a life ball goes down into the dead cup that is nearest to it", () => {
    const g = withBonus("life", true);
    g.cups[3].dead = true;
    g.cups[3].value = 12;
    const heart = g.numbers.find((n) => n.bonus)!;
    heart.x = g.cups[3].x;
    expect(tapAt(g, heart.x, heart.y)).toBe(true);
    for (let i = 0; i < 300 && g.numbers.some((n) => n.bonus); i++) update(g, 1 / 60);
    expect(g.cups[3].dead).toBe(false);
    expect(g.cups[0].dead).toBe(true);
  });

  it("a life ball brings back the dead cup even if the cups have been swapped on the way", () => {
    const g = withBonus("life", true);
    expect(tapBonus(g)).toBe(true);
    // The dead cup and a living one change places while the heart falls.
    const [dead, alive] = [g.cups[0], g.cups[1]];
    [dead.x, alive.x] = [alive.x, dead.x];
    for (let i = 0; i < 300 && g.numbers.some((n) => n.bonus); i++) update(g, 1 / 60);
    expect(g.phase).toBe("play");
    expect(dead.dead).toBe(false);
    expect(alive.dead).toBe(false);
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
  function round(mode: Mode, stage: number): GameState {
    const g = testGame(() => 0.01);
    g.hideIntros = new Set(FEATURES); // (no presentation of what is new: the round starts at once)
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

  it("has no chains before level 4 of plus and minus (nor in plus, the tutorial and the first endless levels)", () => {
    for (const g of [round("plus", 12), round("plus", 1), round("mixed", 3), round("endless", 1)]) {
      for (let i = 0; i < 6; i++) expect(spawnOne(g).every((n) => n.chain === null)).toBe(true);
    }
    const t = testGame(() => 0.01);
    startGame(t, "tutorial");
    t.spawnTimer = 0;
    expect(t.numbers.every((n) => n.chain === null)).toBe(true);
  });

  it("brings two numbers chained together from level 4 of plus and minus, in two columns next to each other", () => {
    const g = round("mixed", 4);
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
  function manySpawned(mode: Mode, stage: number, count = 300): NumberTile[] {
    let seed = 12345;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
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

  it("only makes ghost numbers from level 4 of divide", () => {
    for (const [mode, stage] of [["plus", 12], ["mixed", 12], ["times", 12], ["divide", 3]] as const) {
      expect(manySpawned(mode, stage).every((n) => n.ghost === null), `${mode} ${stage}`).toBe(true);
    }
    expect(manySpawned("divide", 4).some((n) => n.ghost !== null)).toBe(true);
    expect(manySpawned("divide", 12).some((n) => n.ghost !== null)).toBe(true);
  });

  it("never puts a ghost or ice on a number that is chained", () => {
    for (const [mode, stage] of [["divide", 4], ["divide", 12], ["times", 12]] as const) {
      const made = manySpawned(mode, stage);
      const chained = made.filter((n) => n.chain !== null);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained.every((n) => n.ghost === null && n.ice === 0)).toBe(true);
    }
  });

  it("only makes ice numbers from level 4 of times, and never one that is a ghost too", () => {
    for (const [mode, stage] of [["plus", 12], ["mixed", 12], ["times", 3]] as const) {
      expect(manySpawned(mode, stage).every((n) => n.ice === 0), `${mode} ${stage}`).toBe(true);
    }
    for (const [mode, stage] of [["times", 4], ["times", 12], ["divide", 1], ["divide", 12]] as const) {
      const made = manySpawned(mode, stage);
      expect(made.some((n) => n.ice > 0), `${mode} ${stage}`).toBe(true);
      expect(made.every((n) => n.ice === 0 || (n.ice === 2 && n.ghost === null && n.bonus === null))).toBe(true);
    }
  });

  it("keeps what an earlier chapter brought: chains in times and divide, ice in divide", () => {
    expect(manySpawned("times", 1).some((n) => n.chain !== null)).toBe(true);
    expect(manySpawned("divide", 1).some((n) => n.chain !== null)).toBe(true);
    expect(manySpawned("mixed", 3).every((n) => n.chain === null)).toBe(true);
    expect(featureAge(round("mixed", 4), "chain")).toBe(0);
    expect(featureAge(round("mixed", 3), "chain")).toBe(-1);
    expect(featureAge(round("times", 1), "chain")).toBe(9);
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
    for (let i = 0; i < 60 * 20 && g.numbers.length > 0; i++) update(g, 1 / 60);
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

describe("presenting a new kind of number", () => {
  const start = (mode: Mode, stage: number, hidden: Iterable<(typeof FEATURES)[number]> = []): GameState => {
    const g = createGame(() => 0.5);
    g.hideIntros = new Set(hidden);
    startGame(g, mode, stage);
    return g;
  };

  it("comes first in every chapter: the 0 and the life and slow balls in plus, chains and the points ball in plus and minus, ice in times, ghosts in divide", () => {
    const cases: [Mode, number, string][] = [
      ["plus", 2, "screen"],
      ["mixed", 1, "cups"],
      ["plus", 4, "zero"],
      ["plus", 7, "life"],
      ["plus", 10, "slow"],
      ["mixed", 4, "chain"],
      ["mixed", 7, "points"],
      ["times", 4, "ice"],
      ["divide", 4, "ghost"],
      ["space", 4, "fog"],
      ["space", 7, "steel"],
      ["space", 10, "chain3"],
      ["space", 1, "star"],
    ];
    for (const [mode, stage, feature] of cases) {
      const g = start(mode, stage);
      expect(g.phase, `${mode} ${stage}`).toBe("intro");
      expect(g.intro).toEqual([feature]);
    }
  });

  it("does not come on any other level, in the tutorial or in the endless game", () => {
    const presenting = new Set(["plus:2", "mixed:1", "plus:4", "plus:7", "plus:10", "mixed:4", "mixed:7", "times:4", "divide:4", "space:1", "space:4", "space:7", "space:10"]);
    for (const mode of ["plus", "mixed", "times", "divide", "space"] as const) {
      for (let stage = 1; stage <= STAGES; stage++) {
        expect(start(mode, stage).phase === "intro", `${mode} ${stage}`).toBe(presenting.has(`${mode}:${stage}`));
      }
    }
    expect(start("tutorial", 0).phase).toBe("play");
    expect(start("endless", 0).phase).toBe("play");
  });

  it("makes the round wait until it is over, and then starts it", () => {
    const g = start("mixed", 4);
    g.spawnTimer = 0;
    for (let i = 0; i < 120; i++) update(g, 1 / 60);
    expect(g.numbers).toHaveLength(0);
    expect(g.phase).toBe("intro");
    expect(g.overTimer).toBeGreaterThan(1.9); // (how long it has been shown)
    expect(tapAt(g, 100, 100)).toBe(false);
    endIntro(g);
    expect(g.phase).toBe("play");
    expect(g.intro).toEqual([]);
    expect(g.hideIntros.size).toBe(0);
    expect(g.events.some((e) => e.t === "introHide")).toBe(false);
    update(g, 1 / 60);
    expect(g.numbers.length).toBeGreaterThan(0);
  });

  it("is not shown again once the player has asked for that", () => {
    const g = start("times", 4);
    endIntro(g, true);
    expect(g.phase).toBe("play");
    expect(g.hideIntros.has("ice")).toBe(true);
    expect(g.events).toContainEqual({t: "introHide", features: ["ice"]});
    startGame(g, "times", 4);
    expect(g.phase).toBe("play");
    // The other kinds are still presented.
    startGame(g, "divide", 4);
    expect(g.phase).toBe("intro");
  });

  it("is only ended while it is shown", () => {
    const g = start("plus", 1);
    endIntro(g, true);
    expect(g.phase).toBe("play");
    expect(g.hideIntros.size).toBe(0);
  });
});

describe("the orange 0", () => {
  /** Numbers made on this level while a living cup has this much in it. */
  function made(mode: Mode, stage: number, cupValue: number, count = 300): NumberTile[] {
    let seed = 777;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
    g.cups[0].value = cupValue;
    const all: NumberTile[] = [];
    for (let i = 0; i < count; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      all.push(...g.numbers);
    }
    return all;
  }
  const zeros = (list: NumberTile[]) => list.filter((n) => n.op === "zero");

  it("sets the cup it lands in back to 0", () => {
    const g = playing();
    g.cups[1].value = 7;
    const n = drop(g, COLS[1], 200, 0);
    n.op = "zero";
    tapAndSettle(g, n);
    expect(g.cups[1].value).toBe(0);
    expect(g.cups[1].dead).toBe(false);
    expect(g.phase).toBe("play");
    expect(g.score).toBeGreaterThan(0);
  });

  it("saves a minus cup too", () => {
    const g = playing();
    g.cups[2].value = -9;
    const n = drop(g, COLS[2], 200, 0);
    n.op = "zero";
    tapAndSettle(g, n);
    expect(g.cups[2].value).toBe(0);
  });

  it("is game over if it lands in a dead cup, like any other number", () => {
    const g = playing();
    g.cups[1].dead = true;
    g.cups[1].value = 12;
    const n = drop(g, COLS[1], 200, 0);
    n.op = "zero";
    tapAt(g, n.x, n.y);
    for (let i = 0; i < 200 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
  });

  it("only comes from level 4 of plus, and only when a living cup has something worth wiping out in it", () => {
    expect(zeros(made("plus", 3, 6))).toHaveLength(0);
    expect(zeros(made("plus", 4, 6)).length).toBeGreaterThan(0);
    expect(zeros(made("divide", 1, 6)).length).toBeGreaterThan(0);
    expect(zeros(made("plus", 4, 3))).toHaveLength(0);
    expect(zeros(made("plus", 4, -5)).length).toBeGreaterThan(0);
    expect(zeros(made("endless", 0, 6))).toHaveLength(0); // (level 1 of the endless game is like the first chapter)
    expect(made("plus", 4, 6).every((n) => n.op === "zero" ? n.v === 0 : true)).toBe(true);
  });
});

describe("the space chapter", () => {
  /** Lets numbers fall on this level, with cups that have something in them. */
  function numbersIn(mode: Mode, stage: number): NumberTile[] {
    let seed = 4242;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
    g.cups[0].value = 3;
    g.cups[1].value = -4;
    const out: NumberTile[] = [];
    for (let i = 0; i < 300; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      out.push(...g.numbers);
    }
    return out;
  }

  it("is a level mode, and needs two more perfect 10s than the other chapters", () => {
    expect([1, 6, 7, 12].map((s) => goalFor("space", s))).toEqual([5, 6, 7, 8]);
    const g = testGame(() => 0.5);
    g.hideIntros = new Set(FEATURES);
    startGame(g, "space", 5);
    expect(g.stage).toBe(5);
    expect(g.phase).toBe("play");
  });

  it("brings every kind of number from the very first level: minus, blue and yellow ones", () => {
    const all = numbersIn("space", 1);
    expect(all.some((n) => n.v < 0)).toBe(true);
    expect(all.some((n) => n.op === "mul")).toBe(true);
    expect(all.some((n) => n.op === "div")).toBe(true);
  });

  it("keeps everything the earlier chapters brought in (chains, ice and ghosts)", () => {
    const all = numbersIn("space", 1);
    expect(all.some((n) => n.chain !== null)).toBe(true);
    expect(all.some((n) => n.ice > 0)).toBe(true);
    expect(all.some((n) => n.ghost !== null)).toBe(true);
  });

  it("presents the star on level 1, the black number on level 4, steel on level 7, the triple chain on level 10 and nothing else", () => {
    const first: Record<number, string> = {1: "star", 4: "fog", 7: "steel", 10: "chain3"};
    for (let stage = 1; stage <= STAGES; stage++) {
      const g = createGame(() => 0.5);
      startGame(g, "space", stage);
      expect(g.phase === "intro", `space ${stage}`).toBe(stage in first);
      if (stage in first) expect(g.intro).toEqual([first[stage]]);
    }
  });
});

describe("the black number", () => {
  const dark = (list: NumberTile[]) => list.filter((n) => n.op === "dim");

  function made(mode: Mode, stage: number, count = 300): NumberTile[] {
    let seed = 99;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
    const all: NumberTile[] = [];
    for (let i = 0; i < count; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      all.push(...g.numbers);
    }
    return all;
  }

  it("only comes from level 4 of the last chapter", () => {
    for (const [mode, stage] of [["plus", 12], ["mixed", 12], ["times", 12], ["divide", 12], ["space", 3]] as const) {
      expect(dark(made(mode, stage)), `${mode} ${stage}`).toHaveLength(0);
    }
    expect(dark(made("space", 4)).length).toBeGreaterThan(0);
    expect(dark(made("space", 12)).length).toBeGreaterThan(0);
  });

  it("adds its value to the cup, and hides the number of the cup", () => {
    const g = playing();
    g.cups[1].value = 3;
    const n = drop(g, COLS[1], 200, 4);
    n.op = "dim";
    tapAndSettle(g, n);
    expect(g.cups[1].value).toBe(7);
    expect(g.cups[1].hidden).toBe(true);
    expect(g.cups[0].hidden).toBe(false);
  });

  it("works with a minus value too", () => {
    const g = playing();
    g.cups[1].value = 3;
    const n = drop(g, COLS[1], 200, -5);
    n.op = "dim";
    tapAndSettle(g, n);
    expect(g.cups[1].value).toBe(-2);
    expect(g.cups[1].hidden).toBe(true);
  });

  it("keeps the number hidden while more numbers land, and shows it again when the cup starts over", () => {
    const g = playing();
    g.cups[1].value = 3;
    const a = drop(g, COLS[1], 200, 2);
    a.op = "dim";
    tapAndSettle(g, a);
    tapAndSettle(g, drop(g, COLS[1], 200, 1));
    expect(g.cups[1].value).toBe(6);
    expect(g.cups[1].hidden).toBe(true);
    tapAndSettle(g, drop(g, COLS[1], 200, 4)); // 6 + 4 = 10: perfect
    expect(g.cups[1].value).toBe(0);
    expect(g.cups[1].hidden).toBe(false);
  });

  it("is shown again when a 0 sets the cup back, or a life ball brings a dead cup back", () => {
    const g = playing();
    g.cups[1].value = 5;
    g.cups[1].hidden = true;
    const z = drop(g, COLS[1], 200, 0);
    z.op = "zero";
    tapAndSettle(g, z);
    expect(g.cups[1].hidden).toBe(false);
    g.cups[2].dead = true;
    g.cups[2].value = 12;
    g.cups[2].hidden = true;
    const life = drop(g, COLS[0], 200, 0);
    life.bonus = "life";
    expect(tapAt(g, life.x, life.y)).toBe(true);
    for (let i = 0; i < 300 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[2].dead).toBe(false);
    expect(g.cups[2].hidden).toBe(false);
  });
});

describe("three cups in the first chapter, four in the rest", () => {
  const start = (mode: Mode): GameState => {
    const g = testGame(() => 0.5);
    startGame(g, mode, 1);
    return g;
  };

  it("has three cups in three columns, in the middle of the screen, in the plus chapter", () => {
    for (const stage of [1, 6, 12]) {
      const g = testGame(() => 0.5);
      startGame(g, "plus", stage);
      expect(g.cols, `plus ${stage}`).toEqual([90, 180, 270]);
      expect(g.cups.map((c) => c.x)).toEqual([90, 180, 270]);
    }
  });

  it("has four cups in four columns in every other chapter, the tutorial and the endless game", () => {
    for (const mode of ["mixed", "times", "divide", "space", "tutorial", "endless"] as const) {
      const g = start(mode);
      expect(g.cols, mode).toEqual([...COLS]);
      expect(g.cups.map((c) => c.x), mode).toEqual([...COLS]);
    }
  });

  it("lets the numbers fall in the three columns only, and into the cup under them", () => {
    let seed = 31337;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    startGame(g, "plus", 1);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      for (const n of g.numbers) seen.add(n.x);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([90, 180, 270]);
  });

  it("swaps cups between the three columns, and always ends in three different ones", () => {
    const g = start("plus");
    const [a, b, c] = g.cups;
    a.value = 1;
    b.value = 2;
    c.value = 3;
    moveCup(g, a, 275);
    dropCup(g, a);
    expect(g.cups.map((k) => k.x).sort((x, y) => x - y)).toEqual([90, 180, 270]);
    expect(a.x).toBe(270);
  });

  it("goes back to four columns in the book (the cups behind the pages)", () => {
    const g = start("plus");
    showMenu(g);
    expect(g.cols).toEqual([...COLS]);
    expect(g.cups).toHaveLength(4);
  });

  it("presents the fourth cup when the second chapter starts", () => {
    const g = createGame(() => 0.5);
    startGame(g, "mixed", 1);
    expect(g.phase).toBe("intro");
    expect(g.intro).toEqual(["cups"]);
  });
});

describe("the star", () => {
  /** A running game in the space chapter, with one star on its way down. */
  function withStar(stage = 7): {g: GameState; star: NumberTile} {
    let seed = 2024;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    startGame(g, "space", stage);
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    const star = drop(g, g.cols[1], 60, 0);
    star.col = 1;
    star.bonus = "star";
    star.speed = 0.5;
    return {g, star};
  }

  it("only comes from level 1 of space, with the other bonus balls", () => {
    const kindsOn = (mode: Mode, stage: number): Set<string> => {
      const kinds = new Set<string>();
      for (let i = 0; i < 500; i++) {
        let a = i * 104729 + 7;
        const g = testGame(() => {
          a = (a * 1664525 + 1013904223) % 4294967296;
          return a / 4294967296;
        });
        startGame(g, mode, stage);
        g.spawnTimer = 1e9;
        g.bonusTimer = 0.01;
        update(g, 1 / 60);
        for (const n of g.numbers) if (n.bonus) kinds.add(n.bonus);
      }
      return kinds;
    };
    expect(kindsOn("divide", 12).has("star")).toBe(false);
    expect(kindsOn("space", 1).has("star")).toBe(true);
    expect(kindsOn("space", 7).has("star")).toBe(true);
    expect(kindsOn("space", 12).has("star")).toBe(true);
  });

  it("jumps between the columns as it falls, and never stands still in one", () => {
    const {g, star} = withStar();
    const columns = new Set<number>();
    for (let i = 0; i < 60 * 6 && g.numbers.includes(star); i++) {
      update(g, 1 / 60);
      columns.add(star.col);
    }
    expect(columns.size).toBeGreaterThanOrEqual(3);
    expect(g.cols).toContain(star.aim);
  });

  it("falls past the cups if nobody taps it, without landing in one", () => {
    const {g, star} = withStar();
    for (let i = 0; i < 60 * 30 && g.numbers.includes(star); i++) update(g, 1 / 60);
    expect(g.numbers.includes(star)).toBe(false);
    expect(g.cups.every((c) => c.value === 0 && !c.dead)).toBe(true);
    expect(g.phase).toBe("play");
  });

  it("clears every living cup when it is tapped, with an effect on each", () => {
    const {g, star} = withStar();
    g.cups[0].value = 2;
    g.cups[1].value = 7;
    g.cups[2].value = -4;
    g.cups[3].value = 5;
    g.level = 3;
    expect(tapAt(g, star.x, star.y)).toBe(true);
    expect(g.numbers.includes(star)).toBe(false);
    expect(g.cups.map((c) => c.value)).toEqual([0, 0, 0, 0]);
    expect(g.cups.every((c) => c.flash === 1 && c.ripple === 1)).toBe(true);
    // It is not a perfect 10: the level does not go up.
    expect(g.level).toBe(3);
    expect(g.events.some((e) => e.t === "levelUp")).toBe(false);
    expect(g.events.some((e) => e.t === "bonus" && e.kind === "star")).toBe(true);
  });

  it("gives points for what was in the cups", () => {
    const {g, star} = withStar();
    g.cups[0].value = 2;
    g.cups[1].value = 7;
    g.cups[2].value = -4;
    g.level = 3;
    const before = g.score;
    tapAt(g, star.x, star.y);
    expect(g.score - before).toBe((2 + 7 + 4) * 3);
    const bonus = g.events.find((e) => e.t === "bonus" && e.kind === "star") as {amount: number};
    expect(bonus.amount).toBe(39);
  });

  it("leaves a dead cup dead, and shows a hidden cup again", () => {
    const {g, star} = withStar();
    g.cups[0].dead = true;
    g.cups[0].value = 14;
    g.cups[1].value = 5;
    g.cups[1].hidden = true;
    expect(tapAt(g, star.x, star.y)).toBe(true);
    expect(g.cups[0].dead).toBe(true);
    expect(g.cups[0].value).toBe(14);
    expect(g.cups[0].flash).toBe(0);
    expect(g.cups[1].value).toBe(0);
    expect(g.cups[1].hidden).toBe(false);
  });

  it("does not clear the level or take a cup to 10: the progress stays where it was", () => {
    const {g, star} = withStar();
    g.level = goalFor("space", 7); // one cup left to fill
    g.cups[1].value = 9;
    tapAt(g, star.x, star.y);
    expect(g.phase).toBe("play");
    expect(g.level).toBe(goalFor("space", 7));
  });
});

describe("stars for the points of a level", () => {
  it("gives one star for a cleared level, two for a steady run and three for a good one", () => {
    expect(starsFor("plus", 1, 0)).toBe(1);
    expect(starsFor("plus", 1, 300)).toBe(1);
    expect(starsFor("plus", 1, 521)).toBe(1); // 3 cups: par is 522, and three stars start at 731
    expect(starsFor("plus", 1, 705)).toBe(2);
    expect(starsFor("plus", 1, 730)).toBe(2);
    expect(starsFor("plus", 1, 731)).toBe(3);
  });

  it("asks for more points on the levels that need more cups, and never gives fewer stars for more points", () => {
    expect(starsFor("plus", 1, 700)).toBeGreaterThan(starsFor("plus", 10, 700) - 1);
    expect(starsFor("plus", 10, 700)).toBe(1); // 6 cups: far more points are needed
    for (const stage of [1, 4, 7, 10]) {
      let last = 1;
      for (let score = 0; score <= 20000; score += 50) {
        const stars = starsFor("mixed", stage, score);
        expect(stars).toBeGreaterThanOrEqual(last);
        last = stars;
      }
      expect(last).toBe(3);
    }
  });

  it("is one star in the games that have no end", () => {
    expect(starsFor("endless", 0, 99999)).toBe(1);
  });
});

describe("combos of perfect 10s", () => {
  /** Makes a perfect 10 in a cup (it has 6, and a 4 is sent into it). */
  function perfect(g: GameState, cup = 1): void {
    g.cups[cup].value = 6;
    tapAndSettle(g, drop(g, g.cols[cup], 200, 4));
  }
  const combos = (g: GameState) => g.events.filter((e) => e.t === "combo");

  it("gives the normal points for a single perfect 10, and starts the time for a combo", () => {
    const g = playing();
    perfect(g);
    expect(g.level).toBe(2);
    expect(g.score).toBe(4 + 50 * 2); // the 4 that landed, and the bonus for the perfect 10
    expect(g.combo).toBe(1);
    expect(g.comboTimer).toBeGreaterThan(4);
    expect(combos(g)).toHaveLength(0);
  });

  it("builds a combo times 2 when the next perfect 10 comes within 5 seconds, and times 3 after that", () => {
    const g = playing();
    perfect(g);
    const after1 = g.score;
    perfect(g, 2);
    expect(g.combo).toBe(2);
    expect(g.score - after1).toBe(4 * 2 + 100 * 3 * 2); // the points of the number, and the combo bonus (twice as much, times 2)
    expect(combos(g)).toEqual([{t: "combo", n: 2, x: g.cups[2].x, y: g.cups[2].y - CUP_H / 2, bonus: 600}]);
    const after2 = g.score;
    g.events.length = 0;
    perfect(g, 0);
    expect(g.combo).toBe(3);
    expect(g.score - after2).toBe(4 * 3 + 100 * 4 * 3);
    expect(combos(g)).toHaveLength(1);
    expect((combos(g)[0] as {n: number}).n).toBe(3);
  });

  it("starts over when more than 5 seconds have passed", () => {
    const g = playing();
    perfect(g);
    for (let i = 0; i < 60 * 5.2; i++) update(g, 1 / 60);
    expect(g.combo).toBe(0);
    expect(g.comboTimer).toBe(0);
    g.events.length = 0;
    const before = g.score;
    perfect(g, 2);
    expect(g.combo).toBe(1);
    expect(g.score - before).toBe(4 * 2 + 50 * 3); // no combo: the ordinary bonus
    expect(combos(g)).toHaveLength(0);
  });

  it("counts the time down while it is played, also when the numbers are slowed down", () => {
    const g = playing();
    perfect(g);
    const start = g.comboTimer;
    g.slow = 5;
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(g.comboTimer).toBeCloseTo(start - 1, 1);
  });

  it("keeps going with the next perfect 10 if it lands before the time is up (the time is for the landing, not for the tap)", () => {
    const g = playing();
    perfect(g);
    for (let i = 0; i < 60 * 3.5; i++) update(g, 1 / 60);
    expect(g.combo).toBe(1);
    perfect(g, 2);
    expect(g.combo).toBe(2);
  });

  it("does not carry over to a new round, and is not in the tutorial", () => {
    const g = playing();
    perfect(g);
    startGame(g, "mixed", 1);
    expect(g.combo).toBe(0);
    expect(g.comboTimer).toBe(0);
    const t = testGame(() => 0.5);
    startGame(t, "tutorial");
    expect(t.combo).toBe(0);
    expect(combos(t)).toHaveLength(0);
  });
});

describe("the pull-down screen", () => {
  /** A running game in the plus chapter (level 2, where the screen comes in) with this many screens, and numbers high up and low down. */
  function withNumbers(screens = 1): {g: GameState; high: NumberTile; low: NumberTile} {
    const g = testGame(() => 0.5);
    startGame(g, "plus", 2);
    g.spawnTimer = 1e9;
    g.screens = screens;
    const high = drop(g, g.cols[0], 40, 3);
    const low = drop(g, g.cols[2], 380, 4);
    return {g, high, low};
  }
  const bonusBall = (g: GameState, y: number): NumberTile => {
    const n = drop(g, g.cols[1], y, 0);
    n.bonus = "points";
    return n;
  };

  it("comes in on level 2 of the plus chapter, and not before", () => {
    const g = testGame(() => 0.5);
    startGame(g, "plus", 1);
    g.screens = 2;
    expect(featureAge(g, "screen")).toBe(-1);
    expect(useScreen(g)).toBe(false);
    startGame(g, "plus", 2);
    g.screens = 2;
    expect(useScreen(g)).toBe(true);
    expect(g.screens).toBe(1);
  });

  it("comes down from the ceiling and takes away every falling number it reaches, the high ones first", () => {
    const {g, high, low} = withNumbers();
    expect(useScreen(g)).toBe(true);
    expect(g.sweep).toBe(0);
    expect(sweepEdge(g)).toBe(0);
    update(g, 1 / 60);
    expect(g.numbers.includes(high)).toBe(false); // it was right at the top
    expect(g.numbers.includes(low)).toBe(true); // the screen has not got that far yet
    let reached = false;
    for (let i = 0; i < 60 * (SWEEP_DOWN + SWEEP_HOLD) && !reached; i++) {
      update(g, 1 / 60);
      if (!g.numbers.includes(low)) reached = true;
    }
    expect(reached).toBe(true);
    expect(g.numbers.filter((n) => !n.bonus)).toHaveLength(0);
  });

  it("goes all the way down, stays a moment and rolls up again", () => {
    const {g} = withNumbers();
    useScreen(g);
    const edges: number[] = [];
    for (let i = 0; i < 60 * (SWEEP_DOWN + SWEEP_HOLD + SWEEP_UP + 0.1); i++) {
      update(g, 1 / 60);
      edges.push(sweepEdge(g));
    }
    expect(Math.max(...edges)).toBeCloseTo(SWEEP_EDGE, 0);
    expect(edges[edges.length - 1]).toBe(-1);
    expect(g.sweep).toBe(-1);
  });

  it("leaves the numbers that have been tapped, and the bonus balls", () => {
    const {g, low} = withNumbers();
    const star = bonusBall(g, 100);
    const tapped = drop(g, g.cols[1], 300, 2);
    expect(tapAt(g, tapped.x, tapped.y)).toBe(true);
    expect(tapped.state).toBe("dive");
    useScreen(g);
    for (let i = 0; i < 60 * 1.5; i++) update(g, 1 / 60);
    expect(g.numbers.includes(low)).toBe(false);
    expect(g.numbers.includes(star)).toBe(true);
    expect(g.cups[1].value).toBe(2); // the tapped number landed all the same
  });

  it("lets nothing new fall while the screen is down, and starts again after", () => {
    const {g} = withNumbers();
    g.numbers = [];
    g.spawnTimer = 0.1;
    useScreen(g);
    for (let i = 0; i < 60 * (SWEEP_DOWN + SWEEP_HOLD + SWEEP_UP) - 5; i++) update(g, 1 / 60);
    expect(g.numbers).toHaveLength(0);
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(g.numbers.length).toBeGreaterThan(0);
  });

  it("is used one at a time, and only while there are some left", () => {
    const {g} = withNumbers(2);
    expect(useScreen(g)).toBe(true);
    expect(useScreen(g)).toBe(false); // one is already down
    for (let i = 0; i < 60 * 2; i++) update(g, 1 / 60);
    expect(useScreen(g)).toBe(true);
    for (let i = 0; i < 60 * 2; i++) update(g, 1 / 60);
    expect(g.screens).toBe(0);
    expect(useScreen(g)).toBe(false);
  });

  it("cannot be used in the tutorial", () => {
    const g = testGame(() => 0.5);
    startGame(g, "tutorial");
    g.screens = 3;
    expect(useScreen(g)).toBe(false);
  });

  it("is handed out by its presentation if you have none, so it can be tried at once", () => {
    const g = createGame(() => 0.5);
    startGame(g, "plus", 2);
    expect(g.phase).toBe("intro");
    expect(g.screens).toBe(0);
    endIntro(g);
    expect(g.screens).toBe(1);
    expect(g.events).toContainEqual({t: "screens", n: 1});
    // Not if you already have one.
    const h = createGame(() => 0.5);
    h.screens = 2;
    startGame(h, "plus", 2);
    endIntro(h);
    expect(h.screens).toBe(2);
  });

  it("tells the screen when the number of screens changes", () => {
    const {g} = withNumbers(2);
    useScreen(g);
    expect(g.events).toContainEqual({t: "sweep"});
    expect(g.events).toContainEqual({t: "screens", n: 1});
  });

  it("is only given when a level is cleared with three stars, and never past 3", () => {
    const clear = (score: number, screens: number): GameState => {
      const g = testGame(() => 0.5);
      startGame(g, "mixed", 1);
      g.spawnTimer = 1e9;
      g.screens = screens;
      g.level = goalFor("mixed", 1);
      g.score = score;
      g.cups[1].value = 6;
      tapAndSettle(g, drop(g, g.cols[1], 200, 4));
      expect(g.phase).toBe("won");
      return g;
    };
    const none = clear(0, 0);
    expect(none.screens).toBe(0); // a cleared level on its own gives nothing
    expect(none.screenWon).toBe(false);
    expect(none.events.some((e) => e.t === "screens")).toBe(false);
    const two = clear(300, 1); // (about two stars)
    expect(two.screens).toBe(1);
    expect(two.screenWon).toBe(false);
    const three = clear(5000, 0);
    expect(three.screens).toBe(1);
    expect(three.screenWon).toBe(true);
    expect(three.events).toContainEqual({t: "screens", n: 1});
    expect(clear(5000, 2).screens).toBe(SCREEN_MAX);
    const full = clear(5000, SCREEN_MAX);
    expect(full.screens).toBe(SCREEN_MAX);
    expect(full.screenWon).toBe(false); // (no room for one more: no prize to show)
  });

  it("forgets the prize when a new round starts", () => {
    const g = testGame(() => 0.5);
    g.screenWon = true;
    startGame(g, "mixed", 1);
    expect(g.screenWon).toBe(false);
  });

  it("starts with one in the endless game, and gives a new one every time the whole bar has been filled", () => {
    const g = testGame(() => 0.5);
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    expect(g.screens).toBe(1);
    expect(featureAge(g, "screen")).toBeGreaterThanOrEqual(0);
    for (let cup = 1; cup <= 5; cup++) {
      g.cups[1].value = 6;
      tapAndSettle(g, drop(g, g.cols[1], 200, 4));
    }
    expect(g.screens).toBe(2); // (the fifth cup filled the bar)
    expect(useScreen(g)).toBe(true);
  });
});

describe("more help from bonus balls", () => {
  it("brings a bonus ball every 11 to 20 seconds", () => {
    const waits = new Set<number>();
    for (let i = 0; i < 40; i++) {
      let a = i * 7919 + 5;
      const g = testGame(() => {
        a = (a * 1664525 + 1013904223) % 4294967296;
        return a / 4294967296;
      });
      startGame(g, "mixed", 8);
      waits.add(Math.round(g.bonusTimer * 10) / 10);
      expect(g.bonusTimer).toBeGreaterThanOrEqual(11);
      expect(g.bonusTimer).toBeLessThan(20);
    }
    expect(waits.size).toBeGreaterThan(5);
  });

  it("brings the heart soon after a cup has died, as the next bonus ball", () => {
    for (let i = 0; i < 20; i++) {
      let a = i * 104729 + 3;
      const g = testGame(() => {
        a = (a * 1664525 + 1013904223) % 4294967296;
        return a / 4294967296;
      });
      startGame(g, "mixed", 8);
      g.spawnTimer = 1e9;
      g.bonusTimer = 100;
      g.cups[1].value = 8;
      tapAndSettle(g, drop(g, g.cols[1], 200, 5)); // 13: the cup dies
      expect(g.cups[1].dead).toBe(true);
      expect(g.lifeDue).toBe(true);
      expect(g.bonusTimer).toBeLessThanOrEqual(7);
      for (let f = 0; f < 60 * 8 && !g.numbers.some((n) => n.bonus); f++) update(g, 1 / 60);
      expect(g.numbers.find((n) => n.bonus)?.bonus, `try ${i}`).toBe("life");
      expect(g.lifeDue).toBe(false);
    }
  });

  it("does not wait for a heart once the cup has been brought back, and not before hearts have come in", () => {
    const g = testGame(() => 0.5);
    startGame(g, "plus", 1);
    g.spawnTimer = 1e9;
    g.cups[1].value = 8;
    tapAndSettle(g, drop(g, g.cols[1], 200, 5));
    expect(g.cups[1].dead).toBe(true);
    expect(g.lifeDue).toBe(false); // (hearts come in on level 7)
    const h = testGame(() => 0.5);
    startGame(h, "mixed", 8);
    h.spawnTimer = 1e9;
    h.cups[1].dead = true;
    h.lifeDue = true;
    h.cups[1].dead = false; // brought back by something else
    h.bonusTimer = 0.01;
    update(h, 1 / 60);
    expect(h.lifeDue).toBe(false);
  });
});

describe("steel numbers", () => {
  const steelIn = (list: NumberTile[]) => list.filter((n) => n.op === "steel");

  function made(mode: Mode, stage: number, count = 300): NumberTile[] {
    let seed = 8080;
    const g = createGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
    const all: NumberTile[] = [];
    for (let i = 0; i < count; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      all.push(...g.numbers);
    }
    return all;
  }

  it("only come from level 7 of the space chapter, with a small value (1 to 3, or minus)", () => {
    for (const [mode, stage] of [["plus", 12], ["divide", 12], ["space", 6]] as const) {
      expect(steelIn(made(mode, stage)), `${mode} ${stage}`).toHaveLength(0);
    }
    const steel = steelIn(made("space", 7));
    expect(steel.length).toBeGreaterThan(0);
    expect(steel.every((n) => Math.abs(n.v) >= 1 && Math.abs(n.v) <= 3)).toBe(true);
    expect(steel.every((n) => n.ice === 0 && n.ghost === null && n.chain === null)).toBe(true);
    expect(steelIn(made("space", 12)).length).toBeGreaterThan(0);
  });

  it("cannot be tapped: it only clinks, and keeps falling", () => {
    const g = playing();
    const n = drop(g, g.cols[1], 200, 2);
    n.op = "steel";
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(n.state).toBe("fall");
    expect(g.events).toEqual([{t: "steel", x: n.x, y: 200}]);
    expect(g.events.some((e) => e.t === "tap")).toBe(false);
    update(g, 1 / 60);
    expect(n.y).toBeGreaterThan(200);
  });

  it("lands in the cup under it at its own pace and adds its value like any other number", () => {
    const g = playing();
    const n = drop(g, g.cols[1], 200, 3);
    n.op = "steel";
    for (let i = 0; i < 60 * 20 && g.numbers.includes(n); i++) {
      if (i % 20 === 0) tapAt(g, n.x, n.y); // (tapping it again and again changes nothing)
      update(g, 1 / 60);
    }
    expect(g.cups[1].value).toBe(3);
    expect(g.score).toBe(3);
  });

  it("is chosen before another number that is nearer to the finger only if it is the nearest", () => {
    const g = playing();
    const steel = drop(g, g.cols[1], 200, 2);
    steel.op = "steel";
    const plain = drop(g, g.cols[1] + 30, 200, 4);
    expect(tapAt(g, plain.x, plain.y)).toBe(true);
    expect(plain.state).toBe("dive");
    expect(steel.state).toBe("fall");
  });

  it("is gone when the pull-down screen wipes the numbers away, like the others", () => {
    const g = testGame(() => 0.5);
    startGame(g, "space", 7);
    g.spawnTimer = 1e9;
    g.screens = 1;
    const n = drop(g, g.cols[1], 40, 2);
    n.op = "steel";
    useScreen(g);
    update(g, 1 / 60);
    expect(g.numbers.includes(n)).toBe(false);
  });
});

describe("a chain of three", () => {
  function chains(mode: Mode, stage: number, count = 400): {triples: NumberTile[][]; pairs: number} {
    let seed = 515;
    const g = createGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
    const triples: NumberTile[][] = [];
    let pairs = 0;
    for (let i = 0; i < count; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      if (g.numbers.length === 3 && g.numbers.every((n) => n.chain !== null)) triples.push([...g.numbers]);
      else if (g.numbers.length === 2 && g.numbers[0].chain !== null) pairs++;
    }
    return {triples, pairs};
  }

  it("only comes from level 10 of the space chapter, and the pairs still come", () => {
    expect(chains("space", 9).triples).toHaveLength(0);
    expect(chains("divide", 12).triples).toHaveLength(0);
    const r = chains("space", 10);
    expect(r.triples.length).toBeGreaterThan(0);
    expect(r.pairs).toBeGreaterThan(0);
  });

  it("is three numbers side by side, the middle one chained to both, all plain", () => {
    const [t] = chains("space", 10).triples;
    const [a, b, c] = t;
    expect(b.col - a.col).toBe(1);
    expect(c.col - b.col).toBe(1);
    expect(a.chain).toBe(b.id);
    expect(c.chain).toBe(b.id);
    expect(b.chain).toBe(a.id);
    expect(b.chain2).toBe(c.id);
    expect(t.every((n) => n.ghost === null && n.ice === 0 && n.op !== "steel")).toBe(true);
  });

  it("pulls the others down one after the other, and all three end up in their own cups", () => {
    const g = testGame(() => 0.5);
    startGame(g, "space", 10);
    g.spawnTimer = 1e9;
    const a = drop(g, g.cols[0], 200, 2);
    const b = drop(g, g.cols[1], 200, 3);
    const c = drop(g, g.cols[2], 200, 4);
    a.chain = b.id;
    b.chain = a.id;
    b.chain2 = c.id;
    c.chain = b.id;
    expect(tapAt(g, a.x, a.y)).toBe(true);
    expect([a.state, b.state, c.state]).toEqual(["dive", "dive", "dive"]);
    expect(b.hang).toBe(a.id);
    expect(c.hang).toBe(b.id); // the last one hangs on the middle one
    const landed: string[] = [];
    for (let i = 0; i < 60 * 6 && g.numbers.length > 0; i++) {
      update(g, 1 / 60);
      for (const [name, n] of [["a", a], ["b", b], ["c", c]] as const) if (n.done && !landed.includes(name)) landed.push(name);
    }
    expect(landed).toEqual(["a", "b", "c"]);
    expect(g.cups[0].value).toBe(2);
    expect(g.cups[1].value).toBe(3);
    expect(g.cups[2].value).toBe(4);
  });

  it("is pulled from the end as well: the middle one and then the other end follow", () => {
    const g = testGame(() => 0.5);
    startGame(g, "space", 10);
    g.spawnTimer = 1e9;
    const a = drop(g, g.cols[0], 200, 2);
    const b = drop(g, g.cols[1], 200, 3);
    const c = drop(g, g.cols[2], 200, 4);
    a.chain = b.id;
    b.chain = a.id;
    b.chain2 = c.id;
    c.chain = b.id;
    expect(tapAt(g, c.x, c.y)).toBe(true);
    expect([a.state, b.state, c.state]).toEqual(["dive", "dive", "dive"]);
    expect(b.hang).toBe(c.id);
    expect(a.hang).toBe(b.id);
  });
});

describe("how fast the endless game speeds up", () => {
  it("starts like the first level and climbs slower than the cups are filled", () => {
    const g = testGame();
    startGame(g, "endless");
    expect(paceOf(g)).toBe(1);
    g.level = 13; // twelve cups have been filled
    expect(paceOf(g)).toBeCloseTo(1 + 12 * ENDLESS_PACE, 5);
    // The numbers fall slower, and come less often, than they did when the pace was one step for every cup.
    expect(fallSpeed(paceOf(g))).toBeLessThan(fallSpeed(13));
    expect(spawnInterval(paceOf(g))).toBeGreaterThan(spawnInterval(13));
  });

  it("is the old pace in the levels of the book", () => {
    const g = testGame();
    startGame(g, "plus", 4);
    g.level = 3;
    expect(paceOf(g)).toBe(3 + 3 * 1.25);
  });
});

describe("cups that end up on top of each other", () => {
  it("are given a column each again, in the order they stand in", () => {
    const g = playing();
    const xs = g.cups.map((c) => c.x);
    // Two cups in the same column, and one left in between two columns (what a lost drag could leave behind).
    g.cups[1].x = g.cups[0].x;
    g.cups[2].x = (xs[2] + xs[3]) / 2;
    expect(untangleCups(g)).toBe(true);
    expect(g.cups.map((c) => c.x).sort((a, b) => a - b)).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(g.cups.map((c) => c.x)).size).toBe(g.cups.length);
    expect(untangleCups(g)).toBe(false); // (nothing more to do)
  });

  it("are left alone when every cup has its own column", () => {
    const g = playing();
    const before = g.cups.map((c) => c.x);
    expect(untangleCups(g)).toBe(false);
    expect(g.cups.map((c) => c.x)).toEqual(before);
  });

  it("are put right when a cup is let go", () => {
    const g = playing();
    const [a, b] = g.cups;
    moveCup(g, a, b.x); // dragged on top of the next cup: they swap
    b.x = a.x; // (and something went wrong)
    dropCup(g, a);
    expect(new Set(g.cups.map((c) => c.x)).size).toBe(g.cups.length);
  });
});

describe("the record when an endless round is left before it ends", () => {
  it("counts the score so far if it beats the record", () => {
    const g = testGame(() => 0.5, 300);
    startGame(g, "endless");
    g.score = 250;
    expect(recordBest(g)).toBe(false); // lower than 300
    expect(g.best).toBe(300);
    g.score = 800;
    expect(recordBest(g)).toBe(true);
    expect(g.best).toBe(800);
    expect(recordBest(g)).toBe(false); // (already counted)
  });

  it("does nothing in the levels of the book, or when no round is on", () => {
    const g = testGame(() => 0.5, 0);
    startGame(g, "plus", 1);
    g.score = 5000;
    expect(recordBest(g)).toBe(false);
    expect(g.best).toBe(0);
    showMenu(g);
    g.mode = "endless";
    expect(recordBest(g)).toBe(false);
  });
});
