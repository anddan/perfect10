// Things that only look good: steam above the cups, coffee splashes, confetti and "+3" texts.
// The rules never look at these; they only react to what the engine says happened.
import {CUP_H, TARGET} from "../game/constants";
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
          e.op === "mul"
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
        this.texts.push({x: c.x, y: c.y - 60, text: t("perfect10"), age: 0, life: 1.3, color: "#ffd54a", size: 22});
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
        const [text, color] =
          e.kind === "life" ? [t("bonusLife"), "#ffb3c6"] : e.kind === "points" ? [`+${e.amount}`, "#e2c8ff"] : [t("bonusSlow"), "#b8ecff"];
        this.texts.push({x: e.x, y: e.y - 24, text, age: 0, life: 1.2, color, size: 22});
        break;
      }
      case "won": {
        // A level of the book is cleared: confetti from both sides of the screen.
        for (let i = 0; i < 120; i++) {
          const left = i % 2 === 0;
          this.confetti.push({
            x: left ? 10 : 350,
            y: 330 + rnd() * 120,
            vx: (left ? 1 : -1) * (120 + rnd() * 260),
            vy: -(280 + rnd() * 420),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 1.6 + rnd() * 1,
            color: CONFETTI[Math.floor(rnd() * CONFETTI.length)],
          });
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
  }

  /** A fresh game: forget everything that was in the air. */
  clear(): void {
    this.steam = [];
    this.drops = [];
    this.confetti = [];
    this.texts = [];
    this.emit.clear();
    this.flyers = [];
    this.pop = {seg: -1, t: 0};
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
  }
}
