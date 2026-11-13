// The settings page: a gear in the corner opens it over whatever is on the screen. Sound, language, the presentations of
// new things, and the button for the one who makes the game that opens every level.
import {H, W} from "../game/constants";
import {CHALK, GOLD, TAU, type Button, drawButton, drawFlag, drawPanel, drawRibbon, registerHit, roundRect, text, ui, write} from "./draw";
import {LANGS, LANG_NAMES, lang, t} from "./i18n";
import {type Board} from "./scores";
import {VOLUME_STEPS} from "./audio";

/** The gear that opens the settings. */
export const GEAR_BUTTON: Button = {x: 310, y: 10, w: 38, h: 38};

/** The pause button in a round: big and in the corner, where the thumb is. It takes the place of the gear. */
export const PAUSE_BUTTON: Button = {x: 304, y: 8, w: 48, h: 48};

/** Two bars. */
export function drawPauseIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string): void {
  ctx.fillStyle = ink;
  roundRect(ctx, cx - 9, cy - 9, 6.5, 18, 2.5);
  ctx.fill();
  roundRect(ctx, cx + 2.5, cy - 9, 6.5, 18, 2.5);
  ctx.fill();
}

/** A gear: a ring with eight teeth and a hole in the middle. */
export function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string): void {
  const teeth = 8;
  const outer = 12;
  const inner = 9;
  ctx.fillStyle = ink;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = (i * TAU) / teeth - Math.PI / 2;
    const pts: [number, number][] = [
      [a - 0.23, inner],
      [a - 0.13, outer],
      [a + 0.13, outer],
      [a + 0.23, inner],
    ];
    pts.forEach(([ang, rad], k) => {
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      if (i === 0 && k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }
  ctx.closePath();
  ctx.moveTo(cx + 3.8, cy);
  ctx.arc(cx, cy, 3.8, 0, TAU, true);
  ctx.fill("evenodd");
}

/** A loudspeaker: with waves when the sound is on, and a red cross when it is off. */
function speaker(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string, muted: boolean): void {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 3.5);
  ctx.lineTo(cx - 4, cy - 3.5);
  ctx.lineTo(cx + 2, cy - 9);
  ctx.lineTo(cx + 2, cy + 9);
  ctx.lineTo(cx - 4, cy + 3.5);
  ctx.lineTo(cx - 9, cy + 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  if (muted) {
    ctx.strokeStyle = "#ff8a80";
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 5);
    ctx.lineTo(cx + 13, cy + 5);
    ctx.moveTo(cx + 13, cy - 5);
    ctx.lineTo(cx + 6, cy + 5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 5.5, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 10, -0.9, 0.9);
    ctx.stroke();
  }
}

/** A music note: dimmed when the music is off. */
function note(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string, on: boolean): void {
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.45;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy + 6, 5, 3.8, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 1.6, cy + 5);
  ctx.lineTo(cx + 1.6, cy - 9);
  ctx.quadraticCurveTo(cx + 3, cy - 4, cx + 9, cy - 3);
  ctx.stroke();
  ctx.restore();
}

/** A switch that is on or off (x, y is its upper left corner). */
function drawSwitch(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, on: boolean): void {
  registerHit(ctx, id, {x: x - 8, y: y - 8, w: 76, h: 46});
  const pressed = ui.pressed === id;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, x, y + 2, 60, 30, 15);
  ctx.fill();
  const track = ctx.createLinearGradient(0, y, 0, y + 30);
  track.addColorStop(0, on ? "#5fe08e" : "#6b6485");
  track.addColorStop(1, on ? "#2da35a" : "#443e5c");
  ctx.fillStyle = track;
  roundRect(ctx, x, y, 60, 30, 15);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.stroke();
  const kx = x + (on ? 45 : 15) + (pressed ? (on ? -2 : 2) : 0);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(kx + 1, y + 17, 12, 0, TAU);
  ctx.fill();
  const knob = ctx.createLinearGradient(0, y + 3, 0, y + 27);
  knob.addColorStop(0, "#ffffff");
  knob.addColorStop(1, "#d6d0e0");
  ctx.fillStyle = knob;
  ctx.beginPath();
  ctx.arc(kx, y + 15, 12, 0, TAU);
  ctx.fill();
}

const PANEL = {x: 24, y: 92, w: 312, h: 520};

/** Three bars that grow: the volume. */
function volumeIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string): void {
  ctx.fillStyle = ink;
  [6, 11, 16].forEach((h, i) => {
    roundRect(ctx, cx - 11 + i * 8, cy + 8 - h, 5, h, 2);
    ctx.fill();
  });
}

