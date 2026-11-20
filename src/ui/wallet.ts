// The coins the player has earned, the properties for cups bought with them in the shop (one copy for every cup that is to have it), and which
// copies are on which cup on the desk. It is kept in the browser (like the energy), so it is still there the next time.
import {CUP_PRICE, SHOP_CUPS, isShopCup} from "../game/cups";
import {DEFAULT_LOOK, LOOK_KINDS, type LookKind, findLook, lookKey} from "../game/looks";
import {SAUCERS, SAUCER_PRICE, SAUCER_SLOTS, isSaucer, type SaucerKind} from "../game/saucers";
import type {Variant} from "../game/types";
import type {CupKind} from "../game/types";

export type ShopCup = (typeof SHOP_CUPS)[number];

/** What a try of the endless game costs in coins (it is free with Premium). */
export const ENDLESS_COST = 25;

/** What a match mode costs in coins, once (it is open with Premium, and with enough stars). */
export const VARIANT_PRICE = 500;
/** What Online costs in coins, once (it is open with Premium). */
export const ONLINE_PRICE = 150;

/** The match modes. */
export const VARIANTS: readonly Variant[] = ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake"];

export function isVariant(v: unknown): v is Variant {
  return v === "save" || v === "sixeight" || v === "defend" || v === "ice" || v === "fast" || v === "find" || v === "shield" || v === "jet" || v === "comet" || v === "snake";
}

/** Everything that can be bought once for coins: the two match modes, and Online. */
export type UnlockMode = Variant | "online";
export const UNLOCK_MODES: readonly UnlockMode[] = ["save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake", "online"];

export function isUnlockMode(v: unknown): v is UnlockMode {
  return v === "save" || v === "sixeight" || v === "defend" || v === "ice" || v === "fast" || v === "find" || v === "shield" || v === "jet" || v === "comet" || v === "snake" || v === "online";
}

/** What it costs in coins. */
export function priceOfMode(mode: UnlockMode): number {
  return mode === "online" ? ONLINE_PRICE : VARIANT_PRICE;
}

/** The coins for watching the video of the day (once a day). */
export const VIDEO_COINS = 25;
/** The coins the gift of the day gives (the first start of a day; an ad doubles them). */
export const DAILY_GIFT = 10;

/** How many cups there are on the desk. */
export const SLOT_COUNT = 4;
/** What a pull-down screen (a cloth) costs in the shop. */
export const CLOTH_PRICE = 48;
/** The price of an eraser in the shop. */
export const ERASER_PRICE = 60;
/** Energy for coins: one point costs this, and a full refill costs this much for every point that is missing (so it is cheaper than buying them one by one). */
export const ENERGY_PRICE = 36;
export const REFILL_PER_POINT = 24;
/** The most copies of a property there can be: one for every cup of the desk. */
export const MAX_COPIES = SLOT_COUNT;

export interface Wallet {
  coins: number;
  /** How many copies of each property have been bought (0 to MAX_COPIES): every cup that is to have a power needs a copy of its own. */
  owned: Record<ShopCup, number>;
  /** The properties on each cup of the desk (from the left): any number on a cup, but a property is only on as many cups as there are copies of it. */
  slots: ShopCup[][];
  /** The match modes (and Online) that have been bought with coins (Premium opens them all without). */
  modes: UnlockMode[];
  /** How many saucers of each kind have been bought (0 to MAX_COPIES), and the kind under each cup of the desk (from the left): only four fit, so they are chosen. */
  saucers: Record<SaucerKind, number>;
  saucerSlots: (SaucerKind | null)[];
  /** The looks that have been bought (see looks.ts), as "kind:id"; the ones that are there from the start are not in the list. */
  looks: string[];
  /** The look that is on, of every kind. */
  look: Record<LookKind, string>;
}

function noCopies(): Record<ShopCup, number> {
  return {gold: 0, thermos: 0, magnet: 0, big: 0, laser: 0};
}

