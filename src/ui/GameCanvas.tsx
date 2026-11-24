// The game's canvas: runs the loop, scales the 360 x 640 game to the screen, and takes the finger.
import {type FormEvent, useCallback, useEffect, useRef, useState} from "react";
import {DAILY_BONUS, DAILY_REWARD, DAILY_RUNGS, EXTRA_MAX, H, SCREEN_MAX, ERASER_MAX, TAP_RADIUS, W, WIN_DELAY} from "../game/constants";
import {STREAK_RUNGS, type Package, type Streak, dayKey, recordDay, rollPackage, rungEnds, rungsDone, streakCoins, streakCount, streakDayFor} from "../game/daily";
import {CUP_PRICE, isShopCup} from "../game/cups";
import {SAUCER_PRICE, isSaucer} from "../game/saucers";
import {LOOK_KINDS, type LookKind, findLook} from "../game/looks";
import {FEATURES, moveShield, craftOn, holdCraft, flyCraftTo, choosePerk, continueGame, createGame, cupAt, dropCup, endIntro, fireLaser, moveCup, recordBest, useEraser, showMenu, startDaily, startGame, startVariant, tapAt, untangleCups, update, useScreen, cannonOn, aimCannon, fireCannon, lineOn, lineStart, lineMove, lineEnd, mineOn, mineTap, ninjaOn, ninjaStart, ninjaMove, ninjaEnd} from "../game/engine";
import type {Cup, Feature, Mode, Variant} from "../game/types";
import {getVolumeStep, isMusicOn, isMuted, playBuy, playFadeGone, playGain, playClick, playEvent, playPageTurn, setMusicScene, setMusicTrack, stepVolume, type MusicTrack, toggleMusic, toggleMute, unlockAudio} from "./audio";
import {AD_SECONDS} from "./ad";
import {makeBackgrounds} from "./background";
import {BUY_PAGE, CONTENTS_PAGE, DAILY_PAGE, PAGER, PAGES, SHOP_PAGE, beginDrag, createBook, dragBy, endDrag, goToPage, isUnlocked, markCleared, markProgress, currentPage, markScore, openNextGame, pageOfMode, showPage, subPages, tabTarget, updateBook, variantOpen, MATCH_PAGES} from "./book";
import {hitTest, ui} from "./draw";
import {type Lang, lang, setLang, t} from "./i18n";
import {Fx} from "./fx";
import {BUTTON_DELAY, drawGame, tapMenuBall} from "./render";
import {NAME_MAX, cleanName, deviceId, playerName, setPlayerName} from "./profile";
import {FEEDBACK_KINDS, FEEDBACK_MAX, type FeedbackKind, type SendResult, cleanFeedback, submitFeedback} from "./feedback";
import {SCORE_MODES, TOP_ROWS, type ScoreMode, boards, loadBoard, submitScore} from "./scores";
import {useUpdates} from "./updates";
import {CLOTH_PRICE, DAILY_GIFT, ERASER_PRICE, buyEraser, ENDLESS_COST, ENERGY_PRICE, MAX_COPIES, VIDEO_COINS, addCoins, ownsLook, refillPrice, grantCup, buyCloth, buyCup, allOnCup, buyLook, equipLook, buyEnergyPoint, buyEnergyRefill, clearCup, buyMode, isUnlockMode, isVariant, priceOfMode, loadWallet, loadout, saucerLoadout, buySaucer, cycleSaucer, saveWallet, toggleOnCup} from "./wallet";
import {PAYMENTS_CONNECTED, grantPurchase, loadPremium, savePremium} from "./purchase";
import {type DailyRecord, loadDaily, loadGiftDay, loadStreak, loadVideoDay, saveDaily, saveGiftDay, saveStreak, saveVideoDay, todaysTry} from "./dailyStore";
import {ENERGY_MAX, ENERGY_PER_AD, addEnergy, loadEnergy, refreshEnergy, saveEnergy, secondsToNext, spendEnergy} from "./energy";

const BEST_KEY = "p10-best";
const CLEARED_KEY = "p10-cleared";
const PROGRESS_KEY = "p10-progress";
const SCORES_KEY = "p10-scores";
const HIDE_INTROS_KEY = "p10-hide-intros";
const ADMIN_KEY = "p10-admin";
const SCREENS_KEY = "p10-screens";

const LAST_MATCH_KEY = "p10-last-match";

/** The match mode page that was visited last (the contents shows it). */
function loadLastMatch(): string {
  try {
    const v = localStorage.getItem(LAST_MATCH_KEY);
    return v && (MATCH_PAGES as readonly string[]).includes(v) ? v : "endless";
  } catch {
    return "endless";
  }
}

function hasLastMatch(): boolean {
  try {
    return localStorage.getItem(LAST_MATCH_KEY) !== null;
  } catch {
    return false;
  }
}

function saveLastMatch(page: string): void {
  try {
    localStorage.setItem(LAST_MATCH_KEY, page);
  } catch {
    /* private mode */
  }
}

/** Where the record of a game is kept: the endless game has its own, and every match mode too. */
function bestKey(game: ScoreMode): string {
  return game === "endless" ? BEST_KEY : `${BEST_KEY}-${game}`;
}

function loadBest(game: ScoreMode = "endless"): number {
  try {
    return Number(localStorage.getItem(bestKey(game))) || 0;
  } catch {
    return 0;
  }
}

