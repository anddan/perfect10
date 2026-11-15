import {describe, expect, it} from "vitest";
import {CUP_PRICE} from "../game/cups";
import {SAUCER_PRICE} from "../game/saucers";
import {DEFAULT_LOOK, findLook} from "../game/looks";
import {ONLINE_PRICE, VARIANT_PRICE, buyMode, ownsMode, priceOfMode, CLOTH_PRICE, ENERGY_PRICE, MAX_COPIES, REFILL_PER_POINT, SLOT_COUNT, addCoins, allOnCup, buyCloth, buyLook, equipLook, ownsLook, buyEnergyPoint, buyEnergyRefill, refillPrice, buyCup, buySaucer, clearCup, createWallet, cycleSaucer, saucersOn, loadWallet, loadout, placed, saveWallet, spare, toggleOnCup} from "./wallet";

describe("the wallet and the shop", () => {
  it("sells a cloth (a pull-down screen) for coins, as long as there is room for one more", () => {
    const w = createWallet();
    expect(buyCloth(w, 1, 3)).toBeNull(); // (no coins)
    addCoins(w, CLOTH_PRICE * 2 + 5);
    expect(buyCloth(w, 1, 3)).toBe(2);
    expect(w.coins).toBe(CLOTH_PRICE + 5);
    expect(buyCloth(w, 2, 3)).toBe(3);
    expect(w.coins).toBe(5);
    addCoins(w, 1000);
    expect(buyCloth(w, 3, 3)).toBeNull(); // (as many as can be kept)
    expect(w.coins).toBe(1005);
  });

  it("sells looks for coins, puts a look on when it is bought, and lets a bought look be put on again", () => {
    const w = createWallet();
    expect(w.look).toEqual(DEFAULT_LOOK);
    expect(ownsLook(w, "cupColor", "porcelain")).toBe(true); // (there from the start)
    expect(ownsLook(w, "numbers", "neon")).toBe(false);
    expect(buyLook(w, "numbers", "neon")).toBe(false); // (no coins)
    expect(equipLook(w, "numbers", "neon")).toBe(false); // (not bought)
    addCoins(w, findLook("numbers", "neon")!.price + 10);
    expect(buyLook(w, "numbers", "neon")).toBe(true);
    expect(w.look.numbers).toBe("neon");
    expect(w.coins).toBe(10);
    expect(buyLook(w, "numbers", "neon")).toBe(false); // (bought already: nothing is paid twice)
    expect(equipLook(w, "numbers", "classic")).toBe(true); // (back to the first)
    expect(w.look.numbers).toBe("classic");
    expect(equipLook(w, "numbers", "neon")).toBe(true);
    expect(buyLook(w, "room", "garage" as never)).toBe(false); // (not in the shop)
  });

  it("keeps the looks in the browser, and drops what is not in the shop or was not bought", () => {
    const store = new Map<string, string>();
    (globalThis as unknown as {localStorage: unknown}).localStorage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v)};
    const w = createWallet();
    addCoins(w, 1000);
    buyLook(w, "tint", "night");
    buyLook(w, "pattern", "dots");
    equipLook(w, "pattern", "none");
    saveWallet(w);
    const back = loadWallet();
    expect(back.look).toEqual({...DEFAULT_LOOK, tint: "night"});
    expect(back.looks.sort()).toEqual(["pattern:dots", "tint:night"]);
    store.set("p10-wallet", JSON.stringify({coins: 5, owned: {}, slots: [], looks: ["room:cafe", "room:garage", 7], look: {room: "cafe", tint: "sepia", numbers: "neon", cupColor: "pink"}}));
    const odd = loadWallet();
    expect(odd.looks).toEqual(["room:cafe"]);
    expect(odd.look).toEqual({...DEFAULT_LOOK, room: "cafe"}); // (sepia and neon were not bought, and pink is not in the shop)
  });

  it("sells one point of energy for coins, only when there is room for it", () => {
    const w = createWallet();
    expect(buyEnergyPoint(w, 5, 10)).toBe(false); // (no coins)
    addCoins(w, ENERGY_PRICE + 4);
    expect(buyEnergyPoint(w, 10, 10)).toBe(false); // (full: nothing is paid)
    expect(w.coins).toBe(ENERGY_PRICE + 4);
    expect(buyEnergyPoint(w, 9, 10)).toBe(true);
    expect(w.coins).toBe(4);
  });

  it("sells a full refill of the energy for less than buying the points one by one", () => {
    expect(refillPrice(0)).toBe(0);
    expect(refillPrice(10)).toBe(10 * REFILL_PER_POINT);
    expect(refillPrice(10)).toBeLessThan(10 * ENERGY_PRICE);
    const w = createWallet();
    addCoins(w, refillPrice(7) - 1);
    expect(buyEnergyRefill(w, 3, 10)).toBe(0); // (one coin short: nothing is paid)
    addCoins(w, 1);
    expect(buyEnergyRefill(w, 3, 10)).toBe(7);
    expect(w.coins).toBe(0);
    addCoins(w, 500);
    expect(buyEnergyRefill(w, 10, 10)).toBe(0); // (already full)
    expect(w.coins).toBe(500);
  });

  it("starts empty, and a copy of a cup costs what it costs, every time", () => {
    const w = createWallet();
    expect(w.coins).toBe(0);
    expect(w.slots).toHaveLength(SLOT_COUNT);
    expect(buyCup(w, "gold")).toBe(false); // (no coins)
    addCoins(w, CUP_PRICE.gold * 2 + 5);
    expect(buyCup(w, "gold")).toBe(true);
    expect(w.owned.gold).toBe(1);
    expect(buyCup(w, "gold")).toBe(true); // (one more copy, for another cup)
    expect(w.owned.gold).toBe(2);
    expect(w.coins).toBe(5);
    expect(loadout(w)).toEqual([[], [], [], []]); // (they are not on a cup until they are put there)
  });

  it("has at most one copy for every cup of the desk", () => {
    const w = createWallet();
    addCoins(w, CUP_PRICE.magnet * (MAX_COPIES + 1));
    for (let i = 0; i < MAX_COPIES; i++) expect(buyCup(w, "magnet")).toBe(true);
    expect(buyCup(w, "magnet")).toBe(false);
    expect(w.owned.magnet).toBe(MAX_COPIES);
    expect(w.coins).toBe(CUP_PRICE.magnet);
  });

  it("puts a copy on a cup and takes it off again; a property with no copy to spare cannot be put on another cup", () => {
    const w = createWallet();
    addCoins(w, 1000);
    expect(toggleOnCup(w, 0, "magnet")).toBe(false); // (none bought)
    buyCup(w, "magnet");
    expect(toggleOnCup(w, 1, "magnet")).toBe(true);
    expect(loadout(w)).toEqual([[], ["magnet"], [], []]);
    expect(spare(w, "magnet")).toBe(0);
    expect(toggleOnCup(w, 2, "magnet")).toBe(false); // (the only copy is on cup 2 already)
    expect(toggleOnCup(w, 1, "magnet")).toBe(true); // (taken off: the copy is free again)
    expect(toggleOnCup(w, 2, "magnet")).toBe(true);
    expect(loadout(w)).toEqual([[], [], ["magnet"], []]);
    expect(toggleOnCup(w, 9, "magnet")).toBe(false); // (no such cup)
  });

  it("lets a cup have as many properties as there are copies for, in the order of the shop", () => {
    const w = createWallet();
    addCoins(w, 5000);
    for (const k of ["laser", "gold", "thermos"] as const) buyCup(w, k);
    buyCup(w, "gold"); // (two copies of gold)
    toggleOnCup(w, 0, "laser");
    toggleOnCup(w, 0, "thermos");
    toggleOnCup(w, 0, "gold");
    toggleOnCup(w, 2, "gold");
    expect(toggleOnCup(w, 3, "gold")).toBe(false); // (a third cup would need a third copy)
    expect(loadout(w)).toEqual([["gold", "thermos", "laser"], [], ["gold"], []]);
    expect(placed(w, "gold")).toBe(2);
  });

  it("puts every property there is a copy to spare of on a cup at once, or takes them all off", () => {
    const w = createWallet();
    addCoins(w, 2000);
    buyCup(w, "laser");
    buyCup(w, "gold");
    expect(allOnCup(w, 2)).toBe(true);
    expect(loadout(w)[2]).toEqual(["gold", "laser"]);
    expect(allOnCup(w, 0)).toBe(true); // (nothing is left to spare for another cup)
    expect(loadout(w)[0]).toEqual([]);
    expect(clearCup(w, 2)).toBe(true);
    expect(loadout(w)[2]).toEqual([]);
    expect(spare(w, "gold")).toBe(1);
    expect(allOnCup(w, 7)).toBe(false);
  });

  it("can have every property on every cup once there are four copies of each: all 5 on all 4 cups", () => {
    const w = createWallet();
    addCoins(w, 100000);
    const all = ["gold", "thermos", "magnet", "big", "laser"] as const;
    for (const k of all) for (let i = 0; i < MAX_COPIES; i++) expect(buyCup(w, k)).toBe(true);
    for (let slot = 0; slot < SLOT_COUNT; slot++) expect(allOnCup(w, slot)).toBe(true);
    expect(loadout(w)).toEqual([[...all], [...all], [...all], [...all]]);
  });

  it("is kept in the browser, and what an older version kept (one of each, and a list of chosen cups) is read as it was", () => {
    const store = new Map<string, string>();
    (globalThis as unknown as {localStorage: unknown}).localStorage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v)};
    const w = createWallet();
    addCoins(w, 1800);
    buyCup(w, "gold");
    buyCup(w, "gold");
    buyCup(w, "big");
    toggleOnCup(w, 3, "gold");
    toggleOnCup(w, 3, "big");
    saveWallet(w);
    expect(loadWallet()).toEqual(w);
    // The first version: a list of what was bought (one of each) and a list of the chosen cups.
    store.set("p10-wallet", JSON.stringify({coins: 12, owned: ["gold", "magnet", "nonsense"], equipped: ["magnet", "gold", "big"]}));
    const old = loadWallet();
    expect(old.coins).toBe(12);
    expect(old.owned).toEqual({gold: 1, thermos: 0, magnet: 1, big: 0, laser: 0});
    expect(loadout(old)).toEqual([["magnet"], ["gold"], [], []]); // (the one that was not bought is dropped)
    // The second version: a list of what was bought, with the properties on each cup (several cups could have the same one).
    store.set("p10-wallet", JSON.stringify({coins: 0, owned: ["gold"], slots: [["gold"], ["gold"], [], []]}));
    expect(loadout(loadWallet())).toEqual([["gold"], [], [], []]); // (one copy: it stays on the first cup)
    store.set("p10-wallet", "garbage");
    expect(loadWallet()).toEqual(createWallet());
  });
});