function noSaucers(): Record<SaucerKind, number> {
  return {slow: 0, sparse: 0, special: 0, points: 0};
}

export function createWallet(): Wallet {
  return {
    coins: 0,
    owned: noCopies(),
    slots: Array.from({length: SLOT_COUNT}, () => []),
    modes: [],
    saucers: noSaucers(),
    saucerSlots: Array.from({length: SAUCER_SLOTS}, () => null),
    looks: [],
    look: {...DEFAULT_LOOK},
  };
}

/** Whether a match mode (or Online) has been bought. */
export function ownsMode(w: Wallet, mode: UnlockMode): boolean {
  return w.modes.includes(mode);
}

/** Buys a match mode: false if it is bought already, or there are not enough coins (nothing is paid then). */
export function buyMode(w: Wallet, mode: UnlockMode): boolean {
  if (ownsMode(w, mode) || w.coins < priceOfMode(mode)) return false;
  w.coins -= priceOfMode(mode);
  w.modes.push(mode);
  return true;
}

/** How many saucers of a kind are on the desk right now. */
export function saucersOn(w: Wallet, kind: SaucerKind): number {
  return w.saucerSlots.filter((k) => k === kind).length;
}

/** Buys a saucer (it is put under the first cup that has none, if there is one): false if there are as many as there are cups already, or not enough coins. */
export function buySaucer(w: Wallet, kind: SaucerKind): boolean {
  if (w.saucers[kind] >= MAX_COPIES || w.coins < SAUCER_PRICE[kind]) return false;
  w.coins -= SAUCER_PRICE[kind];
  w.saucers[kind] += 1;
  const free = w.saucerSlots.indexOf(null);
  if (free >= 0) w.saucerSlots[free] = kind;
  return true;
}

/** Changes the saucer under a cup to the next kind that there is a copy to spare of (and after the last, to none). False if there is nothing to change to. */
export function cycleSaucer(w: Wallet, slot: number): boolean {
  if (slot < 0 || slot >= SAUCER_SLOTS) return false;
  const order: (SaucerKind | null)[] = [...SAUCERS, null];
  const now = w.saucerSlots[slot] ?? null;
  const at = order.indexOf(now);
  for (let n = 1; n <= order.length; n++) {
    const next = order[(at + n) % order.length];
    if (next === now) continue;
    if (next === null || w.saucers[next] - saucersOn(w, next) > 0) {
      w.saucerSlots[slot] = next;
      return true;
    }
  }
  return false;
}

/** The saucers for the cups at the start of a round: cup by cup from the left. */
export function saucerLoadout(w: Wallet): (SaucerKind | null)[] {
  return [...w.saucerSlots];
}

export function addCoins(w: Wallet, n: number): void {
  w.coins += Math.max(0, Math.floor(n));
}

/** How many cups a property is on right now. */
export function placed(w: Wallet, kind: ShopCup): number {
  return w.slots.filter((list) => list.includes(kind)).length;
}

/** How many copies of a property are not on any cup yet. */
export function spare(w: Wallet, kind: ShopCup): number {
  return w.owned[kind] - placed(w, kind);
}

/** Buys one more copy of a property (it is not put on a cup yet: that is chosen in the dialog after it): false if there are as many as there are cups, or not enough coins. */
export function buyCup(w: Wallet, kind: ShopCup): boolean {
  if (w.owned[kind] >= MAX_COPIES || w.coins < CUP_PRICE[kind]) return false;
  w.coins -= CUP_PRICE[kind];
  w.owned[kind] += 1;
  return true;
}

/** Gives one more copy of a property (a present): false if there are as many as there are cups already. */
export function grantCup(w: Wallet, kind: ShopCup): boolean {
  if (w.owned[kind] >= MAX_COPIES) return false;
  w.owned[kind] += 1;
  return true;
}

/** What it costs to fill the energy up when this many points are missing. */
export function refillPrice(missing: number): number {
  return Math.max(0, Math.floor(missing)) * REFILL_PER_POINT;
}

