// The game's canvas: runs the loop, scales the 360 x 640 game to the screen, and takes the finger.
import {type FormEvent, useCallback, useEffect, useRef, useState} from "react";
import {DAILY_BONUS, DAILY_REWARD, DAILY_RUNGS, EXTRA_MAX, H, SCREEN_MAX, TAP_RADIUS, W, WIN_DELAY} from "../game/constants";
import {dayKey, rungEnds, rungsDone} from "../game/daily";
import {isShopCup} from "../game/cups";
import {LOOK_KINDS, type LookKind} from "../game/looks";
import {FEATURES, choosePerk, continueGame, createGame, cupAt, dropCup, endIntro, fireLaser, moveCup, recordBest, showMenu, startDaily, startGame, tapAt, untangleCups, update, useScreen} from "../game/engine";
import type {Cup, Feature, Mode} from "../game/types";
import {getVolumeStep, isMusicOn, isMuted, playBuy, playClick, playEnergySpend, playEvent, playPageTurn, setMusicScene, stepVolume, toggleMusic, toggleMute, unlockAudio} from "./audio";
import {AD_SECONDS} from "./ad";
import {makeBackgrounds} from "./background";
import {DAILY_PAGE, PAGER, PAGES, SHOP_PAGE, beginDrag, createBook, currentPage, dragBy, endDrag, goToPage, isUnlocked, markCleared, markProgress, markScore, openNextGame, pageOfMode, showPage, updateBook} from "./book";
import {hitTest, ui} from "./draw";
import {type Lang, lang, setLang, t} from "./i18n";
import {Fx} from "./fx";
import {BUTTON_DELAY, drawGame} from "./render";
import {NAME_MAX, cleanName, playerName, setPlayerName} from "./profile";
import {loadBoard, submitScore} from "./scores";
import {useUpdates} from "./updates";
import {COIN_PER_STAR, COIN_PER_TEN, COIN_PER_WIN, addCoins, buyCloth, buyCup, allOnCup, buyLook, equipLook, buyEnergyPoint, buyEnergyRefill, clearCup, loadWallet, loadout, saveWallet, toggleOnCup} from "./wallet";
import {PAYMENTS_CONNECTED, grantPurchase, loadPremium, savePremium} from "./purchase";
import {type DailyRecord, loadDaily, saveDaily, todaysTry} from "./dailyStore";
import {ENERGY_MAX, ENERGY_PER_AD, addEnergy, loadEnergy, refreshEnergy, saveEnergy, secondsToNext, spendEnergy} from "./energy";

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

