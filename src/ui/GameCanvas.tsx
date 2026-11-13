// The game's canvas: runs the loop, scales the 360 x 640 game to the screen, and takes the finger.
import {useCallback, useEffect, useRef, useState} from "react";
import {H, W} from "../game/constants";
import {createGame, cupAt, dropCup, moveCup, startGame, tapAt, update} from "../game/engine";
import type {Cup} from "../game/types";
import {isMuted, playEvent, toggleMute, unlockAudio} from "./audio";
import {makeBackground} from "./background";
import {Fx} from "./fx";
import {MUTE_BUTTON, drawGame} from "./render";
import {useUpdates} from "./updates";

const BEST_KEY = "p10-best";

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(best: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* private mode */
  }
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [g] = useState(() => createGame(Math.random, loadBest()));
  // A new version is only fetched between rounds, never in the middle of one.
  const canReload = useCallback(() => g.phase !== "play", [g]);
  useUpdates(canReload);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const fx = new Fx();
    let bg = makeBackground(1);
    let pxPerUnit = 1;
    let raf = 0;
    let last = performance.now();
    let drag: {cup: Cup; dx: number; pointer: number} | null = null;

    const resize = () => {
      const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.max(1, Math.round(W * scale * dpr));
      canvas.height = Math.max(1, Math.round(H * scale * dpr));
      pxPerUnit = canvas.width / W;
      bg = makeBackground(pxPerUnit);
    };

    /** What happened in the game since last time: splashes, sounds and the best score. */
    const handleEvents = () => {
      for (const e of g.events) {
        fx.react(g, e);
        playEvent(e);
        if (e.t === "gameOver" && e.newBest) saveBest(g.best);
      }
      g.events.length = 0;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(g, dt);
      fx.update(g, dt);
      handleEvents();
      ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
      drawGame(ctx, g, fx, bg, isMuted());
    };

    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H};
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const p = point(e);
      if (Math.hypot(p.x - MUTE_BUTTON.x, p.y - MUTE_BUTTON.y) <= MUTE_BUTTON.r + 8) {
        toggleMute();
        return;
      }
      if (g.phase === "menu") {
        startGame(g);
        fx.clear();
        return;
      }
      if (g.phase === "over") {
        if (g.overTimer > 1) {
          startGame(g);
          fx.clear();
        }
        return;
      }
      // A number under the finger first; otherwise a cup to drag.
      if (tapAt(g, p.x, p.y)) return;
      const cup = cupAt(g, p.x, p.y);
      if (cup) {
        drag = {cup, dx: cup.x - p.x, pointer: e.pointerId};
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!drag || drag.pointer !== e.pointerId || g.phase !== "play") return;
      moveCup(g, drag.cup, point(e).x + drag.dx);
    };

    const onUp = (e: PointerEvent) => {
      if (!drag || drag.pointer !== e.pointerId) return;
      dropCup(g, drag.cup);
      drag = null;
    };

    const noMenu = (e: Event) => e.preventDefault();

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("contextmenu", noMenu);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("contextmenu", noMenu);
    };
  }, [g]);

  return <canvas ref={canvasRef} className="game" />;
}