/** Buys one point of energy (the caller gives it): false if the energy is full (`held` of `max`) or there are not enough coins. */
export function buyEnergyPoint(w: Wallet, held: number, max: number): boolean {
  if (held >= max || w.coins < ENERGY_PRICE) return false;
  w.coins -= ENERGY_PRICE;
  return true;
}

/** Buys a full refill of the energy: returns how many points to give (0 if the energy is full or there are not enough coins, and then nothing is paid). */
export function buyEnergyRefill(w: Wallet, held: number, max: number): number {
  const missing = max - held;
  if (missing < 1 || w.coins < refillPrice(missing)) return 0;
  w.coins -= refillPrice(missing);
  return missing;
}

/** Whether a look can be used: the ones that are there from the start, and the ones that have been bought. */
export function ownsLook(w: Wallet, kind: LookKind, id: string): boolean {
  const def = findLook(kind, id);
  return !!def && (def.price === 0 || w.looks.includes(lookKey(kind, id)));
}

/** Buys a look (and puts it on): false if there is no such look, it is bought already, or there are not enough coins. */
export function buyLook(w: Wallet, kind: LookKind, id: string): boolean {
  const def = findLook(kind, id);
  if (!def || ownsLook(w, kind, id) || w.coins < def.price) return false;
  w.coins -= def.price;
  w.looks.push(lookKey(kind, id));
  w.look[kind] = id;
  return true;
}

/** Puts a look that has been bought on (in place of the one of its kind that is on). False if it cannot be used yet. */
export function equipLook(w: Wallet, kind: LookKind, id: string): boolean {
  if (!ownsLook(w, kind, id)) return false;
  w.look[kind] = id;
  return true;
}

/** Buys an eraser: returns how many there are then, or null if there is no room for one more or not enough coins. */
export function buyEraser(w: Wallet, held: number, max: number): number | null {
  if (held >= max || w.coins < ERASER_PRICE) return null;
  w.coins -= ERASER_PRICE;
  return held + 1;
}

/** Buys a pull-down screen: returns how many there are then, or null if there is no room for one more (`held` of `max`) or not enough coins. */
export function buyCloth(w: Wallet, held: number, max: number): number | null {
  if (held >= max || w.coins < CLOTH_PRICE) return null;
  w.coins -= CLOTH_PRICE;
  return held + 1;
}

/** Puts a copy of a property on a cup of the desk, or takes it off again. False if there is no copy left to put there (or no such cup). */
export function toggleOnCup(w: Wallet, slot: number, kind: ShopCup): boolean {
  if (slot < 0 || slot >= SLOT_COUNT) return false;
  const list = w.slots[slot];
  if (list.includes(kind)) {
    w.slots[slot] = list.filter((k) => k !== kind);
    return true;
  }
  if (spare(w, kind) < 1) return false;
  w.slots[slot] = SHOP_CUPS.filter((k) => k === kind || list.includes(k));
  return true;
}

/** Puts on a cup every property that it does not have and that there is a copy to spare of. */
export function allOnCup(w: Wallet, slot: number): boolean {
  if (slot < 0 || slot >= SLOT_COUNT) return false;
  for (const k of SHOP_CUPS) if (!w.slots[slot].includes(k) && spare(w, k) > 0) toggleOnCup(w, slot, k);
  return true;
}

/** Takes every property off a cup (the copies are free to put on another). */
export function clearCup(w: Wallet, slot: number): boolean {
  if (slot < 0 || slot >= SLOT_COUNT) return false;
  w.slots[slot] = [];
  return true;
}

/** The properties for the cups at the start of a round: cup by cup from the left (in the order of the shop). */
export function loadout(w: Wallet): CupKind[][] {
  return w.slots.map((list) => SHOP_CUPS.filter((k) => list.includes(k)));
}

const KEY = "p10-wallet";

