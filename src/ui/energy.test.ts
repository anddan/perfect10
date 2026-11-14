import {describe, expect, it} from "vitest";
import {ENERGY_MAX, ENERGY_PER_AD, ENERGY_REGEN_SECONDS, addEnergy, clock, createEnergy, refreshEnergy, secondsToNext, spendEnergy} from "./energy";

const MIN = 60 * 1000;

describe("energy", () => {
  it("starts full, and every try costs one", () => {
    const e = createEnergy(0);
    expect(e.n).toBe(ENERGY_MAX);
    for (let i = 0; i < ENERGY_MAX; i++) expect(spendEnergy(e, 1000)).toBe(true);
    expect(e.n).toBe(0);
    expect(spendEnergy(e, 1000)).toBe(false); // none left: nothing is paid
    expect(e.n).toBe(0);
  });

  it("gives one back every 10 minutes, counted from when the energy dropped below full", () => {
    const e = createEnergy(0);
    spendEnergy(e, 5 * MIN); // (the wait starts here, at minute 5)
    expect(secondsToNext(e, 5 * MIN)).toBe(ENERGY_REGEN_SECONDS);
    expect(secondsToNext(e, 10 * MIN)).toBe(ENERGY_REGEN_SECONDS - 5 * 60);
    refreshEnergy(e, 14 * MIN);
    expect(e.n).toBe(ENERGY_MAX - 1);
    refreshEnergy(e, 15 * MIN);
    expect(e.n).toBe(ENERGY_MAX); // full again
    expect(secondsToNext(e, 16 * MIN)).toBe(0);
  });

  it("keeps counting a long wait, a point at a time, and never goes above the most", () => {
    const e = createEnergy(0);
    for (let i = 0; i < 6; i++) spendEnergy(e, 0);
    expect(e.n).toBe(ENERGY_MAX - 6);
    refreshEnergy(e, 25 * MIN); // two points
    expect(e.n).toBe(ENERGY_MAX - 4);
    expect(secondsToNext(e, 25 * MIN)).toBe(5 * 60); // the third comes at minute 30
    refreshEnergy(e, 24 * 60 * MIN);
    expect(e.n).toBe(ENERGY_MAX);
  });

  it("does not make the next point come sooner when more is spent while waiting", () => {
    const e = createEnergy(0);
    spendEnergy(e, 0);
    spendEnergy(e, 8 * MIN);
    expect(e.n).toBe(ENERGY_MAX - 2);
    expect(secondsToNext(e, 8 * MIN)).toBe(2 * 60); // still at minute 10
  });

  it("gives energy for an ad, but never above the most, and not when the clock goes backwards", () => {
    const e = createEnergy(0);
    for (let i = 0; i < ENERGY_MAX; i++) spendEnergy(e, 0);
    addEnergy(e, ENERGY_PER_AD, 0);
    expect(e.n).toBe(ENERGY_PER_AD);
    addEnergy(e, 100, 0);
    expect(e.n).toBe(ENERGY_MAX);
    const f = createEnergy(10 * MIN);
    spendEnergy(f, 10 * MIN);
    refreshEnergy(f, 5 * MIN); // (the clock was set back: nothing is given)
    expect(f.n).toBe(ENERGY_MAX - 1);
  });

  it("writes the time as m:ss", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(61)).toBe("1:01");
    expect(clock(600)).toBe("10:00");
  });
});