describe("the saucers of the shop", () => {
  it("are bought for coins, up to one for every cup, and put under the first cup that has none", () => {
    const w = createWallet();
    expect(buySaucer(w, "slow")).toBe(false); // (no coins)
    addCoins(w, SAUCER_PRICE.slow * 5);
    expect(buySaucer(w, "slow")).toBe(true);
    expect(buySaucer(w, "slow")).toBe(true);
    expect(w.saucerSlots).toEqual(["slow", "slow", null, null]);
    expect(w.coins).toBe(SAUCER_PRICE.slow * 3);
    expect(buySaucer(w, "slow")).toBe(true);
    expect(buySaucer(w, "slow")).toBe(true);
    expect(w.saucers.slow).toBe(MAX_COPIES);
    expect(buySaucer(w, "slow")).toBe(false); // (as many as there are cups)
    expect(saucersOn(w, "slow")).toBe(4);
  });

  it("can only be four on the desk: one that is bought with the places full is kept, not put on", () => {
    const w = createWallet();
    addCoins(w, 10000);
    for (let i = 0; i < 4; i++) buySaucer(w, "slow");
    expect(buySaucer(w, "points")).toBe(true);
    expect(w.saucers.points).toBe(1);
    expect(w.saucerSlots).toEqual(["slow", "slow", "slow", "slow"]);
  });

  it("are changed under a cup to the next kind there is a copy to spare of, and then to none", () => {
    const w = createWallet();
    addCoins(w, 10000);
    buySaucer(w, "slow");
    buySaucer(w, "points");
    expect(w.saucerSlots).toEqual(["slow", "points", null, null]);
    // (the third place: no slow or points saucer is spare, so nothing to change to)
    expect(cycleSaucer(w, 2)).toBe(false);
    buySaucer(w, "points");
    w.saucerSlots = ["slow", "points", null, null];
    expect(cycleSaucer(w, 2)).toBe(true);
    expect(w.saucerSlots[2]).toBe("points");
    expect(cycleSaucer(w, 2)).toBe(true);
    expect(w.saucerSlots[2]).toBeNull();
    expect(cycleSaucer(w, 9)).toBe(false);
  });

  it("are kept in the browser, and only as many on the desk as there are copies", () => {
    const store = new Map<string, string>();
    (globalThis as unknown as {localStorage: unknown}).localStorage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v)};
    const w = createWallet();
    addCoins(w, 10000);
    buySaucer(w, "special");
    buySaucer(w, "sparse");
    saveWallet(w);
    expect(loadWallet().saucerSlots).toEqual(["special", "sparse", null, null]);
    store.set("p10-wallet", JSON.stringify({coins: 5, saucers: {slow: 1, bogus: 3}, saucerSlots: ["slow", "slow", "bogus", "points"]}));
    const l = loadWallet();
    expect(l.saucers.slow).toBe(1);
    expect(l.saucerSlots).toEqual(["slow", null, null, null]);
  });
});

