// The make-believe ad that is shown before the player gets one more try after losing a round (like the ad in the football manager).
// It is not a real ad: it is a made-up coffee brand that plays for a few seconds, then lets the player carry on. It covers
// the whole screen, so nothing under it can be pressed.
import {H, W} from "../game/constants";
import {CHALK, TAU, drawButton, registerHit, roundRect, text, title, ui, write} from "./draw";
import {t} from "./i18n";

/** How many seconds the ad plays before it can be closed. */
export const AD_SECONDS = 5;

/** A big coffee cup with steam, the "product" of the ad. */
function drawProductCup(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  // The steam: three wisps that wave and fade.
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) {
    const k = (time * 0.5 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * Math.sin(k * Math.PI)})`;
    ctx.beginPath();
    const x0 = (i - 1) * 26;
    const y0 = -52 - k * 40;
    ctx.moveTo(x0, y0 + 30);
    ctx.bezierCurveTo(x0 - 12, y0 + 14, x0 + 12, y0, x0, y0 - 16);
    ctx.stroke();
  }
  // The saucer and the shadow.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(4, 62, 96, 20, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#efe6d2";
  ctx.beginPath();
  ctx.ellipse(0, 56, 90, 18, 0, 0, TAU);
  ctx.fill();
  // The handle.
  ctx.strokeStyle = "#d9cfb8";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(66, 6, 24, 28, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // The body.
  const body = ctx.createLinearGradient(-64, 0, 64, 0);
  body.addColorStop(0, "#d8cfba");
  body.addColorStop(0.35, "#ffffff");
  body.addColorStop(1, "#b5ac97");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-66, -28);
  ctx.bezierCurveTo(-66, 22, -50, 54, -30, 58);
  ctx.lineTo(30, 58);
  ctx.bezierCurveTo(50, 54, 66, 22, 66, -28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f6f1e6";
  ctx.beginPath();
  ctx.ellipse(0, -28, 66, 18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#4a2c18";
  ctx.beginPath();
  ctx.ellipse(0, -27, 56, 13, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The cross of the button that closes the ad. */
function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string): void {
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 6);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.moveTo(cx + 6, cy - 6);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.stroke();
}

/** The ad, `adTime` seconds after it started. Closing it (the "adClose" button) only works once AD_SECONDS have gone. */
export function drawAd(ctx: CanvasRenderingContext2D, time: number, adTime: number, kind: "continue" | "energy" | "coins" | "retry" | "gift" = "continue"): void {
  registerHit(ctx, "adBlock", {x: 0, y: -ui.extra, w: W, h: H + 2 * ui.extra});
  const left = Math.max(0, AD_SECONDS - adTime);
  const done = left <= 0;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#ff9f43");
  bg.addColorStop(1, "#b8400c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, -ui.extra, W, H + 2 * ui.extra);
  // Rays that turn slowly behind the cup.
  ctx.save();
  ctx.translate(W / 2, 330);
  ctx.rotate(time * 0.15);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - 0.12) * 700, Math.sin(a - 0.12) * 700);
    ctx.lineTo(Math.cos(a + 0.12) * 700, Math.sin(a + 0.12) * 700);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  title(ctx, "KAFFEKUNGEN", W / 2, 128, 40);
  text(ctx, t("adTagline"), W / 2, 178, 18, "#ffffff");
  drawProductCup(ctx, W / 2, 330 + Math.sin(time * 2) * 4, time);
  // The button of the ad (it does nothing: it is only for show).
  drawButton(ctx, "adCta", {x: 80, y: 448, w: 200, h: 54}, t("adCta"), "primary", {pulse: time, size: 22});

  // The ad is marked as an ad, and a thin bar shows how far it has come.
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, 14, 18, 74, 24, 12);
  ctx.fill();
  write(ctx, t("adTag"), 51, 31, 12, CHALK, "center", 700);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, 0, W, 5);
  ctx.fillStyle = "#ffe27a";
  ctx.fillRect(0, 0, W * Math.min(1, adTime / AD_SECONDS), 5);

  if (done) {
    // It can be closed now: the cross in the corner, and the button to carry on.
    drawButton(ctx, "adClose", {x: W - 52, y: 14, w: 38, h: 38}, "", "round", {draw: drawCross});
    drawButton(ctx, "adClose", {x: W / 2 - 110, y: 548, w: 220, h: 58}, t("adGo"), "green", {pulse: time, size: 22});
  } else {
    // The seconds that are left, in a ring in the corner.
    const cx = W - 33;
    const cy = 33;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, adTime / AD_SECONDS));
    ctx.stroke();
    text(ctx, String(Math.ceil(left)), cx, cy + 1, 17, "#ffffff");
    text(ctx, t(kind === "energy" ? "adEnergy" : kind === "coins" || kind === "gift" ? "adCoins" : "adReward", {n: Math.ceil(left)}), W / 2, 578, 17, "#ffffff");
  }
}
