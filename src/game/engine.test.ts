import {describe, expect, it} from "vitest";
import {LASER_COOLDOWN} from "./cups";
import {PERKS, PERK_LIMIT, PERK_SLOWER, SPECIAL_PERKS, STREAK_DAYS, previousDay, recordDay, rollPackage, streakCoins, streakCount, streakDayFor, streakFactor, cupsToClimb, dailyReward, dayKey, rungEnds, rungGoal, rungOfCup, rungsDone, seedOfDay, seededRandom} from "./daily";
import {DAILY_BONUS, DAILY_REWARD, DAILY_RUNGS} from "./constants";
import {BOMB_RADIUS, BONUS_POINTS, PAUSE_SECONDS, COLS, CUP_H, CUP_START_Y, CUP_W, SCREEN_MAX, SLOW_SECONDS, STAGES, SWEEP_DOWN, SWEEP_EDGE, SWEEP_HOLD, SWEEP_UP, W} from "./constants";
import {ENDLESS_PACE, FEATURES, canContinue, continueGame, createGame, cupAt, dropCup, endIntro, fallSpeed, featureAge, ghostShow, goalFor, fadeOn, fadeSeconds, saucerCount, paceOf, startVariant, variantRamp, variantRate, progressOf, starsFor, choosePerk, fireLaser, speedFactorOf, startDaily, sweepBottom, moveShield, SHIELD_AREA, useEraser, fastHover, fastWave, columnValue, findTime, helpGap, sweepEdge, useScreen, maxNumber, moveCup, nearestAliveCup, endlessLevel, recordBest, showMenu, spawnInterval, stageSpawnFactor, stageSpeedFactor, startGame, tapAt, untangleCups, update, endlessCupsBefore, endlessGoal, holdCraft, nextOffer, jetKillPoints, SHIP_HP, fuelCapacity, flyCraftTo, shotPower, ENEMY_FIRE_FROM, FUEL_SECONDS, FUEL_REFILL, shipFlying, dailyMixOf, dailyMixed, SHIELD_W_MAX, SHIELD_POWER_MAX, shieldDamage} from "./engine";
import {saucerPower, type SaucerKind} from "./saucers";
import type {GameState, Mode, NumberTile, PerkId, Weapon} from "./types";

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

  it("falls slower on the later levels of a chapter: 5% on levels 4-6, 10% on 7-9 and 28% on 10-12, and on top of that 15% on every level from 4 up", () => {
    // (and every level from 4 up another 15% slower than that, and levels 7 to 12 another 10%)
    const factors = [1, 1, 1, 0.8075, 0.8075, 0.8075, 0.6885, 0.6885, 0.6885, 0.5527125, 0.5527125, 0.5527125];
    factors.forEach((f, i) => expect(stageSpeedFactor(i + 1), `level ${i + 1}`).toBeCloseTo(f, 9));
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
        expect(n.y - 100, `${mode} level ${stage}`).toBeCloseTo((fallSpeed(g.level + g.base) * stageSpeedFactor(stage) * (stage >= 2 ? 0.9 : 1)) / 60, 6);
      }
    }
  });

  it("falls 15% slower from level 4 of the endless game, too", () => {
    const moved = (cups: number): number => {
      const g = testGame(() => 0.5);
      startGame(g, "endless");
      g.spawnTimer = 1e9;
      g.level = cups + 1; // (the levels of the endless game need 5, 6, 7 ... cups)
      const n = drop(g, COLS[1], 100, 3);
      update(g, 1 / 60);
      return (n.y - 100) * 60 / fallSpeed(paceOf(g));
    };
    expect(moved(0)).toBeCloseTo(1, 6); // level 1
    expect(moved(14)).toBeCloseTo(0.9, 6); // level 3 (10% slower from level 2)
    expect(moved(18)).toBeCloseTo(0.85 * 0.9, 6); // level 4 (5 + 6 + 7 cups)
    expect(moved(60)).toBeCloseTo(0.85 * 0.9, 6); // level 13: still 15% slower (no jump back up)
  });

  it("takes down every number a swipe passes over, each only once, and ice and steel are touched only once per stroke", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    const a = drop(g, COLS[0], 200, 1);
    const b = drop(g, COLS[1], 200, 2);
    const ice = drop(g, COLS[2], 200, 3);
    ice.ice = 2;
    const skip = new Set<number>();
    // The finger slides along y = 200 from the left to the right, in small steps.
    for (let x = 0; x <= 360; x += 10) tapAt(g, x, 200, skip);
    expect(a.state).toBe("dive");
    expect(b.state).toBe("dive");
    expect(ice.state).toBe("fall");
    expect(ice.ice).toBe(1); // cracked once by this stroke, not broken
    expect(g.events.filter((e) => e.t === "ice")).toHaveLength(1);
    // A new stroke touches it again.
    const second = new Set<number>();
    for (let x = 0; x <= 360; x += 10) tapAt(g, x, 200, second);
    expect(ice.ice).toBe(0);
    expect(ice.state).toBe("fall"); // (the ice is gone, but it takes one more tap to send the number down)
    // Without a stroke (`skip`) a tap is a tap as before.
    expect(tapAt(g, ice.x, ice.y)).toBe(true);
    expect(ice.state).toBe("dive");
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
    startGame(g, "plus", 3);
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

  it("need one cup more on every row of the book: 4, 5, 6 and 7 perfect 10s, and 8 on the last level of every chapter", () => {
    for (const mode of ["plus", "mixed", "times", "divide"] as const) {
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => goalFor(mode, s))).toEqual([4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8]);
    }
    // The space chapter needs two more on every level.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => goalFor("space", s))).toEqual([6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 8]);
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
    for (let i = 0; i < 20 * 60 && g.tutorialStep < 4; i++) update(g, 1 / 60);
    wait(g, 2.2); // (the good-job pause, then the numbers of the last step are set out)
    expect(g.tutorialStep).toBe(4);
    // 5. the cloth: a few numbers are in the air, and the cloth wipes them all away
    expect(g.numbers.length).toBeGreaterThanOrEqual(3);
    expect(g.cups.every((c) => !c.dead && c.value === 0)).toBe(true);
    g.screens = 2; // (what the player has is left alone)
    expect(useScreen(g)).toBe(true);
    update(g, 0.6);
    expect(g.numbers.filter((n) => n.state === "fall" && !n.done)).toHaveLength(0);
    wait(g, 5);
    expect(g.phase).toBe("won");
    expect(g.tutorialStep).toBe(5);
    expect(g.screens).toBe(2);
    expect(g.events.some((e) => e.t === "won")).toBe(true);
  });

  it("only lets the cloth be pulled on its own step, and the numbers of that step are small", () => {
    const g = tutorial();
    g.screens = 1;
    expect(useScreen(g)).toBe(false); // (the first step)
    g.tutorialStep = 4;
    g.numbers = [];
    wait(g, 0.1);
    expect(g.numbers.every((n) => n.v >= 1 && n.v <= 3)).toBe(true);
    expect(useScreen(g)).toBe(true);
    expect(useScreen(g)).toBe(false); // (it is already down)
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
    g.level = endlessCupsBefore(level) + 1; // the game counts every cup: the levels need 5, 6, 7 ...
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

  it("needs one more cup on every level, up to 20, and 20 on every level after that", () => {
    expect([1, 2, 3, 15, 16, 17, 40].map(endlessGoal)).toEqual([5, 6, 7, 19, 20, 20, 20]);
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
      g.level = endlessCupsBefore(level) + 1;
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
    g.rng = () => (kind === "life" ? 0.1 : kind === "points" ? 0.3 : 0.55);
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
    expect([...kindsOn("minus", 6)].sort()).toEqual(["life", "slow"]);
    expect([...kindsOn("minus", 7)].sort()).toEqual(["life", "slow", "wand"]); // the magic wand comes at level 7 of minus
    expect([...kindsOn("minus", 10)].sort()).toEqual(["life", "reverse", "slow", "wand"]); // and the reverse at level 10
    expect([...kindsOn("mixed", 1)].sort()).toEqual(["life", "reverse", "slow", "wand"]);
    expect([...kindsOn("mixed", 6)].sort()).toEqual(["life", "reverse", "slow", "wand"]);
    expect([...kindsOn("mixed", 7)].sort()).toEqual(["life", "points", "reverse", "slow", "wand"]);
    expect([...kindsOn("mixed", 9)].sort()).toEqual(["life", "points", "reverse", "slow", "wand"]);
    expect([...kindsOn("mixed", 10)].sort()).toEqual(["life", "pause", "points", "reverse", "slow", "wand"]); // the pause ball comes at level 10 of plus and minus
    expect([...kindsOn("times", 6)].sort()).toEqual(["life", "pause", "points", "reverse", "slow", "wand"]);
    expect([...kindsOn("times", 7)].sort()).toEqual(["bomb", "life", "pause", "points", "reverse", "slow", "wand"]); // and the bomb at level 7 of times
    expect([...kindsOn("times", 9)].sort()).toEqual(["bomb", "life", "pause", "points", "reverse", "slow", "wand"]);
    expect([...kindsOn("times", 10)].sort()).toEqual(["bomb", "cloth", "life", "pause", "points", "reverse", "slow", "wand"]); // the extra screen at level 10 of times
    expect([...kindsOn("divide", 6)].sort()).toEqual(["bomb", "cloth", "life", "pause", "points", "reverse", "slow", "wand"]);
    expect([...kindsOn("divide", 7)].sort()).toEqual(["bomb", "cloth", "life", "pause", "points", "reverse", "shield", "slow", "wand"]); // and the shield at level 7 of divide
    expect([...kindsOn("endless", 0)].sort()).toEqual(["life", "points", "slow"]); // (in the endless game: the pause ball from level 5 and the bomb from level 9)
  });

  it("a pause ball stops the numbers (and the new ones) for a few seconds, but taps still work", () => {
    const g = playing();
    g.spawnTimer = 0;
    const ball = drop(g, COLS[1], 200, 0);
    ball.bonus = "pause";
    const other = drop(g, COLS[2], 150, 3);
    expect(tapAt(g, ball.x, ball.y)).toBe(true);
    expect(g.pause).toBe(PAUSE_SECONDS);
    expect(g.events).toContainEqual({t: "bonus", kind: "pause", x: COLS[1], y: 200, amount: 0});
    const count = g.numbers.length;
    for (let i = 0; i < 60; i++) update(g, 1 / 60); // one second
    expect(other.y).toBe(150);
    expect(g.numbers).toHaveLength(count);
    // A tap while it is paused sends the number down into its cup as usual.
    expect(tapAt(g, other.x, other.y)).toBe(true);
    expect(other.state).toBe("dive");
    for (let i = 0; i < 200 && other.state === "dive" && !other.done; i++) update(g, 1 / 60);
    expect(g.cups[2].value).toBe(3);
    // When the pause is over, things move again.
    for (let i = 0; i < PAUSE_SECONDS * 60 + 5; i++) update(g, 1 / 60);
    expect(g.pause).toBe(0);
    const y = g.numbers.length > 0 ? g.numbers[0].y : 0;
    const id = g.numbers.length > 0 ? g.numbers[0].id : -1;
    for (let i = 0; i < 30; i++) update(g, 1 / 60);
    const same = g.numbers.find((n) => n.id === id);
    if (same) expect(same.y).toBeGreaterThan(y);
  });

  it("a bomb blows away the numbers close to it, but not the ones far away, the bonus balls or the numbers already on their way into a cup", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    const bomb = drop(g, COLS[1], 300, 0);
    bomb.bonus = "bomb";
    const near1 = drop(g, COLS[0], 315, 4); // 90 to the side
    const near2 = drop(g, COLS[2], 290, 5);
    const near3 = drop(g, COLS[3], 300, 6); // two columns away: 180, still inside
    const far = drop(g, COLS[0], 300 + BOMB_RADIUS + 20, 3); // too far down
    const high = drop(g, COLS[1], 300 - BOMB_RADIUS - 20, 2); // too far up
    const heart = drop(g, COLS[0], 220, 0);
    heart.bonus = "points";
    const diving = drop(g, COLS[2], 330, 1);
    diving.state = "dive";
    expect(tapAt(g, bomb.x, bomb.y)).toBe(true);
    expect(g.numbers.map((n) => n.id).sort()).toEqual([far.id, high.id, heart.id, diving.id].sort());
    expect([near1, near2, near3].some((n) => g.numbers.includes(n))).toBe(false);
    const blast = g.events.find((e) => e.t === "blast");
    expect(blast).toEqual({t: "blast", x: COLS[1], y: 300, hits: [{x: COLS[0], y: 315}, {x: COLS[2], y: 290}, {x: COLS[3], y: 300}]});
    expect(g.events).toContainEqual({t: "bonus", kind: "bomb", x: COLS[1], y: 300, amount: 3});
    // Nothing was added to any cup.
    expect(g.cups.every((c) => c.value === 0)).toBe(true);
  });

  it("a cloth ball gives one more pull-down screen, or points when there are already three", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    g.screens = 1;
    const ball = drop(g, COLS[1], 200, 0);
    ball.bonus = "cloth";
    expect(tapAt(g, ball.x, ball.y)).toBe(true);
    expect(g.screens).toBe(2);
    expect(g.events).toContainEqual({t: "screens", n: 2});
    expect(g.events).toContainEqual({t: "bonus", kind: "cloth", x: COLS[1], y: 200, amount: 0});
    g.screens = SCREEN_MAX;
    const score = g.score;
    const again = drop(g, COLS[1], 200, 0);
    again.bonus = "cloth";
    expect(tapAt(g, again.x, again.y)).toBe(true);
    expect(g.screens).toBe(SCREEN_MAX);
    expect(g.score).toBe(score + BONUS_POINTS * g.level);
    expect(g.events.filter((e) => e.t === "bonus").pop()).toMatchObject({kind: "points", amount: BONUS_POINTS * g.level});
  });

  it("a shield ball puts a shield on the living cup nearest to it, and gives points when every living cup has one", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    g.cups[0].dead = true;
    const ball = drop(g, COLS[0] + 5, 200, 0); // closest to the dead cup, so the nearest living one is the second
    ball.bonus = "shield";
    expect(tapAt(g, ball.x, ball.y)).toBe(true);
    expect(g.cups.map((c) => c.shield)).toEqual([false, true, false, false]);
    expect(g.events).toContainEqual({t: "shield", cupId: g.cups[1].id, x: g.cups[1].x, y: g.cups[1].y - CUP_H / 2, on: true});
    // The next one goes to the nearest cup that has none.
    const second = drop(g, COLS[1], 200, 0);
    second.bonus = "shield";
    expect(tapAt(g, second.x, second.y)).toBe(true);
    expect(g.cups.map((c) => c.shield)).toEqual([false, true, true, false]);
    g.cups[3].shield = true;
    const score = g.score;
    const last = drop(g, COLS[1], 200, 0);
    last.bonus = "shield";
    expect(tapAt(g, last.x, last.y)).toBe(true);
    expect(g.score).toBe(score + BONUS_POINTS * g.level);
  });

  it("a shield stops the number that would have killed the cup, once", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    g.cups[1].value = 8;
    g.cups[1].shield = true;
    const n = drop(g, COLS[1], 200, 5);
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[1].value).toBe(8); // not 13
    expect(g.cups[1].dead).toBe(false);
    expect(g.cups[1].shield).toBe(false);
    expect(g.events).toContainEqual({t: "shield", cupId: g.cups[1].id, x: COLS[1], y: g.cups[1].y - CUP_H / 2, on: false});
    expect(g.events.some((e) => e.t === "bust" || e.t === "land")).toBe(false);
    // The shield is used up: the next one kills the cup as usual.
    g.events.length = 0;
    const m = drop(g, COLS[1], 200, 5);
    expect(tapAt(g, m.x, m.y)).toBe(true);
    for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.cups[1].dead).toBe(true);
  });

  it("a shield does not get in the way of a number that is fine, and stays on after a perfect 10", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    g.cups[1].value = 5;
    g.cups[1].shield = true;
    const n = drop(g, COLS[1], 200, 5);
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(g.events.some((e) => e.t === "levelUp")).toBe(true);
    expect(g.cups[1].shield).toBe(true);
  });

  it("a bomb that nobody taps just falls past", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    const bomb = drop(g, COLS[1], 560, 0);
    bomb.bonus = "bomb";
    drop(g, COLS[0], 20, 4); // (a number far above it: nothing happens to it)
    for (let i = 0; i < 1500 && g.numbers.includes(bomb); i++) update(g, 1 / 60);
    expect(g.numbers.includes(bomb)).toBe(false);
    expect(g.events.some((e) => e.t === "blast")).toBe(false);
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

  it("the magic wand makes every number a 0 or a 10 for a while, the new ones too", () => {
    const g = playing();
    g.spawnTimer = 1e9;
    g.hideIntros = new Set(FEATURES);
    startGame(g, "mixed", 7);
    g.spawnTimer = 1e9;
    const a = drop(g, COLS[0], 150, 7);
    const b = drop(g, COLS[1], 150, -6);
    const c = drop(g, COLS[2], 150, 3);
    c.op = "mul";
    const d = drop(g, COLS[3], 150, 0);
    d.op = "zero";
    const ball = drop(g, COLS[1], 60, 0);
    ball.bonus = "wand";
    expect(tapAt(g, ball.x, ball.y)).toBe(true);
    expect(g.wand).toBeCloseTo(SLOW_SECONDS, 5);
    for (const n of [a, b, c, d]) expect([`zero:0`, `ten:10`]).toContain(`${n.op}:${n.v}`);
    // A number that comes while the wand is at work is turned as well.
    const late = drop(g, COLS[0], 100, 5);
    update(g, 1 / 60);
    expect([0, 10]).toContain(late.v);
    for (let i = 0; i < (SLOW_SECONDS + 1) * 60; i++) update(g, 1 / 60);
    expect(g.wand).toBe(0);
    const after = drop(g, COLS[0], 100, 5);
    update(g, 1 / 60);
    expect(after.v).toBe(5);
  });

  it("the reverse makes a tapped number fly up and away for a while, instead of into a cup", () => {
    const g = playing();
    g.hideIntros = new Set(FEATURES);
    startGame(g, "mixed", 7);
    g.spawnTimer = 1e9;
    const ball = drop(g, COLS[1], 60, 0);
    ball.bonus = "reverse";
    expect(tapAt(g, ball.x, ball.y)).toBe(true);
    expect(g.reverse).toBeCloseTo(SLOW_SECONDS, 5);
    const n = drop(g, COLS[2], 200, 9);
    const value = g.cups[2].value;
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(n.state).toBe("rise");
    for (let i = 0; i < 180 && g.numbers.includes(n); i++) update(g, 1 / 60);
    expect(g.numbers.includes(n)).toBe(false);
    expect(g.cups[2].value).toBe(value); // (it never landed)
    expect(g.phase).toBe("play");
    for (let i = 0; i < (SLOW_SECONDS + 1) * 60; i++) update(g, 1 / 60);
    expect(g.reverse).toBe(0);
    const later = drop(g, COLS[2], 200, 1);
    expect(tapAt(g, later.x, later.y)).toBe(true);
    expect(later.state).toBe("dive");
  });

  it("an eraser makes every tapped number pop for a while (steel and ice too), and is used up", () => {
    const g = playing();
    g.erasers = 2;
    expect(useEraser(g)).toBe(true);
    expect(g.erasers).toBe(1);
    expect(useEraser(g)).toBe(false); // (one is already in use)
    const n = drop(g, COLS[2], 200, 9);
    n.op = "steel";
    const value = g.cups[2].value;
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(g.numbers.includes(n)).toBe(false);
    expect(g.events.some((e) => e.t === "pop")).toBe(true);
    expect(g.cups[2].value).toBe(value);
    for (let i = 0; i < (SLOW_SECONDS + 1) * 60; i++) update(g, 1 / 60);
    expect(g.erase).toBe(0);
    const later = drop(g, COLS[2], 200, 1);
    expect(tapAt(g, later.x, later.y)).toBe(true);
    expect(later.state).toBe("dive");
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

  it("only makes orange 10s from level 12 of plus on", () => {
    expect(manySpawned("plus", 11).some((n) => n.op === "ten")).toBe(false);
    expect(manySpawned("plus", 12).some((n) => n.op === "ten")).toBe(true);
    expect(manySpawned("space", 6).some((n) => n.op === "ten")).toBe(true);
  });

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

  it("takes two taps to crack the ice away, and a third one sends the bare number down", () => {
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
    expect(n.state).toBe("fall"); // the ice is gone, but the number has not been sent down yet
    expect(n.ice).toBe(0);
    expect(g.events).toEqual([{t: "ice", x: n.x, y: 200, broke: true}]);
    g.events.length = 0;
    expect(tapAt(g, n.x, n.y)).toBe(true);
    expect(n.state).toBe("dive");
    expect(g.events.map((e) => e.t)).toEqual(["tap"]);
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
      ["plus", 12, "ten"],
      ["plus", 7, "life"],
      ["plus", 10, "slow"],
      ["mixed", 4, "chain"],
      ["mixed", 7, "points"],
      ["mixed", 10, "pause"],
      ["times", 7, "bomb"],
      ["times", 10, "cloth"],
      ["divide", 7, "shield"],
      ["times", 4, "ice"],
      ["divide", 4, "ghost"],
      ["space", 12, "fog"],
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

  /** Seconds into a level until what it brings in has fallen (no other numbers are made, so it can only be that), or -1 if it never does. */
  function secondsUntilShown(mode: Mode, stage: number, feature: string, rng: () => number): number {
    const g = testGame(rng);
    g.hideIntros = new Set(FEATURES);
    startGame(g, mode, stage);
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    const isIt = (n: NumberTile): boolean =>
      feature === "zero" || feature === "ten" || feature === "steel" ? n.op === feature
        : feature === "fog" ? n.op === "dim"
        : feature === "ice" ? n.ice > 0
        : feature === "ghost" ? n.ghost !== null
        : feature === "chain" ? n.chain !== null
        : feature === "chain3" ? n.chain2 !== null
        : n.bonus === feature;
    for (let i = 0; i < 8 * 60; i++) {
      update(g, 1 / 60);
      if (g.numbers.some(isIt)) return g.time;
    }
    return -1;
  }

  it("makes what a level brings in fall 3 to 5 seconds into it, even without any luck", () => {
    const cases: [Mode, number, string][] = [
      ["plus", 4, "zero"],
      ["plus", 7, "life"],
      ["plus", 10, "slow"],
      ["plus", 12, "ten"],
      ["mixed", 4, "chain"],
      ["mixed", 7, "points"],
      ["mixed", 10, "pause"],
      ["times", 4, "ice"],
      ["times", 7, "bomb"],
      ["times", 10, "cloth"],
      ["divide", 4, "ghost"],
      ["divide", 7, "shield"],
      ["space", 1, "star"],
      ["space", 12, "fog"],
      ["space", 7, "steel"],
      ["space", 10, "chain3"],
    ];
    for (const [mode, stage, feature] of cases) {
      const early = secondsUntilShown(mode, stage, feature, () => 0);
      const late = secondsUntilShown(mode, stage, feature, () => 0.999);
      expect(early, `${mode} ${stage} ${feature}`).toBeGreaterThanOrEqual(3);
      expect(early, `${mode} ${stage} ${feature}`).toBeLessThan(3.1);
      expect(late, `${mode} ${stage} ${feature}`).toBeGreaterThan(4.9);
      expect(late, `${mode} ${stage} ${feature}`).toBeLessThan(5.1);
    }
  });

  it("does that when the presentation is hidden too, and when the level is played again", () => {
    const g = start("plus", 4);
    expect(g.phase).toBe("intro");
    expect(g.showcase).toEqual(["zero"]); // (the presentation is shown first; the wait starts when the round does)
    endIntro(g);
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    for (let i = 0; i < 6 * 60; i++) update(g, 1 / 60);
    expect(g.showcase).toEqual([]);
    const again = secondsUntilShown("plus", 4, "zero", () => 0.5);
    expect(again).toBeGreaterThan(3);
    // Levels that bring nothing in (and the tutorial) do not make anything special fall.
    for (const [mode, stage] of [["plus", 1], ["plus", 5], ["mixed", 12], ["tutorial", 0]] as const) {
      const h = testGame(() => 0.5);
      h.hideIntros = new Set(FEATURES);
      startGame(h, mode, stage);
      expect(h.showcase, `${mode} ${stage}`).toEqual([]);
    }
  });

  it("does it in the endless game too, a few seconds into the level that brings something in", () => {
    const g = playing();
    startGame(g, "endless");
    g.hideIntros = new Set(FEATURES);
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    expect(g.showcase).toEqual([]);
    g.level = 5;
    g.cups[1].value = 5;
    const n = drop(g, COLS[1], 200, 5);
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
    expect(endlessLevel(g)).toBe(2); // level 2 brings the orange 0
    expect(g.showcase).toEqual(["zero"]);
    for (let i = 0; i < 6 * 60 && !g.numbers.some((x) => x.op === "zero"); i++) update(g, 1 / 60);
    expect(g.numbers.some((x) => x.op === "zero")).toBe(true);
    expect(g.showcase).toEqual([]);
  });

  it("an orange 10 sets the cup it lands in to exactly 10: a perfect 10", () => {
    for (const [before, cup] of [[3, 1], [-4, 2], [0, 0]] as const) {
      const g = playing();
      g.spawnTimer = 1e9;
      g.cups[cup].value = before;
      const n = drop(g, COLS[cup], 200, 10);
      n.op = "ten";
      expect(tapAt(g, n.x, n.y)).toBe(true);
      for (let i = 0; i < 200 && g.numbers.length > 0; i++) update(g, 1 / 60);
      expect(g.events.some((e) => e.t === "levelUp" && e.cupId === g.cups[cup].id), `from ${before}`).toBe(true);
      expect(g.cups[cup].value).toBe(0); // (a perfect 10: the cup starts over)
      expect(g.cups[cup].tenSign).toBe(1);
      expect(g.cups[cup].dead).toBe(false);
    }
  });

  it("does not come on any other level, in the tutorial or in the endless game", () => {
    const presenting = new Set(["plus:2", "mixed:1", "plus:4", "plus:7", "plus:10", "mixed:4", "mixed:7", "plus:12", "mixed:10", "times:7", "times:10", "divide:7", "times:4", "divide:4", "space:1", "space:7", "space:10", "space:12", "divide:10", "plus:3", "times:1", "mixed:3", "minus:7", "minus:10", "mixed:5", "divide:1"]);
    for (const mode of ["plus", "minus", "mixed", "times", "divide", "space"] as const) {
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
    expect([1, 6, 7, 11, 12].map((s) => goalFor("space", s))).toEqual([6, 7, 8, 9, 8]);
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

  it("presents the star on level 1, steel on level 7, the triple chain on level 10, the black number on level 12 and nothing else", () => {
    const first: Record<number, string> = {1: "star", 7: "steel", 10: "chain3", 12: "fog"};
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

  it("only comes on the last level of the last chapter", () => {
    for (const [mode, stage] of [["plus", 12], ["mixed", 12], ["times", 12], ["divide", 12], ["space", 4], ["space", 11]] as const) {
      expect(dark(made(mode, stage)), `${mode} ${stage}`).toHaveLength(0);
    }
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

describe("three cups in the first two chapters, four in the rest", () => {
  const start = (mode: Mode): GameState => {
    const g = testGame(() => 0.5);
    startGame(g, mode, 1);
    return g;
  };

  it("has two cups on the first two levels, and presents the third cup on level 3", () => {
    for (const stage of [1, 2]) {
      const g = testGame(() => 0.5);
      startGame(g, "plus", stage);
      expect(g.cols, `plus ${stage}`).toEqual([135, 225]);
      expect(g.cups.map((c) => c.x)).toEqual([135, 225]);
    }
    const g = createGame(() => 0.5);
    startGame(g, "plus", 3);
    expect(g.phase).toBe("intro");
    expect(g.intro).toContain("cup3");
    expect(g.cups).toHaveLength(3);
  });

  it("has three cups in three columns, in the middle of the screen, from level 3 of the plus chapter", () => {
    for (const stage of [3, 6, 12]) {
      const g = testGame(() => 0.5);
      startGame(g, "plus", stage);
      expect(g.cols, `plus ${stage}`).toEqual([90, 180, 270]);
      expect(g.cups.map((c) => c.x)).toEqual([90, 180, 270]);
    }
  });

  it("has three cups in the minus chapter", () => {
    for (const stage of [1, 6, 12]) {
      const g = testGame(() => 0.5);
      startGame(g, "minus", stage);
      expect(g.cols, `minus ${stage}`).toEqual([90, 180, 270]);
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
    startGame(g, "plus", 3);
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
    const g = testGame(() => 0.5);
    startGame(g, "plus", 3);
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
    expect(starsFor("plus", 1, 819)).toBe(1); // 4 cups: par is 820, and three stars start at 1148
    expect(starsFor("plus", 1, 900)).toBe(2);
    expect(starsFor("plus", 1, 1147)).toBe(2);
    expect(starsFor("plus", 1, 1149)).toBe(3);
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

describe("a tall phone (the playfield reaches higher than the top of the 640)", () => {
  it("lets the numbers start from above the top of the screen, so they take longer to fall", () => {
    const short = playing();
    short.spawnTimer = 0;
    update(short, 0.001);
    const tall = playing();
    tall.extra = 100;
    tall.spawnTimer = 0;
    update(tall, 0.001);
    expect(short.numbers).toHaveLength(1);
    expect(tall.numbers).toHaveLength(1);
    expect(short.numbers[0].y).toBeCloseTo(-26, 0);
    expect(tall.numbers[0].y).toBeCloseTo(-126, 0);
  });

  it("can tap a number as soon as it comes into view, high up on a tall screen but not above it", () => {
    const g = playing();
    g.extra = 100;
    const high = drop(g, g.cols[1], -60, 3); // (inside the screen, which starts at -100)
    expect(tapAt(g, high.x, high.y)).toBe(true);
    const above = drop(g, g.cols[2], -140, 3); // (above the top of the screen)
    expect(tapAt(g, above.x, above.y)).toBe(false);
    const s = playing(); // (on a short screen the same height is above the top)
    const out = drop(s, s.cols[1], -60, 3);
    expect(tapAt(s, out.x, out.y)).toBe(false);
  });

  it("has the pull-down screen come all the way down from the top of the screen", () => {
    const g = playing();
    g.extra = 100;
    g.screens = 1;
    useScreen(g);
    expect(sweepBottom(g)).toBeCloseTo(-100, 5); // (just starting: at the top of the screen)
    g.sweep = SWEEP_DOWN + 0.01;
    expect(sweepBottom(g)).toBeCloseTo(SWEEP_EDGE, 5); // (all the way down: as far as on a short screen)
    const high = drop(g, g.cols[1], -80, 4);
    g.sweep = 0.2;
    update(g, 1 / 60);
    expect(g.numbers.includes(high)).toBe(false); // (a number up in the extra part is wiped away too)
  });
});

describe("the cups of the shop", () => {
  /** A round with these cups chosen (the first one stands furthest to the left). */
  function withCups(...kinds: ("gold" | "thermos" | "magnet" | "big" | "laser")[]): GameState {
    return withCupKinds(...kinds.map((k) => [k]));
  }
  /** The same, with the properties of every cup given as a list (so that they can be combined). */
  function withCupKinds(...lists: ("gold" | "thermos" | "magnet" | "big" | "laser")[][]): GameState {
    const g = testGame(() => 0.5);
    g.loadout = lists;
    startGame(g, "mixed", 1);
    g.spawnTimer = 1e9;
    return g;
  }

  it("stand in the columns from the left, and the rest are ordinary; the tutorial has only ordinary cups", () => {
    const g = withCups("magnet", "gold");
    expect(g.cups.map((c) => c.kinds)).toEqual([["magnet"], ["gold"], [], []]);
    startGame(g, "tutorial");
    expect(g.cups.every((c) => c.kinds.length === 0)).toBe(true);
    const g2 = testGame(() => 0.5);
    startGame(g2, "plus", 1);
    expect(g2.cups.every((c) => c.kinds.length === 0)).toBe(true);
  });

  it("gold: every point that lands in it, and its perfect 10, count double", () => {
    const plain = withCups();
    const gold = withCups("gold");
    for (const g of [plain, gold]) {
      tapAndSettle(g, drop(g, g.cols[0], 400, 4));
      tapAndSettle(g, drop(g, g.cols[0], 400, 6));
    }
    expect(plain.level).toBe(2);
    expect(gold.level).toBe(2);
    expect(gold.score).toBe(plain.score * 2);
  });

  it("thermos: starts with a shield that stops the first number that would have killed it", () => {
    const g = withCups("thermos");
    expect(g.cups[0].shield).toBe(true);
    g.cups[0].value = 8;
    tapAndSettle(g, drop(g, g.cols[0], 400, 5));
    expect(g.cups[0].dead).toBe(false);
    expect(g.cups[0].value).toBe(8);
    expect(g.cups[0].shield).toBe(false);
    tapAndSettle(g, drop(g, g.cols[0], 400, 5)); // (the shield is used up)
    expect(g.cups[0].dead).toBe(true);
  });

  it("big: 10, 11 and 12 are all a perfect 10 and what is over stays in the cup; over 12 it dies", () => {
    const g = withCups("big");
    startGame(g, "endless"); // (a level of the book would be cleared after a few cups)
    g.spawnTimer = 1e9;
    g.cups[0].value = 8;
    tapAndSettle(g, drop(g, g.cols[0], 400, 4)); // 12
    expect(g.cups[0].dead).toBe(false);
    expect(g.level).toBe(2); // (a perfect 10)
    expect(g.cups[0].value).toBe(2); // (and it starts over at 2)
    g.cups[0].value = 9;
    tapAndSettle(g, drop(g, g.cols[0], 400, 2)); // 11
    expect(g.level).toBe(3);
    expect(g.cups[0].value).toBe(1);
    g.cups[0].value = 8;
    tapAndSettle(g, drop(g, g.cols[0], 400, 2)); // 10: just as for any cup
    expect(g.level).toBe(4);
    expect(g.cups[0].value).toBe(0);
    g.cups[0].value = 9;
    tapAndSettle(g, drop(g, g.cols[0], 400, 4)); // 13: too much even for this cup
    expect(g.cups[0].dead).toBe(true);
    expect(g.level).toBe(4);
  });

  it("big: the same with minus numbers (-12 is a perfect 10 and starts over at -2)", () => {
    const g = withCups("big");
    startGame(g, "endless");
    g.spawnTimer = 1e9;
    g.cups[0].value = -9;
    tapAndSettle(g, drop(g, g.cols[0], 400, -3));
    expect(g.level).toBe(2);
    expect(g.cups[0].value).toBe(-2);
  });

  it("magnet: takes a number that would have killed the cup under it, but not one that is fine for that cup", () => {
    const g = withCups();
    g.cups[0].value = 8;
    g.cups[1].kinds = ["magnet"];
    // A 5 over the first cup would kill it: the magnet next to it takes it.
    const five = drop(g, g.cols[0], 400, 5);
    tapAndSettle(g, five);
    expect(g.cups[0].dead).toBe(false);
    expect(g.cups[0].value).toBe(8);
    expect(g.cups[1].value).toBe(5);
    // A 2 over the first cup makes exactly 10: it goes there, as always.
    tapAndSettle(g, drop(g, g.cols[0], 400, 2));
    expect(g.level).toBe(2);
    expect(g.cups[1].value).toBe(5);
  });

  it("magnet: does not take it from further away than two columns, or when it would die of it too", () => {
    const g = withCups();
    g.cups[0].value = 8;
    g.cups[3].kinds = ["magnet"]; // (three columns away)
    tapAndSettle(g, drop(g, g.cols[0], 400, 5));
    expect(g.cups[0].dead).toBe(true);
    const h = withCups();
    h.cups[0].value = 8;
    h.cups[1].kinds = ["magnet"];
    h.cups[1].value = 7; // (a 5 would kill it too)
    tapAndSettle(h, drop(h, h.cols[0], 400, 5));
    expect(h.cups[0].dead).toBe(true);
    expect(h.cups[1].dead).toBe(false);
  });

  it("can be combined: one cup can have several properties, and the same property can be on several cups", () => {
    const g = withCupKinds(["gold", "thermos", "big"], ["gold"], ["gold", "magnet"]);
    expect(g.cups.map((c) => c.kinds)).toEqual([["gold", "thermos", "big"], ["gold"], ["gold", "magnet"], []]);
    expect(g.cups[0].shield).toBe(true); // (the thermos)
    expect(g.cups[1].shield).toBe(false);
    // The first cup: thermos stops the first deadly number, big lets 12 be a perfect 10, gold doubles its points.
    g.cups[0].value = 9;
    tapAndSettle(g, drop(g, g.cols[0], 400, 5)); // (14: over what even a big cup takes, so the shield stops it)
    expect(g.cups[0].dead).toBe(false);
    expect(g.cups[0].value).toBe(9);
    const before = g.score;
    tapAndSettle(g, drop(g, g.cols[0], 400, 3)); // 12: a perfect 10 for a big cup
    expect(g.level).toBe(2);
    expect(g.cups[0].value).toBe(2);
    const plain = withCups();
    plain.cups[0].value = 9;
    tapAndSettle(plain, drop(plain, plain.cols[0], 400, 1));
    const gold = withCupKinds(["gold"]);
    gold.cups[0].value = 9;
    tapAndSettle(gold, drop(gold, gold.cols[0], 400, 1));
    expect(gold.score).toBe(plain.score * 2);
    expect(g.score - before).toBeGreaterThan(0);
  });

  it("can have all five properties on all four cups at once", () => {
    const all: ("gold" | "thermos" | "magnet" | "big" | "laser")[] = ["gold", "thermos", "magnet", "big", "laser"];
    const g = withCupKinds(all, all, all, all);
    for (const c of g.cups) {
      expect(c.kinds).toEqual(all);
      expect(c.shield).toBe(true); // (the thermos of each)
    }
    g.cups[1].value = 9;
    tapAndSettle(g, drop(g, g.cols[1], 400, 3)); // 12: a perfect 10 for a big cup
    expect(g.level).toBe(2);
    expect(g.cups[1].value).toBe(2);
    expect(fireLaser(g, g.cups[3])).toBe(true);
  });

  it("laser: only melts the ice of a number frozen in ice, and the number stays", () => {
    const g = withCups("laser");
    const frozen = drop(g, g.cols[0], 200, 6);
    frozen.ice = 2;
    const plain = drop(g, g.cols[0], 120, 3);
    expect(fireLaser(g, g.cups[0])).toBe(true);
    expect(g.numbers.includes(frozen)).toBe(true); // (the number is still there)
    expect(frozen.ice).toBe(0); // (without its ice, so that it can be tapped at once)
    expect(g.numbers.includes(plain)).toBe(false); // (an ordinary number goes)
    expect(g.events.some((e) => e.t === "ice" && e.broke)).toBe(true);
    expect(g.events.some((e) => e.t === "laser" && e.hits.length === 1)).toBe(true);
    expect(tapAt(g, frozen.x, frozen.y)).toBe(true);
    expect(frozen.state).toBe("dive"); // (one tap sends it down now)
  });

  it("laser: clears the numbers in its column (not the balls or the other columns), and has to charge before the next time", () => {
    const g = withCups("laser");
    const a = drop(g, g.cols[0], 100, 3);
    const b = drop(g, g.cols[0] + 30, 250, 4);
    const other = drop(g, g.cols[1], 200, 5);
    const ball = drop(g, g.cols[0], 150, 0);
    ball.bonus = "points";
    expect(fireLaser(g, g.cups[0])).toBe(true);
    expect(g.numbers.includes(a)).toBe(false);
    expect(g.numbers.includes(b)).toBe(false);
    expect(g.numbers.includes(other)).toBe(true);
    expect(g.numbers.includes(ball)).toBe(true);
    expect(g.events.some((e) => e.t === "laser" && e.hits.length === 2)).toBe(true);
    expect(fireLaser(g, g.cups[0])).toBe(false); // (still charging)
    for (let i = 0; i < 60 * (LASER_COOLDOWN + 0.5); i++) update(g, 1 / 60);
    expect(g.cups[0].charge).toBe(0);
    expect(fireLaser(g, g.cups[0])).toBe(true);
    expect(fireLaser(g, g.cups[1])).toBe(false); // (not a laser cup)
  });
});

describe("the daily challenge", () => {
  /** Fills one cup to 10 (the way a perfect 10 is made in the tests). */
  function perfect(g: GameState): void {
    g.numbers = []; // (nothing else is in the air, and no new kind is to be shown)
    g.showcase = [];
    g.countdown = 0; // (no count down of a match mode on the rung)
    const cup = g.cups.find((c) => !c.dead)!;
    cup.value = 9;
    // (under where the shield of a Shield up rung can be; what the match mode of a rung brings in by itself is cleared away)
    const n = drop(g, cup.x, 480, 1);
    const before = g.level;
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 200 && g.level === before; i++) update(g, 1 / 60);
    expect(g.level).toBe(before + 1);
    g.numbers = [];
  }
  function daily(): GameState {
    const g = testGame(() => 0.5);
    startDaily(g, "2026-01-28");
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    return g;
  }

  it("gives everyone the same numbers on the same day, and other numbers on another day", () => {
    const first = (day: string) => {
      const g = testGame();
      startDaily(g, day);
      const seen: number[] = [];
      for (let i = 0; i < 400; i++) {
        update(g, 1 / 30);
        for (const n of g.numbers) if (!seen.includes(n.id)) seen.push(n.id);
      }
      return g.numbers.map((n) => `${n.col}:${n.v}:${n.op}`).join(",") + "|" + seen.length;
    };
    expect(first("2026-11-14")).toBe(first("2026-11-14"));
    expect(first("2026-11-14")).not.toBe(first("2026-11-15"));
    expect(seedOfDay("2026-11-14")).not.toBe(seedOfDay("2026-11-15"));
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(dayKey(new Date(2026, 10, 4))).toBe("2026-11-04");
  });

  it("is the endless game, but the record is not touched", () => {
    const g = daily();
    expect(g.mode).toBe("endless");
    expect(g.daily).toBe(true);
    g.score = 99999;
    expect(recordBest(g)).toBe(false);
    startGame(g, "endless");
    expect(g.daily).toBe(false); // (an ordinary endless round after it is an ordinary one)
  });

  it("offers three perks after every five cups, and the round waits until one is chosen", () => {
    const g = daily();
    for (let i = 0; i < 4; i++) perfect(g);
    expect(g.phase).toBe("play");
    perfect(g);
    expect(g.phase).toBe("perk");
    expect(g.perkChoices).toHaveLength(3);
    expect(new Set(g.perkChoices).size).toBe(3);
    const t0 = g.numbers.length;
    const y = drop(g, g.cols[0], 100, 3).y;
    update(g, 1);
    expect(g.numbers[t0].y).toBe(y); // (nothing falls while the perks are shown)
    expect(tapAt(g, g.cols[0], y)).toBe(false);
    expect(choosePerk(g, 5)).toBe(false);
    const times = g.perkTimes[0];
    expect(times).toBeGreaterThanOrEqual(1);
    expect(choosePerk(g, 0)).toBe(true);
    expect(g.phase).toBe("play");
    expect(g.perks).toHaveLength(times); // (a perk that is offered as x2 is taken twice)
  });

  it("has a slower perk that slows the numbers, and cup perks that give a cup its property", () => {
    const g = daily();
    const before = speedFactorOf(g);
    g.phase = "perk";
    g.perkChoices = ["slow", "laser", "thermos"];
    choosePerk(g, 0);
    expect(speedFactorOf(g)).toBeLessThan(before);
    g.phase = "perk";
    g.perkChoices = ["laser", "thermos", "gold"];
    g.cups[1].value = 6; // (the fullest cup gets it)
    choosePerk(g, 0);
    expect(g.cups[1].kinds).toEqual(["laser"]);
    g.phase = "perk";
    g.perkChoices = ["thermos", "gold", "big"];
    choosePerk(g, 0);
    expect(g.cups.filter((c) => c.kinds.includes("thermos") && c.shield)).toHaveLength(1);
    expect(g.cups[1].kinds).toEqual(["laser", "thermos"]); // (it went on the cup that was fullest, on top of what it had)
  });

  it("needs two more cups on every rung: 5, then 7, then 9 and so on", () => {
    expect([1, 2, 3, 4, 5, 6].map(rungGoal)).toEqual([5, 7, 9, 11, 13, 15]);
    expect([1, 2, 3].map(cupsToClimb)).toEqual([5, 12, 21]);
    expect([0, 4, 5, 11, 12, 20, 21].map(rungsDone)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect([4, 5, 11, 12, 20, 21].map(rungEnds)).toEqual([false, true, false, true, false, true]);
    expect(rungOfCup(0)).toEqual({rung: 1, goal: 5, into: 0});
    expect(rungOfCup(5)).toEqual({rung: 1, goal: 5, into: 5}); // (the cup that finishes a rung shows a full bar)
    expect(rungOfCup(6)).toEqual({rung: 2, goal: 7, into: 1});
    expect(rungOfCup(12)).toEqual({rung: 2, goal: 7, into: 7});
    const g = daily();
    for (let i = 0; i < 5; i++) perfect(g);
    expect(g.phase).toBe("perk");
    choosePerk(g, 0);
    for (let i = 0; i < 6; i++) perfect(g);
    expect(g.phase).toBe("play"); // (six more cups are not enough for the second rung)
    perfect(g);
    expect(g.phase).toBe("perk"); // (the seventh is)
    expect(endlessLevel(g)).toBe(3); // (and the third rung is the level now)
  });

  it("is won on the last rung of the ladder", () => {
    const g = daily();
    for (let rung = 1; rung <= DAILY_RUNGS; rung++) {
      for (let i = 0; i < rungGoal(rung); i++) perfect(g);
      if (rung < DAILY_RUNGS) {
        expect(g.phase).toBe("perk");
        choosePerk(g, 0);
      }
    }
    expect(g.phase).toBe("won");
    expect(g.events.some((e) => e.t === "won")).toBe(true);
  });

  it("pays for the rungs that were climbed, and a bonus for the top", () => {
    expect(dailyReward(0, false)).toBe(0);
    expect(dailyReward(2, false)).toBe(DAILY_REWARD[0] + DAILY_REWARD[1]);
    expect(dailyReward(DAILY_RUNGS, true)).toBe(DAILY_REWARD.reduce((a, b) => a + b, 0) + DAILY_BONUS);
    expect(dailyReward(99, false)).toBe(DAILY_REWARD.reduce((a, b) => a + b, 0));
  });
});

describe("the diamond", () => {
  /** A round in the last chapter, where the diamond has come in, with some numbers in the air. */
  function withDiamond(): {g: GameState; diamond: NumberTile; others: NumberTile[]} {
    const g = testGame(() => 0.5);
    startGame(g, "space", 12);
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    g.showcase = [];
    const others = [drop(g, g.cols[0], 150, 3), drop(g, g.cols[1], 220, 5), drop(g, g.cols[2], 120, 7), drop(g, g.cols[3], 260, 2)];
    const diamond = drop(g, g.cols[1], 80, 0);
    diamond.bonus = "diamond";
    return {g, diamond, others};
  }

  it("is presented on level 10 of the divide chapter, and comes from there on", () => {
    const g = createGame(() => 0.5);
    startGame(g, "divide", 10);
    expect(g.phase).toBe("intro");
    expect(g.intro).toContain("diamond");
    const h = testGame(() => 0.5);
    startGame(h, "divide", 9);
    expect(featureAge(h, "diamond")).toBe(-1);
    startGame(h, "space", 1);
    expect(featureAge(h, "diamond")).toBeGreaterThan(0);
  });

  it("stops everything when it is tapped, and the taps wait", () => {
    const {g, diamond, others} = withDiamond();
    expect(tapAt(g, diamond.x, diamond.y)).toBe(true);
    expect(g.zap).not.toBeNull();
    expect(g.numbers.includes(diamond)).toBe(false); // (it hangs on its own while it works)
    const ys = others.map((n) => n.y);
    update(g, 0.2);
    expect(others.map((n) => n.y)).toEqual(ys);
    expect(tapAt(g, others[0].x, others[0].y)).toBe(false);
  });

  it("changes every number in the air to an orange 10 (one in five) or an orange 0, and then everything falls again", () => {
    const {g, diamond, others} = withDiamond();
    const ball = drop(g, g.cols[3], 40, 0);
    ball.bonus = "points";
    others[0].ice = 2;
    others[1].chain = others[2].id;
    others[2].chain = others[1].id;
    // (random numbers that are a ten for every other number)
    let i = 0;
    g.rng = () => [0.1, 0.9][i++ % 2];
    tapAt(g, diamond.x, diamond.y);
    let guard = 0;
    while (g.zap && guard++ < 600) update(g, 1 / 60);
    expect(g.zap).toBeNull();
    const ops = others.map((n) => n.op).sort();
    expect(ops.filter((o) => o === "ten")).toHaveLength(2);
    expect(ops.filter((o) => o === "zero")).toHaveLength(2);
    for (const n of others) expect(n.op === "ten" ? n.v === 10 : n.v === 0).toBe(true);
    expect(others[0].ice).toBe(0);
    expect(others[1].chain).toBeNull();
    expect(others[2].chain).toBeNull();
    expect(ball.op).toBe("add"); // (a bonus ball is left as it was)
    expect(g.events.filter((e) => e.t === "zapHit")).toHaveLength(4);
    const y = others[3].y;
    update(g, 0.5);
    expect(others[3].y).toBeGreaterThan(y); // (they fall again)
    expect(g.numbers.includes(diamond)).toBe(false); // (and the diamond is gone)
  });

  it("makes an orange 0 that wipes out the cup it lands in", () => {
    const {g, diamond, others} = withDiamond();
    g.rng = () => 0.5;
    tapAt(g, diamond.x, diamond.y);
    while (g.zap) update(g, 1 / 60);
    g.cups[2].value = 7;
    const n = others[2];
    expect(n.op).toBe("zero");
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 200 && g.numbers.includes(n); i++) update(g, 1 / 60);
    expect(g.cups[2].value).toBe(0); // (orange 0: wipes the cup out)
  });
});

describe("the minus chapter", () => {
  /** The numbers that fall in a level, over many spawns (with the same random numbers every time). */
  function fallen(mode: Mode, stage: number, count = 400): NumberTile[] {
    let seed = 8081;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
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

  it("lets only minus numbers fall (the oranges 0 and 10 are the same everywhere)", () => {
    for (const stage of [1, 6, 12]) {
      const numbers = fallen("minus", stage).filter((n) => !n.bonus && (n.op === "add" || n.op === "steel" || n.op === "dim"));
      expect(numbers.length, `minus ${stage}`).toBeGreaterThan(0);
      expect(numbers.every((n) => n.v < 0), `minus ${stage}`).toBe(true);
    }
  });

  it("has plus numbers in the chapter before it and the one after it", () => {
    expect(fallen("plus", 6).some((n) => n.op === "add" && n.v > 0)).toBe(true);
    const mixed = fallen("mixed", 6).filter((n) => n.op === "add");
    expect(mixed.some((n) => n.v > 0)).toBe(true);
    expect(mixed.some((n) => n.v < 0)).toBe(true);
  });

  it("fills a cup with minus 10: a perfect 10", () => {
    const g = testGame(() => 0.5);
    startGame(g, "minus", 1);
    g.spawnTimer = 1e9;
    g.cups[1].value = -4;
    const n = drop(g, g.cols[1], 200, -6);
    tapAndSettle(g, n);
    expect(g.events.some((e) => e.t === "levelUp" && e.cupId === g.cups[1].id)).toBe(true);
  });

  it("needs as many cups as the plus chapter, and is the same kind of level (twelve of them)", () => {
    for (let stage = 1; stage <= STAGES; stage++) expect(goalFor("minus", stage)).toBe(goalFor("plus", stage));
    expect(goalFor("minus", STAGES)).toBe(8);
  });

  it("is where the book is after the plus chapter: the new things of plus are already there, and the ones of the next chapter are not", () => {
    const g = testGame(() => 0.5);
    startGame(g, "minus", 1);
    expect(featureAge(g, "zero")).toBeGreaterThanOrEqual(0);
    expect(featureAge(g, "cups")).toBe(-1); // (the fourth cup comes with plus and minus)
    startGame(g, "mixed", 1);
    expect(featureAge(g, "cups")).toBe(0);
  });
});

describe("a hanging chain", () => {
  function pairs(mode: Mode, stage: number, count = 600): NumberTile[][] {
    let seed = 4242;
    const g = testGame(() => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    });
    startGame(g, mode, stage);
    const found: NumberTile[][] = [];
    for (let i = 0; i < count; i++) {
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 0.01);
      if (g.numbers.length === 2 && g.numbers[0].x === g.numbers[1].x && g.numbers[0].chain !== null) found.push([...g.numbers]);
    }
    return found;
  }

  it("only comes from the first level of the times chapter", () => {
    expect(pairs("mixed", STAGES)).toHaveLength(0);
    expect(pairs("times", 1).length).toBeGreaterThan(0);
  });

  it("is two small numbers on a chain, one above the other, in one column", () => {
    const [[a, b]] = pairs("times", 1);
    expect(a.x).toBe(b.x);
    expect(a.chain).toBe(b.id);
    expect(b.chain).toBe(a.id);
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(40);
    expect(Math.abs(a.v)).toBeLessThanOrEqual(3);
    expect(Math.abs(b.v)).toBeLessThanOrEqual(3);
  });

  it("falls into the same cup, whichever of the two is tapped", () => {
    for (const tapLower of [true, false]) {
      const g = testGame(() => 0.5);
      startGame(g, "times", 1);
      g.spawnTimer = 1e9;
      const low = drop(g, g.cols[1], 200, 2);
      const high = drop(g, g.cols[1], 146, 3);
      low.chain = high.id;
      high.chain = low.id;
      const tapped = tapLower ? low : high;
      expect(tapAt(g, tapped.x, tapped.y), `lower ${tapLower}`).toBe(true);
      for (let i = 0; i < 60 * 6 && g.numbers.length > 0; i++) update(g, 1 / 60);
      expect(g.numbers, `lower ${tapLower}`).toHaveLength(0);
      expect(g.cups[1].value, `lower ${tapLower}`).toBe(5);
      expect(g.cups.every((c) => !c.dead)).toBe(true);
    }
  });
});

describe("the perk that takes a dead cup away", () => {
  it("is one of the perks of the daily challenge", () => {
    expect(PERKS).toContain("remove");
  });

  it("takes the dead cup away, so that there is one cup less", () => {
    const g = playing();
    g.cups[1].dead = true;
    g.phase = "perk";
    g.perkChoices = ["remove"];
    expect(choosePerk(g, 0)).toBe(true);
    expect(g.cups).toHaveLength(3);
    expect(g.cups.some((c) => c.dead)).toBe(false);
    expect(g.phase).toBe("play");
  });

  it("leaves the cups alone when none of them is dead", () => {
    const g = playing();
    g.phase = "perk";
    g.perkChoices = ["remove"];
    expect(choosePerk(g, 0)).toBe(true);
    expect(g.cups).toHaveLength(4);
  });
});

describe("days in a row on the ladder", () => {
  it("knows the day before a day, also over the end of a month and a year", () => {
    expect(previousDay("2026-11-15")).toBe("2026-11-14");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });

  it("starts on day 1, and goes on to the next day when yesterday was counted", () => {
    expect(streakDayFor(null, "2026-11-15")).toBe(1);
    let s = recordDay(null, "2026-11-15");
    expect(s).toEqual({last: "2026-11-15", count: 1, gift: false});
    expect(streakDayFor(s, "2026-11-15")).toBe(1); // (today is counted already)
    expect(recordDay(s, "2026-11-15")).toBe(s); // (and does not count twice)
    expect(streakDayFor(s, "2026-11-16")).toBe(2);
    s = recordDay(s, "2026-11-16");
    expect(s.count).toBe(2);
    expect(streakCount(s, "2026-11-16")).toBe(2);
    expect(streakCount(s, "2026-11-17")).toBe(2); // (yesterday was counted: today can still be counted)
  });

  it("starts over when a day is missed", () => {
    let s = recordDay(null, "2026-11-10");
    s = recordDay(s, "2026-11-11");
    s = recordDay(s, "2026-11-12");
    expect(s.count).toBe(3);
    expect(streakCount(s, "2026-11-14")).toBe(0); // (the 13th was missed)
    expect(streakDayFor(s, "2026-11-14")).toBe(1);
    expect(recordDay(s, "2026-11-14").count).toBe(1);
  });

  it("brings a package on the seventh day, which waits until it is opened and is not lost when the streak starts over", () => {
    let s = null as ReturnType<typeof recordDay> | null;
    for (let d = 1; d <= STREAK_DAYS; d++) {
      s = recordDay(s, "2026-11-" + String(d).padStart(2, "0"));
      expect(s.gift, "day " + d).toBe(d === STREAK_DAYS);
    }
    // The week starts over on the day after the seventh.
    expect(streakDayFor(s, "2026-11-08")).toBe(1);
    const next = recordDay(s, "2026-11-08");
    expect(next.count).toBe(1);
    expect(next.gift).toBe(true); // (the package is still waiting)
    // A day is missed, and the package is still there.
    expect(recordDay(next, "2026-11-20").gift).toBe(true);
  });

  it("pays a little more coins every day: 10 percent more a day, 60 percent on the seventh", () => {
    expect(streakFactor(1)).toBe(1);
    expect(streakFactor(2)).toBeCloseTo(1.1);
    expect(streakFactor(7)).toBeCloseTo(1.6);
    expect(streakFactor(99)).toBeCloseTo(1.6);
    expect(streakCoins(10, 1)).toBe(10);
    expect(streakCoins(10, 7)).toBe(16);
    expect(streakCoins(50, 3)).toBe(60);
  });

  it("gives something from a package: coins, cloths, energy or a cup", () => {
    const kinds = new Set<string>();
    let seed = 99;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 300; i++) {
      const p = rollPackage(rng);
      kinds.add(p.kind);
      if (p.kind === "coins") expect(p.n).toBeGreaterThanOrEqual(150);
      if (p.kind === "coins") expect(p.n).toBeLessThanOrEqual(400);
      if (p.kind === "cup") expect(["gold", "thermos", "magnet", "big", "laser"]).toContain(p.cup);
    }
    expect([...kinds].sort()).toEqual(["cloth", "coins", "cup", "energy"]);
  });
});

describe("progress that fades with time (plus & minus, level 3 and on, and the endless game)", () => {
  function fading(mode: Mode = "mixed", stage = 3): GameState {
    const g = testGame(() => 0.5);
    startGame(g, mode, stage);
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    g.showcase = [];
    return g;
  }

  /** Lets the game run for some seconds. */
  function run(g: GameState, seconds: number): void {
    for (let t = 0; t < seconds; t += 0.05) update(g, 0.05);
  }

  it("is a new kind of number from level 3 of plus & minus, and stays in the chapters after it", () => {
    for (const [mode, stage, age] of [["mixed", 2, -1], ["mixed", 3, 0], ["mixed", 4, 1], ["times", 1, 10], ["space", 12, 45]] as const) {
      const g = fading(mode, stage);
      expect(featureAge(g, "fade"), `${mode} ${stage}`).toBe(age);
    }
    expect(featureAge(fading("plus", 12), "fade")).toBe(-1);
    expect(featureAge(fading("minus", 12), "fade")).toBe(-1);
    expect(featureAge(fading("tutorial", 0), "fade")).toBe(-1);
  });

  it("takes 22 seconds on levels 1-3, 20 on 4-6, 18 on 7-9 and 16 on 10-12 (a whole perfect 10)", () => {
    const secs = (mode: Mode, stage: number) => fadeSeconds(fading(mode, stage));
    expect([secs("mixed", 3), secs("times", 1), secs("times", 3)]).toEqual([22, 22, 22]);
    expect([secs("mixed", 4), secs("divide", 6)]).toEqual([20, 20]);
    expect([secs("mixed", 7), secs("space", 9)]).toEqual([18, 18]);
    expect([secs("mixed", 10), secs("space", 12)]).toEqual([16, 16]);
  });

  it("fades the progress while no perfect 10 comes: a whole one in 22 seconds on level 3", () => {
    const g = fading();
    g.level = 3; // (two perfect 10s done)
    run(g, 11.2);
    expect(g.drain).toBe(10);
    expect(progressOf(g)).toBeCloseTo(1.5, 10);
    run(g, 11);
    expect(g.drain).toBe(20);
    expect(progressOf(g)).toBeCloseTo(1, 10);
  });

  it("goes faster on the higher levels", () => {
    const g = fading("mixed", 10);
    g.level = 3;
    run(g, 16.3);
    expect(g.drain).toBe(20);
  });

  it("is slowed down by slow motion, and stopped by the pause ball", () => {
    const g = fading();
    g.level = 3;
    g.pause = 100;
    run(g, 10);
    expect(g.drain).toBe(0);
    g.pause = 0;
    g.slow = 100;
    run(g, 11.2);
    expect(g.drain).toBeGreaterThan(0);
    expect(g.drain).toBeLessThan(10);
  });

  it("never goes below nothing done", () => {
    const g = fading();
    run(g, 60);
    expect(g.drain).toBe(0);
    g.level = 2;
    run(g, 80);
    expect(g.drain).toBe(20);
    expect(progressOf(g)).toBe(0);
  });

  it("is refilled by a new perfect 10: what had faded of the last cup is back, and a whole cup that is gone stays gone", () => {
    const g = fading();
    g.level = 3;
    g.drain = 7;
    g.drainClock = 0.9;
    g.cups[1].value = 6;
    tapAndSettle(g, drop(g, 135, 200, 4));
    expect(g.level).toBe(4);
    expect(g.drain).toBe(0);
    expect(g.drainClock).toBeLessThan(0.2); // (the time starts over)
    expect(progressOf(g)).toBe(3);
    const e = g.events.find((x) => x.t === "levelUp");
    expect(e && e.t === "levelUp" ? e.done : -1).toBe(3);
    // (one whole cup has faded away, and a part of the next: the part is refilled, the cup is still gone)
    const h = fading();
    h.level = 4;
    h.drain = 27;
    h.cups[1].value = 6;
    tapAndSettle(h, drop(h, 135, 200, 4));
    expect(h.drain).toBe(20);
    expect(progressOf(h)).toBe(3);
  });

  it("clears the level only when the progress that is left reaches the goal", () => {
    const goal = goalFor("mixed", 3);
    // (the last cup is made, but a whole one has faded away: not enough yet)
    const g = fading();
    g.level = goal; // goal - 1 perfect 10s done
    g.drain = 20;
    g.cups[1].value = 6;
    tapAndSettle(g, drop(g, 135, 200, 4));
    expect(g.level - 1).toBe(goal);
    expect(g.phase).toBe("play");
    // (with enough left it is cleared)
    const h = fading();
    h.level = goal + 1;
    h.drain = 20;
    h.cups[1].value = 6;
    tapAndSettle(h, drop(h, 135, 200, 4));
    expect(h.phase).toBe("won");
  });

  it("starts over with a new round", () => {
    const g = fading();
    g.level = 3;
    run(g, 5);
    expect(g.drain).toBeGreaterThan(0);
    startGame(g, "mixed", 3);
    expect(g.drain).toBe(0);
    expect(g.drainClock).toBe(0);
    showMenu(g);
    expect(g.drain).toBe(0);
  });

  describe("in the endless game", () => {
    it("starts on its third level, with 24 seconds, and goes faster the further it gets (two seconds every third level, at least 10)", () => {
      const g = fading("endless", 0);
      expect(fadeOn(g)).toBe(false);
      g.level = 12; // (level 3 of the endless game)
      expect(fadeOn(g)).toBe(true);
      const at = (level: number) => {
        g.level = endlessCupsBefore(level) + 1;
        return fadeSeconds(g);
      };
      expect([at(3), at(4), at(7), at(10), at(13), at(40)]).toEqual([24, 22, 20, 18, 16, 10]);
    });

    it("fades the cups of the bar it is on, never one that was filled before", () => {
      const g = fading("endless", 0);
      g.level = 12; // (eleven cups, the bar of level 3 is empty: nothing to lose)
      run(g, 30);
      expect(g.drain).toBe(0);
      g.level = 14; // (two cups on the bar)
      run(g, 24.5);
      expect(g.drain).toBe(20);
      run(g, 100);
      expect(g.drain).toBe(40);
      expect(progressOf(g)).toBe(11);
      expect(endlessLevel(g)).toBe(3);
    });

    it("needs the bar filled, what has faded counted off, for the next level", () => {
      const g = fading("endless", 0);
      g.level = 18; // (six of the seven cups on the bar of level 3)
      g.drain = 20; // (one of them has faded away)
      g.cups[1].value = 6;
      tapAndSettle(g, drop(g, 135, 200, 4));
      expect(g.level).toBe(19);
      expect(endlessLevel(g)).toBe(3);
      expect(g.banner).toBe(0);
      // (a cup with no fading: seven cups fill the bar)
      const h = fading("endless", 0);
      h.level = 18;
      h.drain = 0;
      h.cups[1].value = 6;
      tapAndSettle(h, drop(h, 135, 200, 4));
      expect(endlessLevel(h)).toBe(4);
      expect(h.banner).toBeGreaterThan(0);
    });

    it("is not in the daily challenge", () => {
      const g = testGame(() => 0.5);
      startDaily(g, "2026-01-28");
      g.spawnTimer = 1e9;
      g.bonusTimer = 1e9;
      g.level = 20;
      expect(fadeOn(g)).toBe(false);
      run(g, 30);
      expect(g.drain).toBe(0);
    });
  });
});

describe("the saucers of the shop", () => {
  function withSaucers(saucers: (SaucerKind | null)[], mode: Mode = "mixed", stage = 1): GameState {
    const g = testGame(() => 0.5);
    g.saucerLoadout = saucers;
    startGame(g, mode, stage);
    g.spawnTimer = 1e9;
    return g;
  }
  const none = (): GameState => withSaucers([]);

  it("go under the cups from the left, and count only the ones that have a cup (three cups in the first chapters)", () => {
    const g = withSaucers(["slow", "points", null, "slow"]);
    expect(g.cups.map((c) => c.saucer)).toEqual(["slow", "points", undefined, "slow"]);
    expect(saucerCount(g, "slow")).toBe(2);
    const h = withSaucers(["slow", "slow", "slow", "slow"], "plus", 3);
    expect(h.cups).toHaveLength(3);
    expect(saucerCount(h, "slow")).toBe(3);
    expect(saucerCount(withSaucers(["slow", "slow", "slow", "slow"], "plus", 1), "slow")).toBe(2);
    const tut = withSaucers(["slow", "slow", "slow", "slow"], "tutorial", 0);
    expect(saucerCount(tut, "slow")).toBe(0);
  });

  it("two, three or four of a kind give a small bonus: they work like two and a quarter, three and a half and five", () => {
    expect([0, 1, 2, 3, 4].map(saucerPower)).toEqual([0, 1, 2.25, 3.5, 5]);
  });

  it("slow: every one makes the numbers fall 5% slower, and two, three or four of them a bit more (four: 25%)", () => {
    const base = speedFactorOf(none());
    expect(speedFactorOf(withSaucers(["slow"]))).toBeCloseTo(base * 0.95, 10);
    expect(speedFactorOf(withSaucers(["slow", "slow"]))).toBeCloseTo(base * 0.8875, 10);
    expect(speedFactorOf(withSaucers(["slow", "slow", "slow"]))).toBeCloseTo(base * 0.825, 10);
    expect(speedFactorOf(withSaucers(["slow", "slow", "slow", "slow"]))).toBeCloseTo(base * 0.75, 10);
    const e = withSaucers(["slow", "slow"], "endless", 0);
    expect(speedFactorOf(e)).toBeCloseTo(0.8875, 10);
  });

  it("sparse: every one makes 10% fewer numbers come (the time between them is longer)", () => {
    const wait = (g: GameState): number => {
      g.spawnTimer = 0;
      update(g, 0.001);
      return g.spawnTimer;
    };
    const base = wait(none());
    expect(wait(withSaucers(["sparse"]))).toBeCloseTo(base / 0.9, 6);
    expect(wait(withSaucers(["sparse", "sparse"]))).toBeCloseTo(base / 0.775, 6);
    expect(wait(withSaucers(["sparse", "sparse", "sparse", "sparse"]))).toBeCloseTo(base / 0.5, 6);
  });

  it("special: every one brings 10% more bonus balls (they come sooner)", () => {
    const base = none().bonusTimer;
    expect(withSaucers(["special", "special"]).bonusTimer).toBeCloseTo(base / 1.225, 6);
    expect(withSaucers(["special", "special", "special", "special"]).bonusTimer).toBeCloseTo(base / 1.5, 6);
  });

  it("points: every one gives 50% more points", () => {
    const score = (saucers: (SaucerKind | null)[]): number => {
      const g = withSaucers(saucers);
      g.cups[1].value = 6;
      tapAndSettle(g, drop(g, 135, 200, 4));
      return g.score;
    };
    const base = score([]);
    expect(base).toBeGreaterThan(0);
    expect(score(["points", "points"])).toBeCloseTo(base * 2.125, -0.5); // (two of a kind work like two and a quarter)
    expect(score([null, "points"])).toBe(Math.round(base * 1.5));
  });
});

describe("the cups of the daily challenge: two, then three, then four", () => {
  function daily(loadout: string[][] = []): GameState {
    const g = testGame(() => 0.5);
    g.loadout = loadout as GameState["loadout"];
    startDaily(g, "2026-01-28");
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    return g;
  }

  /** Climbs a rung: the cups that are done are set so that the next perfect 10 is the one that ends it (5, then 11, then 18 cups), and a perk is chosen. */
  function climb(g: GameState, cupsAtEnd: number, pick = 0): void {
    g.level = cupsAtEnd;
    g.numbers = [];
    g.showcase = [];
    const cup = g.cups.find((c) => !c.dead)!;
    cup.value = 9;
    tapAndSettle(g, drop(g, cup.x, 400, 1));
    expect(g.phase).toBe("perk");
    expect(choosePerk(g, pick)).toBe(true);
  }

  it("starts with two cups, with what the player has on the first two from the shop", () => {
    const g = daily([["gold"], ["magnet"], ["laser"]]);
    expect(g.cols).toEqual([135, 225]);
    expect(g.cups.map((c) => c.x)).toEqual([135, 225]);
    expect(g.cups.map((c) => c.kinds)).toEqual([["gold"], ["magnet"]]);
  });

  it("gets a third cup after the first rung, and a fourth after the third, on the right, with its own power", () => {
    const g = daily([["gold"], ["magnet"], ["laser"], ["big"]]);
    g.cups[0].value = 3;
    climb(g, 5);
    expect(g.cols).toEqual([90, 180, 270]);
    expect(g.cups.map((c) => c.x).sort((a, b) => a - b)).toEqual([90, 180, 270]);
    const third = g.cups.find((c) => c.x === 270)!;
    expect(third.value).toBe(0);
    expect(third.kinds).toEqual(["laser"]);
    expect(g.cups.find((c) => c.x === 90)!.kinds).toContain("gold"); // (the cups that were there keep what they had)
    climb(g, 12); // (the second rung: still three)
    expect(g.cups).toHaveLength(3);
    climb(g, 21);
    expect(g.cols).toEqual([45, 135, 225, 315]);
    expect(g.cups).toHaveLength(4);
    expect(g.cups.find((c) => c.x === 315)!.kinds).toContain("big");
  });

  it("does not bring a cup back that a perk took away", () => {
    const g = daily();
    g.cups[1].dead = true;
    g.phase = "perk";
    g.perkChoices = ["remove"];
    expect(choosePerk(g, 0)).toBe(true);
    expect(g.cups).toHaveLength(1);
    climb(g, 5);
    expect(g.cups).toHaveLength(2); // (one that was there, and the new one of the rung)
  });
});

describe("perks that are offered as x2 or x3 in the daily challenge", () => {
  function daily(): GameState {
    const g = testGame(() => 0.5);
    startDaily(g, "2026-01-28");
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    g.cups[0].value = 0;
    return g;
  }

  it("take effect that many times: x2 of the shield puts a shield on two cups", () => {
    const g = daily();
    g.phase = "perk";
    g.perkChoices = ["shield", "slow", "cloth"];
    g.perkTimes = [2, 1, 1];
    expect(choosePerk(g, 0)).toBe(true);
    expect(g.cups.filter((c) => c.shield)).toHaveLength(2);
    expect(g.perks).toEqual(["shield", "shield"]);
  });

  it("put the same power on two different cups, make two cups come back, and slow the numbers twice", () => {
    const g = daily();
    g.phase = "perk";
    g.perkChoices = ["gold", "slow", "life"];
    g.perkTimes = [2, 2, 1];
    choosePerk(g, 0);
    expect(g.cups.map((c) => c.kinds)).toEqual([["gold"], ["gold"]]);
    const before = speedFactorOf(g);
    g.phase = "perk";
    g.perkChoices = ["slow"];
    g.perkTimes = [2];
    choosePerk(g, 0);
    expect(speedFactorOf(g)).toBeCloseTo(before * PERK_SLOWER * PERK_SLOWER, 10);
    for (const c of g.cups) c.dead = true;
    g.cups[0].value = 13;
    g.phase = "perk";
    g.perkChoices = ["life"];
    g.perkTimes = [2];
    choosePerk(g, 0);
    expect(g.cups.filter((c) => !c.dead)).toHaveLength(2);
  });

  it("are offered now and then, never more than they can be used, and the same for everyone on the same day", () => {
    const offered = (seed: number): number[] => {
      let s = seed;
      const g = testGame(() => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      });
      startDaily(g, "2026-01-28");
      const all: number[] = [];
      for (let i = 0; i < 80; i++) {
        g.phase = "play";
        g.perks = [];
        g.screens = 0;
        for (const c of g.cups) {
          c.shield = false;
          c.kinds = [];
          c.dead = false;
        }
        g.cups[0].dead = i % 2 === 0;
        g.level = 5;
        g.numbers = [];
        const cup = g.cups.find((c) => !c.dead)!;
        cup.value = 9;
        g.showcase = [];
        drop(g, cup.x, 400, 1);
        for (let k = 0; k < 300 && g.numbers.length > 0 && g.phase === "play"; k++) update(g, 1 / 60);
        if ((g.phase as string) === "perk") all.push(...g.perkTimes);
      }
      return all;
    };
    const a = offered(7);
    expect(a.length).toBeGreaterThan(0);
    expect(a.some((n) => n > 1)).toBe(true);
    expect(a.every((n) => n >= 1 && n <= 3)).toBe(true);
    expect(offered(7)).toEqual(a);
  });
});

describe("special perks in the daily challenge (the ones the saucers have)", () => {
  function daily(day = "2026-01-28"): GameState {
    const g = testGame(() => 0.5);
    startDaily(g, day); // (the numbers, and the perks on offer, follow the day)
    g.spawnTimer = 1e9;
    g.bonusTimer = 1e9;
    g.showcase = [];
    return g;
  }

  it("are not in the ordinary perks, but have limits", () => {
    for (const p of SPECIAL_PERKS) {
      expect(PERKS).not.toContain(p);
      expect(PERK_LIMIT[p]).toBeGreaterThan(0);
    }
  });

  it("come now and then in the offer, one of the three, and not more of them than there can be", () => {
    let withSpecial = 0;
    for (let i = 0; i < 300; i++) {
      const g = daily(`2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (Math.floor(i / 12) % 28)).padStart(2, "0")}`);
      g.perks = i % 2 === 0 ? [] : ["points", "points", "points"];
      g.level = 5;
      g.numbers = [];
      const cup = g.cups[0];
      cup.value = 9;
      drop(g, cup.x, 400, 1);
      for (let k = 0; k < 300 && g.numbers.length > 0 && (g.phase as string) === "play"; k++) update(g, 1 / 60);
      if ((g.phase as string) !== "perk") continue;
      expect(g.perkChoices.length).toBeGreaterThanOrEqual(1);
      expect(new Set(g.perkChoices).size).toBe(g.perkChoices.length);
      const special = g.perkChoices.filter((p) => SPECIAL_PERKS.includes(p));
      expect(special.length).toBeLessThanOrEqual(1);
      if (i % 2 === 1) expect(g.perkChoices).not.toContain("points");
      if (special.length > 0) withSpecial++;
    }
    expect(withSpecial).toBeGreaterThan(20);
    expect(withSpecial).toBeLessThan(150);
  });

  it("fewer numbers: every one makes 10% fewer numbers come, and they add up with the saucers", () => {
    const wait = (g: GameState): number => {
      g.spawnTimer = 0;
      update(g, 0.001);
      return g.spawnTimer;
    };
    const base = wait(daily());
    const g = daily();
    g.perks = ["sparse", "sparse"];
    expect(wait(g)).toBeCloseTo(base / 0.8, 6);
    const h = daily();
    h.saucerLoadout = ["sparse", "sparse"];
    startDaily(h, "2026-01-28");
    h.spawnTimer = 1e9;
    h.bonusTimer = 1e9;
    h.perks = ["sparse", "sparse"];
    const both = wait(h);
    expect(both).toBeCloseTo(base / 0.575, 6); // (two saucers work like two and a quarter, and the two perks are two more)
  });

  it("more specials: the bonus balls come sooner", () => {
    const next = (perks: PerkId[]): number => {
      const g = daily();
      g.perks = perks;
      g.bonusTimer = 0;
      update(g, 0.001);
      return g.bonusTimer;
    };
    const base = next([]);
    expect(next(["special", "special"])).toBeCloseTo(base / 1.2, 6);
  });

  it("more points: every one gives 50% more points", () => {
    const score = (perks: PerkId[]): number => {
      const g = daily();
      g.perks = perks;
      g.cups[1].value = 6;
      tapAndSettle(g, drop(g, g.cups[1].x, 200, 4));
      return g.score;
    };
    const base = score([]);
    expect(base).toBeGreaterThan(0);
    expect(score(["points", "points"])).toBe(base * 2);
  });
});

describe("the match modes: Save the cup and Even numbers", () => {
  function lcg(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }
  function started(variant: "save" | "sixeight", seed = 5): GameState {
    const g = testGame(lcg(seed));
    g.loadout = [["gold"], ["magnet"], ["big"], ["laser"]];
    g.saucerLoadout = ["slow", "points", null, null];
    startVariant(g, variant);
    return g;
  }
  /** The numbers that come in some seconds (every one is seen once). */
  function seen(g: GameState, seconds: number): NumberTile[] {
    const all = new Map<number, NumberTile>();
    for (let t = 0; t < seconds; t += 0.05) {
      update(g, 0.05);
      for (const n of g.numbers) all.set(n.id, {...n});
    }
    return [...all.values()];
  }

  it("Save the cup: four regular cups, one of them dead from the start, and nothing from the shop", () => {
    const g = started("save");
    expect(g.mode).toBe("endless");
    expect(g.variant).toBe("save");
    expect(g.cups).toHaveLength(4);
    expect(g.cups.filter((c) => c.dead)).toHaveLength(1);
    expect(g.cups.find((c) => c.dead)!.value).toBeGreaterThan(10);
    for (const c of g.cups) {
      expect(c.kinds).toEqual([]);
      expect(c.saucer).toBeUndefined();
      expect(c.shield).toBe(false);
    }
    expect(g.continuesLeft).toBe(0); // (no carrying on after an ad: it would bring the dead cup back)
    expect(g.screens).toBe(1); // (one cloth, as in the endless game)
  });

  it("Save the cup: only 1s fall, and no bonus balls or new kinds of number, however long it goes on", () => {
    const g = started("save");
    const deadOne = g.cups.find((c) => c.dead)!;
    deadOne.dead = false; // (so that the round does not end: only the numbers are looked at)
    deadOne.value = 0;
    const numbers = seen(g, 40);
    expect(numbers.length).toBeGreaterThan(10);
    expect(numbers.every((n) => n.v === 1 && n.op === "add" && n.bonus === null && n.chain === null && n.ghost === null && n.ice === 0)).toBe(true);
    for (const f of FEATURES) expect(featureAge(g, f), f).toBe(-1);
    g.bonusTimer = 0;
    update(g, 0.05);
    expect(g.bonusTimer).toBeGreaterThan(1e6);
    expect(g.numbers.some((n) => n.bonus !== null)).toBe(false);
  });

  it("Save the cup: a 1 over the dead cup cannot be saved by a tap, a 1 over a living cup goes into it, and moving the dead cup away saves it", () => {
    // (a tap on a 1 over the dead cup: it hops and falls into it)
    const g = started("save");
    g.spawnTimer = 1e9;
    const dead = g.cups.find((c) => c.dead)!;
    const doomed = drop(g, dead.x, 200, 1);
    expect(tapAt(g, doomed.x, doomed.y)).toBe(true);
    for (let i = 0; i < 600 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("deadCup");
    expect(canContinue(g)).toBe(false);
    // (a 1 over a living cup: a tap puts it in the cup)
    const h = started("save");
    h.spawnTimer = 1e9;
    const living = h.cups.find((c) => !c.dead)!;
    tapAndSettle(h, drop(h, living.x, 200, 1));
    expect(living.value).toBe(1);
    expect(h.phase).toBe("play");
    // (the dead cup is moved to another column, and the 1 that was over it falls into the living cup that came there instead)
    const k = started("save");
    k.spawnTimer = 1e9;
    const dead2 = k.cups.find((c) => c.dead)!;
    const from = dead2.x;
    const other = k.cups.find((c) => !c.dead && Math.abs(c.x - from) < 100)!;
    const falling = drop(k, from, 300, 1);
    moveCup(k, dead2, other.x);
    dropCup(k, dead2);
    expect(dead2.x).not.toBe(from);
    expect(other.x).toBe(from);
    for (let i = 0; i < 2000 && k.numbers.includes(falling) && k.phase === "play"; i++) update(k, 1 / 60);
    expect(k.phase).toBe("play");
    expect(other.value).toBe(1);
  });

  it("Save the cup: gets faster and faster (the numbers fall faster and come oftener, up to five times)", () => {
    const g = started("save");
    g.spawnTimer = 1e9;
    g.rng = () => 0.5; // (the time between numbers is a little different every time: not here)
    const wait = (): number => {
      g.spawnTimer = 0;
      update(g, 0.001);
      return g.spawnTimer;
    };
    const speed0 = speedFactorOf(g);
    expect(variantRamp(g)).toBeCloseTo(1.15, 10); // (a bit faster than the endless game from the start)
    expect(variantRate(g)).toBeCloseTo(1.3, 10);
    const wait0 = wait();
    g.variantTime = 36;
    expect(variantRamp(g)).toBeCloseTo(2.15, 3);
    expect(speedFactorOf(g)).toBeCloseTo((speed0 * 2.15) / 1.15, 3);
    g.variantTime = 30;
    expect(variantRate(g)).toBeCloseTo(2.3, 3);
    expect(wait()).toBeCloseTo((wait0 * 1.3) / 2.3, 3);
    g.variantTime = 1e6;
    expect(variantRamp(g)).toBe(5.5);
    expect(variantRate(g)).toBe(7);
    // (the other mode does not speed up with the seconds)
    expect(variantRamp(started("sixeight"))).toBe(1);
    expect(variantRate(started("sixeight"))).toBe(1);
  });

  it("Even numbers: only 2s, 4s, 8s, times 2 and divided by 2 fall, with the cups and saucers from the shop", () => {
    const g = started("sixeight");
    expect(g.variant).toBe("sixeight");
    expect(g.cups.map((c) => c.kinds)).toEqual([["gold"], ["magnet"], ["big"], ["laser"]]);
    expect(g.cups.map((c) => c.saucer)).toEqual(["slow", "points", undefined, undefined]);
    expect(g.cups.some((c) => c.dead)).toBe(false);
    const numbers = seen(g, 60);
    expect(numbers.length).toBeGreaterThan(20);
    const kinds = new Set(numbers.map((n) => `${n.op}${n.v}`));
    expect([...kinds].sort()).toEqual(["add2", "add4", "add8", "div2", "mul2"]);
    expect(numbers.every((n) => n.bonus === null)).toBe(true);
  });

  it("Save the cup: no steel numbers in its first three levels, and some 1s are steel (cannot be tapped) after that", () => {
    const early = started("save");
    expect(seen(early, 80).some((n) => n.op === "steel")).toBe(false);
    const later = started("save");
    later.level = 19; // (18 cups done: the fourth level)
    expect(endlessLevel(later)).toBe(4);
    const numbers = seen(later, 60);
    const steel = numbers.filter((n) => n.op === "steel");
    expect(steel.length).toBeGreaterThan(0);
    expect(numbers.every((n) => n.v === 1)).toBe(true);
  });

  it("Even numbers: no steel and no times 4 or divided by 4 in the first levels; steel after the third and 4s after the fourth", () => {
    const early = seen(started("sixeight"), 90);
    expect(early.some((n) => n.op === "steel" || ((n.op === "mul" || n.op === "div") && n.v === 4))).toBe(false);
    const third = started("sixeight");
    third.level = 19; // (18 cups done: the fourth level)
    expect(endlessLevel(third)).toBe(4);
    const withSteel = seen(third, 120);
    expect(withSteel.some((n) => n.op === "steel")).toBe(true);
    expect(withSteel.filter((n) => n.op === "steel").every((n) => n.v === 2 || n.v === 4)).toBe(true);
    expect(withSteel.some((n) => (n.op === "mul" || n.op === "div") && n.v === 4)).toBe(false);
    const fourth = started("sixeight");
    fourth.level = 27; // (the fifth level)
    expect(endlessLevel(fourth)).toBe(5);
    const later = seen(fourth, 150);
    expect(later.some((n) => n.op === "mul" && n.v === 4)).toBe(true);
    expect(later.some((n) => n.op === "div" && n.v === 4)).toBe(true);
    expect(later.every((n) => n.v % 2 === 0)).toBe(true);
  });

  it("Even numbers: most are 2s, and about a fifth each are times 2 and divided by 2", () => {
    const numbers = seen(started("sixeight"), 90);
    expect(numbers.length).toBeGreaterThan(15);
    const share = (op: string) => numbers.filter((n) => n.op === op).length / numbers.length;
    expect(share("div")).toBeGreaterThan(0.08);
    expect(share("div")).toBeLessThan(0.4);
    expect(share("mul")).toBeGreaterThan(0.05);
    expect(share("mul")).toBeLessThan(0.35);
    expect(numbers.filter((n) => n.op === "add" && n.v === 2).length / numbers.length).toBeGreaterThan(0.3);
  });

  it("Even numbers: 8 divided by 2 is 4, times 2 is 8, and 2 more make 10", () => {
    const g = started("sixeight");
    g.spawnTimer = 1e9;
    g.cups.forEach((c) => (c.kinds = []));
    g.cups[1].value = 8;
    const div = drop(g, g.cups[1].x, 200, 2);
    div.op = "div";
    tapAndSettle(g, div);
    expect(g.cups[1].value).toBe(4);
    const times = drop(g, g.cups[1].x, 200, 2);
    times.op = "mul";
    tapAndSettle(g, times);
    expect(g.cups[1].value).toBe(8);
    tapAndSettle(g, drop(g, g.cups[1].x, 200, 2));
    expect(g.level).toBe(2); // (a perfect 10)
    expect(g.cups[1].value).toBe(0);
  });

  it("start over as ordinary rounds again: the next ordinary round has no match mode", () => {
    const g = started("save");
    startGame(g, "endless");
    expect(g.variant).toBeNull();
    expect(g.cups.some((c) => c.dead)).toBe(false);
    startGame(g, "plus", 1);
    expect(g.variant).toBeNull();
  });

  it("keep their own record in the same way as the endless game", () => {
    const g = started("sixeight");
    g.best = 10;
    g.score = 50;
    expect(recordBest(g)).toBe(true);
    expect(g.best).toBe(50);
  });
});

describe("Defend the cups", () => {
  function defend(): GameState {
    const g = testGame(() => 0.5);
    g.hideIntros = new Set(FEATURES);
    startVariant(g, "defend");
    g.spawnTimer = 1e9;
    return g;
  }

  it("presents the skull when it starts (unless it has been hidden)", () => {
    const g = testGame(() => 0.5);
    g.hideIntros = new Set();
    startVariant(g, "defend");
    expect(g.phase).toBe("intro");
    expect(g.intro).toEqual(["skull"]);
    expect(defend().phase).toBe("play");
  });

  it("seven in ten of what falls is a skull, and the rest are plus numbers at first", () => {
    let a = 7;
    const g = testGame(() => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    });
    g.hideIntros = new Set(FEATURES);
    startVariant(g, "defend");
    const all = new Map<number, string>();
    for (let i = 0; i < 60 * 60 && g.phase === "play"; i++) {
      update(g, 1 / 60);
      for (const n of g.numbers) all.set(n.id, `${n.op}:${n.v}`);
    }
    const kinds = [...all.values()];
    const skulls = kinds.filter((k) => k.startsWith("skull")).length;
    expect(kinds.length).toBeGreaterThan(10);
    expect(skulls / kinds.length).toBeGreaterThan(0.5);
    expect(skulls / kinds.length).toBeLessThan(0.9);
    expect(kinds.filter((k) => !k.startsWith("skull")).every((k) => k.startsWith("add:") && Number(k.slice(4)) > 0)).toBe(true);
  });

  it("a tapped skull pops; a skull that lands in a cup kills it", () => {
    const g = defend();
    const s = drop(g, COLS[1], 200, 99);
    s.op = "skull";
    expect(tapAt(g, s.x, s.y)).toBe(true);
    expect(g.numbers.includes(s)).toBe(false);
    expect(g.events.some((e) => e.t === "skull")).toBe(true);
    const t = drop(g, g.cups[2].x, 200, 99);
    t.op = "skull";
    for (let i = 0; i < 1800 && !g.cups[2].dead && g.numbers.includes(t); i++) update(g, 1 / 60);
    expect(g.cups[2].dead, `${g.phase} ${t.y} ${g.cups[2].x} ${t.x}`).toBe(true);
  });

  it("is a bit faster, with a few more numbers, from the start", () => {
    const g = defend();
    expect(variantRamp(g)).toBeGreaterThan(1);
    expect(variantRate(g)).toBeGreaterThan(1);
  });
});

describe("the daily ladder mixes in a match mode", () => {
  it("plays every other rung with the numbers of today's match mode", () => {
    const g = testGame(() => 0.5);
    g.hideIntros = new Set(FEATURES);
    startDaily(g, "2026-01-28");
    expect(["save", "sixeight", "defend", "ice", "fast", "find", "shield"]).toContain(g.dailyMix);
  });

  it("plays the whole ladder as one match mode, picked at random for the day (the same for everyone)", () => {
    const day = "2026-11-16";
    expect([1, 2, 3, 4, 5, 6].map(dailyMixed)).toEqual([true, true, true, true, true, true]);
    const modes = [1, 2, 3, 4, 5, 6].map((r) => dailyMixOf(day, r));
    expect(new Set(modes).size).toBe(1);
    expect(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map((d) => dailyMixOf(d)).some((m) => m !== modes[0])).toBe(true);
  });
});

describe("the skull in the book", () => {
  it("comes from level 1 of divide on, now and then, and not before", () => {
    const seen = (mode: Mode, stage: number) => {
      let a = 3;
      const g = testGame(() => {
        a = (a * 1664525 + 1013904223) % 4294967296;
        return a / 4294967296;
      });
      startGame(g, mode, stage);
      const ops = new Set<string>();
      for (let i = 0; i < 90 * 60 && g.phase === "play"; i++) {
        update(g, 1 / 60);
        for (const n of g.numbers) ops.add(n.op);
      }
      return ops;
    };
    expect(seen("times", 12).has("skull")).toBe(false);
    expect(seen("divide", 3).has("skull")).toBe(true);
  });
});

describe("a skull in ice", () => {
  it("has to be cracked free before it pops", () => {
    const g = playing();
    const s = drop(g, COLS[1], 200, 99);
    s.op = "skull";
    s.ice = 2;
    expect(tapAt(g, s.x, s.y)).toBe(true);
    expect(tapAt(g, s.x, s.y)).toBe(true);
    expect(g.numbers.includes(s)).toBe(true);
    expect(s.ice).toBe(0);
    expect(tapAt(g, s.x, s.y)).toBe(true);
    expect(g.numbers.includes(s)).toBe(false);
  });

  it("comes now and then on the levels that have ice", () => {
    let found = false;
    for (let seed = 1; seed < 30 && !found; seed++) {
      let a = seed;
      const g = testGame(() => {
        a = (a * 1664525 + 1013904223) % 4294967296;
        return a / 4294967296;
      });
      startGame(g, "divide", 6);
      for (let i = 0; i < 60 * 60 && g.phase === "play" && !found; i++) {
        update(g, 1 / 60);
        found = g.numbers.some((n) => n.op === "skull" && n.ice > 0);
      }
    }
    expect(found).toBe(true);
  });
});

describe("Ice world", () => {
  it("every number that falls is frozen in ice", () => {
    let a = 11;
    const g = testGame(() => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    });
    startVariant(g, "ice");
    const seen: NumberTile[] = [];
    for (let i = 0; i < 40 * 60 && g.phase === "play"; i++) {
      update(g, 1 / 60);
      for (const n of g.numbers) if (!seen.includes(n)) seen.push(n);
    }
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.every((n) => n.ice > 0 || n.state !== "fall" || n.y > 0)).toBe(true);
    expect(seen.filter((n) => n.bonus === null).length).toBeGreaterThan(0);
  });
});

describe("Fast fingers", () => {
  function fast(seed = 13): GameState {
    let a = seed;
    const g = testGame(() => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    });
    startVariant(g, "fast");
    return g;
  }

  it("counts down 3, 2, 1 (0.6 seconds each) before anything comes", () => {
    const g = fast();
    expect(g.countdown).toBeCloseTo(1.8, 5);
    for (let i = 0; i < 1.7 * 60; i++) update(g, 1 / 60);
    expect(g.numbers).toHaveLength(0);
    for (let i = 0; i < 2 * 60; i++) update(g, 1 / 60);
    expect(g.countdown).toBe(0);
    expect(g.numbers.length).toBeGreaterThan(0);
  });

  it("brings only 10s, 0s and skulls, which hang still and then pop (a skull falls)", () => {
    const g = fast();
    for (let i = 0; i < 2 * 60; i++) update(g, 1 / 60);
    const n = g.numbers[0];
    expect(["ten", "zero", "skull", "trap"]).toContain(n.op);
    const y = n.y;
    update(g, 0.3);
    expect(n.y).toBe(y);
    g.spawnTimer = 1e9;
    for (let i = 0; i < 4 * 60; i++) update(g, 1 / 60);
    if (n.op === "skull") expect(n.y).toBeGreaterThan(y);
    else expect(g.numbers.includes(n)).toBe(false);
  });

  it("comes in waves: several at once, more and more, and the next only when they are gone", () => {
    const g = fast();
    for (let i = 0; i < 2 * 60; i++) update(g, 1 / 60);
    expect(g.numbers.length).toBe(fastWave(g));
    expect(g.numbers.length).toBeGreaterThanOrEqual(2);
    g.variantTime = 60;
    expect(fastWave(g)).toBeGreaterThan(2);
  });

  it("later on, a 10 or a 0 sometimes comes chained to a red skull", () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      const g = fast(seed);
      g.countdown = 0;
      g.variantTime = 40;
      g.numbers = [];
      g.spawnTimer = 0;
      update(g, 1 / 60);
      found = g.numbers.some((n) => (n.op === "ten" || n.op === "zero") && n.chain !== null && g.numbers.find((m) => m.id === n.chain)?.op === "trap");
    }
    expect(found).toBe(true);
  });

  it("a red trap skull falls when it is tapped (into the cup under it, which dies)", () => {
    const g = fast();
    g.countdown = 0;
    g.spawnTimer = 1e9;
    const trap = drop(g, g.cups[2].x, 200, 99);
    trap.op = "trap";
    trap.hover = 2;
    expect(tapAt(g, trap.x, trap.y)).toBe(true);
    for (let i = 0; i < 180 && !g.cups[2].dead; i++) update(g, 1 / 60);
    expect(g.cups[2].dead).toBe(true);
  });

  it("a tapped 10 makes a perfect 10, and the numbers hang for less and less time", () => {
    const g = fast();
    g.countdown = 0;
    g.spawnTimer = 1e9;
    const ten = drop(g, g.cups[1].x, 200, 10);
    ten.op = "ten";
    ten.hover = 2;
    expect(tapAt(g, ten.x, ten.y)).toBe(true);
    for (let i = 0; i < 120 && g.numbers.includes(ten); i++) update(g, 1 / 60);
    expect(g.level).toBe(2);
    const early = fastHover(g);
    g.variantTime = 60;
    expect(fastHover(g)).toBeLessThan(early);
  });
});

describe("Sequence 10", () => {
  function find(seed = 21): GameState {
    let a = seed;
    const g = testGame(() => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    });
    startVariant(g, "find");
    for (let i = 0; i < 2.2 * 60; i++) update(g, 1 / 60);
    return g;
  }
  const columns = (g: GameState) => g.cols.map((_, c) => g.numbers.filter((n) => n.col === c).sort((a, b) => a.y - b.y));

  it("after the count down, sets out columns of numbers that stand still, and at least one makes 10 from the top down", () => {
    for (let seed = 1; seed < 30; seed++) {
      const g = find(seed);
      const cols = columns(g).filter((c) => c.length > 0);
      expect(cols.length).toBe(g.cups.filter((c) => !c.dead).length);
      expect(cols.some((c) => columnValue(c) === 10)).toBe(true);
    }
  });

  it("tapping the numbers of a column that makes 10 (top down) sends them into its cup: a perfect 10, and a new puzzle", () => {
    const g = find();
    const col = columns(g).find((c) => c.length > 0 && columnValue(c) === 10)!;
    for (const n of col) {
      expect(tapAt(g, n.x, n.y)).toBe(true);
      for (let i = 0; i < 120 && g.numbers.includes(n); i++) update(g, 1 / 60);
    }
    for (let i = 0; i < 30; i++) update(g, 1 / 60);
    expect(g.level).toBe(2);
    expect(g.numbers.length).toBeGreaterThan(0);
    expect(g.numbers.every((n) => n.hover !== undefined)).toBe(true);
  });

  it("no perfect 10 in time and a cup dies, and one dead cup is game over; the time gets shorter and shorter", () => {
    const g = find();
    for (let i = 0; i < (g.findTotal + 0.3) * 60; i++) update(g, 1 / 60);
    expect(g.cups.filter((c) => c.dead).length).toBe(1);
    expect(g.phase).toBe("over");
    const t0 = findTime(g);
    g.variantTime = 60;
    expect(findTime(g)).toBeLessThan(t0);
  });
});

describe("help with two or three cups", () => {
  it("after a number lands, the next number finishes one of the cups (only that one)", () => {
    let a = 5;
    const g = testGame(() => {
      a = (a * 1664525 + 1013904223) % 4294967296;
      return a / 4294967296;
    });
    startGame(g, "plus", 1);
    expect(g.cols.length).toBeLessThanOrEqual(3);
    g.spawnTimer = 1e9;
    g.cups[0].value = 7;
    g.cups[1].value = 8;
    g.helpDue = true;
    g.numbers = [];
    g.spawnTimer = 0;
    update(g, 1 / 60);
    const n = g.numbers[g.numbers.length - 1];
    expect([3, 2]).toContain(n.v);
    expect(g.helpDue).toBe(false);
    // (and never two in a row: the next one, even if a number lands, is not a forced help)
    g.helpDue = true;
    g.spawnTimer = 0;
    update(g, 1 / 60);
    expect(g.helpDue).toBe(true);
  });
});

describe("help with four cups", () => {
  const gapOn = (mode: Mode, stage: number) => {
    const g = testGame(() => 0.5);
    startGame(g, mode, stage);
    return helpGap(g);
  };
  it("helps often at first, less and less, and not at all from the divide chapter on", () => {
    expect(gapOn("plus", 1)).toBe(2);
    expect(gapOn("mixed", 1)).toBe(2);
    expect(gapOn("mixed", 12)).toBeGreaterThan(gapOn("mixed", 1));
    expect(gapOn("times", 12)).toBeGreaterThan(gapOn("mixed", 12));
    expect(gapOn("divide", 1)).toBe(Infinity);
    expect(gapOn("space", 5)).toBe(Infinity);
  });
});

describe("Shield up", () => {
  function shield(): GameState {
    const g = testGame(() => 0.3);
    startVariant(g, "shield");
    g.spawnTimer = 1e9;
    return g;
  }
  it("the shield stays in its area over the cups", () => {
    const g = shield();
    moveShield(g, -100, 9999);
    expect(g.shieldX).toBe(SHIELD_AREA.x0);
    expect(g.shieldY).toBe(SHIELD_AREA.y1);
    moveShield(g, 180, 0);
    expect(g.shieldY).toBe(SHIELD_AREA.y0);
  });
  it("knocks a skull away (the cup under it lives); a skull it misses kills the cup", () => {
    const g = shield();
    const cup = g.cups[1];
    moveShield(g, cup.x, 400);
    const skull = drop(g, cup.x, 300, 99);
    skull.op = "skull";
    for (let i = 0; i < 1500 && g.numbers.includes(skull); i++) update(g, 1 / 60);
    expect(cup.dead).toBe(false);
    moveShield(g, g.cups[3].x, 400);
    const other = drop(g, g.cups[0].x, 300, 99);
    other.op = "skull";
    for (let i = 0; i < 1500 && !g.cups[0].dead; i++) update(g, 1 / 60);
    expect(g.cups[0].dead).toBe(true);
  });
  it("a shield swept fast across a skull still pops it, and so does the edge of the shield", () => {
    const g = shield();
    moveShield(g, 40, 300);
    const skull = drop(g, 200, 300, 99);
    skull.op = "skull";
    moveShield(g, 340, 300); // (one big jump over it)
    expect(g.numbers.includes(skull)).toBe(false);
    const edge = drop(g, 180 + g.shieldW + 10, 300, 99);
    edge.op = "skull";
    moveShield(g, 180, 300);
    expect(g.numbers.includes(edge)).toBe(false);
  });

  it("at level 10 a boss comes: the shield has to hold it up a while before it bursts", () => {
    const g = shield();
    g.level = 10;
    update(g, 1 / 60);
    const boss = g.numbers.find((n) => n.boss)!;
    expect(boss).toBeDefined();
    moveShield(g, boss.x, 300);
    for (let i = 0; i < 60 && g.numbers.includes(boss); i++) update(g, 1 / 60);
    expect(g.numbers.includes(boss)).toBe(true); // (one second is not enough)
    for (let i = 0; i < 60 * 20 && g.numbers.includes(boss); i++) update(g, 1 / 60);
    expect(g.numbers.includes(boss)).toBe(false);
    expect(g.cups.every((c) => !c.dead)).toBe(true);
  });

  it("a 10 that gets past the shield is a perfect 10", () => {
    const g = shield();
    moveShield(g, g.cups[3].x, 400);
    const ten = drop(g, g.cups[0].x, 300, 10);
    ten.op = "ten";
    for (let i = 0; i < 1500 && g.level === 1; i++) update(g, 1 / 60);
    expect(g.level).toBe(2);
  });

  it("keeps the cups from the shop", () => {
    const g = testGame(() => 0.3);
    g.loadout = [["big"], [], [], []];
    startVariant(g, "shield");
    expect(g.cups.some((c) => c.kinds.includes("big"))).toBe(true);
  });

  it("grows to its full size, and after that only its power goes up (many times), which hurts a boss faster", () => {
    const g = shield();
    const take = () => {
      const ball = drop(g, g.shieldX, g.shieldY - 30, 0);
      ball.bonus = "shield";
      for (let i = 0; i < 120 && g.numbers.includes(ball); i++) update(g, 1 / 60);
    };
    for (let i = 0; i < 5; i++) take();
    expect(g.shieldW).toBe(SHIELD_W_MAX);
    expect(g.shieldPower).toBe(1);
    const damage = shieldDamage(g);
    for (let i = 0; i < 40; i++) take();
    expect(g.shieldW).toBe(SHIELD_W_MAX);
    expect(g.shieldPower).toBe(SHIELD_POWER_MAX);
    expect(shieldDamage(g)).toBeGreaterThan(damage);
  });
});

describe("Fighter jet", () => {
  function jet(): GameState {
    const g = testGame(() => 0.3);
    startVariant(g, "jet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    holdCraft(g, true);
    return g;
  }
  it("shoots only while a finger holds it, and pops a skull over it", () => {
    const idle = jet();
    holdCraft(idle, false);
    moveShield(idle, 180, 450);
    for (let i = 0; i < 60; i++) update(idle, 1 / 60);
    expect(idle.shots).toHaveLength(0);
    const g = jet();
    moveShield(g, 180, 450);
    const skull = drop(g, 180, 200, 99);
    skull.op = "skull";
    for (let i = 0; i < 120 && g.numbers.includes(skull); i++) update(g, 1 / 60);
    expect(g.numbers.includes(skull)).toBe(false);
    expect(g.cups.every((c) => !c.dead)).toBe(true);
  });
  it("shoots a 10 too (it is lost), so the jet has to be moved away to let one in", () => {
    const g = jet();
    moveShield(g, 180, 450);
    const ten = drop(g, 180, 200, 10);
    ten.op = "ten";
    for (let i = 0; i < 120 && g.numbers.includes(ten); i++) update(g, 1 / 60);
    expect(g.numbers.includes(ten)).toBe(false);
    expect(g.level).toBe(1);
  });
  /** A weapon ball (or a shield ball) where the jet is, taken at once. */
  function take(g: GameState, n: NumberTile): void {
    n.x = g.shieldX;
    n.y = g.shieldY - 4;
    n.prevY = n.y;
    update(g, 1 / 60);
  }
  function ball(g: GameState, w: Weapon): NumberTile {
    const n = drop(g, g.shieldX, g.shieldY - 4, 0);
    n.pickup = "weapon";
    n.weapon = w;
    return n;
  }
  it("offers two weapons side by side to choose a way (gun first), and the one not taken goes", () => {
    const g = jet();
    expect(nextOffer(g)).toEqual(["bullet", "laser"]);
    moveShield(g, 120, 450);
    const a = ball(g, "bullet");
    const b = drop(g, 260, 200, 0);
    b.pickup = "weapon";
    b.weapon = "laser";
    a.link = a.id;
    b.link = a.id;
    take(g, a);
    expect(g.jetWeapons.a).toBe("bullet");
    expect(g.jetLv.a).toBe(1);
    expect(g.numbers.includes(b)).toBe(false);
    // (one more of the same way, then the next way is offered: special)
    expect(nextOffer(g)).toEqual(["bullet"]);
    take(g, ball(g, "bullet"));
    expect(g.jetLv.a).toBe(2);
    expect(nextOffer(g)).toEqual(["flame", "missile"]);
    take(g, ball(g, "missile"));
    expect(g.jetWeapons.b).toBe("missile");
    take(g, ball(g, "missile"));
    expect(nextOffer(g)).toEqual(["ricochet", "rapid"]);
    take(g, ball(g, "rapid"));
    for (let k = 0; k < 20 && nextOffer(g).length > 0; k++) take(g, ball(g, nextOffer(g)[0]));
    expect(g.jetLv).toEqual({a: 3, b: 3, c: 3});
    expect(nextOffer(g)).toEqual([]);
  });
  it("the perfect 10s of the bar fade away, and with a whole one gone the weapon goes down (the basic shot stays)", () => {
    const g = jet();
    moveShield(g, 120, 450);
    take(g, ball(g, "bullet"));
    expect(fadeOn(g)).toBe(true);
    g.level = 4; // (three cups on the bar)
    for (let i = 0; i < 60 * 40; i++) update(g, 1 / 60);
    expect(g.drain).toBeGreaterThanOrEqual(20);
    expect(g.jetLv.a).toBe(0);
    expect(g.jetBase).toBe(1);
  });
  it("a skull shot is worth more on the higher levels", () => {
    const g = jet();
    g.level = 3;
    const low = jetKillPoints(g);
    g.level = endlessCupsBefore(4) + 3;
    expect(jetKillPoints(g)).toBeGreaterThan(low * 4);
  });
  it("the laser burns what is straight over the jet, and the plasma flame what is close in front of it", () => {
    const g = jet();
    moveShield(g, 180, 450);
    g.jetWeapons.a = "laser";
    g.jetLv.a = 2;
    const far = drop(g, 182, 100, 99);
    far.op = "skull";
    for (let i = 0; i < 120 && g.numbers.includes(far); i++) update(g, 1 / 60);
    expect(g.numbers.includes(far)).toBe(false);
    const h = jet();
    moveShield(h, 180, 450);
    h.jetBase = 1;
    h.jetWeapons.a = "laser";
    h.jetLv.a = 0;
    h.jetWeapons.b = "flame";
    h.jetLv.b = 1;
    h.jetFire = 1e9;
    const near = drop(h, 190, 380, 99);
    near.op = "skull";
    near.speed = 0;
    for (let i = 0; i < 120 && h.numbers.includes(near); i++) {
      near.y = 380;
      update(h, 1 / 60);
    }
    expect(h.numbers.includes(near)).toBe(false);
  });
  it("ricochet: a bullet bounces on to the next skull", () => {
    const g = jet();
    moveShield(g, 180, 450);
    g.jetWeapons.c = "ricochet";
    g.jetLv.c = 1;
    g.jetFire = 1e9;
    const first = drop(g, 180, 300, 99);
    first.op = "skull";
    const second = drop(g, 260, 260, 99);
    second.op = "skull";
    g.shots = [{x: 180, y: 330, vx: 0, vy: -620, missile: false, power: 1, age: 0, trail: [], bounces: 1, hit: []}];
    for (let i = 0; i < 30; i++) update(g, 1 / 60);
    expect(g.numbers.includes(first)).toBe(false);
    expect(g.numbers.includes(second)).toBe(false);
  });
  it("is knocked out for a moment by a skull when it has no shield", () => {
    const g = jet();
    moveShield(g, 60, 450);
    g.jetFire = 99;
    const skull = drop(g, 60, 440, 99);
    skull.op = "skull";
    update(g, 1 / 60);
    expect(g.jetStun).toBeGreaterThan(0);
  });
  it("hits harder during a combo, and a little harder on every level", () => {
    const g = jet();
    const plain = shotPower(g);
    g.combo = 3;
    expect(shotPower(g)).toBeCloseTo(plain * 2, 5);
    g.combo = 0;
    g.level = endlessCupsBefore(3) + 1;
    expect(shotPower(g)).toBeGreaterThan(plain);
  });
  it("from level 10 the skulls shoot back; a missile knocks out the jet, and a shot takes one down", () => {
    const g = testGame(() => 0.0001);
    startVariant(g, "jet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    g.level = ENEMY_FIRE_FROM;
    g.bossLevel = g.level; // (no boss now)
    moveShield(g, 60, 450);
    const skull = drop(g, 300, 120, 99);
    skull.op = "skull";
    skull.speed = 0;
    for (let i = 0; i < 60 * 20 && g.enemyShots.length === 0; i++) {
      skull.y = 120;
      update(g, 1 / 60);
    }
    expect(g.enemyShots.length).toBeGreaterThan(0);
    g.numbers = [];
    g.enemyShots = [{x: 60, y: 440, vx: 0, vy: 100, age: 0}];
    update(g, 1 / 60);
    expect(g.jetStun).toBeGreaterThan(0);
    const h = jet();
    h.enemyShots = [{x: 180, y: 300, vx: 0, vy: 0, age: 0}];
    h.shots = [{x: 180, y: 305, vx: 0, vy: -1, missile: false, age: 0, trail: []}];
    update(h, 1 / 60);
    expect(h.enemyShots).toHaveLength(0);
  });
  it("a boss comes at level 10 and takes many shots", () => {
    const g = jet();
    g.level = 10;
    update(g, 1 / 60);
    const boss = g.numbers.find((n) => n.boss)!;
    expect(boss).toBeDefined();
    expect(boss.boss!.max).toBeGreaterThan(10);
  });
});

describe("Comet belt", () => {
  function comet(): GameState {
    const g = testGame(() => 0.3);
    startVariant(g, "comet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    return g;
  }
  it("a touch costs a life (and the ship blinks a moment, when it cannot be hurt); with the last life it is over, and a heart gives one back", () => {
    const g = comet();
    moveShield(g, 100, 400);
    const first = drop(g, 100, 380, 0);
    first.comet = true;
    update(g, 1 / 60);
    expect(g.phase).toBe("play");
    expect(g.shipHp).toBe(SHIP_HP - 1);
    expect(g.shipHurt).toBeGreaterThan(0);
    const again = drop(g, 100, 380, 0);
    again.comet = true;
    update(g, 1 / 60);
    expect(g.shipHp).toBe(SHIP_HP - 1); // (just hit: not hurt again)
    const heart = drop(g, 100, 380, 0);
    heart.pickup = "heart";
    update(g, 1 / 60);
    expect(g.shipHp).toBe(SHIP_HP);
  });
  it("is over when the ship touches a comet with its last life", () => {
    const g = comet();
    g.shipHp = 1;
    moveShield(g, 100, 400);
    const n = drop(g, 100, 340, 1);
    n.comet = true;
    for (let i = 0; i < 120 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("crash");
    const h = comet();
    h.shipHp = 1;
    moveShield(h, 100, 400);
    const one = drop(h, 100, 340, 1);
    one.op = "steel";
    for (let i = 0; i < 120 && h.phase === "play"; i++) update(h, 1 / 60);
    expect(h.overReason).toBe("crash"); // (a 1 must not be touched either)
  });
  it("is over when a comet only touches the nose or a fin of the ship", () => {
    for (const [dx, dy] of [[0, -35], [24, 22], [-24, 22]]) {
      const g = comet();
      g.shipHp = 1;
      moveShield(g, 180, 400);
      const n = drop(g, 180 + dx, 400 + dy - 4, 0);
      n.comet = true;
      update(g, 1 / 60);
      expect(g.overReason).toBe("crash");
    }
  });
  it("a comet that passes beside the ship does not hit it", () => {
    const g = comet();
    moveShield(g, 180, 400);
    const n = drop(g, 180 + 50, 300, 0);
    n.comet = true;
    for (let i = 0; i < 300 && g.numbers.includes(n); i++) update(g, 1 / 60);
    expect(g.phase).toBe("play");
  });
  it("the comets fall faster than the numbers", () => {
    const g = comet();
    moveShield(g, 20, 100);
    const two = drop(g, g.cols[1], 100, 2);
    two.op = "steel";
    const rock = drop(g, 300, 100, 0);
    rock.comet = true;
    update(g, 1 / 60);
    expect(rock.y - 100).toBeGreaterThan((two.y - 100) * 1.4);
  });
  it("the smaller a comet, the faster it falls", () => {
    const g = comet();
    moveShield(g, 20, 100);
    const small = drop(g, 300, 100, 0);
    small.comet = true;
    small.scale = 0.6;
    const big = drop(g, 340, 100, 0);
    big.comet = true;
    big.scale = 1.3;
    update(g, 1 / 60);
    expect(small.y - 100).toBeGreaterThan((big.y - 100) * 2);
  });
  it("uses fuel while the ship is held; when it runs out the ship cannot be flown, and it fills up again when it is let go", () => {
    const g = comet();
    moveShield(g, 20, 100);
    holdCraft(g, true);
    for (let i = 0; i < 60 * (FUEL_SECONDS + 0.5) && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.fuel).toBe(0);
    expect(g.fuelOut).toBe(true);
    expect(shipFlying(g)).toBe(false);
    moveShield(g, 200, 300);
    expect(g.shieldX).toBe(20); // (no fuel: it does not move)
    holdCraft(g, false);
    for (let i = 0; i < 60 * FUEL_REFILL && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.fuel).toBeCloseTo(1, 5);
    expect(g.fuelOut).toBe(false);
  });
  it("a new level pops every comet (an ordinary perfect 10 does not)", () => {
    const g = comet();
    moveShield(g, 20, 100);
    const stays = drop(g, 90, 150, 0);
    stays.comet = true;
    const first = g.cups[1];
    first.value = 8;
    const t2 = drop(g, first.x, 470, 2);
    t2.op = "steel";
    for (let i = 0; i < 300 && g.level === 1; i++) update(g, 1 / 60);
    expect(g.level).toBe(2);
    expect(g.numbers.includes(stays)).toBe(true);
    g.numbers = [];
    g.level = endlessCupsBefore(2); // (one cup left to level 2)
    moveShield(g, 20, 100);
    const a = drop(g, 90, 150, 0);
    a.comet = true;
    const b = drop(g, 270, 200, 0);
    b.comet = true;
    const cup = g.cups[1];
    cup.value = 8;
    const two = drop(g, cup.x, 470, 2);
    two.op = "steel";
    const before = g.level;
    for (let i = 0; i < 300 && g.level === before; i++) update(g, 1 / 60);
    expect(endlessLevel(g)).toBe(2);
    expect(g.numbers.some((n) => n.comet)).toBe(false);
  });
  it("the tank gets bigger on every new level", () => {
    const g = comet();
    const first = fuelCapacity(g);
    g.level = endlessCupsBefore(3) + 1;
    expect(fuelCapacity(g)).toBeGreaterThan(first);
  });
  it("flies to where the finger is put down, on its way, instead of jumping", () => {
    const g = comet();
    moveShield(g, 40, 450);
    flyCraftTo(g, 320, 450);
    expect(g.shieldX).toBe(40);
    update(g, 1 / 60);
    expect(g.shieldX).toBeGreaterThan(40);
    expect(g.shieldX).toBeLessThan(320);
    expect(g.craftTrail.length).toBeGreaterThan(0);
    for (let i = 0; i < 60 && g.craftTo; i++) update(g, 1 / 60);
    expect(g.shieldX).toBe(320);
  });
  it("a fuel ball fills up the tank", () => {
    const g = comet();
    moveShield(g, 180, 400);
    g.fuel = 0;
    g.fuelOut = true;
    const ball = drop(g, 180, 380, 0);
    ball.pickup = "fuel";
    update(g, 1 / 60);
    expect(g.fuel).toBe(1);
    expect(g.fuelOut).toBe(false);
  });
  it("goes twice as fast while the ship is held", () => {
    const fallen = (held: boolean): number => {
      const g = comet();
      moveShield(g, 20, 100);
      holdCraft(g, held);
      const n = drop(g, 300, 100, 2);
      n.op = "steel";
      update(g, 1 / 60);
      return n.y - 100;
    };
    expect(fallen(true)).toBeCloseTo(fallen(false) * COMET_HELD_PACE, 2);
  });
  it("a shield ball gives the ship a shield, and the shield takes one hit", () => {
    const g = comet();
    moveShield(g, 180, 400);
    const ball = drop(g, 180, 380, 0);
    ball.pickup = "shield";
    update(g, 1 / 60);
    expect(g.jetShield).toBe(true);
    const n = drop(g, 180, 380, 0);
    n.comet = true;
    update(g, 1 / 60);
    expect(g.phase).toBe("play");
    expect(g.jetShield).toBe(false);
    g.shipHp = 1;
    const m = drop(g, 180, 380, 0);
    m.comet = true;
    update(g, 1 / 60);
    expect(g.overReason).toBe("crash");
  });
  it("sends the 10s down the columns and the comets beside them", () => {
    let a = 11;
    const g = testGame(() => ((a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296));
    startVariant(g, "comet");
    g.countdown = 0;
    g.variantTime = 30;
    moveShield(g, 20, 100);
    const seen: NumberTile[] = [];
    for (let i = 0; i < 60 * 30 && g.phase === "play"; i++) {
      g.jetShield = true; // (the ship is in the way at the edge: the shield keeps the round going)
      update(g, 1 / 60);
      for (const n of g.numbers) if (!seen.includes(n)) seen.push(n);
    }
    const ones = seen.filter((n) => !n.comet && !n.pickup);
    const comets = seen.filter((n) => n.comet);
    expect(ones.length).toBeGreaterThan(0);
    expect(comets.length).toBeGreaterThan(0);
    expect(ones.filter((n) => !n.pickup).every((n) => n.v === 10 && n.op === "ten" && g.cols.includes(n.x))).toBe(true);
    expect(comets.every((n) => g.cols.every((x) => Math.abs(n.x - x) > 25))).toBe(true);
  });
  it("a 1 that misses the ship falls into a cup, and a comet falls past the cups", () => {
    const g = comet();
    moveShield(g, 20, 100);
    const cup = g.cups[2];
    const rock = drop(g, cup.x, 420, 0);
    rock.comet = true;
    for (let i = 0; i < 1500 && g.numbers.includes(rock); i++) update(g, 1 / 60);
    expect(cup.value).toBe(0);
    const n = drop(g, cup.x, 400, 1);
    n.op = "steel";
    for (let i = 0; i < 1500 && g.numbers.includes(n); i++) update(g, 1 / 60);
    expect(cup.value).toBe(1);
    expect(g.phase).toBe("play");
  });
  it("the numbers cannot be tapped (the ship is flown)", () => {
    const g = comet();
    const n = drop(g, 180, 200, 1);
    n.comet = true;
    expect(tapAt(g, n.x, n.y)).toBe(false);
  });
});

describe("the snake", () => {
  function snake(): GameState {
    const g = testGame(() => 0.3);
    startVariant(g, "snake");
    g.countdown = 0;
    update(g, 1 / 60);
    return g;
  }
  /** Puts the train on the screen: the head at `s`, and every number SNAKE_GAP behind the one in front. */
  function lay(g: GameState, s: number): NumberTile[] {
    const train = snakeTrain(g);
    train.forEach((n, i) => (n.track = s - i * SNAKE_GAP));
    update(g, 1 / 600);
    return snakeTrain(g);
  }
  it("sets out a train: a head in front and the numbers behind it, that goes along the track", () => {
    const g = snake();
    const train = snakeTrain(g);
    expect(train[0].snakeHead).toBe(true);
    expect(train.length - 1).toBe(snakeTrainLength(g));
    const before = train[0].track!;
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(train[0].track! - before).toBeCloseTo(snakeSpeed(g), 0);
  });
  it("a tapped number goes into the nearest cup, and the ones behind close the gap", () => {
    const g = snake();
    const train = lay(g, 700);
    const n = train[2];
    const p = snakePoint(g, n.track!);
    expect(tapAt(g, p.x, p.y)).toBe(true);
    expect(n.state).toBe("dive");
    for (let i = 0; i < 120; i++) update(g, 1 / 60);
    expect(g.cups.reduce((s, c) => s + c.value, 0)).toBe(n.v);
    const now = snakeTrain(g);
    expect(now[1].track! - now[2].track!).toBeCloseTo(SNAKE_GAP, 0);
  });
  it("taking a number makes the snake slide slowly back a little", () => {
    const g = snake();
    const train = lay(g, 700);
    const p = snakePoint(g, train[3].track!);
    tapAt(g, p.x, p.y);
    const at = train[0].track!;
    for (let i = 0; i < 20; i++) update(g, 1 / 60);
    expect(train[0].track!).toBeLessThan(at);
    expect(at - train[0].track!).toBeLessThan(SNAKE_GAP * 1.2);
  });
  it("the laser of a cup stuns the snake (it stands still for a while) and burns none of it but its steel numbers", () => {
    const g = snake();
    const train = lay(g, 700);
    const c = g.cups[0];
    c.kinds = ["laser"];
    c.charge = 0;
    const count = snakeTrain(g).length;
    const p = snakePoint(g, train[0].track!);
    for (const n of train) n.track = train[0].track! - train.indexOf(n) * SNAKE_GAP;
    train[1].x = c.x; // (one of it in the column of the cup)
    train[2].x = c.x;
    train[2].op = "steel"; // (and a steel number)
    expect(fireLaser(g, c)).toBe(true);
    expect(snakeTrain(g).length).toBe(count - 1);
    expect(g.numbers.includes(train[2])).toBe(false);
    expect(g.snakeStun).toBe(0); // (the body was hit, not the head: no stun)
    c.charge = 0;
    train[0].x = c.x;
    expect(fireLaser(g, c)).toBe(true);
    expect(g.snakeStun).toBeGreaterThan(0);
    const at = train[0].track!;
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(train[0].track!).toBeLessThanOrEqual(at + 0.5); // (it does not go on: it only slides back to close the gap)
    void p;
  });
  it("a number tapped over a dead cup is not helped to another one: it goes down into the dead cup", () => {
    const g = snake();
    const train = lay(g, 700);
    const n = train.find((m) => !m.snakeHead && m.op === "add" && !m.pickup && m.y > 0 && m.x > 20 && m.x < W - 20)!;
    const dead = g.cups.reduce((b, c) => (Math.abs(c.x - n.x) < Math.abs(b.x - n.x) ? c : b));
    dead.x = n.x;
    dead.dead = true;
    tapAt(g, n.x, n.y);
    for (let i = 0; i < 240 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.overReason).toBe("deadCup");
  });
  it("a perfect 10 that fades off the bar makes the snake faster, with an effect", () => {
    const g = snake();
    lay(g, 700);
    const before = snakeSpeed(g);
    g.level = 3; // (two perfect 10s on the bar)
    g.drain = 19;
    g.drainClock = 0;
    g.events = [];
    for (let i = 0; i < 60 * 30 && g.drain < 20; i++) update(g, 1 / 60);
    expect(g.snakeBoost).toBe(1);
    expect(snakeSpeed(g)).toBeGreaterThan(before);
    expect(g.events.some((e) => e.t === "snakeFaster")).toBe(true);
  });
  it("new numbers always come in at the start of the track, however long the train gets (never in the middle)", () => {
    const g = snake();
    for (let i = 0; i < 60 * 90; i++) {
      update(g, 1 / 60);
    }
    // (no hole: the train hangs together from the start of the track on)
    const train = snakeTrain(g);
    expect(Math.min(...train.map((n) => n.track!))).toBeLessThan(0);
    for (let i = 1; i < train.length; i++) expect(train[i - 1].track! - train[i].track!).toBeLessThan(SNAKE_GAP + 3);
  });
  it("a bomb in the train blows up the numbers round it", () => {
    const g = snake();
    const train = lay(g, 700);
    const bomb = train[4];
    bomb.bonus = "bomb";
    bomb.pickup = undefined;
    bomb.op = "add";
    const count = snakeTrain(g).length;
    expect(tapAt(g, bomb.x, bomb.y)).toBe(true);
    expect(snakeTrain(g).length).toBeLessThan(count - 2);
    expect(snakeTrain(g)[0].snakeHead).toBe(true);
    expect(g.snakeStun).toBe(0); // (far from the head)
    expect(g.snakeRecoil).toBeGreaterThan(SNAKE_RECOIL); // (it is pushed back, a little for every number blown away)
    const near = snakeTrain(g)[1];
    near.bonus = "bomb";
    near.pickup = undefined;
    expect(tapAt(g, near.x, near.y)).toBe(true);
    expect(g.snakeStun).toBeGreaterThan(0); // (next to the head: it is dizzy)
  });
  it("a new level does not start the snake over: the same head and the same numbers go on", () => {
    const g = snake();
    lay(g, 900);
    const oldHead = snakeTrain(g)[0];
    const kept = snakeTrain(g).slice(1, 12);
    while (levelOfGame(g) === 1 && endlessCupsBefore(2) > g.level) g.level++;
    g.level = endlessCupsBefore(2); // (one perfect 10 left for level 2)
    for (const c of g.cups) c.value = 6;
    const n = snakeTrain(g).find((m) => !m.snakeHead && m.op === "add" && !m.pickup && !m.bonus)!;
    n.v = 4;
    n.op = "add";
    expect(tapAt(g, n.x, n.y)).toBe(true);
    for (let i = 0; i < 180 && levelOfGame(g) === 1; i++) update(g, 1 / 60);
    expect(levelOfGame(g)).toBe(2);
    for (let i = 0; i < 5; i++) update(g, 1 / 60);
    const head = snakeTrain(g)[0];
    expect(head).toBe(oldHead);
    expect(head.track!).toBeGreaterThan(800);
    expect(snakeTrain(g).filter((m) => kept.includes(m)).length).toBeGreaterThan(5);
  });
  it("sends more bombs the more steel there is in the train", () => {
    const g = snake();
    expect(snakeBombChance(g)).toBe(0);
    snakeTrain(g).slice(1, 7).forEach((n) => (n.op = "steel"));
    expect(snakeBombChance(g)).toBeGreaterThan(0.15);
  });
  it("steel cannot be tapped", () => {
    const g = snake();
    const train = lay(g, 700);
    const n = train[2];
    n.op = "steel";
    for (let k = 0; k < 5; k++) tapAt(g, n.x, n.y);
    expect(g.numbers.includes(n)).toBe(true);
    expect(n.track).not.toBeUndefined();
  });

  it("sends a heart now and then while a cup is dead (one at a time), and it brings the cup back", () => {
    const g = snake();
    const train = lay(g, 700);
    g.cups[1].dead = true;
    // (the next number to come in: the start of the track is cleared, and the chance is made sure)
    g.numbers = g.numbers.filter((n) => n.track === undefined || n.track >= 0);
    g.rng = () => 0.01;
    update(g, 1 / 60);
    expect(g.numbers.filter((n) => n.bonus === "life")).toHaveLength(1);
    g.numbers = g.numbers.filter((n) => n.bonus === "life" || n.track === undefined || n.track >= -SNAKE_GAP * 0.5);
    for (let i = 0; i < 3; i++) update(g, 1 / 60);
    expect(g.numbers.filter((n) => n.bonus === "life")).toHaveLength(1); // (never two at a time)
    void train;
    const heart = g.numbers.find((n) => n.bonus === "life")!;
    heart.track = 400;
    update(g, 1 / 600);
    expect(tapAt(g, heart.x, heart.y)).toBe(true);
    for (let i = 0; i < 180 && g.cups[1].dead; i++) update(g, 1 / 60);
    expect(g.cups[1].dead).toBe(false);
  });

  it("with a gap in the train the head slides back to the rest, which stays where it is until they meet", () => {
    const g = snake();
    const train = lay(g, 900);
    const rear = train[4];
    const p = snakePoint(g, train[3].track!);
    expect(tapAt(g, p.x, p.y)).toBe(true);
    const headAt = train[0].track!;
    const rearAt = rear.track!;
    for (let i = 0; i < 10; i++) update(g, 1 / 60);
    expect(train[0].track!).toBeLessThan(headAt);
    expect(rear.track!).toBeCloseTo(rearAt, 1);
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(train[2].track! - rear.track!).toBeCloseTo(SNAKE_GAP, 0);
    expect(rear.track!).toBeGreaterThan(rearAt); // (together again: it all goes on)
  });
  it("a bomb that the blast of another reaches goes off too, a moment later", () => {
    const g = snake();
    const train = lay(g, 900);
    for (const k of [4, 5]) {
      train[k].bonus = "bomb";
      train[k].pickup = undefined;
      train[k].op = "add";
    }
    g.events = [];
    expect(tapAt(g, train[4].x, train[4].y)).toBe(true);
    expect(train[5].fuse).toBeGreaterThan(0);
    expect(g.events.some((e) => e.t === "bombChain")).toBe(true);
    for (let i = 0; i < 30; i++) update(g, 1 / 60);
    expect(g.numbers.includes(train[5])).toBe(false);
  });
  it("ice cracks at the first tap and the number goes at the next; a chained number takes its mate along", () => {
    const g = snake();
    const train = lay(g, 900);
    const n = train[3];
    n.ice = 1;
    tapAt(g, n.x, n.y);
    expect(n.track).not.toBeUndefined();
    expect(n.ice).toBe(0);
    tapAt(g, n.x, n.y);
    expect(n.state).toBe("dive");
    const a = train[6];
    const b = train[7];
    a.chain = b.id;
    b.chain = a.id;
    update(g, 1 / 600);
    tapAt(g, a.x, a.y);
    expect(a.state).toBe("dive");
    expect(b.state).toBe("dive");
  });
  it("is red and angry after a perfect 10 has faded, until the next perfect 10", () => {
    const g = snake();
    g.snakeBoost = 1;
    for (const c of g.cups) c.value = 6;
    const train = lay(g, 900);
    const n = train.find((m) => !m.snakeHead && m.op === "add" && !m.pickup && !m.bonus)!;
    n.v = 4;
    tapAt(g, n.x, n.y);
    for (let i = 0; i < 120 && g.snakeBoost > 0; i++) update(g, 1 / 60);
    expect(g.snakeBoost).toBe(0);
  });
  it("the screen that wipes the numbers away does not take the head", () => {
    const g = snake();
    const train = lay(g, 300);
    g.screens = 1;
    useScreen(g);
    for (let i = 0; i < 60 * 3; i++) update(g, 1 / 60);
    expect(g.numbers.includes(train[0])).toBe(true);
  });
  it("a gap at the start of the track also makes the rest stand still (it does not rush in from off the screen)", () => {
    const g = snake();
    const train = lay(g, 3 * SNAKE_GAP + 10);
    // (the number that is taken is the last on the screen: the ones behind it are still off the screen, before the start)
    const n = train.find((m) => m.track! > 0 && m.track! < SNAKE_GAP)!;
    const rear = train[train.indexOf(n) + 1];
    expect(rear.track!).toBeLessThan(0);
    const p = snakePoint(g, n.track!);
    expect(tapAt(g, p.x, p.y)).toBe(true);
    const r0 = rear.track!;
    for (let i = 0; i < 10; i++) update(g, 1 / 60);
    expect(rear.track!).toBeCloseTo(r0, 1);
  });
  it("a ghost number turns into another number every few seconds", () => {
    const g = snake();
    const train = lay(g, 700);
    const n = train[3];
    n.v = 2;
    n.shift = 0.1;
    for (let i = 0; i < 12; i++) update(g, 1 / 60);
    expect(n.v).not.toBe(2);
    expect(n.shift).toBeGreaterThan(SNAKE_GHOST_EVERY - 0.5);
  });

  it("a snake that has gone back to the start of the track with a gap in it comes together again and goes on", () => {
    const g = snake();
    const train = lay(g, 200);
    const p = snakePoint(g, train[2].track!);
    tapAt(g, p.x, p.y);
    g.snakeBack = 6;
    for (let i = 0; i < 60 * 6; i++) update(g, 1 / 60);
    for (let i = 0; i < 60 * 5; i++) update(g, 1 / 60);
    expect(snakeTrain(g)[0].track!).toBeGreaterThan(60);
  });
  it("two numbers that meet and make 10 melt into a golden 10", () => {
    const g = snake();
    const train = lay(g, 700);
    train[1].v = 4;
    train[2].v = 5;
    train[3].v = 6;
    const p = snakePoint(g, train[2].track!);
    expect(tapAt(g, p.x, p.y)).toBe(true);
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(train[1].gold).toBe(true);
    expect(train[1].op).toBe("ten");
    expect(g.numbers.includes(train[3])).toBe(false);
  });
  it("the head cannot be taken, nor steel; and the head kills the cup it gets to", () => {
    const g = snake();
    const train = lay(g, 700);
    const head = train[0];
    train[1].op = "steel";
    for (const n of [head, train[1]]) {
      const p = snakePoint(g, n.track!);
      tapAt(g, p.x, p.y);
      expect(n.track).not.toBeUndefined();
    }
    lay(g, snakeLength(g) - 1);
    for (let i = 0; i < 180 && !g.cups.some((c) => c.dead); i++) update(g, 1 / 60);
    expect(g.cups.filter((c) => c.dead)).toHaveLength(1);
  });
  it("a back ball sends the train back, and a slow ball slows it down", () => {
    const g = snake();
    const train = lay(g, 700);
    train[1].pickup = "back";
    let p = snakePoint(g, train[1].track!);
    tapAt(g, p.x, p.y);
    const at = train[0].track!;
    for (let i = 0; i < 30; i++) update(g, 1 / 60);
    expect(train[0].track!).toBeLessThan(at);
    g.snakeBack = 0;
    train[2].pickup = "slow";
    p = snakePoint(g, train[2].track!);
    tapAt(g, p.x, p.y);
    const from = train[0].track!;
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(train[0].track! - from).toBeLessThan(snakeSpeed(g) * 0.5);
  });
  it("the head of every tenth level is a boss: it pops after three taps", () => {
    const g = snake();
    expect(snakeTrain(g)[0].boss).toBeUndefined();
    const h = testGame(() => 0.3);
    startVariant(h, "snake");
    h.countdown = 0;
    while (levelOfGame(h) < 10) h.level++;
    update(h, 1 / 60);
    const head = lay(h, 700)[0];
    expect(head.boss).toEqual({hp: SNAKE_BOSS_HP, max: SNAKE_BOSS_HP});
    for (let k = 0; k < SNAKE_BOSS_HP; k++) {
      const p = snakePoint(h, head.track!);
      tapAt(h, p.x, p.y);
    }
    expect(h.numbers.includes(head)).toBe(false);
  });
});
import {snakeTrain, snakeTrainLength, snakeSpeed, snakePoint, snakeLength, SNAKE_GAP, SNAKE_BOSS_HP, snakeBombChance, SNAKE_RECOIL, SNAKE_GHOST_EVERY, endlessLevel as levelOfGame} from "./engine";

describe("the fighter jet loses a weapon step when a perfect 10 fades off the bar", () => {
  it("takes one upgrade off the way with the most, and the weapon when it has none left", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "jet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    g.level = 4;
    g.jetWeapons.a = "bullet";
    g.jetLv.a = 2;
    g.jetWeapons.c = "rapid";
    g.jetLv.c = 1;
    g.drain = FADE_STEPS - 1;
    g.drainClock = 0;
    g.events = [];
    for (let i = 0; i < 60 * 30 && g.drain < FADE_STEPS; i++) update(g, 1 / 60);
    expect(g.jetLv.a).toBe(1);
    expect(g.jetLv.c).toBe(1);
    expect(g.events.some((e) => e.t === "weaponDown")).toBe(true);
    jetWeaponDown(g);
    jetWeaponDown(g);
    expect(g.jetWeapons).toEqual({a: null, b: null, c: null});
  });
});
import {jetWeaponDown, FADE_TICKS as FADE_STEPS} from "./engine";

describe("the daily ladder, with each match mode", () => {
  it("brings no bonus balls, no new kinds of number and no presentations into any of them, and plays without trouble", () => {
    const modes = ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "cannon", "line"] as const;
    for (const mode of modes) {
      let day = "";
      for (let d = 0; d < 3000 && !day; d++) {
        const k = new Date(Date.UTC(2026, 0, 1) + d * 864e5).toISOString().slice(0, 10);
        if (dailyMixOf(k) === mode) day = k;
      }
      expect(day).not.toBe("");
      const g = testGame(() => 0.5);
      startDaily(g, day);
      let seed = 7;
      g.rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      expect(featureAge(g, "zero")).toBe(-1);
      for (let i = 0; i < 60 * 40 && g.phase !== "over"; i++) {
        if (g.phase === "perk") choosePerk(g, 0);
        update(g, 1 / 60);
        const n = g.numbers.find((m) => m.state === "fall" && m.y > 40);
        if (n && i % 20 === 0) tapAt(g, n.x, n.y);
        for (const m of g.numbers) {
          // (only the snake and Shield up have balls of their own: bombs and hearts in its train)
          if (m.bonus) expect(`${mode}:${m.bonus}:${m.state}:${m.track}`).toMatch(/^(snake:|shield:shield:)/); // (and Shield up its own shield ball)
        }
      }
      expect(g.showcase).toHaveLength(0);
    }
  });
});

describe("the cannon", () => {
  function cannon(): GameState {
    const g = testGame(() => 0.5);
    startVariant(g, "cannon");
    g.countdown = 0;
    update(g, 1 / 60);
    return g;
  }
  /** Fires the ball in the cannon at (x, y) and runs the game until it has stuck (and what it makes has popped). */
  function shoot(g: GameState, x: number, y: number, v: number): void {
    g.cannonNow = v;
    aimCannon(g, x, y);
    expect(fireCannon(g)).toBe(true);
    for (let i = 0; i < 120 && (g.cannonShot || g.bubbles.some((b) => b.glow !== undefined) || g.cannonCheck.length > 0); i++) update(g, 1 / 60);
  }
  it("starts with a swarm at the top, a ball in the cannon and the next one", () => {
    const g = cannon();
    expect(g.bubbles.length).toBe(5 * CANNON_COLS);
    expect(g.cannonNow).toBeGreaterThan(0);
    expect(g.cannonNext).toBeGreaterThan(0);
  });
  it("a ball that makes 10 with the ball it meets pops them both: that is a perfect 10", () => {
    const g = cannon();
    const target = g.bubbles.find((b) => b.c === 3 && b.r === 4)!;
    target.v = 6;
    for (const b of g.bubbles) if (b !== target && Math.abs(b.c - 3) + Math.abs(b.r - 4) === 1) b.v = 9;
    const before = g.level;
    shoot(g, bubbleX(3), bubbleY(4), 4);
    expect(g.bubbles.includes(target)).toBe(false);
    expect(g.level).toBe(before + 1);
  });
  it("a ball that makes no 10 stays in the swarm", () => {
    const g = cannon();
    for (const b of g.bubbles) b.v = 9;
    const count = g.bubbles.length;
    shoot(g, bubbleX(3), bubbleY(4), 5);
    expect(g.bubbles.length).toBe(count + 1);
  });
  it("after a pop the columns close up, and balls that now touch and make 10 pop too (a chain)", () => {
    const g = cannon();
    for (const b of g.bubbles) b.v = 9;
    // column 3: ... 9, [r3] 2, [r4] 6 ; column 4 at row 3: 8 (2 + 8 = 10 once the 2 has moved up next to it? it is already next to it)
    const at = (c: number, r: number) => g.bubbles.find((b) => b.c === c && b.r === r)!;
    at(3, 4).v = 6; // (pops with the 4 that is shot)
    at(3, 3).v = 1;
    at(4, 3).v = 9; // (1 + 9 = 10: but they already touch, so it is not looked at until something moves)
    const before = g.level;
    shoot(g, bubbleX(3), bubbleY(4), 4);
    expect(g.level).toBeGreaterThanOrEqual(before + 1);
  });
  it("helpers: a star becomes the number that makes 10 and pops; a bolt and a bomb blow balls away", () => {
    const g = cannon();
    for (const b of g.bubbles) b.v = 9;
    const t = g.bubbles.find((b) => b.c === 3 && b.r === 4)!;
    t.v = 3;
    g.cannonNowKind = "star";
    const level = g.level;
    shoot(g, bubbleX(3), bubbleY(4), 1);
    expect(g.bubbles.includes(t)).toBe(false);
    expect(g.level).toBe(level + 1);
    const h = cannon();
    const count = h.bubbles.length;
    h.cannonNowKind = "bolt";
    shoot(h, bubbleX(3), bubbleY(4), 1);
    expect(h.bubbles.length).toBeLessThanOrEqual(count - CANNON_BOLT_HITS);
    const k = cannon();
    for (const b of k.bubbles) b.v = 9;
    const n = k.bubbles.length;
    k.cannonNowKind = "bomb";
    shoot(k, bubbleX(3), bubbleY(4), 1);
    expect(k.bubbles.length).toBeLessThan(n - 2);
  });
  it("a laser clears the whole row and the whole column where it sticks", () => {
    const g = cannon();
    for (const b of g.bubbles) b.v = 9;
    g.cannonNowKind = "laser";
    shoot(g, bubbleX(3), bubbleY(4), 1);
    // (it stuck under the ball at column 3, row 4: row 5 had nothing else, and column 3 had five balls)
    expect(g.bubbles.filter((b) => b.c === 3)).toHaveLength(0);
  });

  it("a magnet mixes up the numbers round it and looks at them all for a 10", () => {
    const g = cannon();
    const before = g.bubbles.filter((b) => Math.abs(b.c - 3) <= 2).map((b) => b.v).sort().join(",");
    g.cannonNowKind = "magnet";
    g.events = [];
    shoot(g, bubbleX(3), bubbleY(4), 1);
    expect(g.events.some((e) => e.t === "magnet")).toBe(true);
    // (no ball is lost by the magnet itself: only what makes 10 pops)
    const after = g.bubbles.filter((b) => Math.abs(b.c - 3) <= 2).map((b) => b.v).sort().join(",");
    expect(after.length).toBeGreaterThan(0);
    void before;
  });

  it("the swarm comes down a row now and then, and it is over when it reaches the cannon", () => {
    const g = cannon();
    const rows = Math.max(...g.bubbles.map((b) => b.r));
    g.cannonRow = 0.001;
    update(g, 1 / 60);
    expect(Math.max(...g.bubbles.map((b) => b.r))).toBe(rows + 1);
    for (let i = 0; i < 20 && g.phase === "play"; i++) {
      g.cannonRow = 0.001;
      update(g, 1 / 60);
    }
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("swarm");
  });
});
import {aimCannon, fireCannon, bubbleX, bubbleY, CANNON_COLS, CANNON_BOLT_HITS} from "./engine";

describe("draw to 10", () => {
  function board(): GameState {
    const g = testGame(() => 0.5);
    startVariant(g, "line");
    g.countdown = 0;
    update(g, 1 / 60);
    return g;
  }
  const at = (g: GameState, c: number, r: number) => g.tiles.find((t) => t.c === c && t.r === r)!;
  const set = (g: GameState, c: number, r: number, v: number, op: "add" | "mul" | "div" = "add") => {
    const t = at(g, c, r);
    t.v = v;
    t.op = op;
    t.kind = undefined;
    t.ice = 0;
    return t;
  };
  /** Draws a line through the tiles (column, row) in this order, and lets go. */
  function draw(g: GameState, cells: [number, number][]): boolean {
    lineStart(g, tileX(cells[0][0]), tileY(cells[0][1]));
    for (const [c, r] of cells.slice(1)) lineMove(g, tileX(c), tileY(r));
    return lineEnd(g);
  }
  it("has no cups, a full board and a clock", () => {
    const g = board();
    expect(g.cups).toHaveLength(0);
    expect(g.tiles).toHaveLength(LINE_COLS * LINE_ROWS);
    expect(g.lineTime).toBeGreaterThan(50);
  });
  it("counts in the order the line is drawn: 3, times 2, plus 4 is 10, but 4, times 2, plus 3 is 11", () => {
    const g = board();
    set(g, 0, 7, 3);
    set(g, 1, 7, 2, "mul");
    set(g, 2, 7, 4);
    lineStart(g, tileX(0), tileY(7));
    lineMove(g, tileX(1), tileY(7));
    lineMove(g, tileX(2), tileY(7));
    expect(lineValue(g)).toBe(10);
    g.linePath = [at(g, 2, 7).id, at(g, 1, 7).id, at(g, 0, 7).id];
    expect(lineValue(g)).toBe(11);
  });
  it("a line that makes 10 pops (a perfect 10, points and time back), the tiles fall and new ones come; one that does not, does nothing", () => {
    const g = board();
    set(g, 0, 7, 9);
    set(g, 1, 7, 2);
    expect(draw(g, [[0, 7], [1, 7]])).toBe(false);
    expect(g.tiles).toHaveLength(LINE_COLS * LINE_ROWS);
    set(g, 1, 7, 1);
    g.lineTime = 30;
    const level = g.level;
    expect(draw(g, [[0, 7], [1, 7]])).toBe(true);
    expect(g.level).toBe(level + 1);
    expect(g.score).toBeGreaterThan(0);
    expect(g.lineTime).toBeGreaterThan(30);
    expect(g.tiles).toHaveLength(LINE_COLS * LINE_ROWS);
  });
  it("goes across too, and back onto the tile before takes the last one off", () => {
    const g = board();
    set(g, 0, 0, 4);
    set(g, 1, 1, 6);
    lineStart(g, tileX(0), tileY(0));
    lineMove(g, tileX(1), tileY(1));
    expect(g.linePath).toHaveLength(2);
    lineMove(g, tileX(0), tileY(0));
    expect(g.linePath).toHaveLength(1);
  });
  it("steel cannot be drawn through, and a 10 next to it breaks it; a bomb in the line blows up the tiles round it", () => {
    const g = board();
    set(g, 0, 7, 4);
    set(g, 1, 7, 6);
    const steel = at(g, 0, 6);
    steel.kind = "steel";
    lineStart(g, tileX(0), tileY(6));
    expect(g.linePath).toHaveLength(0);
    const id = steel.id;
    expect(draw(g, [[0, 7], [1, 7]])).toBe(true);
    expect(g.tiles.some((t) => t.id === id)).toBe(false);
    const h = board();
    set(h, 2, 4, 3);
    const bomb = at(h, 3, 4);
    bomb.kind = "bomb";
    set(h, 4, 4, 7);
    const near = at(h, 3, 3).id;
    expect(draw(h, [[2, 4], [3, 4], [4, 4]])).toBe(true);
    expect(h.tiles.some((t) => t.id === near)).toBe(false);
  });
  it("a bolt in a line that makes 10 electrifies some tiles of the board: they are gone too", () => {
    const g = board();
    set(g, 0, 7, 4);
    const bolt = at(g, 1, 7);
    bolt.kind = "bolt";
    set(g, 2, 7, 6);
    const helpersBefore = g.tiles.filter((t) => t.kind && t !== bolt).map((t) => ({x: tileX(t.c), y: tileY(t.r)}));
    g.events = [];
    expect(draw(g, [[0, 7], [1, 7], [2, 7]])).toBe(true);
    const zap = g.events.find((e) => e.t === "lineBolt");
    expect(zap && zap.t === "lineBolt" && zap.hits.length).toBe(LINE_BOLT_HITS);
    // (the helpers of the board are not electrified)
    expect(zap && zap.t === "lineBolt" && zap.hits.every((h) => !helpersBefore.some((p) => p.x === h.x && p.y === h.y))).toBe(true);
    expect(g.tiles).toHaveLength(LINE_COLS * LINE_ROWS);
  });
  it("on the first levels, when the time is low, a line that makes 10 is shown (and it really makes 10); later it is not", () => {
    const g = board();
    set(g, 0, 7, 3);
    set(g, 1, 7, 7);
    g.lineTime = 9;
    update(g, 1 / 60);
    expect(g.lineHint.length).toBeGreaterThanOrEqual(2);
    expect(lineValue(g, g.lineHint)).toBe(10);
    g.lineTime = 30;
    update(g, 1 / 60);
    expect(g.lineHint).toHaveLength(0);
    while (levelOfGame(g) <= 3) g.level++;
    g.lineTime = 9;
    update(g, 1 / 60);
    expect(g.lineHint).toHaveLength(0);
  });
  it("a line that comes to minus 10 counts as a 10 too", () => {
    const g = board();
    set(g, 0, 7, -4);
    set(g, 1, 7, -6);
    const level = g.level;
    expect(draw(g, [[0, 7], [1, 7]])).toBe(true);
    expect(g.level).toBe(level + 1);
  });
  it("a laser in a line that makes 10 clears its whole row and column", () => {
    const g = board();
    set(g, 0, 7, 4);
    const laser = at(g, 1, 7);
    laser.kind = "laser";
    set(g, 2, 7, 6);
    for (const t of g.tiles) if (t !== laser && (t.c === 1 || t.r === 7) && t.kind && t.kind !== "steel") t.kind = undefined;
    const ids = g.tiles.filter((t) => t.c === 1 || t.r === 7).map((t) => t.id);
    expect(draw(g, [[0, 7], [1, 7], [2, 7]])).toBe(true);
    expect(g.tiles.some((t) => ids.includes(t.id))).toBe(false);
    expect(g.tiles).toHaveLength(LINE_COLS * LINE_ROWS);
  });
  it("a star last in the line makes it 10", () => {
    const g = board();
    set(g, 0, 7, 3);
    const star = at(g, 1, 7);
    star.kind = "star";
    g.linePath = [at(g, 0, 7).id, star.id];
    expect(lineValue(g)).toBe(10);
    g.linePath = [star.id, at(g, 0, 7).id]; // (first in the line: worth nothing)
    expect(lineValue(g)).toBe(3);
  });

  it("after a long line, tiles that fall into a 10 next to each other pop on their own: a chain", () => {
    const g = board();
    for (const t of g.tiles) {
      t.kind = undefined;
      t.ice = 0;
      t.op = "add";
      t.v = 9;
    }
    // (a line of four along the bottom row: 1 + 2 + 3 + 4; over it, in the first two columns, a 4 and a 6 that will fall into the bottom row side by side)
    [1, 2, 3, 4].forEach((v, c) => (at(g, c, 7).v = v));
    at(g, 0, 6).v = 4;
    at(g, 1, 6).v = 6;
    const level = g.level;
    expect(draw(g, [[0, 7], [1, 7], [2, 7], [3, 7]])).toBe(true);
    for (let i = 0; i < 60; i++) update(g, 1 / 60);
    expect(g.level).toBeGreaterThanOrEqual(level + 2);
  });

  it("a tap on a tile in ice cracks the ice, and then it can be drawn through", () => {
    const g = board();
    const t = set(g, 2, 3, 5);
    t.ice = 1;
    lineStart(g, tileX(2), tileY(3));
    expect(t.ice).toBe(0);
    expect(g.linePath).toHaveLength(0);
    lineEnd(g);
    lineStart(g, tileX(2), tileY(3));
    expect(g.linePath).toEqual([t.id]);
  });
  it("shows how many numbers made the 10 (from three on)", () => {
    const g = board();
    set(g, 0, 7, 3);
    set(g, 1, 7, 2, "mul");
    set(g, 2, 7, 4);
    expect(draw(g, [[0, 7], [1, 7], [2, 7]])).toBe(true);
    expect(g.eqFx?.n).toBe(3);
  });

  it("is over when the time runs out", () => {
    const g = board();
    g.lineTime = 0.5;
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("time");
  });
});
import {lineStart, lineMove, lineEnd, lineValue, tileX, tileY, LINE_COLS, LINE_ROWS, LINE_BOLT_HITS} from "./engine";

describe("carrying on after the ad, in the modes that are not lost through a cup", () => {
  it("Draw to 10 gets time again, the cannon a swarm clear of it, and the comet belt its lives: none of them is over again at once", () => {
    for (const mode of ["line", "cannon", "comet"] as const) {
      const g = testGame(() => 0.5);
      startVariant(g, mode);
      g.countdown = 0;
      update(g, 1 / 60);
      if (mode === "line") g.lineTime = 0.01;
      if (mode === "cannon") for (let i = 0; i < 20 && g.phase === "play"; i++) {
        g.cannonRow = 0.001;
        update(g, 1 / 60);
      }
      if (mode === "comet") {
        g.shipHp = 1;
        moveShield(g, 100, 400);
        const n = drop(g, 100, 380, 0);
        n.comet = true;
      }
      for (let i = 0; i < 30 && g.phase === "play"; i++) update(g, 1 / 60);
      expect(g.phase).toBe("over");
      expect(continueGame(g)).toBe(true);
      for (let i = 0; i < 60; i++) update(g, 1 / 60);
      expect(`${mode}:${g.phase}`).toBe(`${mode}:play`);
    }
  });
});

describe("the perks of the daily ladder, in each match mode", () => {
  it("offers only perks that do something in the match mode of the day", () => {
    const modes = ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "cannon", "line"] as const;
    for (const mode of modes) {
      let day = "";
      for (let d = 0; d < 3000 && !day; d++) {
        const k = new Date(Date.UTC(2026, 0, 1) + d * 864e5).toISOString().slice(0, 10);
        if (dailyMixOf(k) === mode) day = k;
      }
      const g = testGame(() => 0.5);
      startDaily(g, day);
      const fits = (p: string) => perkFits(g, p as never);
      for (const p of ["bonus", "special", "help"]) expect(`${mode}:${p}:${fits(p)}`).toBe(`${mode}:${p}:false`);
      expect(fits("points") && fits("slow")).toBe(true);
      expect(fits("time")).toBe(mode === "line");
      expect(fits("helpers")).toBe(mode === "cannon" || mode === "line");
      const cupless = mode === "cannon" || mode === "line";
      for (const p of ["shield", "gold", "thermos", "magnet", "big", "laser"]) expect(`${mode}:${p}:${fits(p)}`).toBe(`${mode}:${p}:${!cupless && (p === "shield" || mode !== "find")}`);
    }
  });
});
import {perkFits} from "./engine";

describe("the comet belt: moons", () => {
  it("now and then sends a moon, smaller than a planet; and holding the ship makes the time go twice as fast", () => {
    let a = 3;
    const g = testGame(() => ((a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296));
    startVariant(g, "comet");
    g.countdown = 0;
    while (levelOfGame(g) < 2) g.level++;
    moveShield(g, 20, 100);
    const seen: NumberTile[] = [];
    for (let i = 0; i < 60 * 60 && g.phase === "play"; i++) {
      g.jetShield = true;
      g.shipHp = 3;
      update(g, 1 / 60);
      for (const n of g.numbers) if (n.moon && !seen.includes(n)) seen.push(n);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((n) => (n.scale ?? 1) < PLANET_SCALE)).toBe(true);
    expect(COMET_HELD_PACE).toBe(2);
  });
});
import {PLANET_SCALE, COMET_HELD_PACE} from "./engine";

describe("fighter jet: skulls with a shield in front", () => {
  function guarded(): {g: GameState; n: NumberTile} {
    const g = testGame(() => 0.5);
    startVariant(g, "jet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    g.level = GUARD_FROM;
    update(g, 1 / 60);
    const n = drop(g, 180, 200, 99);
    n.op = "skull";
    n.guard = {hp: GUARD_HP, max: GUARD_HP, life: GUARD_LIFE};
    return {g, n};
  }
  it("the shield takes the shots from the front, and breaks; then the skull goes quickly", () => {
    const {g, n} = guarded();
    for (let k = 0; k < 4; k++) g.shots.push({x: 180, y: 240, vx: 0, vy: -620, missile: false, power: 1, age: 0, trail: [], bounces: 0, hit: []});
    for (let i = 0; i < 10; i++) update(g, 1 / 60);
    expect(g.numbers.includes(n)).toBe(true);
    expect(n.guard!.hp).toBeLessThan(GUARD_HP);
    expect(n.guard!.life).toBe(GUARD_LIFE);
    n.guard!.hp = 0;
    for (let k = 0; k < 2; k++) g.shots.push({x: 180, y: 240, vx: 0, vy: -620, missile: false, power: 1, age: 0, trail: [], bounces: 0, hit: []});
    for (let i = 0; i < 10; i++) update(g, 1 / 60);
    expect(g.numbers.includes(n)).toBe(false);
  });
  it("a missile gets round the shield", () => {
    const {g, n} = guarded();
    g.shots.push({x: 180, y: 240, vx: 0, vy: -400, missile: true, power: 1, age: 0, trail: []});
    for (let i = 0; i < 20 && g.numbers.includes(n); i++) update(g, 1 / 60);
    expect(g.numbers.includes(n)).toBe(false);
    expect(n.guard!.hp).toBe(GUARD_HP);
  });
  it("comes now and then from the tenth perfect 10 on, and falls slowly", () => {
    const g = testGame(() => 0.01);
    startVariant(g, "jet");
    g.countdown = 0;
    g.level = GUARD_FROM;
    // (all the weapons, and a shield: no weapon balls or shield balls come instead)
    g.jetWeapons = {a: "bullet", b: "missile", c: "rapid"};
    g.jetLv = {a: 3, b: 3, c: 3};
    g.jetShield = true;
    let found: NumberTile | undefined;
    for (let i = 0; i < 60 * 20 && !found; i++) {
      update(g, 1 / 60);
      found = g.numbers.find((n) => n.guard);
    }
    expect(found).toBeDefined();
  });
});
import {GUARD_FROM, GUARD_HP, GUARD_LIFE} from "./engine";

describe("fighter jet: flying to a new place", () => {
  it("does not shoot while it flies on its own to where the finger was put down, and shoots again once it is there", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "jet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    update(g, 1 / 60);
    holdCraft(g, true);
    flyCraftTo(g, 60, 300);
    g.shots = [];
    let flying = 0;
    for (let i = 0; i < 120 && g.craftTo; i++) {
      update(g, 1 / 60);
      flying++;
      if (g.craftTo) expect(g.shots).toHaveLength(0); // (on its way: no shots; the frame it gets there it may shoot)
    }
    expect(flying).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) update(g, 1 / 60);
    expect(g.shots.length).toBeGreaterThan(0);
  });
});
describe("fighter jet: heavy missiles", () => {
  it("from the fifteenth perfect 10 some missiles are heavy: they cannot be shot down", () => {
    const g = testGame(() => 0.0001);
    startVariant(g, "jet");
    g.countdown = 0;
    g.spawnTimer = 1e9;
    g.level = HEAVY_FROM;
    update(g, 1 / 60);
    const n = drop(g, 180, 200, 99);
    n.op = "skull";
    for (let i = 0; i < 60 && !g.enemyShots.some((e) => e.heavy); i++) update(g, 1 / 60);
    const heavy = g.enemyShots.find((e) => e.heavy)!;
    expect(heavy).toBeDefined();
    heavy.x = 180;
    heavy.y = 300;
    heavy.vx = 0;
    heavy.vy = 0;
    g.shots = [{x: 180, y: 330, vx: 0, vy: -620, missile: false, power: 1, age: 0, trail: [], bounces: 0, hit: []}];
    for (let i = 0; i < 6; i++) update(g, 1 / 60);
    expect(g.enemyShots.includes(heavy)).toBe(true);
  });
});
import {HEAVY_FROM} from "./engine";

describe("the match modes get harder every tenth level", () => {
  it("a step on level 10, another on 20; not in the endless game", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "save");
    expect(hardTier(g)).toBe(0);
    const ramp = variantRamp(g);
    while (levelOfGame(g) < 10) g.level++;
    expect(hardTier(g)).toBe(1);
    while (levelOfGame(g) < 20) g.level++;
    expect(hardTier(g)).toBe(2);
    g.level = 1;
    expect(variantRamp(g)).toBeCloseTo(ramp, 5);
    const e = testGame(() => 0.5);
    startGame(e, "endless");
    while (levelOfGame(e) < 10) e.level++;
    expect(hardTier(e)).toBe(0);
  });
});
import {hardTier} from "./engine";

describe("the mine", () => {
  function mine(): GameState {
    const g = testGame(() => 0.5);
    startVariant(g, "mine");
    g.countdown = 0;
    update(g, 1 / 60);
    // (the view where it is going to be, so that the taps land on the right blocks)
    for (let i = 0; i < 120; i++) update(g, 1 / 600);
    g.mineLava = -50;
    return g;
  }
  const tapCell = (g: GameState, c: number, r: number) => mineTap(g, mineX(c), mineY(g, r));
  const set = (g: GameState, c: number, r: number, v: number) => {
    g.mine[r][c] = {v, op: "add", dug: false};
  };
  it("has no cups; the miner starts on top, with an empty basket", () => {
    const g = mine();
    expect(g.cups).toHaveLength(0);
    expect(g.miner.r).toBe(0);
    expect(g.mineSum).toBe(0);
  });
  it("digs only next to him (to a side, or under him); the number goes into the basket and he steps in", () => {
    const g = mine();
    const {c} = g.miner;
    set(g, c, 2, 5);
    expect(tapCell(g, c, 2)).toBe(false);
    set(g, c, 1, 4);
    set(g, c, 2, 9);
    expect(tapCell(g, c, 1)).toBe(true);
    expect(g.mineSum).toBe(4);
    expect(g.miner.r).toBe(1);
  });
  it("exactly 10 in the basket is a perfect 10 (and the lava is pushed back); over 10 it tips over", () => {
    const g = mine();
    const {c} = g.miner;
    set(g, c, 1, 4);
    set(g, c, 2, 6);
    set(g, c, 3, 9);
    set(g, c, 4, 9);
    const level = g.level;
    const lava = g.mineLava;
    tapCell(g, c, 1);
    tapCell(g, c, 2);
    expect(g.level).toBe(level + 1);
    expect(g.mineSum).toBe(0);
    expect(g.mineLava).toBeLessThan(lava);
    expect(g.mineKeys).toBe(1); // (a perfect 10 gives a key)
    g.mineKeys = 0; // (as if the door had been opened: the numbers count again)
    // (9 and then 9: over 10, the basket tips over, the same every way)
    tapCell(g, c, 3);
    expect(g.mineSum).toBe(9);
    tapCell(g, c, 4);
    expect(g.mineSum).toBe(0);
    expect(g.level).toBe(level + 1);
    expect(g.mineDaze).toBeGreaterThan(0);
  });
  it("walls of steel with a locked door every few rows: a door opens with as many keys as it has locks (one for every perfect 10)", () => {
    const g = mine();
    const wall = Array.from({length: 40}, (_, r) => r).find((r) => gateRow(r))!;
    digOutTo(g, wall);
    const gates = g.mine[wall].map((cell, c) => ({cell, c})).filter((x) => x.cell.kind === "gate");
    expect(gates).toHaveLength(1);
    expect(g.mine[wall].filter((cell) => cell.kind === "steel")).toHaveLength(MINE_COLS - 1);
    expect(gates[0].cell.v).toBe(1); // (one lock on the first level)
    const {cell, c} = gates[0];
    g.miner = {c, r: wall - 1};
    g.mine[wall - 1][c].dug = true;
    for (let i = 0; i < 120; i++) update(g, 1 / 600);
    void cell;
    g.mineKeys = 0;
    expect(tapCell(g, c, wall)).toBe(false);
    g.mineKeys = 1;
    expect(tapCell(g, c, wall)).toBe(true);
    expect(g.mineKeys).toBe(0);
  });
  it("falls down through what is dug out under him; steel cannot be dug; a bomb blows up the blocks round it", () => {
    const g = mine();
    const {c} = g.miner;
    g.mine[2][c].dug = true;
    g.mine[3][c].dug = true;
    set(g, c, 1, 1);
    tapCell(g, c, 1);
    expect(g.miner.r).toBe(3);
    g.mine[4][c] = {v: 0, op: "add", kind: "steel", dug: false};
    expect(tapCell(g, c, 4)).toBe(false);
    g.mine[3][c + 1] = {v: 0, op: "add", kind: "bomb", dug: false};
    tapCell(g, c + 1, 3);
    expect(g.mine[4][c].dug).toBe(true);
  });
  it("a tap on the miner empties the basket; a block over him can be dug", () => {
    const g = mine();
    const {c} = g.miner;
    set(g, c, 1, 4);
    tapCell(g, c, 1);
    expect(g.mineSum).toBe(4);
    const lava = g.mineLava;
    expect(tapCell(g, g.miner.c, g.miner.r)).toBe(true);
    expect(g.mineSum).toBe(0);
    expect(g.mineLava).toBeGreaterThan(lava);
    // (over him: the earth next to the hole he came down by)
    set(g, c + 1, 0, 3);
    g.miner = {c: c + 1, r: 1};
    g.mine[1][c + 1].dug = true;
    expect(tapCell(g, c + 1, 0)).toBe(true);
    expect(g.mineSum).toBe(3);
    expect(g.miner.r).toBe(1);
  });
  it("with no way on at all it is over: no way down", () => {
    const g = mine();
    // (a row of tunnel, with steel all round it and under it, and an empty basket)
    const r = 3;
    for (let c = 0; c < MINE_COLS; c++) {
      g.mine[r][c].dug = true;
      g.mine[r - 1][c] = {v: 0, op: "add", kind: "steel", dug: false};
      g.mine[r + 1][c] = {v: 0, op: "add", kind: "steel", dug: false};
    }
    g.miner = {c: 3, r};
    g.mineSum = 0;
    expect(mineStuck(g)).toBe(true);
    g.mine[r + 1][5] = {v: 4, op: "add", dug: false};
    expect(mineStuck(g)).toBe(false);
  });

  it("with keys enough for the next door the numbers are blank: digging them puts nothing in the basket, until the door is opened", () => {
    const g = mine();
    const {c} = g.miner;
    g.mineKeys = 1;
    set(g, c, 1, 7);
    tapCell(g, c, 1);
    expect(g.mineSum).toBe(0);
    g.mineKeys = 0;
    set(g, c, 2, 7);
    tapCell(g, c, 2);
    expect(g.mineSum).toBe(7);
  });

  it("is over when the lava reaches the miner", () => {
    const g = mine();
    g.mineLava = g.miner.r + 0.3;
    for (let i = 0; i < 60 && g.phase === "play"; i++) update(g, 1 / 60);
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("lava");
  });
});
import {mineTap, mineX, mineY, gateRow, MINE_COLS, mineStuck} from "./engine";
/** The rows of the mine made as far down as row r (as the miner going down would). */
function digOutTo(g: GameState, r: number): void {
  const keep = g.miner.r;
  g.miner.r = r;
  mineTap(g, -1000, -1000);
  g.miner.r = keep;
}

describe("the mine: doors with two locks", () => {
  it("a door with two locks needs two keys, and the numbers stay until there are two", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "mine");
    g.countdown = 0;
    update(g, 1 / 60);
    const wall = Array.from({length: 40}, (_, r) => r).find((r) => gateRow(r))!;
    const door = g.mine[wall].find((cell) => cell.kind === "gate")!;
    door.v = 2;
    expect(nextLocks(g)).toBe(2);
    g.mineKeys = 1;
    expect(mineFree(g)).toBe(false);
    g.mineKeys = 2;
    expect(mineFree(g)).toBe(true);
  });
});
import {nextLocks, mineFree} from "./engine";


import {toolsOn} from "./engine";

describe("the cloth and the eraser in every match mode and the daily ladder", () => {
  const modes = ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "cannon", "line", "mine", "ninja"] as const;
  it("both can be used in every match mode, and the match modes start with a cloth", () => {
    for (const v of modes) {
      const g = testGame(() => 0.5);
      startVariant(g, v);
      g.countdown = 0;
      g.phase = "play";
      g.intro = [];
      update(g, 1 / 60);
      expect(toolsOn(g, "screen")).toBe(true);
      expect(toolsOn(g, "eraser")).toBe(true);
      expect(g.screens).toBe(1);
      expect(useScreen(g)).toBe(true);
      g.erasers = 1;
      expect(useEraser(g)).toBe(true);
    }
  });
  it("in the daily ladder too", () => {
    const g = testGame(() => 0.5);
    startDaily(g, "2026-01-28");
    expect(toolsOn(g, "screen")).toBe(true);
    expect(toolsOn(g, "eraser")).toBe(true);
  });
  it("the cloth wipes the low rows of the cannon", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "cannon");
    g.countdown = 0;
    update(g, 1 / 60);
    const rows = new Set(g.bubbles.map((b) => b.r)).size;
    useScreen(g);
    expect(new Set(g.bubbles.map((b) => b.r)).size).toBe(Math.max(0, rows - 3));
  });
});

describe("the mine: steel blown away", () => {
  it("can be walked on like any tunnel", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "mine");
    g.countdown = 0;
    update(g, 1 / 60);
    for (let i = 0; i < 120; i++) update(g, 1 / 600);
    g.mineLava = -50;
    const {c, r} = g.miner;
    g.mine[r][c + 1] = {v: 0, op: "add", kind: "steel", dug: true};
    g.mine[r + 1][c + 1] = {v: 0, op: "add", kind: "steel", dug: false};
    expect(mineTap(g, mineX(c + 1), mineY(g, r))).toBe(true);
    expect(g.miner.c).toBe(c + 1);
  });
});

