// Things that only look good: steam above the cups, coffee splashes, confetti and "+3" texts.
// The rules never look at these; they only react to what the engine says happened.
import {CUP_H, H, TARGET, W} from "../game/constants";
import type {GameEvent, GameState} from "../game/types";
import {drawStar} from "./draw";
import {t} from "./i18n";
import {segmentCenter, segmentFilledBy} from "./progress";

interface Steam {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  phase: number;
  alpha: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
  color: string;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
  life: number;
  color: string;
}

/** A spark, a little star or a bit of paper in the celebration of a cleared level (drawn over the card). */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
  life: number;
  size: number;
  color: string;
  kind: "dot" | "star" | "paper";
  gravity: number;
}

/** A ring that spreads out and fades (`age` below 0: it has not started yet). */
interface Ring {
  x: number;
  y: number;
  age: number;
  life: number;
  max: number;
  color: string;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  age: number;
  life: number;
  color: string;
  size: number;
}

const COFFEE = ["#3b2314", "#5a3a22", "#7a4f2e", "#2a170c"];
const ICE = ["#ffffff", "#d8f1ff", "#a9d8f5", "#7fbfe8"];
const CONFETTI =["#ffd54a", "#ff7a59", "#6ee7b7", "#7dd3fc", "#f9a8d4", "#ffffff"];

/** A soft white blob, drawn once and stamped for every puff of steam. */
function makeSteamSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** A golden star that flies from a cup that reached 10 to its place in the progress bar. */
interface Flyer {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  seg: number;
  age: number;
  life: number;
}

/** Where a flying star is, `t` (0 to 1) of the way: a curve that rises first and then comes down onto the bar. */
function flyerAt(f: Flyer, t: number): {x: number; y: number} {
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const cx = (f.x0 + f.x1) / 2 + (f.x1 - f.x0) * 0.12;
  const cy = Math.min(f.y0, f.y1) - 170;
  const u = 1 - e;
  return {x: u * u * f.x0 + 2 * u * e * cx + e * e * f.x1, y: u * u * f.y0 + 2 * u * e * cy + e * e * f.y1};
}

export class Fx {
  private flyers: Flyer[] = [];
  /** The segment of the progress bar that has just been filled, and how much of its pop is left (1 down to 0). */
  pop = {seg: -1, t: 0};
  private steam: Steam[] = [];
  private drops: Drop[] = [];
  private confetti: Confetti[] = [];
  private texts: FloatText[] = [];
  /** The "PERFECT 10!" over a cup that reached 10: where it is (the middle of the words), and how long it has been there. */
  private perfects: {x: number; y: number; age: number; life: number}[] = [];
  /**
   * The celebration of a cleared level: what it has been going on for, how many stars it was for, which of the star bursts and
   * fireworks have been let off, and the sparks, rings and flash it made.
   */
  private celebration: {t: number; stars: number; burst: boolean[]; fireworks: boolean[]} | null = null;
  private party: Spark[] = [];
  private rings: Ring[] = [];
  private flash = 0;
  private emit = new Map<number, number>();
  private sprite = makeSteamSprite();

