import {COLS, CUP_H, CUP_START_Y, CUP_W, MISS_Y, TAP_RADIUS, TARGET, W} from "./constants";
import type {Cup, GameOverReason, GameState, NumberTile} from "./types";

// ---- Difficulty -----------------------------------------------------------------------

/** How fast the numbers drift down (game units per second). */
export function fallSpeed(level: number): number {
  return Math.min(150, 42 + (level - 1) * 9);
}

/** Seconds between new numbers. */
export function spawnInterval(level: number): number {
  return Math.max(0.7, 1.7 - (level - 1) * 0.08);
}

/** The biggest number that can fall at this level (1..9). */
export function maxNumber(level: number): number {
  return Math.min(9, 3 + level);
}

// ---- Creating and restarting ----------------------------------------------------------

export function createGame(rng: () => number = Math.random, best = 0): GameState {
  const g: GameState = {
    phase: "menu",
    cups: [],
    numbers: [],
    level: 1,
    score: 0,
    best,
    newBest: false,
    spawnTimer: 0.6,
    overTimer: 0,
    overReason: null,
    banner: 0,
    shake: 0,
    time: 0,
    nextId: 1,
    events: [],
    rng,
  };
  // The menu shows four cups with some coffee in them, steaming.
  resetCups(g, [2, 5, 7, 9]);
  return g;
}

function resetCups(g: GameState, values?: number[]): void {
  g.cups = COLS.map((x, i): Cup => ({
    id: g.nextId++,
    x,
    y: CUP_START_Y,
    value: values?.[i] ?? 0,
    dead: false,
    bump: 0,
    ripple: 0,
    showTen: 0,
    flash: 0,
    seed: g.rng() * 10,
  }));
}

export function startGame(g: GameState): void {
  g.phase = "play";
  g.numbers = [];
  g.level = 1;
  g.score = 0;
  g.newBest = false;
  g.spawnTimer = 0.6;
  g.overTimer = 0;
  g.overReason = null;
  g.banner = 0;
  g.shake = 0;
  resetCups(g);
}

function endGame(g: GameState, reason: GameOverReason): void {
  if (g.phase !== "play") return;
  g.phase = "over";
  g.overReason = reason;
  g.overTimer = 0;
  g.shake = 1;
  g.newBest = g.score > g.best;
  if (g.newBest) g.best = g.score;
  g.events.push({t: "gameOver", reason, newBest: g.newBest});
}

// ---- Cups -----------------------------------------------------------------------------

export function cupById(g: GameState, id: number | null): Cup | undefined {
  return id === null ? undefined : g.cups.find((c) => c.id === id);
}

/** The living cup closest sideways to x (the lower one if they are equally close). */
export function nearestAliveCup(g: GameState, x: number): Cup | undefined {
  let best: Cup | undefined;
  for (const c of g.cups) {
    if (c.dead) continue;
    if (!best) {
      best = c;
      continue;
    }
    const d = Math.abs(c.x - x);
    const bd = Math.abs(best.x - x);
    if (d < bd - 0.5 || (Math.abs(d - bd) <= 0.5 && c.y > best.y)) best = c;
  }
  return best;
}

/** The cup under a finger, if any (a cup in front wins over one behind it). */
export function cupAt(g: GameState, x: number, y: number): Cup | undefined {
  return [...g.cups]
    .sort((a, b) => b.y - a.y)
    .find((c) => Math.abs(x - c.x) < CUP_W / 2 + 10 && Math.abs(y - c.y) < CUP_H / 2 + 14);
}

/** The column (an index into COLS) a cup belongs to: the one no other cup stands in. */
function homeColumn(g: GameState, c: Cup): number {
  const free = COLS.findIndex((x) => g.cups.every((o) => o === c || o.x !== x));
  if (free >= 0) return free;
  let best = 0;
  for (let i = 1; i < COLS.length; i++) if (Math.abs(COLS[i] - c.x) < Math.abs(COLS[best] - c.x)) best = i;
  return best;
}

/**
 * Drags a cup sideways. The cups stand in four fixed columns: when the dragged cup reaches
 * another column, the cup standing there swaps places with it (and takes the column it left).
 */
export function moveCup(g: GameState, c: Cup, nx: number): void {
  if (!g.cups.includes(c)) return;
  const home = homeColumn(g, c);
  c.x = Math.min(Math.max(nx, CUP_W / 2 + 6), W - CUP_W / 2 - 6);
  let col = 0;
  for (let i = 1; i < COLS.length; i++) if (Math.abs(COLS[i] - c.x) < Math.abs(COLS[col] - c.x)) col = i;
  if (col === home) return;
  const other = g.cups.find((o) => o !== c && o.x === COLS[col]);
  if (other) other.x = COLS[home];
}

/** The finger let go: the cup settles in its column. */
export function dropCup(g: GameState, c: Cup): void {
  if (!g.cups.includes(c)) return;
  c.x = COLS[homeColumn(g, c)];
}

// ---- Numbers --------------------------------------------------------------------------

function pickValue(g: GameState): number {
  const max = maxNumber(g.level);
  // Often a number that finishes one of the cups: the game is about choosing, not about luck.
  if (g.rng() < 0.35) {
    const finishing = g.cups.filter((c) => !c.dead && TARGET - c.value >= 1 && TARGET - c.value <= max);
    if (finishing.length > 0) {
      const c = finishing[Math.floor(g.rng() * finishing.length)];
      return TARGET - c.value;
    }
  }
  return 1 + Math.floor(g.rng() * max);
}