import {ninjaStart, ninjaMove, ninjaEnd, NINJA_STRIKES} from "./engine";

describe("the ninja", () => {
  function ninja(): GameState {
    const g = testGame(() => 0.5);
    startVariant(g, "ninja");
    g.countdown = 0;
    update(g, 1 / 60);
    g.ninjaBalls = [];
    g.ninjaTimer = 99;
    return g;
  }
  const ball = (g: GameState, x: number, v: number, kind?: "bomb" | "star" | "clock" | "freeze") => {
    g.ninjaBalls.push({id: ++g.ninjaId, x, y: 300, vx: 0, vy: 0, v, kind, cut: false, spin: 0});
  };
  const swipe = (g: GameState, x1: number, x2: number) => {
    ninjaStart(g, x1, 300);
    for (let k = 1; k <= 20; k++) ninjaMove(g, x1 + ((x2 - x1) * k) / 20, 300);
    ninjaEnd(g);
  };
  it("has no cups; numbers cut in one swipe that make exactly 10 are a perfect 10", () => {
    const g = ninja();
    expect(g.cups).toHaveLength(0);
    ball(g, 100, 4);
    ball(g, 200, 6);
    const level = g.level;
    swipe(g, 50, 260);
    expect(g.ninjaBalls).toHaveLength(0);
    expect(g.level).toBe(level + 1);
    expect(g.ninjaStrikes).toBe(0);
  });
  it("over 10 is a cross, and so is a bomb; three crosses and it is over", () => {
    const g = ninja();
    ball(g, 100, 7);
    ball(g, 200, 8);
    swipe(g, 50, 260);
    expect(g.ninjaStrikes).toBe(1);
    ball(g, 150, 0, "bomb");
    swipe(g, 50, 260);
    expect(g.ninjaStrikes).toBe(2);
    ball(g, 150, 0, "bomb");
    swipe(g, 50, 260);
    expect(g.ninjaStrikes).toBe(NINJA_STRIKES);
    expect(g.phase).toBe("over");
    expect(g.overReason).toBe("ninja");
  });
  it("a stroke under 10 counts nothing; a star starts the star rain: numbers that make 10 come thick and fast, and no bombs", () => {
    const g = ninja();
    ball(g, 100, 3);
    const level = g.level;
    swipe(g, 50, 160);
    expect(g.level).toBe(level);
    expect(g.ninjaStrikes).toBe(0);
    ball(g, 200, 0, "star");
    swipe(g, 150, 260);
    expect(g.ninjaFrenzy).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) update(g, 1 / 60);
    expect(g.ninjaBalls.length).toBeGreaterThanOrEqual(6);
    expect(g.ninjaBalls.some((b) => b.kind === "bomb")).toBe(false);
  });
  it("throws balls up from the bottom, and the clock slows them", () => {
    const g = ninja();
    g.ninjaTimer = 0;
    update(g, 1 / 60);
    expect(g.ninjaBalls.length).toBeGreaterThan(0);
    const b = g.ninjaBalls[0];
    const y = b.y;
    update(g, 0.1);
    expect(b.y).toBeLessThan(y);
  });
});