  /** Turns what happened in the game into splashes, confetti and texts. */
  react(g: GameState, e: GameEvent): void {
    const rnd = Math.random;
    switch (e.t) {
      case "land": {
        const n = 10 + (e.op !== "add" ? 8 : Math.abs(e.v));
        for (let i = 0; i < n; i++) {
          this.drops.push({
            x: e.x + (rnd() - 0.5) * 20,
            y: e.y,
            vx: (rnd() - 0.5) * 180,
            vy: -(110 + rnd() * 160),
            age: 0,
            life: 0.45 + rnd() * 0.4,
            r: 1.8 + rnd() * 2.4,
            color: COFFEE[Math.floor(rnd() * COFFEE.length)],
          });
        }
        this.texts.push(
          e.op === "zero"
            ? {x: e.x, y: e.y - 18, text: "0", age: 0, life: 0.9, color: "#ffc27a", size: 24}
            : e.op === "mul"
            ? {x: e.x, y: e.y - 18, text: `\u00D7${e.v}`, age: 0, life: 0.9, color: "#a9d4ff", size: 22}
            : e.op === "div"
            ? {x: e.x, y: e.y - 18, text: `\u00F7${e.v}`, age: 0, life: 0.9, color: "#ffe28a", size: 22}
            : e.v < 0
            ? {x: e.x, y: e.y - 18, text: `−${-e.v}`, age: 0, life: 0.9, color: "#ffb3ab", size: 20}
            : {x: e.x, y: e.y - 18, text: `+${e.v}`, age: 0, life: 0.9, color: "#ffe9a8", size: 20}
        );
        break;
      }
      case "ice": {
        // Ice cracks (a few shards), or breaks (a lot of them).
        const n = e.broke ? 18 : 7;
        for (let i = 0; i < n; i++) {
          this.drops.push({
            x: e.x + (rnd() - 0.5) * 30,
            y: e.y + (rnd() - 0.5) * 30,
            vx: (rnd() - 0.5) * (e.broke ? 260 : 150),
            vy: -(40 + rnd() * (e.broke ? 190 : 100)),
            age: 0,
            life: 0.4 + rnd() * 0.35,
            r: 1.6 + rnd() * 2.2,
            color: ICE[Math.floor(rnd() * ICE.length)],
          });
        }
        break;
      }
      case "steel": {
        // A clink: a few bright sparks (nothing else happens).
        for (let i = 0; i < 9; i++) {
          this.confetti.push({
            x: e.x + (rnd() - 0.5) * 14,
            y: e.y + (rnd() - 0.5) * 14,
            vx: (rnd() - 0.5) * 240,
            vy: -(40 + rnd() * 160),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 0.25 + rnd() * 0.25,
            color: i % 2 === 0 ? "#ffffff" : "#cfe6ff",
          });
        }
        break;
      }
      case "combo": {
        // A combo: the text grows with it, and more sparks the higher it goes.
        this.texts.push({x: e.x, y: e.y - 58, text: `${t("combo")} \u00D7${e.n}`, age: 0, life: 1.5, color: e.n >= 4 ? "#ff9ad5" : e.n === 3 ? "#ffb24a" : "#ffe27a", size: Math.min(36, 22 + e.n * 3)});
        this.texts.push({x: e.x, y: e.y - 34, text: `+${e.bonus}`, age: 0, life: 1.3, color: "#fff3c0", size: 18});
        for (let i = 0; i < 12 + e.n * 6; i++) {
          this.confetti.push({
            x: e.x + (rnd() - 0.5) * 30,
            y: e.y,
            vx: (rnd() - 0.5) * 360,
            vy: -(120 + rnd() * 300),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 0.7 + rnd() * 0.6,
            color: CONFETTI[Math.floor(rnd() * CONFETTI.length)],
          });
        }
        break;
      }
      case "levelUp": {
        const c = g.cups.find((k) => k.id === e.cupId);
        if (!c) break;
        for (let i = 0; i < 60; i++) {
          this.confetti.push({
            x: c.x + (rnd() - 0.5) * 30,
            y: c.y - CUP_H / 2,
            vx: (rnd() - 0.5) * 320,
            vy: -(160 + rnd() * 340),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 1.2 + rnd() * 0.8,
            color: CONFETTI[Math.floor(rnd() * CONFETTI.length)],
          });
        }
        // The words PERFECT 10: they pop up over the cup in gold, in front of a burst of light, with a ring spreading from the cup.
        this.perfects.push({x: c.x, y: c.y - 74, age: 0, life: 1.7});
        if (g.mode !== "tutorial") {
          const seg = segmentFilledBy(g, e.level);
          const end = segmentCenter(g, seg);
          this.flyers.push({x0: c.x, y0: c.y - CUP_H / 2, x1: end.x, y1: end.y, seg, age: 0, life: 0.7});
        }
        break;
      }
      case "bonus": {
        // A bonus ball is collected: golden sparks, and what it gave.
        for (let i = 0; i < 26; i++) {
          this.confetti.push({
            x: e.x + (rnd() - 0.5) * 12,
            y: e.y,
            vx: (rnd() - 0.5) * 300,
            vy: -(100 + rnd() * 260),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 0.6 + rnd() * 0.5,
            color: i % 3 === 0 ? "#ffffff" : "#ffd54a",
          });
        }
        if (e.kind === "star") {
          // The star clears all the cups: on every living cup the coffee sloshes up and sparkles fly.
          for (const c of g.cups) {
            if (c.dead) continue;
            for (let i = 0; i < 14; i++) {
              this.drops.push({
                x: c.x + (rnd() - 0.5) * 30,
                y: c.y - CUP_H / 2,
                vx: (rnd() - 0.5) * 160,
                vy: -(150 + rnd() * 240),
                age: 0,
                life: 0.5 + rnd() * 0.5,
                r: 2 + rnd() * 2.6,
                color: COFFEE[Math.floor(rnd() * COFFEE.length)],
              });
            }
            for (let i = 0; i < 12; i++) {
              this.confetti.push({
                x: c.x + (rnd() - 0.5) * 36,
                y: c.y - CUP_H / 2,
                vx: (rnd() - 0.5) * 220,
                vy: -(120 + rnd() * 280),
                rot: rnd() * 6,
                vr: (rnd() - 0.5) * 14,
                age: 0,
                life: 0.7 + rnd() * 0.6,
                color: i % 2 === 0 ? "#fff3b0" : "#ffd54a",
              });
            }
          }
        }
        const [text, color] =
          e.kind === "life"
            ? [t("bonusLife"), "#ffb3c6"]
            : e.kind === "points"
              ? [`+${e.amount}`, "#e2c8ff"]
              : e.kind === "star"
                ? [t("bonusClear"), "#ffe27a"]
                : [t("bonusSlow"), "#b8ecff"];
        this.texts.push({x: e.x, y: e.y - 24, text, age: 0, life: 1.2, color, size: 22});
        if (e.kind === "star" && e.amount > 0) this.texts.push({x: e.x, y: e.y + 2, text: `+${e.amount}`, age: 0, life: 1.2, color: "#fff3c0", size: 18});
        break;
      }
      case "won": {
        // A level of the book is cleared: a celebration that is bigger the more stars it was cleared with. Confetti from both sides
        // of the screen (a little for one star, a lot for three); a burst of sparks from each star that comes up on the card; and
        // with three stars fireworks, a golden rain and a flash. All of it is drawn over the card (see drawCelebration).
        this.celebration = {t: 0, stars: e.stars, burst: [false, false, false], fireworks: [false, false, false, false, false]};
        const pieces = e.stars === 3 ? 170 : e.stars === 2 ? 90 : 36;
        for (let i = 0; i < pieces; i++) {
          const left = i % 2 === 0;
          this.party.push({
            x: left ? 10 : 350,
            y: 330 + rnd() * 120,
            vx: (left ? 1 : -1) * (120 + rnd() * 260),
            vy: -(280 + rnd() * 420),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 1.6 + rnd() * 1,
            size: 4,
            color: CONFETTI[Math.floor(rnd() * CONFETTI.length)],
            kind: "paper",
            gravity: 520,
          });
        }
        if (e.stars === 3) {
          // A rain of gold falling from the top of the screen.
          for (let i = 0; i < 70; i++) {
            this.party.push({
              x: rnd() * W,
              y: -20 - rnd() * 220,
              vx: (rnd() - 0.5) * 30,
              vy: 40 + rnd() * 90,
              rot: rnd() * 6,
              vr: (rnd() - 0.5) * 6,
              age: 0,
              life: 2.6 + rnd() * 1.2,
              size: i % 3 === 0 ? 5 + rnd() * 3 : 2 + rnd() * 1.8,
              color: i % 2 === 0 ? "#ffd54a" : "#fff3b0",
              kind: i % 3 === 0 ? "star" : "dot",
              gravity: 30,
            });
          }
        }
        break;
      }
      case "revive": {
        const c = g.cups.find((k) => k.id === e.cupId);
        if (c) this.texts.push({x: c.x, y: c.y - 60, text: t("back"), age: 0, life: 1.3, color: "#9ff0c4", size: 20});
        break;
      }
      case "bust": {
        const c = g.cups.find((k) => k.id === e.cupId);
        if (!c) break;
        for (let i = 0; i < 26; i++) {
          this.drops.push({
            x: c.x + (rnd() - 0.5) * 40,
            y: c.y - CUP_H / 2,
            vx: (rnd() - 0.5) * 300,
            vy: -(140 + rnd() * 240),
            age: 0,
            life: 0.6 + rnd() * 0.5,
            r: 2 + rnd() * 3,
            color: COFFEE[Math.floor(rnd() * COFFEE.length)],
          });
        }
        this.texts.push({x: c.x, y: c.y - 60, text: t("over10"), age: 0, life: 1.2, color: "#ff8a80", size: 20});
        // And what it came to, so that it can be seen how far over it went.
        this.texts.push({x: c.x, y: c.y - 88, text: `= ${c.value < 0 ? "−" : ""}${Math.abs(c.value)}`, age: 0, life: 1.8, color: "#ffd0c8", size: 30});
        break;
      }
      case "miss": {
        for (let i = 0; i < 6; i++) {
          this.drops.push({
            x: e.x,
            y: e.y,
            vx: (rnd() - 0.5) * 80,
            vy: -(20 + rnd() * 50),
            age: 0,
            life: 0.3,
            r: 2,
            color: "rgba(220,200,170,0.7)",
          });
        }
        break;
      }
      default:
        break;
    }
  }