/** The looks that were kept in the browser: only the ones that exist, and a look that is on has to be bought (or be there from the start). */
function cleanLooks(owned: unknown, on: unknown): {looks: string[]; look: Record<LookKind, string>} {
  const looks = Array.isArray(owned) ? [...new Set(owned.filter((k): k is string => typeof k === "string"))].filter((k) => LOOK_KINDS.some((kind) => findLook(kind, k.slice(kind.length + 1)) && k === lookKey(kind, k.slice(kind.length + 1)))) : [];
  const look = {...DEFAULT_LOOK};
  if (typeof on === "object" && on !== null) {
    for (const kind of LOOK_KINDS) {
      const id = (on as Record<string, unknown>)[kind];
      const def = findLook(kind, id);
      if (def && (def.price === 0 || looks.includes(lookKey(kind, def.id)))) look[kind] = def.id;
    }
  }
  return {looks, look};
}

/** The saucers that were kept in the browser: only the ones that exist, and a saucer is only on as many cups as there are copies of it. */
function cleanSaucers(owned: unknown, slots: unknown): {saucers: Record<SaucerKind, number>; saucerSlots: (SaucerKind | null)[]} {
  const saucers = noSaucers();
  if (typeof owned === "object" && owned !== null) {
    for (const k of SAUCERS) {
      const n = (owned as Record<string, unknown>)[k];
      saucers[k] = typeof n === "number" && Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(0, Math.floor(n))) : 0;
    }
  }
  const used = noSaucers();
  const saucerSlots = Array.from({length: SAUCER_SLOTS}, (_, i): SaucerKind | null => {
    const k = Array.isArray(slots) ? slots[i] : null;
    if (!isSaucer(k) || used[k] >= saucers[k]) return null;
    used[k] += 1;
    return k;
  });
  return {saucers, saucerSlots};
}

/** What is kept in the browser, cleaned up (it is not to be trusted). The first versions kept a plain list of what had been bought (one of each) and of the chosen cups. */
export function loadWallet(): Wallet {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof data === "object" && data !== null) {
      const {coins, owned, slots, equipped} = data as Record<string, unknown>;
      const own = noCopies();
      if (Array.isArray(owned)) {
        for (const k of owned) if (isShopCup(k)) own[k] = 1;
      } else if (typeof owned === "object" && owned !== null) {
        for (const k of SHOP_CUPS) {
          const n = (owned as Record<string, unknown>)[k];
          own[k] = typeof n === "number" && Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(0, Math.floor(n))) : 0;
        }
      }
      let cups: ShopCup[][];
      if (Array.isArray(slots)) cups = Array.from({length: SLOT_COUNT}, (_, i) => (Array.isArray(slots[i]) ? SHOP_CUPS.filter((k) => (slots[i] as unknown[]).includes(k)) : []));
      else {
        const old = Array.isArray(equipped) ? equipped.filter(isShopCup) : [];
        cups = Array.from({length: SLOT_COUNT}, (_, i) => (old[i] ? [old[i]] : []));
      }
      // (a property is only on as many cups as there are copies of it: the cups from the left keep it)
      const used = noCopies();
      cups = cups.map((list) =>
        list.filter((k) => {
          if (used[k] >= own[k]) return false;
          used[k] += 1;
          return true;
        })
      );
      return {
        coins: typeof coins === "number" && Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0,
        owned: own,
        slots: cups,
        modes: Array.isArray((data as Record<string, unknown>).modes) ? UNLOCK_MODES.filter((v) => ((data as Record<string, unknown>).modes as unknown[]).includes(v)) : [],
        ...cleanSaucers((data as Record<string, unknown>).saucers, (data as Record<string, unknown>).saucerSlots),
        ...cleanLooks((data as Record<string, unknown>).looks, (data as Record<string, unknown>).look),
      };
    }
  } catch {
    /* nothing kept, or private mode */
  }
  return createWallet();
}

export function saveWallet(w: Wallet): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* private mode */
  }
}