/** A minus or a plus sign, on a round button. */
function sign(plus: boolean): (ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string) => void {
  return (ctx, cx, cy, ink) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy);
    ctx.lineTo(cx + 6, cy);
    if (plus) {
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy + 6);
    }
    ctx.stroke();
  };
}

/** What the settings page needs to know. */
export interface SettingsState {
  muted: boolean;
  /** The music in the background is on. */
  music: boolean;
  /** The volume of everything, 1 to VOLUME_STEPS. */
  volume: number;
  unlockAll: boolean;
  /** The name the player has chosen for the top list ("" if none). */
  name: string;
  /** Some of the presentations of new things have been hidden with "don't show again". */
  hiddenIntros: boolean;
}

/** The settings page: a dark veil over everything, and a panel with the settings. Tapping the veil, or Done, closes it. */
export function drawSettings(ctx: CanvasRenderingContext2D, st: SettingsState, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.72)";
  ctx.fillRect(0, 0, W, H);
  registerHit(ctx, "settingsClose", {x: 0, y: 0, w: W, h: H});
  registerHit(ctx, "settingsPanel", PANEL);
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 24);
  drawRibbon(ctx, W / 2, 62, 240, t("settings"), "#ffe27a", "#d49a14");

  // Sound.
  const rowY = 148;
  speaker(ctx, 56, rowY + 15, CHALK, st.muted);
  text(ctx, t("sound"), 84, rowY + 16, 20, CHALK, "left");
  drawSwitch(ctx, "set:sound", PANEL.x + PANEL.w - 80, rowY, !st.muted);

  // The music in the background (it is silent as well when the sound is off).
  const musicY = rowY + 42;
  note(ctx, 56, musicY + 15, CHALK, st.music);
  text(ctx, t("music"), 84, musicY + 16, 20, CHALK, "left");
  drawSwitch(ctx, "set:music", PANEL.x + PANEL.w - 80, musicY, st.music);

  // The volume of everything: minus, bars (one for each step) and plus.
  const volY = musicY + 42;
  volumeIcon(ctx, 56, volY + 15, CHALK);
  text(ctx, t("volume"), 84, volY + 16, 20, CHALK, "left");
  drawButton(ctx, "set:volDown", {x: 184, y: volY - 2, w: 34, h: 34}, "", "round", {draw: sign(false), alpha: st.volume <= 1 ? 0.4 : 1});
  for (let i = 0; i < VOLUME_STEPS; i++) {
    const h = 8 + i * 4;
    ctx.fillStyle = i < st.volume ? GOLD : "rgba(255,255,255,0.18)";
    roundRect(ctx, 226 + i * 11, volY + 28 - h, 8, h, 2.5);
    ctx.fill();
  }
  drawButton(ctx, "set:volUp", {x: 282, y: volY - 2, w: 34, h: 34}, "", "round", {draw: sign(true), alpha: st.volume >= VOLUME_STEPS ? 0.4 : 1});

  // Language: a flag for each, the one that is on is lit.
  text(ctx, t("language"), 44, 288, 20, CHALK, "left");
  LANGS.forEach((l, i) => {
    const b = {x: 40 + i * 72, y: 304, w: 64, h: 46};
    const id = `set:lang:${l}`;
    const current = l === lang();
    registerHit(ctx, id, b);
    const pressed = ui.pressed === id;
    ctx.fillStyle = current ? "rgba(255,213,74,0.22)" : pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)";
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.lineWidth = current ? 2.4 : 1.4;
    ctx.strokeStyle = current ? GOLD : "rgba(255,255,255,0.25)";
    ctx.stroke();
    drawFlag(ctx, l, b.x + b.w / 2 - 17, b.y + b.h / 2 - 12, 34, 24);
  });
  write(ctx, LANG_NAMES[lang()], W / 2, 364, 15, "#e8dcc2", "center", 600);

  // The presentations of new things.
  drawButton(ctx, "set:news", {x: 40, y: 384, w: 280, h: 42}, st.hiddenIntros ? t("introsAgain") : t("introsOn"), "secondary", {size: 17, alpha: st.hiddenIntros ? 1 : 0.5});

  // The name in the top list.
  drawButton(ctx, "set:name", {x: 40, y: 436, w: 280, h: 42}, `${t("name")}: ${st.name || "\u2014"}`, "secondary", {size: 17});

  // For the one who makes the game: every level open.
  write(ctx, t("adminRow"), 44, 504, 15, "#e8dcc2", "left", 600);
  drawSwitch(ctx, "set:admin", PANEL.x + PANEL.w - 80, 488, st.unlockAll);

  drawButton(ctx, "settingsClose", {x: W / 2 - 110, y: 544, w: 220, h: 54}, t("done"), "primary", {pulse: time, size: 22});
}

