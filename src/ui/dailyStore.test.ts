import {describe, expect, it} from "vitest";
import {todaysTry} from "./dailyStore";

describe("today's try of the daily challenge", () => {
  it("counts only when it was made today", () => {
    expect(todaysTry(null, "2026-11-14")).toBeNull();
    expect(todaysTry({day: "2026-11-13", rungs: 4, cleared: false}, "2026-11-14")).toBeNull();
    const r = {day: "2026-11-14", rungs: 2, cleared: false};
    expect(todaysTry(r, "2026-11-14")).toBe(r);
  });
});
