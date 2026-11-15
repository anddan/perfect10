// The settings page: a gear in the corner opens it over whatever is on the screen. Sound, language, the presentations of
// new things, and the button for the one who makes the game that opens every level.
import {H, W} from "../game/constants";
import {CHALK, FONT, GOLD, TAU, type Button, drawButton, drawCoin, drawWoodPill, drawFlag, logoTitle, wrapLines, drawPanel, drawRibbon, registerHit, roundRect, text, ui, write} from "./draw";
import {LANGS, LANG_NAMES, lang, t} from "./i18n";
import {type Board} from "./scores";
import {VOLUME_STEPS} from "./audio";
import {drawPropBadge, drawShopCup} from "./cupArt";
import {SHOP_CUPS, isShopCup} from "../game/cups";
import {ENERGY_MAX, ENERGY_PER_AD, ENERGY_REGEN_SECONDS, clock} from "./energy";

/** The energy (the key) at the left of the header of the book. */
export const ENERGY_PILL: Button = {x: 14, y: 6, w: 68, h: 30};

/** The gear that opens the settings. */
export const GEAR_BUTTON: Button = {x: 308, y: 3, w: 38, h: 38};

/** The coins in the top right corner of the header of the book (where the gear used to be): a pill that is as wide as the number needs. */
export function coinsPillBox(ctx: CanvasRenderingContext2D, coins: number): Button {
  ctx.font = `700 17px ${FONT}`;
  const w = Math.max(68, Math.ceil(ctx.measureText(String(coins)).width) + 50);
  return {x: 346 - w, y: 6, w, h: 30};
}

