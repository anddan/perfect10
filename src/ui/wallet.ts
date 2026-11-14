// The coins the player has earned, the properties for cups bought with them in the shop (one copy for every cup that is to have it), and which
// copies are on which cup on the desk. It is kept in the browser (like the energy), so it is still there the next time.
import {CUP_PRICE, SHOP_CUPS, isShopCup} from "../game/cups";
import {DEFAULT_LOOK, LOOK_KINDS, type LookKind, findLook, lookKey} from "../game/looks";
import type {CupKind} from "../game/types";

export type ShopCup = (typeof SHOP_CUPS)[number];

/** Coins for a perfect 10, for clearing a level of the book (and for every star it was cleared with), and how many cups there are on the desk. */
export const COIN_PER_TEN = 1;
export const COIN_PER_WIN = 5;
export const COIN_PER_STAR = 2;
export const SLOT_COUNT = 4;
/** What a pull-down screen (a cloth) costs in the shop. */
export const CLOTH_PRICE = 40;
/** Energy for coins: one point costs this, and a full refill costs this much for every point that is missing (so it is cheaper than buying them one by one). */
export const ENERGY_PRICE = 30;
export const REFILL_PER_POINT = 20;
/** The most copies of a property there can be: one for every cup of the desk. */
export const MAX_COPIES = SLOT_COUNT;

export interface Wallet {
  coins: number;
  /** How many copies of each property have been bought (0 to MAX_COPIES): every cup that is to have a power needs a copy of its own. */
  owned: Record<ShopCup, number>;
  /** The properties on each cup of the desk (from the left): any number on a cup, but a property is only on as many cups as there are copies of it. */
  slots: ShopCup[][];
  /** The looks that have been bought (see looks.ts), as "kind:id"; the ones that are there from the start are not in the list. */
  looks: string[];
  /** The look that is on, of every kind. */
  look: Record<LookKind, string>;
}

function noCopies(): Record<ShopCup, number> {
  return {gold: 0, thermos: 0, magnet: 0, big: 0, laser: 0};
}

export function createWallet(): Wallet {
  return {coins: 0, owned: noCopies(), slots: Array.from({length: SLOT_COUNT}, () => []), looks: [], look: {...DEFAULT_LOOK}};
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