  /** How many stars are still on their way to the progress bar: its segments do not light up before they arrive. */
  get pending(): number {
    return this.flyers.length;
  }

  update(g: GameState, dt: number): void {
    const rnd = Math.random;
    this.pop.t = Math.max(0, this.pop.t - dt * 1.8);
    for (const f of this.flyers) {
      f.age += dt;
      if (f.age < f.life) continue;
      // It has arrived: the segment pops, and sparks fly up from it.
      this.pop = {seg: f.seg, t: 1};
      for (let i = 0; i < 18; i++) {
        this.confetti.push({
          x: f.x1 + (rnd() - 0.5) * 10,
          y: f.y1,
          vx: (rnd() - 0.5) * 240,
          vy: -(120 + rnd() * 260),
          rot: rnd() * 6,
          vr: (rnd() - 0.5) * 14,
          age: 0,
          life: 0.5 + rnd() * 0.5,
          color: i % 3 === 0 ? "#ffffff" : "#ffd54a",
        });
      }
    }
    this.flyers = this.flyers.filter((f) => f.age < f.life);
    // Every living cup steams more and more the closer it gets to 10.
    for (const c of g.cups) {
      const v = c.showTen > 0 && c.value === 0 ? TARGET : Math.abs(c.value);
      if (c.dead || v <= 0) continue;
      const acc = (this.emit.get(c.id) ?? 0) + (1.2 + v * v * 0.2) * dt;
      let n = Math.floor(acc);
      this.emit.set(c.id, acc - n);
      while (n-- > 0 && this.steam.length < 260) {
        this.steam.push({
          x: c.x + (rnd() - 0.5) * 36,
          y: c.y - CUP_H / 2 - 4,
          vx: (rnd() - 0.5) * 12,
          vy: -(24 + rnd() * 16 + v * 4),
          age: 0,
          life: 1.1 + rnd() * 0.7 + v * 0.05,
          size: 10 + rnd() * 6,
          grow: 14 + rnd() * 8,
          phase: rnd() * 6,
          alpha: Math.min(0.55, 0.16 + 0.05 * v),
        });
      }
    }
    for (const p of this.steam) {
      p.age += dt;
      p.x += (p.vx + Math.sin(p.age * 3 + p.phase) * 16) * dt;
      p.y += p.vy * dt;
    }
    this.steam = this.steam.filter((p) => p.age < p.life);

    for (const d of this.drops) {
      d.age += dt;
      d.vy += 700 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    this.drops = this.drops.filter((d) => d.age < d.life);

    for (const c of this.confetti) {
      c.age += dt;
      c.vy += 520 * dt;
      c.vx *= 1 - 0.8 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
    }
    this.confetti = this.confetti.filter((c) => c.age < c.life);

    for (const t of this.texts) {
      t.age += dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
    for (const p of this.perfects) p.age += dt;
    this.perfects = this.perfects.filter((p) => p.age < p.life);
    this.updateCelebration(dt);
  }

  /** One star comes up on the card: sparks fly from it and a ring spreads (the last of three is the biggest). */
  private starBurst(x: number, y: number, stars: number, big: boolean): void {
    const rnd = Math.random;
    const n = big ? 48 : 16 + stars * 6;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = (big ? 120 : 80) + rnd() * (big ? 240 : 150);
      this.party.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        rot: rnd() * 6,
        vr: (rnd() - 0.5) * 10,
        age: 0,
        life: 0.6 + rnd() * 0.6,
        size: i % 4 === 0 ? 6 + rnd() * 4 : 2 + rnd() * 2.5,
        color: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd54a" : "#ffb347",
        kind: i % 4 === 0 ? "star" : "dot",
        gravity: 260,
      });
    }
    this.rings.push({x, y, age: 0, life: 0.55, max: big ? 84 : 52, color: "#fff3b0"});
    if (big) this.rings.push({x, y, age: -0.12, life: 0.6, max: 124, color: "#ffd54a"});
  }

  /** A firework: sparks in a ball that falls a little as they fade. */
  private firework(x: number, y: number): void {
    const rnd = Math.random;
    const color = CONFETTI[Math.floor(rnd() * (CONFETTI.length - 1))];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + rnd() * 0.1;
      const sp = 110 + rnd() * 70;
      this.party.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: 0,
        vr: 0,
        age: 0,
        life: 0.9 + rnd() * 0.4,
        size: 2.4 + rnd() * 1.6,
        color: i % 5 === 0 ? "#ffffff" : color,
        kind: "dot",
        gravity: 140,
      });
    }
    this.rings.push({x, y, age: 0, life: 0.35, max: 30, color});
  }

  /** Lets off the bursts and fireworks of the celebration on time, and moves the sparks. */
  private updateCelebration(dt: number): void {
    const rnd = Math.random;
    const c = this.celebration;
    if (c) {
      c.t += dt;
      // A burst from each star that has been earned, as it comes up on the card (the stars stand 62 apart, the middle one a bit higher).
      for (let i = 0; i < c.stars; i++) {
        if (c.burst[i] || c.t < 0.45 + i * 0.16) continue;
        c.burst[i] = true;
        const last = c.stars === 3 && i === 2;
        this.starBurst(W / 2 + (i - 1) * 62, 186 - (i === 1 ? 10 : 0), c.stars, last);
        if (last) this.flash = 0.5;
      }
      // With three stars there are fireworks in the upper part of the screen too.
      if (c.stars === 3) {
        [1.0, 1.3, 1.65, 2.0, 2.4].forEach((at, i) => {
          if (c.fireworks[i] || c.t < at) return;
          c.fireworks[i] = true;
          this.firework(60 + rnd() * 240, 80 + rnd() * 130);
        });
      }
      if (c.t > 3.6) this.celebration = null;
    }
    this.flash = Math.max(0, this.flash - dt * 1.6);
    for (const p of this.party) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - (p.kind === "paper" ? 0.8 : 1.2) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.party = this.party.filter((p) => p.age < p.life);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
  }

  /** A fresh game: forget everything that was in the air. */
  clear(): void {
    this.steam = [];
    this.drops = [];
    this.confetti = [];
    this.texts = [];
    this.perfects = [];
    this.emit.clear();
    this.flyers = [];
    this.pop = {seg: -1, t: 0};
    this.celebration = null;
    this.party = [];
    this.rings = [];
    this.flash = 0;
  }

  /** The celebration of a cleared level: drawn over the card, so that the sparks of the stars can be seen. */
  drawCelebration(ctx: CanvasRenderingContext2D): void {
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,248,220,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
    for (const r of this.rings) {
      if (r.age < 0) continue;
      const k = r.age / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.max * (1 - Math.pow(1 - k, 3)), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.party) {
      const k = p.age / p.life;
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      if (p.kind === "star") {
        drawStar(ctx, p.x, p.y, p.size, true);
      } else if (p.kind === "paper") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - k * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The stars on their way to the progress bar, each with a short golden trail. */
  drawFlyers(ctx: CanvasRenderingContext2D): void {
    for (const f of this.flyers) {
      const t = Math.min(1, f.age / f.life);
      for (let k = 5; k >= 0; k--) {
        const p = flyerAt(f, Math.max(0, t - k * 0.035));
        ctx.globalAlpha = k === 0 ? 1 : 0.32 - k * 0.05;
        drawStar(ctx, p.x, p.y, k === 0 ? 11 : 9 - k, true);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawSteam(ctx: CanvasRenderingContext2D): void {
    for (const p of this.steam) {
      const k = p.age / p.life;
      const a = p.alpha * (1 - k) * Math.min(1, k * 6);
      const s = p.size + p.grow * p.age;
      ctx.globalAlpha = a;
      ctx.drawImage(this.sprite, p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  drawTop(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drops) {
      ctx.globalAlpha = Math.min(1, (1 - d.age / d.life) * 1.6);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of this.confetti) {
      ctx.globalAlpha = Math.min(1, (1 - c.age / c.life) * 2);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of this.texts) {
      const k = t.age / t.life;
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      ctx.font = `800 ${t.size}px "Trebuchet MS","Segoe UI",system-ui,sans-serif`;
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(30,15,5,0.85)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    for (const p of this.perfects) this.drawPerfect(ctx, p);
  }

  /**
   * "PERFECT 10!": a ring spreads from the cup, a burst of light turns slowly behind the words, and the words pop up (they overshoot a
   * little and settle), in gold with a dark outline and a soft glow, with a few twinkling stars. They rise a little and fade out.
   */
  private drawPerfect(ctx: CanvasRenderingContext2D, p: {x: number; y: number; age: number; life: number}): void {
    const k = p.age / p.life;
    const fade = k < 0.75 ? 1 : (1 - k) / 0.25;
    const u = Math.min(1, p.age / 0.3);
    // It overshoots a little, then settles (the same curve as the pull-down screen prize on the card).
    const pop = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
    const label = t("perfect10");
    const size = 30;
    ctx.save();
    ctx.font = `800 ${size}px "Trebuchet MS","Segoe UI",system-ui,sans-serif`;
    const half = (ctx.measureText(label).width / 2) * 1.12 + 10;
    // Kept on the screen, also for the cups at the edges.
    const x = Math.min(W - half, Math.max(half, p.x));
    const y = p.y - p.age * 20;

    // The ring from the cup.
    if (p.age < 0.6) {
      const r = p.age / 0.6;
      ctx.globalAlpha = (1 - r) * 0.9;
      ctx.lineWidth = 4 * (1 - r) + 1;
      ctx.strokeStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(p.x, p.y + 74 - CUP_H / 2, 14 + 70 * (1 - Math.pow(1 - r, 3)), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(x, y);

    // The light behind the words.
    ctx.save();
    ctx.globalAlpha = fade * 0.55 * Math.min(1, p.age / 0.2);
    ctx.rotate(p.age * 0.7);
    const reach = 46 + 40 * Math.min(1, u);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, reach + 30);
    glow.addColorStop(0, "rgba(255,236,150,0.9)");
    glow.addColorStop(1, "rgba(255,200,60,0)");
    ctx.fillStyle = glow;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-7, -(reach + 30));
      ctx.lineTo(7, -(reach + 30));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // The words.
    ctx.globalAlpha = fade;
    ctx.rotate(-0.05);
    ctx.scale(pop, pop);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${size}px "Trebuchet MS","Segoe UI",system-ui,sans-serif`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(70,36,4,0.95)";
    ctx.strokeText(label, 0, 0);
    ctx.shadowColor = "rgba(255,196,60,0.9)";
    ctx.shadowBlur = 14;
    const gold = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    gold.addColorStop(0, "#fff8c8");
    gold.addColorStop(0.5, "#ffd23a");
    gold.addColorStop(1, "#ee9408");
    ctx.fillStyle = gold;
    ctx.fillText(label, 0, 0);
    ctx.shadowBlur = 0;

    // A few stars that twinkle round the words.
    const spots: [number, number, number][] = [
      [-half + 4, -18, 0],
      [half - 6, -22, 1.7],
      [half + 2, 14, 3.1],
      [-half + 14, 20, 4.6],
    ];
    ctx.fillStyle = "#fffbe0";
    for (const [sx, sy, ph] of spots) {
      const s = Math.max(0, 6.5 * (0.55 + 0.45 * Math.sin(p.age * 11 + ph))) * Math.min(1, u * 1.5);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? s : s * 0.28;
        ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