/** The coins, as a wood pill like the one for the keys on the other side (a tap goes to the shop). */
export function drawCoinsPill(ctx: CanvasRenderingContext2D, coins: number): void {
  const b = coinsPillBox(ctx, coins);
  drawWoodPill(ctx, "coins", b, (c, _cx, cy) => {
    drawCoin(c, b.x + 17, cy, 9);
    text(c, String(coins), b.x + b.w - 12, cy + 1, 17, "#ffffff", "right", "rgba(40,25,5,0.85)");
  });
}

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
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  registerHit(ctx, "settingsClose", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
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
  // (with the sound off the music is silent too, so there is nothing to turn up: the whole row is dimmed and its buttons do nothing)
  ctx.save();
  if (st.muted) ctx.globalAlpha = 0.35;
  volumeIcon(ctx, 56, volY + 15, CHALK);
  text(ctx, t("volume"), 84, volY + 16, 20, CHALK, "left");
  for (let i = 0; i < VOLUME_STEPS; i++) {
    const h = 8 + i * 4;
    ctx.fillStyle = i < st.volume ? GOLD : "rgba(255,255,255,0.18)";
    roundRect(ctx, 226 + i * 11, volY + 28 - h, 8, h, 2.5);
    ctx.fill();
  }
  ctx.restore();
  drawButton(ctx, "set:volDown", {x: 184, y: volY - 2, w: 34, h: 34}, "", "round", {draw: sign(false), alpha: st.muted ? 0.3 : st.volume <= 1 ? 0.4 : 1});
  drawButton(ctx, "set:volUp", {x: 282, y: volY - 2, w: 34, h: 34}, "", "round", {draw: sign(true), alpha: st.muted ? 0.3 : st.volume >= VOLUME_STEPS ? 0.4 : 1});

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

/** The very first start of the game: choose a language (English is on) and start a new game. */
export function drawStart(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.94)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  registerHit(ctx, "startPanel", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
  drawPanel(ctx, 24, 70, 312, 500, 24);
  drawRibbon(ctx, W / 2, 62, 240, t("startWelcome"), "#ffe27a", "#d49a14");
  logoTitle(ctx, "PERFECT 10", W / 2, 150, 36);
  write(ctx, t("startPickLang"), W / 2, 222, 18, "#e8dcc2", "center", 700);
  LANGS.forEach((l, i) => {
    const b = {x: 42 + (i % 2) * 140, y: 246 + Math.floor(i / 2) * 76, w: 136, h: 64};
    const id = `set:lang:${l}`;
    const current = l === lang();
    registerHit(ctx, id, b);
    const pressed = ui.pressed === id;
    ctx.fillStyle = current ? "rgba(255,213,74,0.22)" : pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)";
    roundRect(ctx, b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.lineWidth = current ? 2.6 : 1.4;
    ctx.strokeStyle = current ? GOLD : "rgba(255,255,255,0.25)";
    ctx.stroke();
    drawFlag(ctx, l, b.x + b.w / 2 - 17, b.y + 10, 34, 24);
    write(ctx, LANG_NAMES[l], b.x + b.w / 2, b.y + 49, 15, current ? "#ffffff" : "#e8dcc2", "center", 700);
  });
  drawButton(ctx, "start:new", {x: W / 2 - 120, y: 462, w: 240, h: 60}, t("startNew"), "primary", {pulse: time, size: 24});
}

/** A key (the energy), centred on (cx, cy), drawn like a cartoon: gold with a thick dark blue edge, and a round head with a hole in it. Grey when there is no energy. */
export function drawKey(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, active: boolean): void {
  const k = size / 20;
  const edge = active ? "#1b2347" : "#3a3a44";
  const light = active ? "#fcc82f" : "#bdbdbd";
  const dark = active ? "#e39a17" : "#8d8d8d";
  // The key is drawn lying down (the head to the right, the shaft with its three teeth to the left) and then turned, so that the head is up to the right.
  const body = new Path2D();
  body.arc(6, 0, 5.3, 0, Math.PI * 2, true);
  // (the shaft goes a little way into the head only: its end is not seen, and the edge of the key is drawn round the whole shape, with no line inside the head)
  body.moveTo(1.5, -1.7);
  body.lineTo(-10.6, -1.7);
  body.lineTo(-10.6, 4.6);
  body.lineTo(-7.9, 4.6);
  body.lineTo(-7.9, 1.7);
  body.lineTo(-6.3, 1.7);
  body.lineTo(-6.3, 3.9);
  body.lineTo(-3.8, 3.9);
  body.lineTo(-3.8, 1.7);
  body.lineTo(1.5, 1.7);
  body.closePath();
  const ring = new Path2D();
  ring.arc(6, 0, 2.4, 0, Math.PI * 2, false);
  const all = new Path2D();
  all.addPath(body);
  all.addPath(ring);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-0.4, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // The edge first (the gold covers its inner half, so that nothing of it is seen inside the shape), then the gold: light at the top and
  // slowly darker towards the bottom, without a line between them.
  ctx.lineWidth = 2;
  ctx.strokeStyle = edge;
  ctx.stroke(all);
  const gold = ctx.createLinearGradient(0, -5.3, 0, 5.3);
  gold.addColorStop(0, light);
  gold.addColorStop(0.4, light);
  gold.addColorStop(1, dark);
  ctx.fillStyle = gold;
  ctx.fill(all);
  // A white shine over the upper half, like the one on the letters of the logo: strongest at the top of the key (as it is seen on the screen) and
  // fading out softly towards the middle, with no edge. (The key is turned a quarter of a turn, so the top of the screen is up to the right here.)
  ctx.save();
  ctx.clip(all);
  const shine = ctx.createLinearGradient(7.1, -7.1, -1.5, 1.5);
  shine.addColorStop(0, "rgba(255,255,255,0.9)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.3)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(-14, -14, 28, 28);
  ctx.restore();
  ctx.restore();
}

/** A small four-pointed twinkle. */
function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.closePath();
  ctx.fill();
}

/**
 * The energy in the corner of the book: a bolt and how many points there are (it opens the energy page), and when the next one comes.
 * When a point has just been spent (ui.energyFx counts the seconds) the bolt gives a soft pulse with a ring of light round it, the old number slides
 * up and out while the new one slides in from below, a few twinkles drift up, and a "-1" rises and fades.
 */
export function drawEnergyPill(ctx: CanvasRenderingContext2D, n: number, nextSeconds: number, unlimited = false, beside = false): void {
  const f = ui.energyFx;
  const spending = f >= 0 && f < 1 && !unlimited;
  const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const ink = n > 0 || unlimited ? "#ffffff" : "#ff9a8f";
  drawWoodPill(ctx, "energy", ENERGY_PILL, (c, cx, cy) => {
    {
      // The bolt: it swells a little and settles.
      const pop = spending ? 1 + 0.3 * Math.pow(Math.max(0, 1 - f / 0.32), 2) : 1;
      c.save();
      c.translate(cx - 13, cy);
      c.scale(pop, pop);
      drawKey(c, 0, 0, 20, n > 0 || unlimited);
      c.restore();
      if (unlimited) {
        text(c, "∞", cx + 12, cy + 1, 24, ink, "center", "rgba(40,25,5,0.85)");
      } else if (spending) {
        // The old number goes up and out, the new one comes up from below.
        const u = ease(f / 0.42);
        c.save();
        c.beginPath();
        c.rect(cx - 1, cy - 14, 28, 28);
        c.clip();
        c.globalAlpha = 1 - u;
        text(c, String(n + 1), cx + 12, cy + 1 - u * 15, 20, "#ffffff", "center", "rgba(40,25,5,0.85)");
        c.globalAlpha = u;
        text(c, String(n), cx + 12, cy + 1 + (1 - u) * 15, 20, ink, "center", "rgba(40,25,5,0.85)");
        c.restore();
      } else {
        text(c, String(n), cx + 12, cy + 1, 20, ink, "center", "rgba(40,25,5,0.85)");
      }
    }
  });
  // The countdown to the next point: under the pill, or (with room, when the title has a row of its own) just to the right of it.
  if (n < ENERGY_MAX && !unlimited) {
    const label = `+1 · ${clock(nextSeconds)}`;
    if (beside) text(ctx, label, ENERGY_PILL.x + ENERGY_PILL.w + 8, 22, 13, "#fff3c0", "left", "rgba(0,0,0,0.75)");
    else text(ctx, label, 48, 46, 12, "#fff3c0", "center", "rgba(0,0,0,0.75)");
  }
  if (!spending) return;
  const u = Math.min(1, f / 0.6);
  ctx.save();
  // A soft glow round the bolt, and a ring of light that spreads and fades.
  const glow = ctx.createRadialGradient(35, 21, 2, 35, 21, 26);
  glow.addColorStop(0, `rgba(255,236,150,${0.55 * (1 - u)})`);
  glow.addColorStop(1, "rgba(255,236,150,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(35, 21, 26, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 0.8 + 2 * (1 - u);
  ctx.strokeStyle = `rgba(255,240,170,${0.85 * (1 - u)})`;
  ctx.beginPath();
  ctx.arc(35, 21, 8 + ease(u) * 22, 0, TAU);
  ctx.stroke();
  // Twinkles drift up from the bolt.
  const drift = [[-6, 0.0, 3.4], [7, 0.12, 2.8], [-1, 0.22, 2.4], [11, 0.3, 2.2], [-10, 0.38, 2]] as const;
  for (const [dx, delay, size] of drift) {
    const k = (f - delay) / 0.62;
    if (k <= 0 || k >= 1) continue;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.fillStyle = "#fff6c4";
    twinkle(ctx, 35 + dx + Math.sin(k * 5 + dx) * 2, 21 - ease(k) * 30, size * (1 - k * 0.3));
  }
  // The -1, rising from the number and fading away.
  const a = Math.min(1, f / 0.14) * (1 - Math.max(0, (f - 0.5) / 0.5));
  ctx.globalAlpha = Math.max(0, a);
  text(ctx, "−1", 60, 30 - ease(f / 0.9) * 13, 16, "#fff3c0", "center", "rgba(70,40,5,0.85)");
  ctx.restore();
}

const CUP_NAME = {gold: "cupGold", thermos: "cupThermos", magnet: "cupMagnet", big: "cupBig", laser: "cupLaser"} as const;
const CUP_DESC = {gold: ["cupGoldA", "cupGoldB"], thermos: ["cupThermosA", "cupThermosB"], magnet: ["cupMagnetA", "cupMagnetB"], big: ["cupBigA", "cupBigB"], laser: ["cupLaserA", "cupLaserB"]} as const;

/**
 * The cups of the desk: the four cups on a strip, each with a badge for every power it has (the colours of the powers mix on the cup), and for the
 * cup that is chosen a list of the powers that have been bought, as switches. It opens when a cup is bought, so that it can be put on the cups, and
 * from the shop.
 */
export function drawCups(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(8,6,14,0.8)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  registerHit(ctx, "cupsPanel", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
  const owned = SHOP_CUPS.filter((k) => (ui.owned[k] ?? 0) > 0);
  const rowH = 42;
  const listY = 312;
  // (the panel is as tall as the list of powers is long)
  const listEnd = owned.length > 0 ? listY + owned.length * rowH + 4 : 296;
  const panel = {x: 22, y: 90, w: 316, h: listEnd + 14 + 42 + 18 - 90};
  // (a solid colour under the panel, so that the page behind it does not show through)
  ctx.fillStyle = "#241d33";
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  ctx.fill();
  drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  drawRibbon(ctx, W / 2, 62, 230, t("cupsTitle"), "#ffe27a", "#d49a14");
  const focus = ui.cupFocus && isShopCup(ui.cupFocus) ? t(CUP_NAME[ui.cupFocus]) : null;
  ctx.font = `600 13px ${FONT}`;
  const intro = owned.length === 0 ? t("cupsNone") : focus ? t("cupsPick", {name: focus}) : t("cupsHelp");
  wrapLines(ctx, intro, panel.w - 44)
    .slice(0, 2)
    .forEach((line, k) => write(ctx, line, W / 2, 126 + k * 17, 13, "#e8dcc2", "center", 600));

  // The four cups, on a strip (the desk).
  const stripY = 150;
  const stripH = 116;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  roundRect(ctx, 34, stripY, 292, stripH, 16);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const cx = 44 + i * 68 + 34;
    const kinds = (ui.slots[i] ?? []).filter(isShopCup);
    const chosen = ui.cupSlot === i;
    if (chosen) {
      ctx.save();
      ctx.shadowColor = "rgba(255,213,74,0.55)";
      ctx.shadowBlur = 14;
      const card = ctx.createLinearGradient(0, stripY + 6, 0, stripY + stripH - 6);
      card.addColorStop(0, "rgba(255,226,122,0.26)");
      card.addColorStop(1, "rgba(255,213,74,0.1)");
      ctx.fillStyle = card;
      roundRect(ctx, cx - 32, stripY + 6, 64, stripH - 12, 12);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,213,74,0.95)";
      roundRect(ctx, cx - 32, stripY + 6, 64, stripH - 12, 12);
      ctx.stroke();
    }
    registerHit(ctx, `cups:slot:${i}`, {x: cx - 34, y: stripY, w: 68, h: stripH});
    // The number of the cup.
    ctx.fillStyle = chosen ? "#ffd54a" : "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(cx - 21, stripY + 20, 8.5, 0, TAU);
    ctx.fill();
    write(ctx, String(i + 1), cx - 21, stripY + 21, 12, chosen ? "#4a2a05" : "#e8dcc2", "center", 800);
    drawShopCup(ctx, kinds, cx, stripY + 84, 0.72, {badges: "below"});
  }

  // What the chosen cup has: a title, quick buttons, and the powers as a list of switches.
  write(ctx, t("cupsOf", {n: ui.cupSlot + 1}), 40, 290, 17, "#ffffff", "left", 700);
  if (owned.length > 0) {
    drawButton(ctx, "cups:all", {x: 214, y: 277, w: 52, h: 26}, t("cupsAll"), "secondary", {size: 12.5});
    drawButton(ctx, "cups:clear", {x: 272, y: 277, w: 52, h: 26}, t("cupsClear"), "secondary", {size: 12.5});
  }
  if (owned.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    roundRect(ctx, 34, listY - 4, 292, owned.length * rowH + 8, 14);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();
  }
  owned.forEach((kind, i) => {
    const y0 = listY + i * rowH;
    const on = (ui.slots[ui.cupSlot] ?? []).includes(kind);
    const marked = ui.cupFocus === kind;
    // (every cup that has a power needs a copy of its own: a power with none to spare cannot be switched on)
    const used = ui.slots.filter((list) => list.includes(kind)).length;
    const free = (ui.owned[kind] ?? 0) - used;
    const locked = !on && free < 1;
    if (marked) {
      ctx.fillStyle = "rgba(255,213,74,0.1)";
      roundRect(ctx, 38, y0, 284, rowH - 2, 11);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255,213,74,0.65)";
      ctx.stroke();
    } else if (i > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(52, y0 - 1, 258, 1);
    }
    registerHit(ctx, `cups:toggle:${kind}`, {x: 34, y: y0 - 1, w: 292, h: rowH});
    drawPropBadge(ctx, kind, 62, y0 + rowH / 2 - 1, 14);
    write(ctx, t(CUP_NAME[kind]), 86, y0 + 12, 15, locked ? "#a79bc0" : "#ffffff", "left", 700);
    // How many of the copies are on cups.
    ctx.font = `700 15px ${FONT}`;
    const nameW = ctx.measureText(t(CUP_NAME[kind])).width;
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, 86 + nameW + 8, y0 + 4, 34, 16, 8);
    ctx.fill();
    write(ctx, `${used}/${ui.owned[kind] ?? 0}`, 86 + nameW + 25, y0 + 12.5, 10.5, free < 1 ? "#ffd54a" : "#e8dcc2", "center", 700);
    ctx.font = `600 10px ${FONT}`;
    wrapLines(ctx, CUP_DESC[kind].map((k) => t(k)).join(" "), 176)
      .slice(0, 2)
      .forEach((line, k) => write(ctx, line, 86, y0 + 25 + k * 11, 10, "#bfb3d6", "left", 600));
    // The switch.
    const sx = 322 - 12 - 44;
    ctx.globalAlpha = locked ? 0.4 : 1;
    ctx.fillStyle = on ? "#2fae5e" : "rgba(255,255,255,0.16)";
    roundRect(ctx, sx, y0 + rowH / 2 - 13, 44, 24, 12);
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = on ? "#0f5a2a" : "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(on ? sx + 33 : sx + 11, y0 + rowH / 2 - 1, 9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  drawButton(ctx, "cups:close", {x: 70, y: listEnd + 14, w: 220, h: 42}, t("cupsClose"), "primary", {size: 19});
}

/** The coins in the corner of the book (on a tall phone, under the energy): a coin and how many there are; it opens the shop. */
export function drawCoinPill(ctx: CanvasRenderingContext2D, coins: number): void {
  drawButton(ctx, "coins", {x: 8, y: 62, w: 70, h: 30}, "", "secondary", {
    draw: (c, cx, cy) => {
      drawCoin(c, cx - 17, cy, 9);
      text(c, String(coins), cx + 11, cy + 1, 18, "#ffffff", "center", "rgba(40,25,5,0.85)");
    },
  });
}

/**
 * The energy page: a dark veil and a panel with how much energy there is, when the next point comes, and the button that gives more for an
 * ad. It opens when a try is started with none left, or from the corner of the book.
 */
export function drawEnergy(ctx: CanvasRenderingContext2D, n: number, nextSeconds: number, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.74)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  registerHit(ctx, "energyClose", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
  const panel = {x: 40, y: 150, w: 280, h: 400};
  registerHit(ctx, "energyPanel", panel);
  drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  drawRibbon(ctx, W / 2, 120, 220, t(n > 0 ? "energy" : "energyOut"), "#ffe27a", "#d49a14");
  drawKey(ctx, W / 2 - 62, 218, 54, n > 0);
  text(ctx, `${n} / ${ENERGY_MAX}`, W / 2 + 30, 220, 46, n > 0 ? "#ffffff" : "#ff9a8f", "center", "rgba(40,25,5,0.85)");
  write(ctx, n >= ENERGY_MAX ? t("energyFull") : t("energyNext", {t: clock(nextSeconds)}), W / 2, 266, 17, "#f3ecdd", "center", 700);
  t("energyInfo", {n: ENERGY_REGEN_SECONDS / 60})
    .split("|")
    .forEach((line, i) => write(ctx, line, W / 2, 298 + i * 20, 14, "#e8dcc2", "center", 600));
  if (n < ENERGY_MAX) drawButton(ctx, "energyAd", {x: W / 2 - 110, y: 346, w: 220, h: 56}, t("energyAd", {n: ENERGY_PER_AD}), "green", {pulse: time, size: 19, ad: true});
  // (the energy can also be bought with coins, on the page for it in the book)
  drawButton(ctx, "energyShop", {x: W / 2 - 110, y: n < ENERGY_MAX ? 412 : 346, w: 220, h: 46}, t("energyBuy"), "primary", {size: 18});
  drawButton(ctx, "energyClose", {x: W / 2 - 110, y: n < ENERGY_MAX ? 468 : 402, w: 220, h: 46}, t("done"), "secondary", {size: 19});
}

/**
 * The pause page of a round: a dark veil and a panel with Resume, the sound and Quit. The game waits behind it, and a tap
 * outside the panel does nothing (so that a stray tap does not start the round again).
 */
export function drawPause(ctx: CanvasRenderingContext2D, muted: boolean, music: boolean, time: number): void {
  ctx.fillStyle = "rgba(8,6,14,0.74)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
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

/** The top list of a game (the endless game or a match mode): the best ten with their names, or what is wrong with it. Tapping the veil, or Done, closes it. */
export function drawScores(ctx: CanvasRenderingContext2D, bd: Board, myDevice: string, time: number, game: "endless" | "save" | "sixeight" = "endless"): void {
  ctx.fillStyle = "rgba(8,6,14,0.74)";
  ctx.fillRect(0, -ui.extra, W, H + ui.extra);
  registerHit(ctx, "scoresClose", {x: 0, y: -ui.extra, w: W, h: H + ui.extra});
  const panel = {x: 24, y: 92, w: 312, h: 476};
  registerHit(ctx, "scoresPanel", panel);
  drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  drawRibbon(ctx, W / 2, 62, 240, t("topList"), "#ffe27a", "#d49a14");
  write(ctx, t(game === "endless" ? "endless" : game === "save" ? "saveName" : "sixEightName"), W / 2, 122, 17, "#ffe27a", "center", 700);
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
