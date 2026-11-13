// The game's canvas: runs the loop, scales the 360 x 640 game to the screen, and takes the finger.
import {type FormEvent, useCallback, useEffect, useRef, useState} from "react";
import {H, SCREEN_MAX, W, WIN_DELAY} from "../game/constants";
import {FEATURES, continueGame, createGame, cupAt, dropCup, endIntro, moveCup, recordBest, showMenu, startGame, tapAt, untangleCups, update, useScreen} from "../game/engine";
import type {Cup, Feature, Mode} from "../game/types";
import {getVolumeStep, isMusicOn, isMuted, playClick, playEvent, playPageTurn, setMusicScene, stepVolume, toggleMusic, toggleMute, unlockAudio} from "./audio";
import {AD_SECONDS} from "./ad";
import {makeBackgrounds} from "./background";
import {beginDrag, createBook, currentPage, dragBy, endDrag, goToPage, isUnlocked, markCleared, markProgress, markScore, openNextGame, pageOfMode, showPage, updateBook} from "./book";
import {hitTest, ui} from "./draw";
import {type Lang, lang, setLang, t} from "./i18n";
import {Fx} from "./fx";
import {BUTTON_DELAY, drawGame} from "./render";
import {NAME_MAX, cleanName, playerName, setPlayerName} from "./profile";
import {loadBoard, submitScore} from "./scores";
import {useUpdates} from "./updates";

const BEST_KEY = "p10-best";
const CLEARED_KEY = "p10-cleared";
const PROGRESS_KEY = "p10-progress";
const SCORES_KEY = "p10-scores";
const HIDE_INTROS_KEY = "p10-hide-intros";
const ADMIN_KEY = "p10-admin";
const SCREENS_KEY = "p10-screens";

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

