// The game's canvas: runs the loop, scales the 360 x 640 game to the screen, and takes the finger.
import {useCallback, useEffect, useRef, useState} from "react";
import {H, W} from "../game/constants";
import {createGame, cupAt, dropCup, moveCup, showMenu, startGame, tapAt, update} from "../game/engine";
import type {Cup, Mode} from "../game/types";
import {isMuted, playEvent, toggleMute, unlockAudio} from "./audio";
import {makeBackgrounds} from "./background";
import {beginDrag, createBook, currentPage, dragBy, endDrag, goToPage, isUnlocked, markCleared, markProgress, nextGame, pageOfMode, showPage, updateBook} from "./book";
import {hitTest, ui} from "./draw";
import {type Lang, lang, setLang} from "./i18n";
import {Fx} from "./fx";
import {BUTTON_DELAY, drawGame} from "./render";
import {useUpdates} from "./updates";

const BEST_KEY = "p10-best";
const CLEARED_KEY = "p10-cleared";
const PROGRESS_KEY = "p10-progress";

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

/** The levels that have been cleared, remembered in the browser. */
function loadCleared(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(CLEARED_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** How many cups have been filled in each level, as the most so far. */
function loadProgress(): Record<string, number> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}");
    if (typeof data !== "object" || data === null) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === "number" && v > 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function saveProgress(map: Map<string, number>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    /* private mode */
  }
}

