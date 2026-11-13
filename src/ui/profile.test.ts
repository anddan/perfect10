import {describe, expect, it} from "vitest";
import {NAME_MAX, cleanName, deviceId} from "./profile";

describe("names", () => {
  it("are trimmed, with one space between words", () => {
    expect(cleanName("  Anna   Lund  ")).toBe("Anna Lund");
    expect(cleanName("Kalle")).toBe("Kalle");
  });

  it("lose control characters and angle brackets", () => {
    expect(cleanName("<b>Kalle</b>")).toBe("bKalle/b");
    expect(cleanName("Ka\u0000l\nle")).toBe("Kalle");
  });

  it("are at most as long as the database allows, and do not end on a space", () => {
    expect(cleanName("a".repeat(50))).toHaveLength(NAME_MAX);
    const cut = cleanName("Anna Maria Eleonora Svensson");
    expect(cut.length).toBeLessThanOrEqual(NAME_MAX);
    expect(cut.endsWith(" ")).toBe(false);
  });

  it("can be empty", () => {
    expect(cleanName("   ")).toBe("");
    expect(cleanName("")).toBe("");
  });
});

describe("the device", () => {
  it("has an id that stays the same", () => {
    const id = deviceId();
    expect(id).toMatch(/^d[a-z0-9]+$/);
    expect(deviceId()).toBe(id);
  });
});