import {dailyMixOf as mixOfDay, findOn as findPlayed, playedAs} from "./engine";

describe("the daily ladder played as Sequence 10, and the others", () => {
  const dayOf = (v: string) => {
    for (let d = 1; d < 400; d++) {
      const day = `2027-${String(1 + Math.floor((d - 1) / 28)).padStart(2, "0")}-${String(1 + ((d - 1) % 28)).padStart(2, "0")}`;
      if (mixOfDay(day) === v) return day;
    }
    throw new Error("no day for " + v);
  };
  it("Sequence 10 in the daily ladder: plain cups (nothing from the shop), and its clock runs", () => {
    const g = testGame(() => 0.5);
    g.loadout = [["big"], ["magnet"], [], []] as typeof g.loadout;
    startDaily(g, dayOf("find"));
    expect(findPlayed(g)).toBe(true);
    expect(g.cups.every((c) => c.kinds.length === 0 && !c.saucer)).toBe(true);
    for (let i = 0; i < 60 * 6; i++) update(g, 1 / 60);
    expect(g.findTotal).toBeGreaterThan(0);
    expect(g.findTimer).toBeLessThan(g.findTotal);
  });
  it("every match mode of the daily ladder is played as itself", () => {
    for (const v of ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "cannon", "line", "ninja"]) {
      const g = testGame(() => 0.5);
      startDaily(g, dayOf(v));
      expect(playedAs(g)).toBe(v);
      for (let i = 0; i < 60 * 8; i++) update(g, 1 / 60);
      expect(["play", "over", "intro"]).toContain(g.phase);
    }
  });
});

