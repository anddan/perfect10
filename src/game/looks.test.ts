import {describe, expect, it} from "vitest";
import {DEFAULT_LOOK, LOOKS, LOOK_KINDS, findLook, looksOf} from "./looks";

describe("the looks of the shop", () => {
  it("have a look of every kind that is there from the start, and every look is in the list only once", () => {
    for (const kind of LOOK_KINDS) {
      const def = findLook(kind, DEFAULT_LOOK[kind]);
      expect(def, kind).toBeDefined();
      expect(def!.price).toBe(0);
      expect(looksOf(kind).filter((l) => l.price === 0)).toHaveLength(1); // (only the one that is there from the start is free)
    }
    const keys = LOOKS.map((l) => l.kind + ":" + l.id);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cost something, apart from the one that is there from the start", () => {
    for (const l of LOOKS) if (l.id !== DEFAULT_LOOK[l.kind]) expect(l.price, l.kind + l.id).toBeGreaterThan(0);
  });

  it("have a theme of the numbers with the colours the wrong way round", () => {
    expect(findLook("numbers", "reverse")?.price).toBeGreaterThan(0);
  });

  it("find a look, and not a thing that is not in the shop", () => {
    expect(findLook("room", "cafe")?.price).toBeGreaterThan(0);
    expect(findLook("room", "garage")).toBeUndefined();
    expect(findLook("numbers", 7)).toBeUndefined();
  });
});
