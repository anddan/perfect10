// Things that only look good: steam above the cups, coffee splashes, confetti and "+3" texts.
// The rules never look at these; they only react to what the engine says happened.
import {CUP_H, TARGET} from "../game/constants";
import type {GameEvent, GameState} from "../game/types";

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
const CONFETTI = ["#ffd54a", "#ff7a59", "#6ee7b7", "#7dd3fc", "#f9a8d4", "#ffffff"];

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

export class Fx {
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
        const n = 10 + e.v;
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
        this.texts.push({x: e.x, y: e.y - 18, text: `+${e.v}`, age: 0, life: 0.9, color: "#ffe9a8", size: 20});
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
        this.texts.push({x: c.x, y: c.y - 60, text: "PERFEKT 10!", age: 0, life: 1.3, color: "#ffd54a", size: 22});
        break;
      }
      case "revive": {
        const c = g.cups.find((k) => k.id === e.cupId);
        if (c) this.texts.push({x: c.x, y: c.y - 60, text: "Tillbaka!", age: 0, life: 1.3, color: "#9ff0c4", size: 20});
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
        this.texts.push({x: c.x, y: c.y - 60, text: "Över 10!", age: 0, life: 1.2, color: "#ff8a80", size: 20});
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

  update(g: GameState, dt: number): void {
    const rnd = Math.random;
    // Every living cup steams more and more the closer it gets to 10.
    for (const c of g.cups) {
      const v = c.showTen > 0 && c.value === 0 ? TARGET : c.value;
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