/** The most points got in each cleared level. */
function loadScores(): Record<string, number> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SCORES_KEY) ?? "{}");
    if (typeof data !== "object" || data === null) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === "number" && v > 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function saveScores(map: Map<string, number>): void {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    /* private mode */
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

/** How many pull-down screens have been collected in the levels of the book (one to start with). */
function loadScreens(): number {
  try {
    const saved = localStorage.getItem(SCREENS_KEY);
    if (saved === null) return 1; // (nothing collected yet: you start with one, to try it)
    return Math.min(SCREEN_MAX, Math.max(0, Math.floor(Number(saved) || 0)));
  } catch {
    return 0;
  }
}

function saveScreens(n: number): void {
  try {
    localStorage.setItem(SCREENS_KEY, String(n));
  } catch {
    /* private mode */
  }
}

/** Whether the admin button on the tutorial page has opened every level. */
function loadAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

function saveAdmin(on: boolean): void {
  try {
    localStorage.setItem(ADMIN_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

/** The new kinds of number the player has asked not to be shown again. */
function loadHiddenIntros(): Set<Feature> {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(HIDE_INTROS_KEY) ?? "[]");
    return new Set(Array.isArray(list) ? FEATURES.filter((f) => list.includes(f)) : []);
  } catch {
    return new Set();
  }
}

function saveHiddenIntros(hidden: Iterable<Feature>): void {
  try {
    localStorage.setItem(HIDE_INTROS_KEY, JSON.stringify([...hidden]));
  } catch {
    /* private mode */
  }
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [g] = useState(() => {
    const game = createGame(Math.random, loadBest());
    game.hideIntros = loadHiddenIntros();
    game.screens = loadScreens();
    return game;
  });
  // The box that asks for a name: what is written so far, and what to do with the answer (null: not now).
  const [nameAsk, setNameAsk] = useState<{draft: string; done: (name: string | null) => void} | null>(null);
  // A new version is only fetched between rounds, never in the middle of one.
  const canReload = useCallback(() => g.phase !== "play", [g]);
  useUpdates(canReload);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const fx = new Fx();
    // Admin (every level open) is off until it is turned on with the switch in the settings, also while developing.
    const unlockAll = loadAdmin();
    const book = createBook(0, loadCleared(), unlockAll, loadProgress(), loadScores());
    // Open on the page you are on: after the tutorial, the chapter you have got to.
    showPage(book, currentPage(book));
    let rooms = makeBackgrounds(1);
    let pxPerUnit = 1;
    let raf = 0;
    let last = performance.now();
    let drag: {cup: Cup; dx: number; pointer: number} | null = null;
    // A finger on a button, or on the book (where it can turn into a drag that turns the page).
    let press: {id: string | null; x: number; y: number; moved: boolean; pointer: number; settings?: boolean} | null = null;
    // Between two screens the picture fades to black and back: `fade` is how dark it is.
    let fade = 0;
    // Every page that is turned in the book makes a sound.
    let turns = book.turns;
    let fading: {phase: "out" | "in"; then: () => void} | null = null;

    const transition = (then: () => void) => {
      if (!fading) {
        fading = {
          phase: "out",
          then: () => {
            ui.settingsOpen = false;
            ui.pauseOpen = false;
            ui.scoresOpen = false;
            ui.adOpen = false;
            then();
          },
        };
      }
    };
    const startRound = (mode: Mode, stage: number) =>
      transition(() => {
        // The levels of the book use the screens that have been collected; the endless game starts with its own.
        if (mode !== "endless") g.screens = loadScreens();
        startGame(g, mode, stage);
        fx.clear();
      });
    /** The score so far of an endless round that is left before it ends (or when the app is closed) is kept if it is a record. */
    const saveRecord = () => {
      if (!recordBest(g)) return;
      saveBest(g.best);
      const name = playerName();
      if (name) void submitScore(name, g.best);
    };
    const toBook = (page: number) =>
      transition(() => {
        saveRecord();
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
        if (e.t === "won") {
          // The confetti and the fanfare come with the card, when the progress bar has finished its effect.
          window.setTimeout(() => {
            if (g.phase === "won") {
              fx.react(g, e);
              playEvent(e);
            }
          }, WIN_DELAY * 1000);
        } else {
          fx.react(g, e);
          playEvent(e);
        }
        if (e.t === "gameOver" && e.newBest) {
          saveBest(g.best);
          // A new record in the endless game goes to the top list under the player's name (asked for the first time).
          const record = g.best;
          window.setTimeout(() => {
            if (g.phase !== "over") return;
            const name = playerName();
            if (name) void submitScore(name, record);
            else
              setNameAsk({
                draft: "",
                done: (n) => {
                  if (n) void submitScore(setPlayerName(n), record);
                },
              });
          }, 900);
        }
        if (e.t === "introHide") saveHiddenIntros(g.hideIntros);
        // The screens collected in the levels of the book are remembered (the endless game has its own).
        if (e.t === "screens" && g.mode !== "endless") saveScreens(e.n);
        // A cup that reaches 10 in a level of the book lights a dot on its tile (the most cups so far).
        if (e.t === "levelUp" && g.stage > 0 && markProgress(book, g.mode, g.stage, e.level - 1)) saveProgress(book.bestCups);
        if (e.t === "won") {
          markCleared(book, g.mode, g.stage);
          saveCleared(book.cleared);
          // The points of the level are shown under its number in the book (the most there have been).
          if (g.stage > 0 && markScore(book, g.mode, g.stage, g.score)) saveScores(book.bestScores);
        }
      }
      g.events.length = 0;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (ui.adOpen) ui.adTime += dt;
      // The game waits while the settings or the pause page are open.
      const gameDt = (ui.settingsOpen || ui.pauseOpen) && g.phase === "play" ? 0 : dt;
      update(g, gameDt);
      updateBook(book, dt);
      if (book.turns !== turns) {
        turns = book.turns;
        playPageTurn();
      }
      fx.update(g, gameDt);
      handleEvents();
      // The cup that is held is marked; and when no cup is held every cup stands in a column of its own (a safety net).
      ui.heldCup = drag ? drag.cup.id : null;
      if (!drag) untangleCups(g);
      // The music plays in a round, not in the book. It fades out for the pause page, a cleared level and game over (and the song goes on
      // silently, so the next level does not start it over).
      setMusicScene(g.phase !== "menu", ui.pauseOpen || g.phase === "won" || g.phase === "over");
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
      drawGame(ctx, g, fx, rooms, isMuted(), isMusicOn(), getVolumeStep(), book, fade);
    };

    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H};
    };

    /** A button was pressed and let go. */
    const perform = (id: string) => {
      if (id === "settings") {
        ui.settingsOpen = true;
      } else if (id === "settingsClose") {
        ui.settingsOpen = false;
      } else if (id === "scores") {
        ui.scoresOpen = true;
        void loadBoard();
      } else if (id === "scoresClose") {
        ui.scoresOpen = false;
      } else if (id === "set:name") {
        // Change the name (and send the record again under it).
        setNameAsk({
          draft: playerName(),
          done: (n) => {
            if (!n) return;
            const name = setPlayerName(n);
            if (g.best > 0) void submitScore(name, g.best);
          },
        });
      } else if (id === "set:sound") {
        toggleMute();
      } else if (id === "set:music") {
        toggleMusic();
      } else if (id === "set:volDown") {
        stepVolume(-1);
      } else if (id === "set:volUp") {
        stepVolume(1);
      } else if (id.startsWith("set:lang:")) {
        // The rooms have words on them (the board in the cafe), so they are drawn again in the new language.
        setLang(id.slice(9) as Lang);
        rooms = makeBackgrounds(pxPerUnit);
      } else if (id === "set:news") {
        // The presentations that were hidden with "don't show again" come back.
        g.hideIntros.clear();
        saveHiddenIntros(g.hideIntros);
      } else if (id === "set:admin") {
        book.unlockAll = !book.unlockAll;
        saveAdmin(book.unlockAll);
      } else if (id === "pause") {
        ui.pauseOpen = true;
      } else if (id === "pauseResume") {
        ui.pauseOpen = false;
      } else if (id === "pauseQuit") {
        // Out of the round and back to the book.
        ui.pauseOpen = false;
        toBook(pageOfMode(g.mode));
      } else if (id === "next") {
        goToPage(book, book.target + 1, true);
      } else if (id === "prev") {
        goToPage(book, book.target - 1, true);
      } else if (id.startsWith("play:")) {
        const [, mode, stage] = id.split(":");
        if (isUnlocked(book, mode as Mode, Number(stage))) startRound(mode as Mode, Number(stage));
      } else if (id === "again") {
        const next = g.phase === "won" ? openNextGame(book, g.mode, g.stage) : undefined;
        startRound(next?.mode ?? g.mode, next?.stage ?? g.stage);
      } else if (id === "continueAd") {
        // One more try: the (make-believe) ad plays first, and the round carries on when it has been closed.
        if (g.phase === "over" && g.continuesLeft > 0) {
          ui.adOpen = true;
          ui.adTime = 0;
        }
      } else if (id === "adClose") {
        if (ui.adOpen && ui.adTime >= AD_SECONDS) {
          ui.adOpen = false;
          if (continueGame(g)) fx.clear();
        }
      } else if (id === "screen") {
        useScreen(g);
      } else if (id === "introOk") {
        endIntro(g);
      } else if (id === "introNever") {
        endIntro(g, true);
      } else if (id === "toBook") {
        toBook(pageOfMode(g.phase === "won" && g.mode === "tutorial" ? "plus" : g.mode));
      }
    };

    // Every button clicks (after what it does, so that the sound button clicks when the sound has been turned on and not when it is turned off).
    const act = (id: string) => {
      perform(id);
      // Turning a page of the book has its own sound (the page turning), so the buttons for it do not click as well.
      if (id !== "next" && id !== "prev") playClick();
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      if (fading) return;
      const p = point(e);
      const id = hitTest(p.x, p.y);
      if (ui.settingsOpen || ui.pauseOpen || ui.scoresOpen || ui.adOpen) {
        // The settings, the pause page and the ad are over everything: only their own buttons can be pressed (and the game waits behind them).
        if (id && (id.startsWith("set:") || id === "settingsClose" || id === "scoresClose" || id === "pauseResume" || id === "pauseQuit" || id === "adClose")) {
          ui.pressed = id;
          press = {id, x: p.x, y: p.y, moved: false, pointer: e.pointerId, settings: true};
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }
      // The buttons after a round do not work for a moment, so that a late tap does not skip the screen.
      if ((g.phase === "over" || g.phase === "won" || g.phase === "intro") && g.overTimer <= BUTTON_DELAY && id !== "settings") return;
      if (id) ui.pressed = id;
      if (g.phase === "menu" || id) {
        press = {id, x: p.x, y: p.y, moved: false, pointer: e.pointerId};
        // (the buttons for the next and the previous page do not start a drag: they would take hold of a page that is on its way)
        if (g.phase === "menu" && id !== "next" && id !== "prev") beginDrag(book);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (g.phase !== "play") return;
      // A number under the finger first; otherwise a cup to drag.
      if (tapAt(g, p.x, p.y)) return;
      const cup = cupAt(g, p.x, p.y);
      if (cup) {
        // A cup that is still being dragged (a second finger, or a finger that was lifted without us hearing of it) is put down in its
        // column first, so that it is not left in between the columns, on top of another cup.
        if (drag) dropCup(g, drag.cup);
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
          if (press.moved && !ui.settingsOpen && !ui.scoresOpen) dragBy(book, dx);
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
        const {id, moved, settings} = press;
        const p = point(e);
        press = null;
        ui.pressed = null;
        if (g.phase === "menu" && !settings) endDrag(book);
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
    // Escape pauses a round (or closes the page that is open).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || ui.adOpen) return;
      if (ui.settingsOpen) ui.settingsOpen = false;
      else if (ui.scoresOpen) ui.scoresOpen = false;
      else if (ui.pauseOpen) ui.pauseOpen = false;
      else if (g.phase === "play") ui.pauseOpen = true;
    };
    // The app is closed or goes to the background in the middle of an endless round: the score so far is kept if it is a record.
    const onHide = () => {
      if (document.visibilityState === "hidden") saveRecord();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", saveRecord);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("contextmenu", noMenu);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", saveRecord);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("contextmenu", noMenu);
    };
  }, [g]);

  /** The answer in the box: the name, or "not now". */
  const answer = (name: string | null) => {
    const ask = nameAsk;
    setNameAsk(null);
    ask?.done(name && cleanName(name) ? cleanName(name) : null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    answer(nameAsk?.draft ?? null);
  };

  return (
    <>
      <canvas ref={canvasRef} className="game" />
      {nameAsk && (
        <div className="name-veil">
          <form className="name-card" onSubmit={submit}>
            <h2>{t("nameTitle")}</h2>
            <p>{t("nameHelp")}</p>
            <input
              autoFocus
              value={nameAsk.draft}
              maxLength={NAME_MAX}
              autoComplete="off"
              spellCheck={false}
              aria-label={t("nameTitle")}
              onChange={(e) => setNameAsk({...nameAsk, draft: e.target.value})}
            />
            <button type="submit" className="save" disabled={!cleanName(nameAsk.draft)}>
              {t("nameSave")}
            </button>
            <button type="button" className="skip" onClick={() => answer(null)}>
              {t("nameSkip")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
