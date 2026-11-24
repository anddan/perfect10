// Things that only look good: steam above the cups, coffee splashes, confetti and "+3" texts.
// The rules never look at these; they only react to what the engine says happened.
import {CUP_H, H, TARGET, W} from "../game/constants";
import {FADE_TICKS, fadeCap, fadeOn} from "../game/engine";
import type {GameEvent, GameState} from "../game/types";
import {drawSkull, drawStar, ui} from "./draw";
import {t} from "./i18n";
import {segmentCenter, segmentCount, segmentFilledBy, segmentLayout} from "./progress";

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
  /** How much of the progress has faded as it is shown (twentieths of a cup): it follows the real amount smoothly, so the bar drains softly. */
  drainShown = 0;
  /** The segments that have faded away completely, and how long ago (they fade out in the bar), and how many of them the sound has not been played for. */
  gone: {seg: number; age: number}[] = [];
  private goneNew = 0;
  private steam: Steam[] = [];
  private drops: Drop[] = [];
  private confetti: Confetti[] = [];
  private texts: FloatText[] = [];
  /** The skulls that have been popped: they drift up and fade out fast. */
  private skulls: {x: number; y: number; age: number}[] = [];
  /** The "PERFECT 10!" over a cup that reached 10: where it is (the middle of the words), and how long it has been there. */
  private perfects: {x: number; y: number; age: number; life: number}[] = [];
  /**
   * The celebration of a cleared level: what it has been going on for, how many stars it was for, which of the star bursts and
   * fireworks have been let off, and the sparks, rings and flash it made.
   */
  private celebration: {t: number; stars: number; burst: boolean[]; fireworks: boolean[]} | null = null;
  private party: Spark[] = [];
  private rings: Ring[] = [];
  /** Bolts of lightning (Draw to 10): from (x0, y0) to (x1, y1), jagged, flickering. */
  bolts: {x0: number; y0: number; x1: number; y1: number; age: number; life: number; seed: number}[] = [];
  /** The crosses of light of the laser of the cannon. */
  crosses: {x: number; y: number; age: number; life: number}[] = [];
  private flash = 0;
  /** The lightning of a diamond at work: where it hangs, the numbers it strikes (and when), and how long it has been going on. */
  private zaps: {x: number; y: number; hits: {x: number; y: number; at: number; ten: boolean}[]; age: number}[] = [];
  /** The beams of laser cups: a line up a column that fades. */
  private beams: {x: number; y0: number; y1: number; age: number; life: number}[] = [];
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
            ? {x: e.x, y: e.y - 18, text: "=0", age: 0, life: 0.9, color: "#ffc27a", size: 24}
            : e.op === "ten"
            ? {x: e.x, y: e.y - 18, text: "=10", age: 0, life: 0.9, color: "#ffc27a", size: 24}
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
          const seg = segmentFilledBy(g, e.level, e.done);
          const end = segmentCenter(g, seg, e.level - 1);
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
          e.kind === "diamond"
            ? [t("bonusDiamond"), "#bfe9ff"]
            : e.kind === "cloth"
            ? [t("bonusCloth"), "#ffd9a0"]
            : e.kind === "shield"
              ? [t("bonusShield"), "#bcd0ff"]
              : e.kind === "life"
            ? [t("bonusLife"), "#ffb3c6"]
            : e.kind === "points"
              ? [`+${e.amount}`, "#e2c8ff"]
              : e.kind === "star"
                ? [t("bonusClear"), "#ffe27a"]
                : e.kind === "pause"
                  ? [t("bonusPause"), "#b9f5d4"]
                  : e.kind === "bomb"
                    ? [t("bonusBomb"), "#ffb36b"]
                    : e.kind === "wand"
                      ? [t("bonusWand"), "#ffc8f2"]
                      : e.kind === "reverse"
                        ? [t("bonusReverse"), "#c8fff4"]
                      : [t("bonusSlow"), "#b8ecff"];
        this.texts.push({x: e.x, y: e.y - 24, text, age: 0, life: 1.2, color, size: 22});
        if (e.kind === "star" && e.amount > 0) this.texts.push({x: e.x, y: e.y + 2, text: `+${e.amount}`, age: 0, life: 1.2, color: "#fff3c0", size: 18});
        break;
      }
      case "shield": {
        // A shield goes on a cup (a ring of blue sparks round it), or takes a hit and breaks (a lot of bright shards).
        const SHARDS = ["#ffffff", "#dbe6ff", "#a9c0ff", "#7f9bff"];
        const n = e.on ? 16 : 30;
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2;
          const s = e.on ? 60 + rnd() * 60 : 120 + rnd() * 240;
          this.confetti.push({
            x: e.x + Math.cos(a) * (e.on ? 40 : 14),
            y: e.y + 22 + Math.sin(a) * (e.on ? 36 : 14),
            vx: Math.cos(a) * s * (e.on ? -0.4 : 1),
            vy: Math.sin(a) * s * (e.on ? -0.4 : 1) - (e.on ? 0 : 60),
            rot: rnd() * 6,
            vr: (rnd() - 0.5) * 14,
            age: 0,
            life: 0.4 + rnd() * 0.4,
            color: SHARDS[Math.floor(rnd() * SHARDS.length)],
          });
        }
        if (!e.on) this.texts.push({x: e.x, y: e.y - 10, text: t("shieldBroke"), age: 0, life: 1, color: "#bcd0ff", size: 20});
        break;
      }
      case "zap": {
        // The diamond is tapped: a flash of cold light round it, and then the lightning strikes one number after the other (see drawTop).
        this.zaps.push({x: e.x, y: e.y, hits: e.hits, age: 0});
        for (let i = 0; i < 30; i++) {
          const a = rnd() * Math.PI * 2;
          const s = 80 + rnd() * 260;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.4 + rnd() * 0.4, color: i % 2 === 0 ? "#ffffff" : "#8fdcff"});
        }
        break;
      }
      case "skull": {
        // A skull is popped: a ring of grey and purple bits, and the skull itself drifts up and fades away.
        const BITS = ["#ffffff", "#d8d0e4", "#8c6bb0", "#3a2850"];
        for (let i = 0; i < 16; i++) {
          const a = rnd() * Math.PI * 2;
          const s = 110 + rnd() * 170;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.25 + rnd() * 0.3, color: BITS[Math.floor(rnd() * BITS.length)]});
        }
        this.skulls.push({x: e.x, y: e.y, age: 0});
        break;
      }
      case "pop": {
        // A number is rubbed out by the eraser: pink and white crumbs fly off it.
        const CRUMBS = ["#ffffff", "#ffd0e0", "#ff8fb0", "#6fa8ff"];
        for (let i = 0; i < 18; i++) {
          const a = rnd() * Math.PI * 2;
          const s = 80 + rnd() * 180;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.35, color: CRUMBS[Math.floor(rnd() * CRUMBS.length)]});
        }
        break;
      }
      case "zapHit": {
        // A number has been changed: sparks (gold for a 10, blue for a 0) and what it became.
        const SPARKS = e.ten ? ["#fff3b0", "#ffd54a", "#ffffff"] : ["#ffffff", "#aee6ff", "#6fb8ff"];
        for (let i = 0; i < 16; i++) {
          const a = rnd() * Math.PI * 2;
          const s = 90 + rnd() * 200;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.4, color: SPARKS[Math.floor(rnd() * SPARKS.length)]});
        }
        this.texts.push({x: e.x, y: e.y - 26, text: e.ten ? "=10" : "=0", age: 0, life: 0.8, color: e.ten ? "#ffe27a" : "#bfe6ff", size: e.ten ? 24 : 18});
        break;
      }
      case "laser": {
        // A laser cup is fired: a beam up its column, a burst of sparks at the cup, and a small burst from every number it cleared.
        this.beams.push({x: e.x, y0: e.y, y1: -g.extra - 20, age: 0, life: 0.45});
        const LASER = ["#ffffff", "#f5b8ff", "#c27bff", "#8c5cff"];
        const burst = (x: number, y: number, n: number, speed: number) => {
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2;
            const s = speed * (0.35 + rnd() * 0.65);
            this.confetti.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.4, color: LASER[Math.floor(rnd() * LASER.length)]});
          }
        };
        burst(e.x, e.y, 26, 300);
        for (const h of e.hits) burst(h.x, h.y, 12, 220);
        break;
      }
      case "blast": {
        // The bomb goes off: a burst of fire-coloured sparks from the bomb, and a smaller burst from every number it blew away.
        const FIRE = ["#fff3b0", "#ffd54a", "#ff9a3c", "#ff6a2a", "#4a4038"];
        const burst = (x: number, y: number, n: number, speed: number) => {
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2;
            const s = speed * (0.35 + rnd() * 0.65);
            this.confetti.push({
              x,
              y,
              vx: Math.cos(a) * s,
              vy: Math.sin(a) * s - 40,
              rot: rnd() * 6,
              vr: (rnd() - 0.5) * 16,
              age: 0,
              life: 0.4 + rnd() * 0.5,
              color: FIRE[Math.floor(rnd() * FIRE.length)],
            });
          }
        };
        burst(e.x, e.y, 80, 560);
        for (const h of e.hits) burst(h.x, h.y, 14, 240);
        break;
      }
      case "boom": {
        // An explosion (a missile that hits, a skull that hits the jet, a boss that bursts, the ship that crashes): fire and smoke, bigger for a big one.
        const FIRE = ["#ffffff", "#fff3b0", "#ffd54a", "#ff9a3c", "#ff6a2a", "#5a504a"];
        const n = e.big ? 70 : 22;
        const speed = e.big ? 420 : 200;
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2;
          const s = speed * (0.3 + rnd() * 0.7);
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: (e.big ? 0.5 : 0.3) + rnd() * 0.4, color: FIRE[Math.floor(rnd() * FIRE.length)]});
        }
        break;
      }
      case "comets": {
        // A perfect 10 in the comet belt pops every comet: each one bursts into fire and bits of rock.
        const FIRE = ["#ffffff", "#fff3b0", "#ffd54a", "#ff9a3c", "#ff6a2a", "#6a4a3a", "#3a2a26"];
        for (const h of e.hits) {
          const n = Math.round(26 * h.size);
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2;
            const s = (140 + rnd() * 240) * h.size;
            this.confetti.push({x: h.x, y: h.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, rot: rnd() * 6, vr: (rnd() - 0.5) * 18, age: 0, life: 0.35 + rnd() * 0.45, color: FIRE[Math.floor(rnd() * FIRE.length)]});
          }
        }
        break;
      }
      case "weaponDown": {
        // The weapons of the jet go down a step: a puff of grey smoke and a few sparks from it (more, and red, when it has no shots left).
        const C = e.empty ? ["#ff6a5a", "#7a6a6a", "#4a4040", "#ffffff"] : ["#c8c0c8", "#8a8090", "#ffb15a"];
        for (let i = 0; i < (e.empty ? 30 : 14); i++) {
          const a = rnd() * Math.PI * 2;
          const s = 60 + rnd() * 160;
          this.confetti.push({x: e.x, y: e.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, rot: rnd() * 6, vr: (rnd() - 0.5) * 12, age: 0, life: 0.4 + rnd() * 0.4, color: C[Math.floor(rnd() * C.length)]});
        }
        break;
      }
      case "magnet": {
        // A magnet in the swarm: a red ring that shrinks in on it, and sparks that fly from every ball it pulls to the magnet.
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.4, max: 70, color: "#ff6a6a"});
        for (const b of e.balls) {
          for (let k = 0; k < 3; k++) {
            this.confetti.push({x: b.x, y: b.y, vx: (e.x - b.x) * 2.5 + (rnd() - 0.5) * 30, vy: (e.y - b.y) * 2.5 + (rnd() - 0.5) * 30, rot: rnd() * 6, vr: (rnd() - 0.5) * 12, age: -k * 0.04, life: 0.35, color: k % 2 ? "#ffffff" : "#ff7a7a"});
          }
        }
        break;
      }
      case "lineChain": {
        // A chain in Draw to 10: the tiles burst in orange and gold, bigger with every step.
        const C = ["#ffe27a", "#ff9a3c", "#ffffff", "#ff6a2a"];
        for (const p of e.pts) {
          this.rings.push({x: p.x, y: p.y, age: 0, life: 0.4, max: 30 + 6 * e.n, color: "#ff9a3c"});
          for (let k = 0; k < 8 + 2 * e.n; k++) {
            const a = rnd() * Math.PI * 2;
            const s = 90 + rnd() * 160;
            this.confetti.push({x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, rot: rnd() * 6, vr: (rnd() - 0.5) * 14, age: 0, life: 0.4 + rnd() * 0.3, color: C[k % C.length]});
          }
        }
        break;
      }
      case "ghostShift": {
        // A ghost number of the snake changes: a puff of purple.
        for (let k = 0; k < 10; k++) {
          const a = rnd() * Math.PI * 2;
          const s = 40 + rnd() * 70;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 10, age: 0, life: 0.35, color: k % 2 ? "#e6d6ff" : "#a878ff"});
        }
        break;
      }
      case "guardHit": {
        // A shot meets the shield: a few blue sparks.
        for (let k = 0; k < 6; k++) {
          const a = Math.PI * (0.2 + rnd() * 0.6);
          const s = 60 + rnd() * 90;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s * (rnd() < 0.5 ? -1 : 1), vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 12, age: 0, life: 0.25, color: k % 2 ? "#ffffff" : "#7ad0ff"});
        }
        break;
      }
      case "guardBreak": {
        // The shield breaks: shards of blue glass fly off, and a ring.
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.4, max: 50, color: "#7ad0ff"});
        for (let k = 0; k < 26; k++) {
          const a = rnd() * Math.PI * 2;
          const s = 100 + rnd() * 200;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 18, age: 0, life: 0.45 + rnd() * 0.3, color: k % 3 ? "#bfe8ff" : "#ffffff"});
        }
        break;
      }
      case "mineDig": {
        // A block is dug: crumbs of earth fly off it.
        const C = ["#8a5a32", "#a8743e", "#5a3a20", "#d8b080"];
        for (let k = 0; k < 12; k++) {
          const an = rnd() * Math.PI * 2;
          const s = 60 + rnd() * 130;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 40, rot: rnd() * 6, vr: (rnd() - 0.5) * 14, age: 0, life: 0.35 + rnd() * 0.25, color: C[k % C.length]});
        }
        break;
      }
      case "mineHeavy": {
        // Too heavy (or a gate that the basket does not open): a few grey sparks and a little ring.
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.25, max: 26, color: "#c8c8d0"});
        break;
      }
      case "mineGate": {
        // A gate opens: a burst of gold and green.
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.5, max: 70, color: "#9cf0a8"});
        for (let k = 0; k < 24; k++) {
          const an = rnd() * Math.PI * 2;
          const s = 100 + rnd() * 180;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.5, color: k % 2 ? "#9cf0a8" : "#ffd54a"});
        }
        break;
      }
      case "mineGem": {
        // A gem: bright sparkles in all colours.
        const C = ["#ff9aa8", "#9ad6ff", "#9cf0a8", "#e0b0ff", "#ffffff"];
        for (let k = 0; k < 20; k++) {
          const an = rnd() * Math.PI * 2;
          const s = 80 + rnd() * 160;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 50, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.5, color: C[k % C.length]});
        }
        break;
      }
      case "mineErase": {
        // The numbers are wiped out: a puff of white chalk dust off every ball, one after the other.
        e.pts.forEach((p, i) => {
          for (let k = 0; k < 4; k++) {
            const an = rnd() * Math.PI * 2;
            const s = 20 + rnd() * 50;
            this.confetti.push({x: p.x, y: p.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 20, rot: rnd() * 6, vr: (rnd() - 0.5) * 8, age: -i * 0.012, life: 0.5, color: k % 2 ? "#ffffff" : "#e8e8f0"});
          }
        });
        break;
      }
      case "mineRestore": {
        // The numbers come back: a gold sparkle on every ball.
        e.pts.forEach((p, i) => {
          this.rings.push({x: p.x, y: p.y, age: -i * 0.012, life: 0.3, max: 22, color: "#ffe27a"});
        });
        break;
      }
      case "mineTen": {
        // A perfect 10 in the mine: a burst of gold, and a ring.
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.45, max: 60, color: "#ffe27a"});
        for (let k = 0; k < 30; k++) {
          const an = rnd() * Math.PI * 2;
          const s = 100 + rnd() * 200;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s - 60, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.5 + rnd() * 0.4, color: k % 3 ? "#ffd54a" : "#ffffff"});
        }
        break;
      }
      case "mineTip": {
        // The basket tips over: grey stones spill out.
        for (let k = 0; k < 16; k++) {
          const an = Math.PI * (1.1 + rnd() * 0.8);
          const s = 80 + rnd() * 120;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 14, age: 0, life: 0.5, color: k % 2 ? "#8a8a96" : "#5a5a66"});
        }
        break;
      }
      case "laserCross": {
        // The laser of the cannon: a beam across the swarm and one up and down it, purple with a white core, and sparks all along them.
        this.crosses.push({x: e.x, y: e.y, age: 0, life: 0.45});
        for (let i = 0; i < 30; i++) {
          const across = i % 2 === 0;
          const u = rnd();
          this.confetti.push({x: across ? u * W : e.x, y: across ? e.y : u * H, vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 120, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.3, color: i % 3 ? "#f0a8ff" : "#ffffff"});
        }
        break;
      }
      case "lineBolt": {
        // A bolt goes off: crackling lightning jumps from it to every tile it electrifies, with a flash and sparks there.
        for (const h of e.hits) {
          this.bolts.push({x0: e.x, y0: e.y, x1: h.x, y1: h.y, age: 0, life: 0.35, seed: rnd() * 1000});
          this.rings.push({x: h.x, y: h.y, age: 0, life: 0.3, max: 34, color: "#c9a8ff"});
          for (let k = 0; k < 10; k++) {
            const a = rnd() * Math.PI * 2;
            const s = 80 + rnd() * 150;
            this.confetti.push({x: h.x, y: h.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.25, color: k % 2 ? "#fff6a0" : "#b88cff"});
          }
        }
        break;
      }
      case "lineTen": {
        // A line makes 10: gold sparks fly from every tile of it, a ring swells round each, and a stream of light runs along it.
        const G = ["#fff6c4", "#ffe27a", "#ffc83a", "#ffffff"];
        e.pts.forEach((p, i) => {
          this.rings.push({x: p.x, y: p.y, age: -i * 0.04, life: 0.4, max: 36, color: "#ffe27a"});
          for (let k = 0; k < 10; k++) {
            const a = rnd() * Math.PI * 2;
            const s = 80 + rnd() * 160;
            this.confetti.push({x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, rot: rnd() * 6, vr: (rnd() - 0.5) * 14, age: -i * 0.04, life: 0.45 + rnd() * 0.3, color: G[k % G.length]});
          }
        });
        break;
      }
      case "tenMade": {
        // Balls of the swarm make 10: a thread of gold sparks runs from ball to ball, and a gold ring swells round each of them.
        const G = ["#fff6c4", "#ffe27a", "#ffc83a", "#ffffff"];
        e.balls.forEach((b, i) => {
          this.rings.push({x: b.x, y: b.y, age: -i * 0.05, life: 0.35, max: 30, color: "#ffe27a"});
          const n = e.balls[i + 1];
          if (!n) return;
          for (let k = 0; k < 8; k++) {
            const u = k / 7;
            this.confetti.push({x: b.x + (n.x - b.x) * u, y: b.y + (n.y - b.y) * u, vx: (rnd() - 0.5) * 40, vy: (rnd() - 0.5) * 40, rot: rnd() * 6, vr: (rnd() - 0.5) * 10, age: -i * 0.05 - u * 0.05, life: 0.3, color: G[k % G.length]});
          }
        });
        break;
      }
      case "bubblePop": {
        // A ball of the swarm pops: it bursts into bright bits and a quick ring.
        const C = ["#ffffff", "#ffe27a", "#ff9ad0", "#8fe0ff", "#9cf0a8"];
        for (let i = 0; i < 16; i++) {
          const a = rnd() * Math.PI * 2;
          const sp = 90 + rnd() * 170;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.3, color: C[Math.floor(rnd() * C.length)]});
        }
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.25, max: 28, color: "#ffffff"});
        break;
      }
      case "bombChain": {
        // One bomb sets off another: a streak of sparks flies from the one to the other, and a hot ring swells round the one whose fuse is lit.
        const C = ["#fff3b0", "#ffd54a", "#ff9a3c", "#ff4a2a"];
        for (let i = 0; i < 18; i++) {
          const u = i / 17;
          const x = e.fromX + (e.x - e.fromX) * u;
          const y = e.fromY + (e.y - e.fromY) * u;
          const a = rnd() * Math.PI * 2;
          const s = 30 + rnd() * 60;
          this.confetti.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: -u * 0.15, life: 0.35 + rnd() * 0.2, color: C[i % C.length]});
        }
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.3, max: 40, color: "#ffb03a"});
        this.rings.push({x: e.x, y: e.y, age: -0.1, life: 0.3, max: 56, color: "#ff5a2a"});
        break;
      }
      case "snakeFaster": {
        // The snake gets faster: a burst of red and orange sparks from its head, and a ring.
        const C = ["#ff4a3a", "#ff9a3c", "#ffe27a", "#ffffff"];
        for (let i = 0; i < 28; i++) {
          const a = rnd() * Math.PI * 2;
          const s = 120 + rnd() * 200;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.35 + rnd() * 0.35, color: C[Math.floor(rnd() * C.length)]});
        }
        this.rings.push({x: e.x, y: e.y, age: 0, life: 0.5, max: 60, color: "#ff6a3a"});
        break;
      }
      case "hurt": {
        // The ship loses a life: red sparks fly off it.
        for (let i = 0; i < 20; i++) {
          const a = rnd() * Math.PI * 2;
          const s = 100 + rnd() * 180;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.3 + rnd() * 0.3, color: i % 3 === 0 ? "#ffffff" : "#ff4a5a"});
        }
        break;
      }
      case "pickup": {
        // The jet picks up a ball: a ring of sparks in its colour.
        const C = e.kind === "fuel" ? ["#ffe2b8", "#ff9a3c", "#ffffff"] : e.kind === "weapon" ? ["#fff3b0", "#ffd54a", "#ffffff"] : e.kind === "heart" ? ["#ffd0dc", "#ff4a7a", "#ffffff"] : ["#d8f4ff", "#5cc8f5", "#ffffff"];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const s = 160 + rnd() * 80;
          this.confetti.push({x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: rnd() * 6, vr: (rnd() - 0.5) * 16, age: 0, life: 0.35 + rnd() * 0.3, color: C[i % C.length]});
        }
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
              y: -20 - rnd() * 220 - ui.extra,
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

  /** True (once) when a segment of the bar has faded away for good since last time: the sound plays then. */
  takeGone(): boolean {
    const any = this.goneNew > 0;
    this.goneNew = 0;
    return any;
  }

  /**
   * The progress that fades: the amount shown glides down to the real one (a little at a time, softly), and when a segment of the bar is
   * emptied for good, it breaks up: a flash, a ring and a few bits that fall.
   */
  private updateFade(g: GameState, dt: number): void {
    for (const e of this.gone) e.age += dt;
    this.gone = this.gone.filter((e) => e.age < 0.75);
    if (!fadeOn(g)) {
      this.drainShown = 0;
      return;
    }
    const cap = fadeCap(g);
    const target = Math.min(g.drain, cap);
    const before = Math.min(this.drainShown, cap);
    const gap = target - before;
    // (down to what it is: a soft start and then a steady pace; up is when a cup was filled and it is cut back)
    const step = gap > 0 ? Math.min(gap, Math.max(gap * dt * 6, 1.6 * dt)) : gap;
    this.drainShown = before + step;
    const was = g.level - 1 - before / FADE_TICKS;
    const now = g.level - 1 - this.drainShown / FADE_TICKS;
    if (now >= was) return;
    for (let s = Math.max(0, Math.floor(now - 1e-6)); s < Math.ceil(was); s++) {
      if (was > s + 1e-6 && now <= s + 1e-6) this.vanish(g, s % segmentCount(g));
    }
  }

  /** A segment of the progress bar is gone: it flashes and breaks up, and a ring spreads from it. */
  private vanish(g: GameState, seg: number): void {
    const rnd = Math.random;
    const c = segmentCenter(g, seg);
    const lay = segmentLayout(g);
    this.gone.push({seg, age: 0});
    this.goneNew += 1;
    this.rings.push({x: c.x, y: c.y, age: 0, life: 0.5, max: 34, color: "#ff9a7a"});
    for (let i = 0; i < 16; i++) {
      this.party.push({
        x: c.x + (rnd() - 0.5) * lay.segW * 0.9,
        y: c.y + (rnd() - 0.5) * 6,
        vx: (rnd() - 0.5) * 150,
        vy: -(30 + rnd() * 150),
        rot: rnd() * 6,
        vr: (rnd() - 0.5) * 14,
        age: 0,
        life: 0.7 + rnd() * 0.5,
        size: 2 + rnd() * 2.5,
        color: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd54a" : "#ff8a5c",
        kind: "paper",
        gravity: 620,
      });
    }
  }

  update(g: GameState, dt: number): void {
    const rnd = Math.random;
    for (const s of this.skulls) s.age += dt;
    this.skulls = this.skulls.filter((s) => s.age < 0.6);
    this.pop.t = Math.max(0, this.pop.t - dt * 1.8);
    this.updateFade(g, dt);
    for (const z of this.zaps) z.age += dt;
    this.zaps = this.zaps.filter((z) => z.age < (z.hits.length > 0 ? z.hits[z.hits.length - 1].at : 0) + 0.5);
    for (const b of this.beams) b.age += dt;
    this.beams = this.beams.filter((b) => b.age < b.life);
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
      const v = c.showTen > 0 && c.value === c.tenCarry ? TARGET : Math.abs(c.value);
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
    for (const b of this.bolts) b.age += dt;
    for (const c of this.crosses) c.age += dt;
    this.crosses = this.crosses.filter((c) => c.age < c.life);
    this.bolts = this.bolts.filter((b) => b.age < b.life);
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
    this.drainShown = 0;
    this.gone = [];
    this.goneNew = 0;
    this.celebration = null;
    this.party = [];
    this.rings = [];
    this.flash = 0;
    this.beams = [];
    this.zaps = [];
  }

  /** The celebration of a cleared level: drawn over the card, so that the sparks of the stars can be seen. */
  drawCelebration(ctx: CanvasRenderingContext2D): void {
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,248,220,${this.flash * 0.6})`;
      ctx.fillRect(0, -ui.extra, W, H + ui.extra);
    }
    // (the cross of the laser: a wide purple glow and a white core, that narrows as it fades)
    for (const c of this.crosses) {
      const k = c.age / c.life;
      for (const [w, col] of [[22 * (1 - k) + 4, "rgba(200,90,255,0.45)"], [5 * (1 - k) + 1.5, "rgba(255,255,255,0.95)"]] as const) {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = col;
        ctx.fillRect(0, c.y - w / 2, W, w);
        ctx.fillRect(c.x - w / 2, -ui.extra, w, H + ui.extra);
      }
    }
    // (the bolts of lightning: a jagged line that jumps about, purple with a white core)
    for (const b of this.bolts) {
      const k = b.age / b.life;
      const pts: {x: number; y: number}[] = [{x: b.x0, y: b.y0}];
      const n = 7;
      const jump = Math.floor(b.age * 30);
      const nx = -(b.y1 - b.y0);
      const ny = b.x1 - b.x0;
      const len = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const off = Math.sin(b.seed + i * 12.9898 + jump * 78.233) * 14;
        pts.push({x: b.x0 + (b.x1 - b.x0) * u + (nx / len) * off, y: b.y0 + (b.y1 - b.y0) * u + (ny / len) * off});
      }
      pts.push({x: b.x1, y: b.y1});
      for (const [w, c] of [[7, "rgba(170,120,255,0.55)"], [2.5, "rgba(255,255,255,0.95)"]] as const) {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
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
    for (const s of this.skulls) {
      const k = s.age / 0.6;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      drawSkull(ctx, s.x, s.y - 70 * k, 1.5 + 0.4 * k);
      ctx.restore();
    }
    // The lightning of a diamond: a jagged line from the diamond to the number it strikes, that flickers for a moment.
    for (const z of this.zaps) {
      z.hits.forEach((h, i) => {
        const u = (z.age - h.at) / 0.32;
        if (u < 0 || u >= 1) return;
        const flick = Math.floor(z.age * 45);
        const bolt = (spread: number, seed: number) => {
          const dx = h.x - z.x;
          const dy = h.y - z.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const parts = Math.max(5, Math.round(len / 24));
          ctx.beginPath();
          ctx.moveTo(z.x, z.y);
          for (let p = 1; p < parts; p++) {
            const f = p / parts;
            const r = Math.sin((flick + 1) * 12.9898 + i * 78.233 + p * 37.719 + seed) * 43758.5453;
            const off = (r - Math.floor(r) - 0.5) * spread;
            ctx.lineTo(z.x + dx * f + nx * off, z.y + dy * f + ny * off);
          }
          ctx.lineTo(h.x, h.y);
        };
        ctx.save();
        ctx.globalAlpha = 1 - u * u;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = h.ten ? "rgba(255,220,100,0.95)" : "rgba(110,190,255,0.95)";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = h.ten ? "rgba(255,214,90,0.7)" : "rgba(110,190,255,0.7)";
        ctx.lineWidth = 6;
        bolt(34, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        bolt(34, 0);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = h.ten ? "rgba(255,240,170,0.85)" : "rgba(190,235,255,0.85)";
        bolt(22, 5);
        ctx.stroke();
        // A glow where it strikes.
        const glow = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, 34);
        glow.addColorStop(0, h.ten ? "rgba(255,236,150,0.9)" : "rgba(200,240,255,0.9)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
    for (const b of this.beams) {
      const k = b.age / b.life;
      const w = 46 * (1 - k * 0.7);
      const beam = ctx.createLinearGradient(b.x - w / 2, 0, b.x + w / 2, 0);
      beam.addColorStop(0, "rgba(180,110,255,0)");
      beam.addColorStop(0.35, `rgba(220,160,255,${0.55 * (1 - k)})`);
      beam.addColorStop(0.5, `rgba(255,255,255,${0.95 * (1 - k)})`);
      beam.addColorStop(0.65, `rgba(220,160,255,${0.55 * (1 - k)})`);
      beam.addColorStop(1, "rgba(180,110,255,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(b.x - w / 2, b.y1, w, b.y0 - b.y1);
    }
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

    // The ring from the cup: a soft band of light that fades out on both sides (not a line with a hard edge).
    if (p.age < 0.6) {
      const r = p.age / 0.6;
      const ringX = p.x;
      const ringY = p.y + 74 - CUP_H / 2;
      const radius = 14 + 70 * (1 - Math.pow(1 - r, 3));
      const band = 9 * (1 - r) + 5;
      const soft = ctx.createRadialGradient(ringX, ringY, Math.max(0, radius - band), ringX, ringY, radius + band);
      soft.addColorStop(0, "rgba(255,226,122,0)");
      soft.addColorStop(0.5, `rgba(255,226,122,${0.85 * (1 - r)})`);
      soft.addColorStop(1, "rgba(255,226,122,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = soft;
      ctx.beginPath();
      ctx.arc(ringX, ringY, radius + band, 0, Math.PI * 2);
      ctx.fill();
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