function saveBest(best: number, game: ScoreMode = "endless"): void {
  try {
    localStorage.setItem(bestKey(game), String(best));
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

/** How many erasers there are (bought in the shop, or won with three stars). */
function loadErasers(): number {
  try {
    return Math.min(ERASER_MAX, Math.max(0, Math.floor(Number(localStorage.getItem("p10-erasers")) || 0)));
  } catch {
    return 0;
  }
}

function saveErasers(n: number): void {
  try {
    localStorage.setItem("p10-erasers", String(n));
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

/** Whether the first-start page (language and new game) has been through. */
function hasStarted(): boolean {
  try {
    return localStorage.getItem("p10-started") === "1";
  } catch {
    return true;
  }
}

function saveStarted(): void {
  try {
    localStorage.setItem("p10-started", "1");
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
  // The box for writing to us (from the back cover of the book): what kind of message, what is written, and how the sending went.
  const [feedback, setFeedback] = useState<{kind: FeedbackKind; text: string; state: "typing" | "sending" | "sent" | Exclude<SendResult, "sent" | "empty">} | null>(null);
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
    /** The days in a row of the daily challenge (see daily.ts). */
    let streak: Streak | null = loadStreak();
    /** The last day the video for coins was watched: it can be watched once a day. */
    let videoDay = loadVideoDay();
    /** The last day the gift of the day was taken (see giveGift): it comes once a day. */
    let giftDay = loadGiftDay();
    try {
      ui.layout = localStorage.getItem("p10-layout") === "groups" ? "groups" : "menu";
    } catch {
      /* private mode */
    }
    /** How many pull-down screens there are in the book (also kept in the browser: see loadScreens). */
    let screensHeld = loadScreens();
    let erasersHeld = loadErasers();
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
    for (const m of SCORE_MODES) ui.bests[m] = loadBest(m);
    ui.lastMatch = loadLastMatch();
    ui.hasLastMatch = hasLastMatch();
    // The very first start: a page to choose the language (English is on) and start a new game. Someone who has played before never sees it.
    if (!hasStarted()) {
      if (book.cleared.size === 0 && wallet.coins === 0) {
        ui.startOpen = true;
        setLang("en");
      } else saveStarted();
    }
    book.premium = premium;
    // The app starts on the page you are at: the tutorial until it has been cleared, then the chapter of the first level that has not been cleared yet,
    // and the endless game when every level has been.
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
    let press: {id: string | null; x: number; y: number; moved: boolean; pointer: number; settings?: boolean; axis?: "x" | "y"; scroll0?: number; slideAt?: number; slideVel?: number} | null = null;
    // Between two screens the picture fades to black and back: `fade` is how dark it is.
    let fade = 0;
    // Every page that is turned in the book makes a sound.
    let turns = Math.round(book.pos);
    /** The song of the round that is on (null in the book), and the last one that was picked (the next round gets another). */
    let roundSong: MusicTrack | null = null;
    let lastSong: MusicTrack | null = null;
    /** The page the book last came to rest on (the dialog of the gift opens when it comes to the daily steps). */
    let lastSettled: string | null = null;
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
    const startRound = (mode: Mode, stage: number, variant?: Variant) => {
      if (fading || starting) return;
      // A try costs one energy (the tutorial is free), and a try of the endless game costs ENDLESS_COST coins as well; nothing costs anything with
      // Premium. With no energy left the energy page opens instead, and with too few coins a message says so (nothing is paid in either case).
      let spent = false;
      let paid = false;
      if (mode !== "tutorial" && !premium) {
        if (mode === "endless" && !variant && wallet.coins < ENDLESS_COST) {
          toBuy(t("endNoCoins", {n: ENDLESS_COST}));
          return;
        }
        if (!spendEnergy(energy, Date.now())) {
          ui.energyOpen = true;
          return;
        }
        saveEnergy(energy);
        spent = true;
        if (mode === "endless" && !variant) {
          wallet.coins -= ENDLESS_COST;
          saveWallet(wallet);
          paid = true;
        }
      }
      const begin = () =>
        transition(() => {
          // The levels of the book use the screens that have been collected; the endless game starts with its own.
          if (mode !== "endless") g.screens = loadScreens();
          g.erasers = erasersHeld;
          g.loadout = loadout(wallet);
          g.saucerLoadout = saucerLoadout(wallet);
          ui.lastCoins = 0;
          g.best = loadBest(variant ?? "endless"); // (the record of what is played: the endless game, or a match mode)
          ui.topPlace = null;
          if (mode === "endless") void loadBoard(variant ?? "endless"); // (so that it can be seen at the end whether the round made the top list)
          if (variant) startVariant(g, variant);
          else startGame(g, mode, stage);
          fx.clear();
        });
      if (spent || paid) {
        // The energy is seen being used (the pill shakes and the key flies off it), or the coins are seen being paid, before the round starts.
        if (spent) ui.energyFx = 0;
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
        g.saucerLoadout = saucerLoadout(wallet);
        ui.lastCoins = 0;
        startDaily(g);
        fx.clear();
      });
    };
    /** One more try of today's daily challenge (as many as you like, each for a video): the same numbers, from the start. */
    const retryDailyRound = () => {
      if (fading || !ui.dailyRetry) return;
      transition(() => {
        g.loadout = loadout(wallet);
        g.saucerLoadout = saucerLoadout(wallet);
        ui.lastCoins = 0;
        startDaily(g);
        fx.clear();
      });
    };
    /** What is in a package goes to the player: a package that cannot be used (the energy or the cloths are full, or all the copies of the cup are owned) gives coins instead. */
    const givePackage = (item: Package): Package => {
      let given = item;
      if (item.kind === "cloth" && screensHeld >= SCREEN_MAX) given = {kind: "coins", n: 150};
      else if (item.kind === "energy") {
        refreshEnergy(energy, Date.now());
        if (energy.n >= ENERGY_MAX) given = {kind: "coins", n: 150};
      } else if (item.kind === "cup" && !grantCup(wallet, item.cup)) given = {kind: "coins", n: 200};
      if (given.kind === "coins") addCoins(wallet, given.n);
      else if (given.kind === "cloth") {
        screensHeld = Math.min(SCREEN_MAX, screensHeld + given.n);
        saveScreens(screensHeld);
      } else if (given.kind === "energy") {
        addEnergy(energy, given.n, Date.now());
        saveEnergy(energy);
      }
      saveWallet(wallet);
      return given;
    };
    /** Too few coins for something that was tapped: a message says so, and the page for buying coins opens (from a round, through the fade). */
    const toBuy = (message = t("needCoins")) => {
      ui.notice = message;
      ui.noticeTime = 2.4;
      if (g.phase === "menu") goToPage(book, BUY_PAGE, true);
      else toBook(BUY_PAGE);
    };
    /** The coins for the video of the day (only once a day). */
    const giveVideoCoins = () => {
      if (videoDay === dayKey()) return;
      videoDay = dayKey();
      saveVideoDay(videoDay);
      addCoins(wallet, VIDEO_COINS);
      saveWallet(wallet);
      ui.notice = t("pkgCoins", {n: VIDEO_COINS});
      ui.noticeTime = 2.4;
    };
    /** The gift of the day goes into the wallet (twice as much after an ad); once a day. */
    const giveGift = (times: 1 | 2) => {
      const dk = dayKey();
      if (giftDay === dk) return;
      giftDay = dk;
      saveGiftDay(dk);
      addCoins(wallet, DAILY_GIFT * times);
      saveWallet(wallet);
      ui.giftGot = DAILY_GIFT * times;
      ui.giftAge = 0;
    };
    /** The score so far of an endless round that is left before it ends (or when the app is closed) is kept if it is a record. */
    const saveRecord = () => {
      if (!recordBest(g)) return;
      const game: ScoreMode = g.variant ?? "endless";
      saveBest(g.best, game);
      ui.bests[game] = g.best;
      const name = playerName();
      if (name) void submitScore(name, g.best, game);
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
        // A round that gets on the top list (the endless game or a match mode) is lit up on the card, with a celebration.
        if (e.t === "gameOver" && g.mode === "endless" && !g.daily) {
          const bd = boards[g.variant ?? "endless"];
          const me = deviceId();
          const place = 1 + bd.rows.filter((r) => r.device !== me && r.score >= g.score).length;
          ui.topPlace = bd.status === "ok" && g.score > 0 && place <= TOP_ROWS ? place : null;
          if (ui.topPlace !== null || e.newBest) {
            window.setTimeout(() => {
              if (g.phase !== "over") return;
              fx.react(g, {t: "won", stars: 3});
              playGain();
            }, 500);
          }
        }
        if (e.t === "gameOver" && e.newBest) {
          const game: ScoreMode = g.variant ?? "endless";
          saveBest(g.best, game);
          ui.bests[game] = g.best;
          // A new record in the endless game goes to the top list under the player's name (asked for the first time).
          const record = g.best;
          // (with a name the record is sent at once, so that it is kept even if the round is left right away; without one, the name is asked for in a moment)
          const name = playerName();
          if (name) void submitScore(name, record, game);
          else
            window.setTimeout(() => {
              if (g.phase !== "over" || playerName()) return;
              setNameAsk({
                draft: "",
                done: (n) => {
                  if (n) void submitScore(setPlayerName(n), record, game);
                },
              });
          }, 900);
        }
        if (e.t === "introHide") saveHiddenIntros(g.hideIntros);
        // The screens collected in the levels of the book are remembered (the endless game has its own).
        if (e.t === "erasers") {
          erasersHeld = e.n;
          saveErasers(e.n);
        }
        if (e.t === "screens" && g.mode !== "endless") {
          saveScreens(e.n);
          screensHeld = e.n;
        }
        // A cup that reaches 10 in a level of the book lights a dot on its tile (the most cups so far).
        if (e.t === "levelUp" && g.stage > 0 && markProgress(book, g.mode, g.stage, Math.floor(e.done + 1e-9))) saveProgress(book.bestCups);
        // Coins come only from the daily challenge (every rung, and the top): the levels of the book and the endless game pay nothing.
        if (e.t === "levelUp" && g.mode !== "tutorial") {
          const rung = rungsDone(e.level - 1);
          if (g.daily && rungEnds(e.level - 1) && rung >= 1 && rung <= DAILY_RUNGS) {
            // (the coins of the day: a little more for every day in a row; a stage that was cleared in an earlier try of the day does not pay again, and
            // the day counts for the streak when the goal line has been reached)
            const today = dayKey();
            const best = todaysTry(dailyRec)?.rungs ?? 0;
            if (rung > best) earn(streakCoins(DAILY_REWARD[rung - 1], streakDayFor(streak, today)));
            if (rung >= STREAK_RUNGS) {
              streak = recordDay(streak, today);
              saveStreak(streak);
            }
            dailyRec = {day: today, rungs: Math.max(best, rung), cleared: false};
            saveDaily(dailyRec);
          }
        }
        if (e.t === "won" && g.mode !== "tutorial") {
          if (g.daily) {
            earn(streakCoins(DAILY_BONUS, streakDayFor(streak, dayKey())));
            dailyRec = {day: dayKey(), rungs: DAILY_RUNGS, cleared: true};
            saveDaily(dailyRec);
          }
          // (clearing a level of the book pays no coins)
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
      if (ui.buyFx >= 0) ui.buyFx = ui.buyFx + dt > (ui.buyGain ? 1.8 : 1.2) ? -1 : ui.buyFx + dt;
      if (ui.energyFx >= 0) ui.energyFx = ui.energyFx + dt > 1 ? -1 : ui.energyFx + dt;
      ui.premium = premium;
      ui.noticeTime = Math.max(0, ui.noticeTime - dt);
      ui.screens = screensHeld;
      ui.erasers = erasersHeld;
      ui.owned = wallet.owned;
      ui.modes = wallet.modes;
      // (the match mode page that is settled on is remembered, for the contents)
      const settled = PAGES[Math.round(book.pos)];
      if (Math.abs(book.pos - book.target) < 0.01 && settled && (MATCH_PAGES as readonly string[]).includes(settled) && ui.lastMatch !== settled) {
        ui.lastMatch = settled;
        ui.hasLastMatch = true;
        saveLastMatch(settled);
      }
      // The gift of the day: its dialog opens when the book comes to the page of the daily steps (while it can still be taken today).
      const atRest = Math.abs(book.pos - book.target) < 0.01;
      if (atRest && settled === "daily" && lastSettled !== "daily" && ui.giftReady && !ui.giftOpen && g.phase === "menu" && !ui.startOpen && !ui.settingsOpen) {
        ui.giftOpen = true;
        ui.giftAge = 0;
        ui.giftGot = 0;
      }
      if (atRest) lastSettled = settled ?? null;
      ui.saucers = wallet.saucers;
      ui.saucerSlots = wallet.saucerSlots;
      ui.slots = wallet.slots;
      const today = todaysTry(dailyRec);
      ui.dailyUsed = today !== null;
      ui.dailyRungs = today?.rungs ?? 0;
      ui.dailyCleared = today?.cleared ?? false;
      const dk = dayKey();
      ui.streakDay = streakDayFor(streak, dk);
      ui.streakCount = streakCount(streak, dk);
      ui.streakToday = streak?.last === dk;
      ui.streakGift = streak?.gift ?? false;
      ui.videoReady = videoDay !== dk;
      ui.giftReady = giftDay !== dk;
      if (ui.giftOpen) ui.giftAge += dt;
      // (the very first start: once the front cover has been turned, the bar at the bottom is there)
      if (ui.coverIntro && Math.round(book.pos) !== 0) ui.coverIntro = false;
      ui.dailyRetry = ui.dailyUsed && !ui.dailyCleared; // (as many tries as you like, each for an ad, until the whole ladder has been climbed)
      if (ui.packageOpen) ui.packageAge += dt;
      // The game waits while the settings or the pause page are open.
      const gameDt = (ui.settingsOpen || ui.pauseOpen) && g.phase === "play" ? 0 : dt;
      update(g, gameDt);
      updateBook(book, dt);
      // (every page that is passed, not every press: a jump over five pages makes five sounds)
      const here = Math.round(book.pos);
      if (here !== turns) {
        turns = here;
        playPageTurn(1 + Math.random() * 0.12);
      }
      fx.update(g, gameDt);
      if (fx.takeGone()) playFadeGone();
      handleEvents();
      // The cup that is held is marked; and when no cup is held every cup stands in a column of its own (a safety net).
      ui.heldCup = drag ? drag.cup.id : null;
      if (!drag) untangleCups(g);
      // The music plays in a round, not in the book. It fades out for the pause page, a cleared level and game over (and the song goes on
      // silently, so the next level does not start it over).
      // (the song of the round: picked at random when a round starts, not the same as the last one; the space chapter always has its own)
      if (g.phase !== "menu" && !roundSong) {
        const songs = (["music", "ambient1", "ambient2", "calm"] as const).filter((t) => t !== lastSong);
        roundSong = g.mode === "space" && !g.variant && !g.daily ? "space" : songs[Math.floor(Math.random() * songs.length)];
        if (roundSong !== "space") lastSong = roundSong;
        setMusicTrack(roundSong);
      } else if (g.phase === "menu") roundSong = null;
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
      // The pages of a group of the bar at the bottom are popped out: a tap on one of them goes there, a tap on the group closes the arc again,
      // and a tap on anything else only closes it.
      if (ui.barOpen >= 0 && !id.startsWith("tab:")) {
        if (id === "subStrip") return; // (a tap on the panel of the slider, between its buttons)
        ui.barOpen = -1;
        if (id.startsWith("sub:")) goToPage(book, Number(id.slice(4)), true);
        return;
      }
      if (id === "settings") {
        ui.settingsOpen = true;
      } else if (id === "settingsClose") {
        ui.settingsOpen = false;
      } else if (id.startsWith("scores:")) {
        // The top list of a game (the endless game or a match mode).
        const game = id.slice(7) as ScoreMode;
        if (SCORE_MODES.includes(game)) {
          ui.scoresMode = game;
          ui.scoresOpen = true;
          void loadBoard(game);
        }
      } else if (id === "scoresClose") {
        ui.scoresOpen = false;
      } else if (id === "set:name") {
        // Change the name (and send the record again under it).
        setNameAsk({
          draft: playerName(),
          done: (n) => {
            if (!n) return;
            const name = setPlayerName(n);
            for (const m of SCORE_MODES) if (ui.bests[m] > 0) void submitScore(name, ui.bests[m], m);
          },
        });
      } else if (id === "start:new") {
        ui.startOpen = false;
        saveStarted();
        // The very first start: the tutorial begins at once (it costs no energy).
        startRound("tutorial", 0);
      } else if (id === "gift:take") {
        giveGift(1);
      } else if (id === "gift:ad") {
        // Twice the gift, for an ad (with Premium there is no ad).
        if (premium) giveGift(2);
        else {
          ui.adFor = "gift";
          ui.adOpen = true;
          ui.adTime = 0;
        }
      } else if (id === "gift:later" || id === "gift:close") {
        ui.giftOpen = false;
      } else if (id === "set:layout") {
        ui.layout = ui.layout === "groups" ? "menu" : "groups";
        ui.barOpen = -1;
        try {
          localStorage.setItem("p10-layout", ui.layout);
        } catch {
          /* private mode */
        }
      } else if (id.startsWith("side:")) {
        // A coloured tab on the edge of the book: to the page of its group.
        goToPage(book, tabTarget(book, Number(id.slice(5))), true);
      } else if (id === "set:sound") {
        toggleMute();
      } else if (id === "set:music") {
        toggleMusic();
      } else if (id === "set:volDown") {
        if (!isMuted() || isMusicOn()) stepVolume(-1); // (nothing to turn down while the sound and the music are both off)
      } else if (id === "set:volUp") {
        if (!isMuted() || isMusicOn()) stepVolume(1);
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
        toBook(g.daily ? DAILY_PAGE : g.variant ? PAGES.indexOf(g.variant) : pageOfMode(g.mode)); // (a match mode goes back to its own page)
      } else if (id === "daily:play") {
        startDailyRound();
      } else if (id === "daily:retry") {
        // A new try after a video (with Premium there is no video).
        if (ui.dailyRetry) {
          if (premium) retryDailyRound();
          else {
            ui.adFor = "retry";
            ui.adOpen = true;
            ui.adTime = 0;
          }
        }
      } else if (id === "daily:gift") {
        // The package of the seventh day is opened: what is in it is picked now, and goes straight to the player.
        if (streak?.gift) {
          ui.packageOpen = givePackage(rollPackage(Math.random));
          ui.packageAge = 0;
          streak = {...streak, gift: false};
          saveStreak(streak);
        }
      } else if (id === "package:close") {
        ui.packageOpen = null;
      } else if (id === "toc:toggle") {
        ui.tocOpen = !ui.tocOpen;
      } else if (id === "toc:modes") {
        ui.modesOpen = !ui.modesOpen;
      } else if (id === "support") {
        // The back cover: a box for writing a question, an idea or a problem.
        setFeedback({kind: "idea", text: "", state: "typing"});
      } else if (id.startsWith("tab:")) {
        // A place on the bar at the bottom: the match modes and the shop pop out their pages in an arc (a second tap closes it), the others go to their page.
        const group = Number(id.slice(4));
        if (subPages(group).length > 0) {
          ui.barOpen = ui.barOpen === group ? -1 : group;
          ui.barOpenAt = performance.now() / 1000;
          ui.subScroll = -1;
        } else {
          ui.barOpen = -1;
          goToPage(book, tabTarget(book, group), true);
        }
      } else if (id.startsWith("variant:")) {
        // A match mode is played (it has to be open: bought with coins, or Premium).
        const v = id.slice(8);
        if (isVariant(v) && variantOpen(book, v)) startRound("endless", 0, v);
      } else if (id.startsWith("unlock:")) {
        // A match mode is bought with coins (with too few coins the page for buying coins opens).
        const v = id.slice(7);
        if (isUnlockMode(v) && !variantOpen(book, v)) {
          if (buyMode(wallet, v)) saveWallet(wallet);
          else if (wallet.coins < priceOfMode(v)) toBuy();
        }
      } else if (id.startsWith("page:") || id.startsWith("toc:")) {
        goToPage(book, Number(id.slice(id.indexOf(":") + 1)), true);
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
        ui.shopTab = Math.min(2, Math.max(0, Number(id.slice(9)) || 0));
      } else if (id.startsWith("looks:tab:")) {
        ui.lookTab = Math.min(4, Math.max(0, Number(id.slice(10)) || 0));
      } else if (id.startsWith("looks:buy:") || id.startsWith("looks:use:")) {
        const [, action, kind, look] = id.split(":");
        if (isLookKind(kind)) {
          if (action === "buy" ? buyLook(wallet, kind, look) : equipLook(wallet, kind, look)) saveWallet(wallet);
          else if (action === "buy" && !ownsLook(wallet, kind, look) && wallet.coins < (findLook(kind, look)?.price ?? 0)) toBuy();
        }
      } else if (id === "shop:energy1") {
        refreshEnergy(energy, Date.now());
        if (buyEnergyPoint(wallet, energy.n, ENERGY_MAX)) {
          addEnergy(energy, 1, Date.now());
          saveEnergy(energy);
          saveWallet(wallet);
        } else if (energy.n < ENERGY_MAX && wallet.coins < ENERGY_PRICE) toBuy();
      } else if (id === "shop:energyFull") {
        refreshEnergy(energy, Date.now());
        const points = buyEnergyRefill(wallet, energy.n, ENERGY_MAX);
        if (points > 0) {
          addEnergy(energy, points, Date.now());
          saveEnergy(energy);
          saveWallet(wallet);
        } else if (energy.n < ENERGY_MAX && wallet.coins < refillPrice(ENERGY_MAX - energy.n)) toBuy();
      } else if (id === "energyShop") {
        // (to the energy of the shop in the book)
        ui.energyOpen = false;
        ui.shopTab = 2;
        toBook(SHOP_PAGE);
      } else if (id === "shop:eraser") {
        const n = buyEraser(wallet, erasersHeld, ERASER_MAX);
        if (n !== null) {
          erasersHeld = n;
          saveErasers(n);
          saveWallet(wallet);
        } else if (erasersHeld < ERASER_MAX && wallet.coins < ERASER_PRICE) toBuy();
      } else if (id === "shop:cloth") {
        const n = buyCloth(wallet, screensHeld, SCREEN_MAX);
        if (n !== null) {
          screensHeld = n;
          saveScreens(n);
          saveWallet(wallet);
        } else if (screensHeld < SCREEN_MAX && wallet.coins < CLOTH_PRICE) toBuy();
      } else if (id.startsWith("saucer:buy:")) {
        // A saucer is bought and put under the first cup that has none.
        const kind = id.slice(11);
        if (isSaucer(kind) && buySaucer(wallet, kind)) saveWallet(wallet);
        else if (isSaucer(kind) && wallet.saucers[kind] < MAX_COPIES && wallet.coins < SAUCER_PRICE[kind]) toBuy();
      } else if (id.startsWith("saucer:slot:")) {
        // The saucer under a cup is changed to the next one there is a copy to spare of.
        if (cycleSaucer(wallet, Number(id.slice(12)))) saveWallet(wallet);
      } else if (id.startsWith("shop:buy:")) {
        const kind = id.slice(9);
        if (isShopCup(kind) && buyCup(wallet, kind)) {
          saveWallet(wallet);
          // (the dialog opens, to put the cup that was bought on the cups of the desk)
          ui.cupsOpen = true;
          ui.cupFocus = kind;
          ui.cupSlot = 0;
        } else if (isShopCup(kind) && wallet.owned[kind] < MAX_COPIES && wallet.coins < CUP_PRICE[kind]) toBuy();
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
      } else if (id === "first") {
        goToPage(book, 0, true);
      } else if (id === "last") {
        goToPage(book, BUY_PAGE, true); // (the last page is the Purchase page: the back cover after it is only turned to)
      } else if (id.startsWith("play:")) {
        const [, mode, stage] = id.split(":");
        if (isUnlocked(book, mode as Mode, Number(stage))) startRound(mode as Mode, Number(stage));
      } else if (id === "again") {
        const next = g.phase === "won" ? openNextGame(book, g.mode, g.stage) : undefined;
        startRound(next?.mode ?? g.mode, next?.stage ?? g.stage, next ? undefined : g.variant ?? undefined);
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
      } else if (id === "video:coins") {
        // The video of the day: coins for watching it (once a day; with Premium there is no video, the coins just come).
        if (videoDay !== dayKey()) {
          if (premium) giveVideoCoins();
          else {
            ui.adFor = "coins";
            ui.adOpen = true;
            ui.adTime = 0;
          }
        }
      } else if (id === "adClose") {
        if (ui.adOpen && ui.adTime >= AD_SECONDS) {
          ui.adOpen = false;
          if (ui.adFor === "coins") giveVideoCoins();
          else if (ui.adFor === "gift") giveGift(2);
          else if (ui.adFor === "retry") retryDailyRound();
          else if (ui.adFor === "energy") {
            addEnergy(energy, ENERGY_PER_AD, Date.now());
            saveEnergy(energy);
          } else if (continueGame(g)) fx.clear();
        }
      } else if (id === "screen") {
        useScreen(g);
      } else if (id === "eraser") {
        useEraser(g);
      } else if (id === "introOk") {
        endIntro(g);
      } else if (id === "introNever") {
        endIntro(g, true);
      } else if (id === "toBook") {
        toBook(g.daily ? DAILY_PAGE : g.variant ? PAGES.indexOf(g.variant) : pageOfMode(g.phase === "won" && g.mode === "tutorial" ? "plus" : g.mode));
      }
    };

    // Every button clicks (after what it does, so that the sound button clicks when the sound has been turned on and not when it is turned off).
    const act = (id: string, at?: {x: number; y: number}) => {
      const coinsBefore = wallet.coins;
      perform(id);
      // Something was bought with coins (they burst out where the button was), or coins came in (a pack bought with money, Premium, a video: a shower
      // of coins, a flash of light and "+N").
      const delta = wallet.coins - coinsBefore;
      if (at && delta !== 0) {
        ui.buyFx = 0;
        ui.buyAt = {x: at.x, y: at.y};
        ui.buyN = Math.abs(delta);
        ui.buyGain = delta > 0;
        if (delta > 0) playGain();
        else playBuy();
      }
      // Turning a page of the book has its own sound (the page turning), so the buttons for it do not click as well.
      // (the bar at the bottom makes no sound of its own, nor do its arcs: a tap that goes to a page has the sound of the page turning, and nothing else)
      const barQuiet = id === "barBackdrop" || id.startsWith("sub:") || id.startsWith("tab:") || id.startsWith("side:");
      if (!barQuiet && id !== "next" && id !== "prev" && id !== "first" && id !== "last" && !id.startsWith("page:") && !id.startsWith("toc:")) playClick();
    };

    let shieldPointer: number | null = null;
    let cannonPointer: number | null = null;
    let linePointer: number | null = null;
    let ninjaPointer: number | null = null;
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      if (fading) return;
      const p = point(e);
      const id = hitTest(p.x, p.y);
      if (ui.packageOpen || ui.giftOpen || ui.startOpen || ui.settingsOpen || ui.pauseOpen || ui.scoresOpen || ui.energyOpen || ui.cupsOpen || ui.adOpen) {
        // The start page, the settings, the pause page, the energy page and the ad are over everything: only their own buttons can be pressed (and the game waits behind them).
        if (id && (id.startsWith("set:") || id === "start:new" || id === "package:close" || id.startsWith("gift:") || id === "settingsClose" || id === "scoresClose" || id === "energyAd" || id === "energyShop" || id === "energyClose" || id.startsWith("cups:") || id === "pauseResume" || id === "pauseQuit" || id === "adClose")) {
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
      // A number drifting behind the book: a tap makes it fall (the finger can go on to drag the book).
      if (g.phase === "menu" && !id) tapMenuBall(g, p.x, p.y);
      if (g.phase === "menu" || id) {
        press = {id, x: p.x, y: p.y, moved: false, pointer: e.pointerId};
        // (the buttons for the next and the previous page do not start a drag: they would take hold of a page that is on its way)
        if (g.phase === "menu" && id !== "next" && id !== "prev" && id !== "first" && id !== "last" && !id?.startsWith("page:") && !id?.startsWith("tab:") && !id?.startsWith("side:") && ui.barOpen < 0) beginDrag(book);
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
      // Ninja: the finger is the blade: it cuts the balls it goes through.
      if (ninjaOn(g)) {
        ninjaPointer = e.pointerId;
        ninjaStart(g, p.x, p.wy);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      // The mine: a tap digs (or walks).
      if (mineOn(g)) {
        mineTap(g, p.x, p.wy);
        return;
      }
      // Draw to 10: the finger draws a line through the tiles, and letting go counts it.
      if (lineOn(g)) {
        linePointer = e.pointerId;
        lineStart(g, p.x, p.wy);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      // The cannon: the finger aims it (anywhere on the screen), and letting go fires.
      if (cannonOn(g)) {
        cannonPointer = e.pointerId;
        aimCannon(g, p.x, p.wy);
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
      } else if (craftOn(g) && shieldPointer === null) {
        // Shield up: a finger on nothing (no 10, no cup) takes hold of the shield, a little over the finger so that it does not hide it; another finger
        // can tap the 10s and move the cups meanwhile. (The jet and the ship fly there, fast, instead of jumping.)
        flyCraftTo(g, p.x, p.wy - 40);
        shieldPointer = e.pointerId;
        holdCraft(g, true);
        canvas.setPointerCapture(e.pointerId);
      } else {
        // Nothing under the finger: it can still slide over numbers and take them down.
        swipe = {pointer: e.pointerId, x: p.x, y: p.wy, skip};
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (ninjaPointer === e.pointerId) {
        const p = point(e);
        ninjaMove(g, p.x, p.wy);
        return;
      }
      if (linePointer === e.pointerId && g.phase === "play") {
        const p = point(e);
        lineMove(g, p.x, p.wy);
        return;
      }
      if (cannonPointer === e.pointerId && g.phase === "play") {
        const p = point(e);
        aimCannon(g, p.x, p.wy);
        return;
      }
      if (shieldPointer === e.pointerId && craftOn(g) && g.phase === "play") {
        const p = point(e);
        if (g.craftTo) flyCraftTo(g, p.x, p.wy - 40); // (still on its way: it heads for where the finger is now)
        else moveShield(g, p.x, p.wy - 40);
        return;
      }
      if (scrub && scrub.pointer === e.pointerId) {
        const per = PAGER.w / (PAGES.length - 1); // (the width of the strip is every page)
        const page = Math.round(scrub.startPage + (point(e).x - scrub.startX) / per);
        goToPage(book, Math.min(PAGES.length - 1, Math.max(0, page)));
        return;
      }
      if (press && press.pointer === e.pointerId) {
        const p = point(e);
        if (g.phase === "menu" && ui.barOpen >= 0) {
          // (the slider of the match modes: the finger scrolls it sideways; a move is not a tap)
          const dx = p.x - press.x;
          if (!press.moved && Math.abs(dx) > 8) {
            press.moved = true;
            press.scroll0 = ui.subScroll;
            ui.pressed = null;
          }
          if (press.moved) {
            // (how fast the finger goes, for the roll after it lets go)
            const now = performance.now() / 1000;
            const last = press.slideAt ?? now;
            const was = ui.subScroll;
            ui.subScroll = Math.max(0, (press.scroll0 ?? 0) - dx);
            if (now > last) press.slideVel = 0.6 * (press.slideVel ?? 0) + 0.4 * ((ui.subScroll - was) / (now - last));
            press.slideAt = now;
            ui.subVel = 0;
          }
          return;
        }
        if (g.phase === "menu") {
          const dx = p.x - press.x;
          const dy = p.y - press.y;
          // The first move says which way the finger is going: up or down scrolls the contents list (if it does not all fit), sideways turns the page.
          if (!press.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            press.axis = ui.tocMax > 0 && Math.round(book.pos) === CONTENTS_PAGE && Math.abs(dy) > Math.abs(dx) ? "y" : "x";
            press.scroll0 = ui.tocScroll;
            press.moved = true;
            ui.pressed = null;
          }
          if (press.axis === "y") ui.tocScroll = Math.min(ui.tocMax, Math.max(0, (press.scroll0 ?? 0) - dy));
          else if (press.moved && !ui.settingsOpen && !ui.scoresOpen) dragBy(book, dx);
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
      if (ninjaPointer === e.pointerId) {
        ninjaPointer = null;
        ninjaEnd(g);
        return;
      }
      if (linePointer === e.pointerId) {
        linePointer = null;
        lineEnd(g);
        return;
      }
      if (cannonPointer === e.pointerId) {
        cannonPointer = null;
        fireCannon(g);
        return;
      }
      if (shieldPointer === e.pointerId) {
        shieldPointer = null;
        holdCraft(g, false);
        return;
      }
      if (scrub && scrub.pointer === e.pointerId) {
        scrub = null;
        ui.scrubbing = false;
        return;
      }
      if (press && press.pointer === e.pointerId) {
        const {id, moved, settings} = press;
        // (the slider of the match modes: let go after a quick flick, it rolls on)
        if (moved && ui.barOpen >= 0 && press.slideAt !== undefined && performance.now() / 1000 - press.slideAt < 0.1) {
          ui.subVel = Math.max(-3000, Math.min(3000, press.slideVel ?? 0));
          ui.subT = performance.now() / 1000;
        }
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
      void Promise.all([document.fonts.load('600 20px "Fredoka"'), document.fonts.load('700 20px "Fredoka"'), document.fonts.load('400 20px "Lilita One"')])
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
    // The wheel scrolls the contents list (when it does not all fit).
    const onWheel = (e: WheelEvent) => {
      if (g.phase !== "menu" || Math.round(book.pos) !== CONTENTS_PAGE || ui.tocMax <= 0 || ui.settingsOpen || ui.scoresOpen) return;
      e.preventDefault();
      ui.tocScroll = Math.min(ui.tocMax, Math.max(0, ui.tocScroll + e.deltaY));
    };
    canvas.addEventListener("wheel", onWheel, {passive: false});
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
      canvas.removeEventListener("wheel", onWheel);
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
  /** The message is sent to the database. */
  const sendFeedback = async (e: FormEvent) => {
    e.preventDefault();
    if (!feedback || feedback.state === "sending" || !cleanFeedback(feedback.text)) return;
    const {kind, text} = feedback;
    setFeedback({...feedback, state: "sending"});
    const result = await submitFeedback(kind, text, lang());
    setFeedback((f) => (f ? {...f, state: result === "sent" ? "sent" : result === "empty" ? "typing" : result} : f));
  };

  return (
    <>
      <canvas ref={canvasRef} className="game" />
      {feedback && (
        <div className="name-veil">
          <form className="name-card feedback-card" onSubmit={sendFeedback}>
            <h2>{t("backSend")}</h2>
            {feedback.state === "sent" ? (
              <>
                <p>{t("fbThanks")}</p>
                <button type="button" className="save" onClick={() => setFeedback(null)}>
                  {t("done")}
                </button>
              </>
            ) : (
              <>
                <div className="kinds">
                  {FEEDBACK_KINDS.map((k) => (
                    <button type="button" key={k} className={k === feedback.kind ? "on" : ""} onClick={() => setFeedback({...feedback, kind: k})}>
                      {t(k === "support" ? "fbSupport" : k === "idea" ? "fbIdea" : "fbProblem")}
                    </button>
                  ))}
                </div>
                <textarea
                  autoFocus
                  rows={6}
                  value={feedback.text}
                  maxLength={FEEDBACK_MAX}
                  placeholder={t("fbPlaceholder")}
                  aria-label={t("backSend")}
                  onChange={(e) => setFeedback({...feedback, text: e.target.value, state: "typing"})}
                />
                {(feedback.state === "off" || feedback.state === "error" || feedback.state === "wait") && (
                  <p className="problem">{t(feedback.state === "off" ? "fbOff" : feedback.state === "wait" ? "fbWait" : "fbError")}</p>
                )}
                <button type="submit" className="save" disabled={!cleanFeedback(feedback.text) || feedback.state === "sending"}>
                  {t("fbSend")}
                </button>
                <button type="button" className="skip" onClick={() => setFeedback(null)}>
                  {t("nameSkip")}
                </button>
              </>
            )}
          </form>
        </div>
      )}
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
