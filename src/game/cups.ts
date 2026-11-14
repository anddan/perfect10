import type {CupKind} from "./types";

// The cups of the shop. Every cup that is not "plain" has a property, and costs coins (earned by playing: see wallet.ts).

/** The cups that can be bought, in the order they stand in the shop (and, when equipped, in the columns from the left). */
export const SHOP_CUPS: readonly Exclude<CupKind, "plain">[] = ["gold", "thermos", "magnet", "big", "laser"];

/** What a cup costs in coins. */
export const CUP_PRICE: Record<Exclude<CupKind, "plain">, number> = {gold: 150, thermos: 225, magnet: 375, big: 450, laser: 525};

/** The gold cup counts every point that lands in it, and its perfect 10, this many times. */
export const GOLD_FACTOR = 2;
/** The big cup does not die until it is over this (the others die when they are over 10). */
export const BIG_LIMIT = 12;
/** The magnet cup takes a number that would have killed the cup under it, from this far away sideways (two columns of 90). */
export const MAGNET_REACH = 190;

/** The laser cup: a double tap on it clears every falling number in its column (not the bonus balls), and it has to charge for this many seconds before it can be fired again. */
export const LASER_COOLDOWN = 20;
/** How far from the middle of the cup (sideways) a number is hit by the laser. */
export const LASER_HALF_WIDTH = 46;

/** Is this a cup of the shop? (what the player has kept in the browser is not to be trusted) */
export function isShopCup(k: unknown): k is Exclude<CupKind, "plain"> {
  return typeof k === "string" && (SHOP_CUPS as readonly string[]).includes(k);
}
