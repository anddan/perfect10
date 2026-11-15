import {describe, expect, it} from "vitest";
import {DEFAULT_LOOK, looksOf} from "../game/looks";
import {ROOMS} from "./background";
import {CUP_COLORS, STYLE_COLORS, cupPalette} from "./cupArt";

describe("the colours of a cup", () => {
  it("are white for a cup with no property, the colour of the property for one, and a mix for several", () => {
    expect(cupPalette([])).toBeNull();
    expect(cupPalette(["gold"])).toEqual(CUP_COLORS.gold);
    const mix = cupPalette(["gold", "thermos"])!;
    expect(mix.body).toHaveLength(5);
    expect(mix.rim).toHaveLength(3);
    expect(mix.body[2]).not.toBe(CUP_COLORS.gold.body[2]);
    expect(mix.body[2]).not.toBe(CUP_COLORS.thermos.body[2]);
    // The middle of "#fff0a8" and "#e6f1fb" is "#f3f1d2" (every part is the average of the two).
    expect(mix.body[2]).toBe("#f3f1d2");
    expect(cupPalette(["gold", "thermos"])).toEqual(cupPalette(["thermos", "gold"]));
  });

  it("are the colour from the shop for an ordinary cup, and the colour of the power for a cup with one", () => {
    expect(cupPalette([], "sky")).toEqual(STYLE_COLORS.sky);
    expect(cupPalette([], "porcelain")).toBeNull();
    expect(cupPalette([], "nonsense")).toBeNull();
    expect(cupPalette(["magnet"], "sky")).toEqual(CUP_COLORS.magnet);
  });
});

describe("every look of the shop can be drawn", () => {
  it("has a colour for every cup colour, and a room for every room", () => {
    for (const look of looksOf("cupColor")) {
      if (look.id !== DEFAULT_LOOK.cupColor) expect(STYLE_COLORS[look.id], look.id).toBeDefined();
    }
    for (const look of looksOf("room")) {
      if (look.id !== DEFAULT_LOOK.room) expect(ROOMS, look.id).toContain(look.id);
    }
  });
});
