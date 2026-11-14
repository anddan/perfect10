// What can be bought with real money: packs of coins, and Premium (every level and the endless game open, new tries cost no energy, and no ads).
//
// NO PAYMENT IS CONNECTED YET: until one is (the app stores' billing, or a web payment), PAYMENTS_CONNECTED is false and the game does not
// hand out anything for a tap on a buy button (with the admin switch in the settings on, it does, for testing). The prices are only for
// showing: the real ones come from the payment service.
import type {Wallet} from "./wallet";
import {addCoins} from "./wallet";

export const PAYMENTS_CONNECTED = false;

/** What the prices are written in on the page for buying. */
export const CURRENCY = "kr";

export const COIN_PACKS = [
  {id: "coins500", coins: 500, price: 9},
  {id: "coins1500", coins: 1500, price: 25},
  {id: "coins4000", coins: 4000, price: 49},
] as const;

/** Premium: some coins on top of everything it opens. */
export const PREMIUM = {id: "premium", coins: 1000, price: 59} as const;

/** Gives what a purchase is for (the coins, and for Premium the coins and the word that it has been bought). Null for something that is not for sale. */
export function grantPurchase(w: Wallet, id: string): "coins" | "premium" | null {
  const pack = COIN_PACKS.find((p) => p.id === id);
  if (pack) {
    addCoins(w, pack.coins);
    return "coins";
  }
  if (id === PREMIUM.id) {
    addCoins(w, PREMIUM.coins);
    return "premium";
  }
  return null;
}

const KEY = "p10-premium";

export function loadPremium(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function savePremium(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}