describe("the ninja: golden numbers", () => {
  it("a golden number that falls out uncut is a cross; a plain one is not", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "ninja");
    g.countdown = 0;
    update(g, 1 / 60);
    g.ninjaTimer = 99;
    g.ninjaBalls = [
      {id: 1, x: 100, y: 690, vx: 0, vy: 50, v: 3, cut: false, spin: 0},
      {id: 2, x: 200, y: 690, vx: 0, vy: 50, v: 4, cut: false, spin: 0, must: true},
    ];
    update(g, 0.2);
    expect(g.ninjaBalls).toHaveLength(0);
    expect(g.ninjaStrikes).toBe(1);
  });
});

describe("the ninja: shells", () => {
  it("a number in steel or ice takes two swipes: the first takes the shell off, the second cuts it", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "ninja");
    g.countdown = 0;
    update(g, 1 / 60);
    g.ninjaTimer = 99;
    for (const shell of ["steel", "ice"] as const) {
      g.ninjaBalls = [{id: 50, x: 150, y: 300, vx: 0, vy: 0, v: 3, cut: false, spin: 0, shell}];
      ninjaStart(g, 50, 300);
      for (let k = 1; k <= 20; k++) ninjaMove(g, 50 + k * 10, 300);
      ninjaEnd(g);
      expect(g.ninjaBalls).toHaveLength(1);
      expect(g.ninjaBalls[0].shell).toBeUndefined();
      const b = g.ninjaBalls[0];
      b.x = 150;
      b.y = 300;
      ninjaStart(g, 50, 300);
      for (let k = 1; k <= 20; k++) ninjaMove(g, 50 + k * 10, 300);
      ninjaEnd(g);
      expect(g.ninjaBalls).toHaveLength(0);
    }
  });
});

