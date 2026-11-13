import {describe, expect, it} from "vitest";
import {SCORE_MAX, TOP_ROWS, board, scoreDoc, scoresEnabled, submitScore, toRows} from "./scores";

describe("the document of a score", () => {
  it("has the device, a clean name, a whole score that is not too big, and the time", () => {
    expect(scoreDoc("d1", "  Kalle  ", 1234.9, 99)).toEqual({device: "d1", name: "Kalle", score: 1234, at: 99});
    expect(scoreDoc("d1", "Kalle", -5, 1).score).toBe(0);
    expect(scoreDoc("d1", "Kalle", 1e12, 1).score).toBe(SCORE_MAX);
  });

  it("has only the four things the rules allow", () => {
    expect(Object.keys(scoreDoc("d1", "Kalle", 5, 1)).sort()).toEqual(["at", "device", "name", "score"]);
  });
});

describe("the rows of the top list", () => {
  it("come with the best first and no more than the top list shows", () => {
    const docs = Array.from({length: 25}, (_, i) => ({device: `d${i}`, name: `P${i}`, score: i * 10}));
    const rows = toRows(docs);
    expect(rows).toHaveLength(TOP_ROWS);
    expect(rows[0].score).toBe(240);
    expect(rows.map((r) => r.score)).toEqual([...rows.map((r) => r.score)].sort((a, b) => b - a));
  });

  it("leave out what is not shaped right", () => {
    const rows = toRows([
      {device: "a", name: "Anna", score: 50},
      {device: "b", name: "", score: 60},
      {device: "c", name: "Bo", score: "70"},
      {device: "d", name: "Cia", score: -1},
      {device: 4, name: "Dan", score: 80},
      null,
      "text",
      {device: "e", name: "<Eva>", score: 90.7},
    ]);
    expect(rows).toEqual([
      {device: "e", name: "Eva", score: 90},
      {device: "a", name: "Anna", score: 50},
    ]);
  });
});

describe("while the project is not connected", () => {
  it("keeps everything on the device and never fails", async () => {
    expect(scoresEnabled()).toBe(false);
    expect(board.status).toBe("off");
    await expect(submitScore("Kalle", 500)).resolves.toBe(false);
  });
});
