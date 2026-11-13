import {describe, expect, it} from "vitest";
import {STAGES} from "../game/constants";
import type {Mode} from "../game/types";
import {createBook, currentPage, isUnlocked, markCleared, markProgress, nextGame, pageOfMode} from "./book";

describe("which levels are open", () => {
  it("starts with only the first plus level (and the tutorial and endless game)", () => {
    const b = createBook();
    expect(isUnlocked(b, "plus", 1)).toBe(true);
    for (let s = 2; s <= STAGES; s++) expect(isUnlocked(b, "plus", s)).toBe(false);
    for (let s = 1; s <= STAGES; s++) expect(isUnlocked(b, "mixed", s)).toBe(false);
    expect(isUnlocked(b, "tutorial", 0)).toBe(true);
    expect(isUnlocked(b, "endless", 0)).toBe(true);
  });

  it("opens a level when the one before it has been cleared, and no further", () => {
    const b = createBook();
    markCleared(b, "plus", 1);
    expect(isUnlocked(b, "plus", 2)).toBe(true);
    expect(isUnlocked(b, "plus", 3)).toBe(false);
    markCleared(b, "plus", 2);
    expect(isUnlocked(b, "plus", 3)).toBe(true);
  });

  it("opens the plus and minus levels when the last plus level is cleared", () => {
    const b = createBook();
    for (let s = 1; s < STAGES; s++) markCleared(b, "plus", s);
    expect(isUnlocked(b, "mixed", 1)).toBe(false);
    markCleared(b, "plus", STAGES);
    expect(isUnlocked(b, "mixed", 1)).toBe(true);
    expect(isUnlocked(b, "mixed", 2)).toBe(false);
    markCleared(b, "mixed", 1);
    expect(isUnlocked(b, "mixed", 2)).toBe(true);
  });

  it("opens the chapter with multiplication when the last level with minus is cleared, level by level", () => {
    const b = createBook();
    expect(isUnlocked(b, "times", 1)).toBe(false);
    for (let s = 1; s <= STAGES; s++) markCleared(b, "mixed", s);
    expect(isUnlocked(b, "times", 1)).toBe(true);
    expect(isUnlocked(b, "times", 2)).toBe(false);
    markCleared(b, "times", 1);
    expect(isUnlocked(b, "times", 2)).toBe(true);
  });

  it("opens the division chapter when the last multiplication level is cleared, level by level", () => {
    const b = createBook();
    expect(isUnlocked(b, "divide", 1)).toBe(false);
    for (let s = 1; s <= STAGES; s++) markCleared(b, "times", s);
    expect(isUnlocked(b, "divide", 1)).toBe(true);
    expect(isUnlocked(b, "divide", 2)).toBe(false);
    markCleared(b, "divide", 1);
    expect(isUnlocked(b, "divide", 2)).toBe(true);
  });

  it("goes chapter after chapter, and comes to the endless game after the last division level", () => {
    expect(nextGame("mixed", STAGES)).toEqual({mode: "times", stage: 1});
    expect(nextGame("times", 3)).toEqual({mode: "times", stage: 4});
    expect(nextGame("times", STAGES)).toEqual({mode: "divide", stage: 1});
    expect(nextGame("divide", STAGES)).toEqual({mode: "endless", stage: 0});
  });

  it("has every level open when it is told to (for testing)", () => {
    const b = createBook(0, [], true);
    for (const mode of ["plus", "mixed", "times", "divide"] as const) for (let s = 1; s <= STAGES; s++) expect(isUnlocked(b, mode, s)).toBe(true);
  });

  it("remembers how many cups were filled in a level, and only ever goes up", () => {
    const b = createBook(0, [], false, {"mixed-2": 1});
    expect(b.bestCups.get("mixed-2")).toBe(1);
    expect(markProgress(b, "mixed", 2, 2)).toBe(true);
    expect(b.bestCups.get("mixed-2")).toBe(2);
    expect(markProgress(b, "mixed", 2, 1)).toBe(false); // a worse try does not take it back
    expect(b.bestCups.get("mixed-2")).toBe(2);
    expect(b.bestCups.get("plus-1")).toBeUndefined();
  });

  it("opens on the tutorial until it is cleared, then on the page you have got to", () => {
    const b = createBook();
    expect(currentPage(b)).toBe(0);
    markCleared(b, "tutorial", 0);
    expect(currentPage(b)).toBe(pageOfMode("plus"));
    for (let s = 1; s <= 3; s++) markCleared(b, "plus", s);
    expect(currentPage(b)).toBe(pageOfMode("plus")); // still in the first chapter
    for (let s = 4; s <= STAGES; s++) markCleared(b, "plus", s);
    expect(currentPage(b)).toBe(pageOfMode("mixed"));
    for (let s = 1; s <= STAGES; s++) {
      markCleared(b, "mixed", s);
      markCleared(b, "times", s);
      markCleared(b, "divide", s);
    }
    expect(currentPage(b)).toBe(pageOfMode("endless"));
  });

  it("remembers what was cleared from before", () => {
    const b = createBook(0, ["plus-1", "plus-2"]);
    expect(isUnlocked(b, "plus", 3)).toBe(true);
    expect(isUnlocked(b, "plus", 4)).toBe(false);
  });

  it("goes from each level to the next one, which is open once the first is cleared", () => {
    const b = createBook();
    let game: {mode: Mode; stage: number} | undefined = {mode: "plus", stage: 1};
    while (game && game.mode !== "endless") {
      markCleared(b, game.mode, game.stage);
      game = nextGame(game.mode, game.stage);
      if (game) expect(isUnlocked(b, game.mode, game.stage)).toBe(true);
    }
    expect(game?.mode).toBe("endless");
  });
});