describe("the ninja: hearts", () => {
  it("a heart cut takes a cross away", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "ninja");
    g.countdown = 0;
    update(g, 1 / 60);
    g.ninjaTimer = 99;
    g.ninjaStrikes = 2;
    g.ninjaBalls = [{id: 60, x: 150, y: 300, vx: 0, vy: 0, v: 0, kind: "heart", cut: false, spin: 0}];
    ninjaStart(g, 50, 300);
    for (let k = 1; k <= 20; k++) ninjaMove(g, 50 + k * 10, 300);
    ninjaEnd(g);
    expect(g.ninjaStrikes).toBe(1);
  });
});

import {ninjaMult} from "./engine";

describe("the ninja: combo", () => {
  it("three perfect 10s in a row make the points ×2, six ×3; a cross starts it over", () => {
    const g = testGame(() => 0.5);
    startVariant(g, "ninja");
    g.countdown = 0;
    update(g, 1 / 60);
    g.ninjaTimer = 99;
    const ten = () => {
      g.ninjaBalls = [{id: ++g.ninjaId, x: 150, y: 300, vx: 0, vy: 0, v: 10, cut: false, spin: 0}];
      ninjaStart(g, 50, 300);
      for (let k = 1; k <= 20; k++) ninjaMove(g, 50 + k * 10, 300);
      ninjaEnd(g);
    };
    expect(ninjaMult(g)).toBe(1);
    for (let k = 0; k < 3; k++) ten();
    expect(ninjaMult(g)).toBe(2);
    for (let k = 0; k < 3; k++) ten();
    expect(ninjaMult(g)).toBe(3);
    g.ninjaBalls = [{id: ++g.ninjaId, x: 150, y: 300, vx: 0, vy: 0, v: 0, kind: "bomb", cut: false, spin: 0}];
    ninjaStart(g, 50, 300);
    for (let k = 1; k <= 20; k++) ninjaMove(g, 50 + k * 10, 300);
    ninjaEnd(g);
    expect(ninjaMult(g)).toBe(1);
  });
});
