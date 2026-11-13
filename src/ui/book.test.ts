import {describe, expect, it} from "vitest";
import {STAGES} from "../game/constants";
import type {Mode} from "../game/types";
import {CHAPTER_MODES, CHAPTER_STARS, STARS_FOR_ENDLESS, STARS_TO_OPEN, type Book, chapterOf, chapterStars, createBook, currentPage, dragBy, endDrag, goToPage, isUnlocked, markCleared, markProgress, markScore, nextGame, openNextGame, pageOfMode, totalStars, updateBook} from "./book";

/** Clears every level of a chapter with three stars (a lot of points). */
function clearWithThreeStars(b: Book, mode: Mode): void {
  for (let s = 1; s <= STAGES; s++) {
    markCleared(b, mode, s);
    markScore(b, mode, s, 1e6);
  }
}

describe("which levels are open", () => {
  it("starts with only the first plus level (and the tutorial)", () => {
    const b = createBook();
    expect(isUnlocked(b, "plus", 1)).toBe(true);
    for (let s = 2; s <= STAGES; s++) expect(isUnlocked(b, "plus", s)).toBe(false);
    for (let s = 1; s <= STAGES; s++) expect(isUnlocked(b, "mixed", s)).toBe(false);
    expect(isUnlocked(b, "tutorial", 0)).toBe(true);
    expect(isUnlocked(b, "endless", 0)).toBe(false);
    for (let s = 1; s <= STAGES; s++) expect(isUnlocked(b, "space", s)).toBe(false);
  });

  it("opens a level when the one before it has been cleared, and no further", () => {
    const b = createBook();
    markCleared(b, "plus", 1);
    expect(isUnlocked(b, "plus", 2)).toBe(true);
    expect(isUnlocked(b, "plus", 3)).toBe(false);
    markCleared(b, "plus", 2);
    expect(isUnlocked(b, "plus", 3)).toBe(true);
  });

  it("opens the plus and minus levels when 24 of the 36 stars of the plus chapter have been got", () => {
    const b = createBook();
    for (let s = 1; s <= STAGES; s++) markCleared(b, "plus", s); // (every level cleared, but only one star in each: 12 stars)
    expect(chapterStars(b, "plus")).toBe(12);
    expect(isUnlocked(b, "mixed", 1)).toBe(false);
    for (let s = 1; s <= 6; s++) markScore(b, "plus", s, 1e6); // six levels with three stars: 6 * 3 + 6 = 24
    expect(chapterStars(b, "plus")).toBe(STARS_TO_OPEN);
    expect(isUnlocked(b, "mixed", 1)).toBe(true);
    expect(isUnlocked(b, "mixed", 2)).toBe(false);
    markCleared(b, "mixed", 1);
    expect(isUnlocked(b, "mixed", 2)).toBe(true);
  });

  it("opens the chapter with multiplication when the last level with minus is cleared, level by level", () => {
    const b = createBook();
    expect(isUnlocked(b, "times", 1)).toBe(false);
    clearWithThreeStars(b, "mixed");
    expect(isUnlocked(b, "times", 1)).toBe(true);
    expect(isUnlocked(b, "times", 2)).toBe(false);
    markCleared(b, "times", 1);
    expect(isUnlocked(b, "times", 2)).toBe(true);
  });

  it("opens the division chapter when the last multiplication level is cleared, level by level", () => {
    const b = createBook();
    expect(isUnlocked(b, "divide", 1)).toBe(false);
    clearWithThreeStars(b, "times");
    expect(isUnlocked(b, "divide", 1)).toBe(true);
    expect(isUnlocked(b, "divide", 2)).toBe(false);
    markCleared(b, "divide", 1);
    expect(isUnlocked(b, "divide", 2)).toBe(true);
  });

  it("opens the space chapter when the last division level is cleared, level by level", () => {
    const b = createBook();
    expect(isUnlocked(b, "space", 1)).toBe(false);
    clearWithThreeStars(b, "divide");
    expect(isUnlocked(b, "space", 1)).toBe(true);
    expect(isUnlocked(b, "space", 2)).toBe(false);
    markCleared(b, "space", 1);
    expect(isUnlocked(b, "space", 2)).toBe(true);
  });

  it("counts the stars of a chapter, out of 36, and opens the next chapter with at least 24 (more is fine)", () => {
    expect(CHAPTER_STARS).toBe(36);
    const b = createBook();
    expect(chapterStars(b, "plus")).toBe(0);
    // 23 stars: not enough. Eleven levels with two stars (the par of the level) and one with one star.
    for (let s = 1; s <= STAGES; s++) markCleared(b, "plus", s);
    for (let s = 1; s <= 11; s++) markScore(b, "plus", s, 1e6);
    markScore(b, "plus", 12, 0);
    expect(chapterStars(b, "plus")).toBe(34);
    // A level that has not been cleared has no stars, whatever its points.
    const c = createBook();
    markScore(c, "plus", 1, 1e6);
    expect(chapterStars(c, "plus")).toBe(0);
    // 23: seven levels with three stars and two with one star ... = 21 + 2 = 23
    const d = createBook();
    for (let s = 1; s <= 8; s++) markCleared(d, "plus", s);
    for (let s = 1; s <= 7; s++) markScore(d, "plus", s, 1e6);
    expect(chapterStars(d, "plus")).toBe(22);
    expect(isUnlocked(d, "mixed", 1)).toBe(false);
    markCleared(d, "plus", 9);
    expect(chapterStars(d, "plus")).toBe(23);
    expect(isUnlocked(d, "mixed", 1)).toBe(false);
    markScore(d, "plus", 8, 1e6); // that level now has three stars: 25
    expect(chapterStars(d, "plus")).toBe(25);
    expect(isUnlocked(d, "mixed", 1)).toBe(true);
    // The first level of a chapter that has been cleared stays open.
    const e = createBook(0, ["mixed-1"]);
    expect(isUnlocked(e, "mixed", 1)).toBe(true);
  });

  it("only gives the next game when it is open", () => {
    const b = createBook();
    for (let s = 1; s <= STAGES; s++) markCleared(b, "plus", s);
    expect(nextGame("plus", STAGES)).toEqual({mode: "mixed", stage: 1});
    expect(openNextGame(b, "plus", STAGES)).toBeUndefined(); // only 12 stars
    expect(openNextGame(b, "plus", 3)).toEqual({mode: "plus", stage: 4});
    clearWithThreeStars(b, "plus");
    expect(openNextGame(b, "plus", STAGES)).toEqual({mode: "mixed", stage: 1});
  });

  it("opens the endless game when 120 stars have been got in all the chapters together", () => {
    expect(STARS_FOR_ENDLESS).toBe(120);
    const b = createBook();
    expect(totalStars(b)).toBe(0);
    // Three chapters with three stars everywhere: 108 stars.
    for (const mode of ["plus", "mixed", "times"] as const) clearWithThreeStars(b, mode);
    expect(totalStars(b)).toBe(108);
    expect(isUnlocked(b, "endless", 0)).toBe(false);
    // Three levels with three stars and two with one star in the next chapter: 108 + 9 + 2 = 119, one short.
    for (let s = 1; s <= 3; s++) {
      markCleared(b, "divide", s);
      markScore(b, "divide", s, 1e6);
    }
    for (let s = 4; s <= 5; s++) markCleared(b, "divide", s);
    expect(totalStars(b)).toBe(119);
    expect(isUnlocked(b, "endless", 0)).toBe(false);
    // One more star (a third level with one star): 120.
    markCleared(b, "divide", 6);
    expect(totalStars(b)).toBe(STARS_FOR_ENDLESS);
    expect(isUnlocked(b, "endless", 0)).toBe(true);
    // Every level cleared is not enough without the stars (12 levels in each of 5 chapters, one star each: 60).
    const c = createBook();
    for (const mode of CHAPTER_MODES) for (let s = 1; s <= STAGES; s++) markCleared(c, mode, s);
    expect(totalStars(c)).toBe(60);
    expect(isUnlocked(c, "endless", 0)).toBe(false);
  });

  it("goes chapter after chapter, and comes to the endless game after the last space level", () => {
    expect(nextGame("mixed", STAGES)).toEqual({mode: "times", stage: 1});
    expect(nextGame("times", 3)).toEqual({mode: "times", stage: 4});
    expect(nextGame("times", STAGES)).toEqual({mode: "divide", stage: 1});
    expect(nextGame("divide", STAGES)).toEqual({mode: "space", stage: 1});
    expect(nextGame("space", 5)).toEqual({mode: "space", stage: 6});
    expect(nextGame("space", STAGES)).toEqual({mode: "endless", stage: 0});
    expect(nextGame("endless", 0)).toBeUndefined();
  });

  it("numbers the chapters 1 to 5, with the space chapter last", () => {
    expect(CHAPTER_MODES.map((m) => chapterOf(m))).toEqual([1, 2, 3, 4, 5]);
    expect(pageOfMode("space")).toBe(pageOfMode("divide") + 1);
    expect(pageOfMode("endless")).toBe(pageOfMode("space") + 1);
  });

  it("has every level open when it is told to (for testing)", () => {
    const b = createBook(0, [], true);
    for (const mode of CHAPTER_MODES) for (let s = 1; s <= STAGES; s++) expect(isUnlocked(b, mode, s)).toBe(true);
    expect(isUnlocked(b, "endless", 0)).toBe(true);
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

  it("remembers the points got in a level, and only ever the most", () => {
    const b = createBook(0, [], false, {}, {"plus-1": 300});
    expect(b.bestScores.get("plus-1")).toBe(300);
    expect(markScore(b, "plus", 1, 705)).toBe(true);
    expect(b.bestScores.get("plus-1")).toBe(705);
    expect(markScore(b, "plus", 1, 500)).toBe(false); // a worse try does not take it back
    expect(b.bestScores.get("plus-1")).toBe(705);
    expect(markScore(b, "mixed", 2, 0)).toBe(false);
    expect(b.bestScores.get("mixed-2")).toBeUndefined();
  });

  it("opens on the tutorial until it is cleared, then on the page you have got to", () => {
    const b = createBook();
    expect(currentPage(b)).toBe(0);
    markCleared(b, "tutorial", 0);
    expect(currentPage(b)).toBe(pageOfMode("plus"));
    for (let s = 1; s <= 3; s++) markCleared(b, "plus", s);
    expect(currentPage(b)).toBe(pageOfMode("plus")); // still in the first chapter
    for (let s = 4; s <= STAGES; s++) markCleared(b, "plus", s);
    // Every level cleared, but too few stars to open the next chapter: it stays on this one.
    expect(currentPage(b)).toBe(pageOfMode("plus"));
    clearWithThreeStars(b, "plus");
    expect(currentPage(b)).toBe(pageOfMode("mixed"));
    clearWithThreeStars(b, "mixed");
    clearWithThreeStars(b, "times");
    clearWithThreeStars(b, "divide");
    expect(currentPage(b)).toBe(pageOfMode("space"));
    clearWithThreeStars(b, "space");
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
      markScore(b, game.mode, game.stage, 1e6);
      game = nextGame(game.mode, game.stage);
      if (game) expect(isUnlocked(b, game.mode, game.stage)).toBe(true);
    }
    expect(game?.mode).toBe("endless");
  });
});

describe("turning the pages with the buttons, quickly", () => {
  it("carries on towards the new page when a button is pressed again while a page is on its way", () => {
    const b = createBook();
    goToPage(b, 1, true);
    expect(b.windup).toBeGreaterThan(0); // the first press: the page lifts a moment
    for (let i = 0; i < 20; i++) updateBook(b, 1 / 60); // (still on its way)
    expect(b.pos).toBeLessThan(1);
    goToPage(b, 2, true);
    expect(b.windup).toBe(0); // no new wind-up: the page does not stick
    expect(b.target).toBe(2);
    for (let i = 0; i < 600; i++) updateBook(b, 1 / 60);
    expect(b.pos).toBe(2);
  });

  it("does not stick when the button is pressed over and over at short intervals", () => {
    const b = createBook();
    for (let press = 0; press < 5; press++) {
      goToPage(b, b.target + 1, true);
      for (let i = 0; i < 8; i++) updateBook(b, 1 / 60); // (a press about every seventh of a second)
    }
    expect(b.target).toBe(5);
    for (let i = 0; i < 600; i++) updateBook(b, 1 / 60);
    expect(b.pos).toBe(5);
  });

  it("only drags and lets go of a drag that has begun (a press on a page button does not begin one)", () => {
    const b = createBook();
    goToPage(b, 1, true);
    for (let i = 0; i < 20; i++) updateBook(b, 1 / 60);
    const pos = b.pos;
    dragBy(b, 100); // not dragging: nothing happens
    expect(b.pos).toBe(pos);
    endDrag(b); // not dragging: the target is not changed
    expect(b.target).toBe(1);
  });
});
