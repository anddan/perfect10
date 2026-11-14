import {describe, expect, it} from "vitest";
import {COIN_PACKS, PREMIUM, grantPurchase} from "./purchase";
import {createWallet} from "./wallet";

describe("what can be bought", () => {
  it("gives the coins of a pack, and nothing else", () => {
    const w = createWallet();
    expect(grantPurchase(w, COIN_PACKS[1].id)).toBe("coins");
    expect(w.coins).toBe(COIN_PACKS[1].coins);
  });

  it("gives Premium with some coins on top, and refuses what is not for sale", () => {
    const w = createWallet();
    expect(grantPurchase(w, PREMIUM.id)).toBe("premium");
    expect(w.coins).toBe(PREMIUM.coins);
    expect(grantPurchase(w, "coins999999")).toBeNull();
    expect(w.coins).toBe(PREMIUM.coins);
  });
});
