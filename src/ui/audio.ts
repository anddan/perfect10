// Small synthesized sounds (no files to load). Starts on the first touch, as browsers require.
import type {GameEvent} from "../game/types";

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem("p10-muted") === "1";
} catch {
  /* private mode */
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem("p10-muted", muted ? "1" : "0");
  } catch {
    /* private mode */
  }
  return muted;
}

/** Call from a touch or click. */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

interface ToneOptions {
  type?: OscillatorType;
  vol?: number;
  slide?: number;
  delay?: number;
}

function tone(freq: number, dur: number, {type = "sine", vol = 0.15, slide = 0, delay = 0}: ToneOptions = {}): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Plays the sound that goes with something that happened in the game. */
export function playEvent(e: GameEvent): void {
  switch (e.t) {
    case "tap":
      tone(500, 0.12, {type: "triangle", slide: 300, vol: 0.1});
      break;
    case "land":
      tone(320, 0.16, {slide: -200, vol: 0.2});
      tone(180, 0.1, {vol: 0.1, delay: 0.04});
      break;
    case "levelUp":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, {type: "triangle", vol: 0.16, delay: i * 0.09}));
      break;
    case "revive":
      tone(600, 0.2, {slide: 400, vol: 0.12, delay: 0.3});
      break;
    case "bust":
      tone(220, 0.5, {type: "sawtooth", slide: -150, vol: 0.12});
      break;
    case "miss":
      tone(140, 0.08, {type: "triangle", vol: 0.08});
      break;
    case "gameOver":
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, {type: "triangle", vol: 0.16, delay: 0.3 + i * 0.18}));
      break;
  }
}