describe("the match modes of the shop", () => {
  it("are bought once for coins, and not again", () => {
    const w = createWallet();
    expect(buyMode(w, "save")).toBe(false); // (no coins)
    addCoins(w, VARIANT_PRICE + 50);
    expect(buyMode(w, "save")).toBe(true);
    expect(w.coins).toBe(50);
    expect(ownsMode(w, "save")).toBe(true);
    expect(ownsMode(w, "sixeight")).toBe(false);
    expect(buyMode(w, "save")).toBe(false);
    expect(w.coins).toBe(50);
  });

  it("include Online, which costs 150 coins", () => {
    expect(ONLINE_PRICE).toBe(150);
    expect(VARIANT_PRICE).toBe(500);
    expect(priceOfMode("online")).toBe(150);
    expect(priceOfMode("save")).toBe(500);
    const w = createWallet();
    addCoins(w, 160);
    expect(buyMode(w, "save")).toBe(false);
    expect(buyMode(w, "online")).toBe(true);
    expect(w.coins).toBe(10);
    expect(ownsMode(w, "online")).toBe(true);
  });

  it("are kept in the browser, and only the ones that exist", () => {
    const store = new Map<string, string>();
    (globalThis as unknown as {localStorage: unknown}).localStorage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v)};
    const w = createWallet();
    addCoins(w, 5000);
    buyMode(w, "sixeight");
    saveWallet(w);
    expect(loadWallet().modes).toEqual(["sixeight"]);
    store.set("p10-wallet", JSON.stringify({coins: 1, modes: ["save", "bogus", "save"]}));
    expect(loadWallet().modes).toEqual(["save"]);
  });
});