function isLookKind(k: unknown): k is LookKind {
  return (LOOK_KINDS as readonly unknown[]).includes(k);
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
    /** Every try at a level costs one point of energy (see energy.ts). */
    const energy = loadEnergy(Date.now());
    /** The coins, and the cups bought with them in the shop (see wallet.ts); and the try of the daily challenge (one a day). */
    const wallet = loadWallet();
    let dailyRec: DailyRecord | null = loadDaily();
    /** How many pull-down screens there are in the book (also kept in the browser: see loadScreens). */
    let screensHeld = loadScreens();
    /** Premium (see purchase.ts): everything is open, new tries cost no energy, and there are no ads. */
    let premium = loadPremium();
    /** Coins earned: they are put in the wallet and counted for the card after the round. */
    const earn = (n: number) => {
      if (n <= 0) return;
      addCoins(wallet, n);
      ui.lastCoins += n;
      saveWallet(wallet);
    };
    const book = createBook(0, loadCleared(), unlockAll, loadProgress(), loadScores());
    book.premium = premium;
    // Open on the page you are on: after the tutorial, the chapter you have got to.
    showPage(book, currentPage(book));
    let rooms = makeBackgrounds(1);
    let pxPerUnit = 1;
    /** The tone of the light the rooms were drawn with (see buildRooms). */
    let builtTint = "none";
    const buildRooms = () => {
      builtTint = wallet.look.tint;
      rooms = makeBackgrounds(pxPerUnit, g.extra, builtTint);
      ui.roomPics = rooms;
    };
    let raf = 0;
    let last = performance.now();
    let drag: {cup: Cup; dx: number; pointer: number} | null = null;
    /** The cup that was tapped last, and when: a double tap on a laser cup fires it. */
    let lastCupTap: {id: number; at: number} | null = null;
    /** A finger on the page numbers of the book: where it started, and the page it started on. Dragging it along the strip turns the pages quickly. */
    let scrub: {pointer: number; startX: number; startPage: number} | null = null;
    /** A finger that is sliding over the numbers: where it was last, and the numbers this stroke has already touched. */
    let swipe: {pointer: number; x: number; y: number; skip: Set<number>} | null = null;
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
            ui.energyOpen = false;
            ui.cupsOpen = false;
            ui.adOpen = false;
            then();
          },
        };
      }
    };
    /** A try has been paid for and is about to start (the effect of the energy being used is playing). */
    let starting = false;
    const startRound = (mode: Mode, stage: number) => {
      if (fading || starting) return;
      // A try costs one energy (the tutorial is free); with none left the energy page opens instead.
      let spent = false;
      if (mode !== "tutorial" && !premium) {
        if (!spendEnergy(energy, Date.now())) {
          ui.energyOpen = true;
          return;
        }
        saveEnergy(energy);
        spent = true;
      }
      const begin = () =>
        transition(() => {
          // The levels of the book use the screens that have been collected; the endless game starts with its own.
          if (mode !== "endless") g.screens = loadScreens();
          g.loadout = loadout(wallet);
          ui.lastCoins = 0;
          startGame(g, mode, stage);
          fx.clear();
        });
      if (spent) {
        // The energy is seen being used (the pill shakes and the bolt flies off it) before the round starts.
        ui.energyFx = 0;
        playEnergySpend();
        starting = true;
        window.setTimeout(() => {
          starting = false;
          begin();
        }, 550);
      } else begin();
    };
    /** Today's try of the daily challenge: the ladder, with the same numbers for everyone. It does not cost energy, and there is one try a day. */
    const startDailyRound = () => {
      if (fading || todaysTry(dailyRec)) return;
      dailyRec = {day: dayKey(), rungs: 0, cleared: false};
      saveDaily(dailyRec);
      transition(() => {
        g.loadout = loadout(wallet);
        ui.lastCoins = 0;
        startDaily(g);
        fx.clear();
      });
    };
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
      // A tall phone has room above the 640 units (the game is drawn against the bottom, and the playfield reaches up to the top of the screen);
      // a short one shows only the 640. The picture is never stretched.
      const tall = (window.innerHeight * W) / window.innerWidth - H;
      g.extra = Math.round(Math.min(EXTRA_MAX, Math.max(0, tall)));
      const viewH = H + g.extra;
      const scale = Math.min(window.innerWidth / W, window.innerHeight / viewH);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${viewH * scale}px`;
      canvas.width = Math.max(1, Math.round(W * scale * dpr));
      canvas.height = Math.max(1, Math.round(viewH * scale * dpr));
      pxPerUnit = canvas.width / W;
      buildRooms();
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
        if (e.t === "screens" && g.mode !== "endless") {
          saveScreens(e.n);
          screensHeld = e.n;
        }
        // A cup that reaches 10 in a level of the book lights a dot on its tile (the most cups so far).
        if (e.t === "levelUp" && g.stage > 0 && markProgress(book, g.mode, g.stage, e.level - 1)) saveProgress(book.bestCups);
        // Coins: one for every perfect 10, and more for a level of the book that is cleared (the daily challenge pays for every rung, and the top).
        if (e.t === "levelUp" && g.mode !== "tutorial") {
          earn(COIN_PER_TEN);
          const rung = rungsDone(e.level - 1);
          if (g.daily && rungEnds(e.level - 1) && rung >= 1 && rung <= DAILY_RUNGS) {
            earn(DAILY_REWARD[rung - 1]);
            dailyRec = {day: dayKey(), rungs: rung, cleared: false};
            saveDaily(dailyRec);
          }
        }
        if (e.t === "won" && g.mode !== "tutorial") {
          if (g.daily) {
            earn(DAILY_BONUS);
            dailyRec = {day: dayKey(), rungs: DAILY_RUNGS, cleared: true};
            saveDaily(dailyRec);
          } else earn(COIN_PER_WIN + COIN_PER_STAR * e.stars);
        }
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
      refreshEnergy(energy, Date.now());
      ui.energyN = energy.n;
      ui.energyNext = secondsToNext(energy, Date.now());
      ui.coins = wallet.coins;
      ui.look = wallet.look;
      ui.looksOwned = wallet.looks;
      // (the rooms are drawn again when another tone of light is chosen)
      if (wallet.look.tint !== builtTint) buildRooms();
      // The page number under the finger swells while it is dragged along the page numbers, and settles back afterwards.
      ui.scrubAmt += ((ui.scrubbing ? 1 : 0) - ui.scrubAmt) * Math.min(1, dt * 14);
      if (ui.scrubAmt < 0.005) ui.scrubAmt = 0;
      if (ui.buyFx >= 0) ui.buyFx = ui.buyFx + dt > 1.2 ? -1 : ui.buyFx + dt;
      if (ui.energyFx >= 0) ui.energyFx = ui.energyFx + dt > 1 ? -1 : ui.energyFx + dt;
      ui.premium = premium;
      ui.noticeTime = Math.max(0, ui.noticeTime - dt);
      ui.screens = screensHeld;
      ui.owned = wallet.owned;
      ui.slots = wallet.slots;
      const today = todaysTry(dailyRec);
      ui.dailyUsed = today !== null;
      ui.dailyRungs = today?.rungs ?? 0;
      ui.dailyCleared = today?.cleared ?? false;
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
      const y = ((e.clientY - r.top) / r.height) * (H + g.extra);
      // (`y` is where on the screen, `wy` where on the playfield, which is drawn `extra` units down from the top of the screen)
      return {x: ((e.clientX - r.left) / r.width) * W, y, wy: y - g.extra};
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
        if (!isMuted()) stepVolume(-1); // (nothing to turn down while the sound is off)
      } else if (id === "set:volUp") {
        if (!isMuted()) stepVolume(1);
      } else if (id.startsWith("set:lang:")) {
        // The rooms have words on them (the board in the cafe), so they are drawn again in the new language.
        setLang(id.slice(9) as Lang);
        buildRooms();
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
        toBook(g.daily ? DAILY_PAGE : pageOfMode(g.mode));
      } else if (id === "daily:play") {
        startDailyRound();
      } else if (id.startsWith("page:")) {
        goToPage(book, Number(id.slice(5)), true);
      } else if (id.startsWith("buy:")) {
        // There is no payment connected yet (see purchase.ts): with the admin switch on in the settings a purchase is made for testing, otherwise a message says so.
        const what = id.slice(4);
        if (what === "premium" && premium) return;
        if (PAYMENTS_CONNECTED || book.unlockAll) {
          const bought = grantPurchase(wallet, what);
          if (bought === "premium") {
            premium = true;
            savePremium(true);
            book.premium = true;
          }
          if (bought) saveWallet(wallet);
        } else {
          ui.notice = t("payNotReady");
          ui.noticeTime = 2.4;
        }
      } else if (id === "coins") {
        goToPage(book, SHOP_PAGE, true);
      } else if (id.startsWith("shop:tab:")) {
        ui.shopTab = Number(id.slice(9)) === 1 ? 1 : 0;
      } else if (id.startsWith("looks:tab:")) {
        ui.lookTab = Math.min(4, Math.max(0, Number(id.slice(10)) || 0));
      } else if (id.startsWith("looks:buy:") || id.startsWith("looks:use:")) {
        const [, action, kind, look] = id.split(":");
        if (isLookKind(kind)) {
          if (action === "buy" ? buyLook(wallet, kind, look) : equipLook(wallet, kind, look)) saveWallet(wallet);
        }
      } else if (id === "shop:energy1") {
        refreshEnergy(energy, Date.now());
        if (buyEnergyPoint(wallet, energy.n, ENERGY_MAX)) {
          addEnergy(energy, 1, Date.now());
          saveEnergy(energy);
          saveWallet(wallet);
        }
      } else if (id === "shop:energyFull") {
        refreshEnergy(energy, Date.now());
        const points = buyEnergyRefill(wallet, energy.n, ENERGY_MAX);
        if (points > 0) {
          addEnergy(energy, points, Date.now());
          saveEnergy(energy);
          saveWallet(wallet);
        }
      } else if (id === "energyShop") {
        // (to the energy of the shop in the book)
        ui.energyOpen = false;
        ui.shopTab = 1;
        toBook(SHOP_PAGE);
      } else if (id === "shop:cloth") {
        const n = buyCloth(wallet, screensHeld, SCREEN_MAX);
        if (n !== null) {
          screensHeld = n;
          saveScreens(n);
          saveWallet(wallet);
        }
      } else if (id.startsWith("shop:buy:")) {
        const kind = id.slice(9);
        if (isShopCup(kind) && buyCup(wallet, kind)) {
          saveWallet(wallet);
          // (the dialog opens, to put the cup that was bought on the cups of the desk)
          ui.cupsOpen = true;
          ui.cupFocus = kind;
          ui.cupSlot = 0;
        }
      } else if (id.startsWith("shop:own:")) {
        ui.cupsOpen = true;
        ui.cupFocus = id.slice(9);
        ui.cupSlot = 0;
      } else if (id === "cups:open") {
        ui.cupsOpen = true;
        ui.cupFocus = null;
        ui.cupSlot = 0;
      } else if (id === "cups:close") {
        ui.cupsOpen = false;
        ui.cupFocus = null;
      } else if (id.startsWith("cups:slot:")) {
        ui.cupSlot = Math.min(3, Math.max(0, Number(id.slice(10)) || 0));
      } else if (id === "cups:all") {
        if (allOnCup(wallet, ui.cupSlot)) saveWallet(wallet);
      } else if (id === "cups:clear") {
        if (clearCup(wallet, ui.cupSlot)) saveWallet(wallet);
      } else if (id.startsWith("cups:toggle:")) {
        const kind = id.slice(12);
        if (isShopCup(kind) && toggleOnCup(wallet, ui.cupSlot, kind)) saveWallet(wallet);
      } else if (id.startsWith("perk:")) {
        choosePerk(g, Number(id.slice(5)));
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
          if (premium) {
            // (no ad with Premium: the round just goes on)
            if (continueGame(g)) fx.clear();
          } else {
            ui.adFor = "continue";
            ui.adOpen = true;
            ui.adTime = 0;
          }
        }
      } else if (id === "energy") {
        ui.energyOpen = true;
      } else if (id === "energyClose") {
        ui.energyOpen = false;
      } else if (id === "energyAd") {
        // More energy for an ad (only when there is room for it).
        if (energy.n < ENERGY_MAX) {
          ui.adFor = "energy";
          ui.adOpen = true;
          ui.adTime = 0;
        }
      } else if (id === "adClose") {
        if (ui.adOpen && ui.adTime >= AD_SECONDS) {
          ui.adOpen = false;
          if (ui.adFor === "energy") {
            addEnergy(energy, ENERGY_PER_AD, Date.now());
            saveEnergy(energy);
          } else if (continueGame(g)) fx.clear();
        }
      } else if (id === "screen") {
        useScreen(g);
      } else if (id === "introOk") {
        endIntro(g);
      } else if (id === "introNever") {
        endIntro(g, true);
      } else if (id === "toBook") {
        toBook(g.daily ? DAILY_PAGE : pageOfMode(g.phase === "won" && g.mode === "tutorial" ? "plus" : g.mode));
      }
    };

    // Every button clicks (after what it does, so that the sound button clicks when the sound has been turned on and not when it is turned off).
    const act = (id: string, at?: {x: number; y: number}) => {
      const coinsBefore = wallet.coins;
      perform(id);
      // Something was bought with coins: coins and sparkles burst out where the button was.
      if (at && coinsBefore - wallet.coins > 0) {
        ui.buyFx = 0;
        ui.buyAt = {x: at.x, y: at.y};
        ui.buyN = coinsBefore - wallet.coins;
        playBuy();
      }
      // Turning a page of the book has its own sound (the page turning), so the buttons for it do not click as well.
      if (id !== "next" && id !== "prev" && !id.startsWith("page:")) playClick();
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      if (fading) return;
      const p = point(e);
      const id = hitTest(p.x, p.y);
      if (ui.settingsOpen || ui.pauseOpen || ui.scoresOpen || ui.energyOpen || ui.cupsOpen || ui.adOpen) {
        // The settings, the pause page, the energy page and the ad are over everything: only their own buttons can be pressed (and the game waits behind them).
        if (id && (id.startsWith("set:") || id === "settingsClose" || id === "scoresClose" || id === "energyAd" || id === "energyShop" || id === "energyClose" || id.startsWith("cups:") || id === "pauseResume" || id === "pauseQuit" || id === "adClose")) {
          ui.pressed = id;
          press = {id, x: p.x, y: p.y, moved: false, pointer: e.pointerId, settings: true};
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }
      // The page numbers of the book: a press goes to that page, and a finger dragged along them turns the pages, the whole strip being all of them.
      if (g.phase === "menu" && id && (id === "pageStrip" || id.startsWith("page:"))) {
        const start = id.startsWith("page:") ? Number(id.slice(5)) : Math.round(book.pos);
        goToPage(book, start);
        scrub = {pointer: e.pointerId, startX: p.x, startPage: start};
        ui.scrubbing = true;
        ui.pressed = null;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      // The buttons after a round do not work for a moment, so that a late tap does not skip the screen.
      if ((g.phase === "over" || g.phase === "won" || g.phase === "intro" || g.phase === "perk") && g.overTimer <= BUTTON_DELAY && id !== "settings") return;
      if (id) ui.pressed = id;
      if (g.phase === "menu" || id) {
        press = {id, x: p.x, y: p.y, moved: false, pointer: e.pointerId};
        // (the buttons for the next and the previous page do not start a drag: they would take hold of a page that is on its way)
        if (g.phase === "menu" && id !== "next" && id !== "prev" && !id?.startsWith("page:")) beginDrag(book);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (g.phase !== "play") return;
      // A number under the finger first (and the finger can go on to take more numbers with it); otherwise a cup to drag.
      const skip = new Set<number>();
      if (tapAt(g, p.x, p.wy, skip)) {
        swipe = {pointer: e.pointerId, x: p.x, y: p.wy, skip};
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      const cup = cupAt(g, p.x, p.wy);
      if (cup) {
        // A double tap on a laser cup fires it (it clears its column) instead of taking hold of it.
        const at = performance.now();
        if (cup.kinds.includes("laser") && lastCupTap && lastCupTap.id === cup.id && at - lastCupTap.at < 350) {
          lastCupTap = null;
          fireLaser(g, cup);
          return;
        }
        lastCupTap = {id: cup.id, at};
        // A cup that is still being dragged (a second finger, or a finger that was lifted without us hearing of it) is put down in its
        // column first, so that it is not left in between the columns, on top of another cup.
        if (drag) dropCup(g, drag.cup);
        drag = {cup, dx: cup.x - p.x, pointer: e.pointerId};
        canvas.setPointerCapture(e.pointerId);
      } else {
        // Nothing under the finger: it can still slide over numbers and take them down.
        swipe = {pointer: e.pointerId, x: p.x, y: p.wy, skip};
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (scrub && scrub.pointer === e.pointerId) {
        const per = PAGER.w / (PAGES.length - 1); // (the width of the strip is every page)
        const page = Math.round(scrub.startPage + (point(e).x - scrub.startX) / per);
        goToPage(book, Math.min(PAGES.length - 1, Math.max(0, page)));
        return;
      }
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
      if (swipe && swipe.pointer === e.pointerId) {
        // Every number the finger passes over on its way (the points in between too, so that a fast stroke does not skip any) is tapped once.
        if (g.phase !== "play" || ui.settingsOpen || ui.pauseOpen || ui.scoresOpen || ui.energyOpen || ui.cupsOpen || ui.adOpen) return;
        const p = point(e);
        const steps = Math.max(1, Math.ceil(Math.hypot(p.x - swipe.x, p.wy - swipe.y) / (TAP_RADIUS * 0.6)));
        for (let k = 1; k <= steps; k++) tapAt(g, swipe.x + ((p.x - swipe.x) * k) / steps, swipe.y + ((p.wy - swipe.y) * k) / steps, swipe.skip);
        swipe.x = p.x;
        swipe.y = p.wy;
        return;
      }
      if (!drag || drag.pointer !== e.pointerId || g.phase !== "play") return;
      moveCup(g, drag.cup, point(e).x + drag.dx);
    };

    const onUp = (e: PointerEvent) => {
      if (scrub && scrub.pointer === e.pointerId) {
        scrub = null;
        ui.scrubbing = false;
        return;
      }
      if (press && press.pointer === e.pointerId) {
        const {id, moved, settings} = press;
        const p = point(e);
        press = null;
        ui.pressed = null;
        if (g.phase === "menu" && !settings) endDrag(book);
        if (!moved && id && hitTest(p.x, p.y) === id) act(id, {x: p.x, y: p.y});
        return;
      }
      if (swipe && swipe.pointer === e.pointerId) {
        swipe = null;
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
      else if (ui.cupsOpen) ui.cupsOpen = false;
      else if (ui.energyOpen) ui.energyOpen = false;
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