function saveCleared(keys: Iterable<string>): void {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify([...keys]));
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
    // While developing (npm run dev) every level is open, so it can all be tried. Add ?locked to the address to try the locks.
    const unlockAll = import.meta.env.DEV && !new URLSearchParams(window.location.search).has("locked");
    const book = createBook(0, loadCleared(), unlockAll, loadProgress());
    // Open on the page you are on: after the tutorial, the chapter you have got to.
    showPage(book, currentPage(book));
    let rooms = makeBackgrounds(1);
    let pxPerUnit = 1;
    let raf = 0;
    let last = performance.now();
    let drag: {cup: Cup; dx: number; pointer: number} | null = null;
    // A finger on a button, or on the book (where it can turn into a drag that turns the page).
    let press: {id: string | null; x: number; y: number; moved: boolean; pointer: number} | null = null;
    // Between two screens the picture fades to black and back: `fade` is how dark it is.
    let fade = 0;
    let fading: {phase: "out" | "in"; then: () => void} | null = null;

    const transition = (then: () => void) => {
      if (!fading) {
        fading = {
          phase: "out",
          then: () => {
            ui.langOpen = false;
            then();
          },
        };
      }
    };
    const startRound = (mode: Mode, stage: number) =>
      transition(() => {
        startGame(g, mode, stage);
        fx.clear();
      });
    const toBook = (page: number) =>
      transition(() => {
        showPage(book, page);
        showMenu(g);
        fx.clear();
      });

    const resize = () => {
      const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.max(1, Math.round(W * scale * dpr));
      canvas.height = Math.max(1, Math.round(H * scale * dpr));
      pxPerUnit = canvas.width / W;
      rooms = makeBackgrounds(pxPerUnit);
    };

    /** What happened in the game since last time: splashes, sounds, the best score and the levels cleared. */
    const handleEvents = () => {
      for (const e of g.events) {
        fx.react(g, e);
        playEvent(e);
        if (e.t === "gameOver" && e.newBest) saveBest(g.best);
        // A cup that reaches 10 in a level of the book lights a dot on its tile (the most cups so far).
        if (e.t === "levelUp" && g.stage > 0 && markProgress(book, g.mode, g.stage, e.level - 1)) saveProgress(book.bestCups);
        if (e.t === "won") {
          markCleared(book, g.mode, g.stage);
          saveCleared(book.cleared);
        }
      }
      g.events.length = 0;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(g, dt);
      updateBook(book, dt);
      fx.update(g, dt);
      handleEvents();
      if (fading) {
        if (fading.phase === "out") {
          fade = Math.min(1, fade + dt / 0.16);
          if (fade >= 1) {
            fading.then();
            fading.phase = "in";
          }
        } else {
          fade = Math.max(0, fade - dt / 0.2);
          if (fade <= 0) fading = null;
        }
      }
      ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
      drawGame(ctx, g, fx, rooms, isMuted(), book, fade);
    };

    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H};
    };

    /** A button was pressed and let go. */
    const act = (id: string) => {
      if (id === "mute") {
        toggleMute();
      } else if (id === "lang") {
        ui.langOpen = !ui.langOpen;
        ui.langAt = g.time;
      } else if (id === "langClose") {
        ui.langOpen = false;
      } else if (id.startsWith("lang:")) {
        // The rooms have words on them (the board in the cafe), so they are drawn again in the new language.
        setLang(id.slice(5) as Lang);
        rooms = makeBackgrounds(pxPerUnit);
        ui.langOpen = false;
      } else if (id === "menu") {
        toBook(pageOfMode(g.mode));
      } else if (id === "next") {
        goToPage(book, book.target + 1, true);
      } else if (id === "prev") {
        goToPage(book, book.target - 1, true);
      } else if (id.startsWith("play:")) {
        const [, mode, stage] = id.split(":");
        if (isUnlocked(book, mode as Mode, Number(stage))) startRound(mode as Mode, Number(stage));
      } else if (id === "again") {
        const next = g.phase === "won" ? nextGame(g.mode, g.stage) : undefined;
        startRound(next?.mode ?? g.mode, next?.stage ?? g.stage);
      } else if (id === "toBook") {
        toBook(pageOfMode(g.phase === "won" && g.mode === "tutorial" ? "plus" : g.mode));
      }
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      if (fading) return;
      const p = point(e);
      const id = hitTest(p.x, p.y);
      // The buttons after a round do not work for a moment, so that a late tap does not skip the screen.
      if ((g.phase === "over" || g.phase === "won") && g.overTimer <= BUTTON_DELAY && id !== "mute") return;
      if (id) ui.pressed = id;
      if (g.phase === "menu" || id) {
        press = {id, x: p.x, y: p.y, moved: false, pointer: e.pointerId};
        if (g.phase === "menu") beginDrag(book);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (g.phase !== "play") return;
      // A number under the finger first; otherwise a cup to drag.
      if (tapAt(g, p.x, p.y)) return;
      const cup = cupAt(g, p.x, p.y);
      if (cup) {
        drag = {cup, dx: cup.x - p.x, pointer: e.pointerId};
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (press && press.pointer === e.pointerId) {
        const p = point(e);
        if (g.phase === "menu") {
          const dx = p.x - press.x;
          if (Math.abs(dx) > 8) {
            press.moved = true;
            ui.pressed = null;
          }
          if (press.moved && !ui.langOpen) dragBy(book, dx);
        } else {
          // A button: it only counts while the finger is still on it.
          ui.pressed = hitTest(p.x, p.y) === press.id ? press.id : null;
        }
        return;
      }
      if (!drag || drag.pointer !== e.pointerId || g.phase !== "play") return;
      moveCup(g, drag.cup, point(e).x + drag.dx);
    };

    const onUp = (e: PointerEvent) => {
      if (press && press.pointer === e.pointerId) {
        const {id, moved} = press;
        const p = point(e);
        press = null;
        ui.pressed = null;
        if (g.phase === "menu") endDrag(book);
        if (!moved && id && hitTest(p.x, p.y) === id) act(id);
        return;
      }
      if (!drag || drag.pointer !== e.pointerId) return;
      dropCup(g, drag.cup);
      drag = null;
    };

    const noMenu = (e: Event) => e.preventDefault();

    document.documentElement.lang = lang();
    resize();
    // The text of the rooms is drawn once: draw it again when the typeface has arrived.
    if (document.fonts) {
      void Promise.all([document.fonts.load('600 20px "Fredoka"'), document.fonts.load('700 20px "Fredoka"')])
        .then(resize)
        .catch(() => undefined);
    }
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