function spawn(g: GameState): void {
  const free = COLS.map((_, i) => i).filter((i) => !g.numbers.some((n) => n.col === i && n.state === "fall" && n.y < 70));
  if (free.length === 0) return;
  const col = free[Math.floor(g.rng() * free.length)];
  g.numbers.push({
    id: g.nextId++,
    col,
    x: COLS[col],
    y: -26,
    prevY: -26,
    v: pickValue(g),
    state: "fall",
    target: null,
    speed: 0,
    phase: g.rng() * 6,
    scale: 1,
    done: false,
  });
}

/** A tap at (x, y). Sends the number there into the nearest living cup. Returns true if it hit one. */
export function tapAt(g: GameState, x: number, y: number): boolean {
  if (g.phase !== "play") return false;
  let hit: NumberTile | undefined;
  let bd = TAP_RADIUS;
  for (const n of g.numbers) {
    if (n.state !== "fall" || n.y < -8) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) {
      bd = d;
      hit = n;
    }
  }
  if (!hit) return false;
  const cup = nearestAliveCup(g, hit.x);
  if (!cup) return false;
  hit.state = "dive";
  hit.target = cup.id;
  hit.speed = 240;
  g.events.push({t: "tap"});
  return true;
}

// ---- Landing --------------------------------------------------------------------------

function land(g: GameState, c: Cup, n: NumberTile): void {
  n.done = true;
  g.events.push({t: "land", x: c.x, y: c.y - CUP_H / 2, v: n.v, cupId: c.id});
  // A number in a dead cup: that is the end.
  if (c.dead) {
    endGame(g, "deadCup");
    return;
  }
  c.value += n.v;
  c.bump = 1;
  c.ripple = 1;
  g.score += n.v * g.level;
  if (c.value === TARGET) {
    levelUp(g, c);
  } else if (c.value > TARGET) {
    c.dead = true;
    g.shake = Math.max(g.shake, 0.7);
    g.events.push({t: "bust", cupId: c.id});
    if (g.cups.every((k) => k.dead)) endGame(g, "allDead");
  }
}

function levelUp(g: GameState, c: Cup): void {
  g.level += 1;
  g.score += 50 * g.level;
  // The cup starts over at 0 (the golden 10 stays on it for a moment).
  c.value = 0;
  c.showTen = 0.9;
  c.flash = 1;
  g.banner = 1.6;
  g.events.push({t: "levelUp", cupId: c.id, level: g.level});
  // A reward: one dead cup comes back to life.
  const dead = g.cups.find((k) => k.dead);
  if (dead) {
    dead.dead = false;
    dead.value = 0;
    dead.flash = 1;
    dead.ripple = 1;
    g.events.push({t: "revive", cupId: dead.id});
  }
}

// ---- Every frame ----------------------------------------------------------------------

export function update(g: GameState, dt: number): void {
  g.time += dt;
  for (const c of g.cups) {
    c.bump = Math.max(0, c.bump - dt * 4);
    c.ripple = Math.max(0, c.ripple - dt * 1.5);
    c.showTen = Math.max(0, c.showTen - dt);
    c.flash = Math.max(0, c.flash - dt * 1.5);
  }
  g.shake = Math.max(0, g.shake - dt * 2.2);
  g.banner = Math.max(0, g.banner - dt);

  if (g.phase === "over") {
    g.overTimer += dt;
    return;
  }
  if (g.phase !== "play") return;

  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    g.spawnTimer = spawnInterval(g.level) * (0.85 + g.rng() * 0.3);
    spawn(g);
  }

  for (const n of g.numbers) {
    if (g.phase !== "play") break;
    if (n.state === "fall") fall(g, n, dt);
    else dive(g, n, dt);
  }
  g.numbers = g.numbers.filter((n) => !n.done);
}

function fall(g: GameState, n: NumberTile, dt: number): void {
  n.prevY = n.y;
  n.y += fallSpeed(g.level) * dt;
  // On its own the number lands in whatever cup it passes over (a living one, or a dead one: game over).
  for (const c of g.cups) {
    const mouth = c.y - CUP_H / 2;
    if (n.prevY < mouth && n.y >= mouth && Math.abs(n.x - c.x) <= CUP_W / 2 - 4) {
      land(g, c, n);
      return;
    }
  }
  if (n.y > MISS_Y) {
    n.done = true;
    g.events.push({t: "miss", x: n.x, y: MISS_Y - 4});
  }
}

function dive(g: GameState, n: NumberTile, dt: number): void {
  let cup = cupById(g, n.target);
  // The cup it was heading for died on the way: find another living one.
  if (!cup || cup.dead) {
    cup = nearestAliveCup(g, n.x);
    if (!cup) {
      n.done = true;
      return;
    }
    n.target = cup.id;
  }
  const tx = cup.x;
  const ty = cup.y - CUP_H / 2 + 2;
  n.speed = Math.min(1100, n.speed + 3200 * dt);
  const dx = tx - n.x;
  const dy = ty - n.y;
  const d = Math.hypot(dx, dy);
  const step = n.speed * dt;
  n.scale = Math.min(1, Math.max(0.55, d / 70));
  if (d <= step + 2) {
    n.x = tx;
    n.y = ty;
    land(g, cup, n);
  } else {
    n.x += (dx / d) * step;
    n.y += (dy / d) * step;
  }
}