/**
 * The pause page of a round: a dark veil and a panel with Resume, the sound and Quit. The game waits behind it, and a tap
 * outside the panel does nothing (so that a stray tap does not start the round again).
 */
export function drawPause(ctx: CanvasRenderingContext2D, muted: boolean, music: boolean, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.74)";
  ctx.fillRect(0, 0, W, H);
  const panel = {x: 40, y: 150, w: 280, h: 340};
  drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  drawRibbon(ctx, W / 2, 120, 220, t("paused"), "#ffe27a", "#d49a14");
  drawButton(ctx, "pauseResume", {x: W / 2 - 110, y: 206, w: 220, h: 64}, t("resume"), "primary", {pulse: time, size: 26});
  // The sound.
  speaker(ctx, 76, 318, CHALK, muted);
  text(ctx, t("sound"), 102, 319, 20, CHALK, "left");
  drawSwitch(ctx, "set:sound", panel.x + panel.w - 92, 303, !muted);
  // The music.
  note(ctx, 76, 360, CHALK, music);
  text(ctx, t("music"), 102, 361, 20, CHALK, "left");
  drawSwitch(ctx, "set:music", panel.x + panel.w - 92, 345, music);
  drawButton(ctx, "pauseQuit", {x: W / 2 - 110, y: 408, w: 220, h: 54}, t("quitLevel"), "secondary", {size: 19});
}

/** A little trophy (a cup with two handles on a foot). */
export function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string): void {
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 10);
  ctx.lineTo(cx + 8, cy - 10);
  ctx.lineTo(cx + 6, cy + 1);
  ctx.quadraticCurveTo(cx + 5, cy + 5, cx + 1.5, cy + 5.5);
  ctx.lineTo(cx - 1.5, cy + 5.5);
  ctx.quadraticCurveTo(cx - 5, cy + 5, cx - 6, cy + 1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 7);
  ctx.quadraticCurveTo(cx - 14, cy - 6, cx - 11, cy);
  ctx.quadraticCurveTo(cx - 9, cy + 2.5, cx - 6.5, cy + 2);
  ctx.moveTo(cx + 8, cy - 7);
  ctx.quadraticCurveTo(cx + 14, cy - 6, cx + 11, cy);
  ctx.quadraticCurveTo(cx + 9, cy + 2.5, cx + 6.5, cy + 2);
  ctx.stroke();
  ctx.fillRect(cx - 1.2, cy + 5, 2.4, 4);
  ctx.fillRect(cx - 6, cy + 8.5, 12, 3);
}

/** The top list of the endless game: the best ten with their names, or what is wrong with it. Tapping the veil, or Done, closes it. */
export function drawScores(ctx: CanvasRenderingContext2D, bd: Board, myDevice: string, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.74)";
  ctx.fillRect(0, 0, W, H);
  registerHit(ctx, "scoresClose", {x: 0, y: 0, w: W, h: H});
  const panel = {x: 24, y: 92, w: 312, h: 476};
  registerHit(ctx, "scoresPanel", panel);
  drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  drawRibbon(ctx, W / 2, 62, 240, t("topList"), "#ffe27a", "#d49a14");
  if (bd.status === "ok" && bd.rows.length > 0) {
    bd.rows.forEach((r, i) => {
      const y = 152 + i * 32;
      const mine = r.device === myDevice;
      if (mine) {
        ctx.fillStyle = "rgba(255,213,74,0.2)";
        roundRect(ctx, 38, y - 14, 284, 28, 10);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,213,74,0.7)";
        ctx.stroke();
      }
      const medal = i === 0 ? "#ffd54a" : i === 1 ? "#d8dde6" : i === 2 ? "#e0a070" : CHALK;
      text(ctx, String(i + 1), 62, y + 1, 17, medal, "center");
      text(ctx, r.name, 88, y + 1, 17, mine ? GOLD : CHALK, "left");
      text(ctx, String(r.score), 308, y + 1, 17, mine ? GOLD : CHALK, "right");
    });
  } else {
    const message = bd.status === "off" ? t("scoresOff") : bd.status === "loading" ? t("scoresLoading") : bd.status === "error" ? t("scoresError") : t("scoresEmpty");
    write(ctx, message, W / 2, 300, 17, "#e8dcc2", "center", 600);
  }
  drawButton(ctx, "scoresClose", {x: W / 2 - 110, y: 500, w: 220, h: 54}, t("done"), "primary", {pulse: time, size: 22});
}
