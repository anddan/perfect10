import {describe, expect, it} from "vitest";
import {LANGS, TABLES, lang, nextLang, setLang, t, type Key} from "./i18n";

describe("the four languages", () => {
  const keys = Object.keys(TABLES.en) as Key[];

  it("have every text, and none of them empty", () => {
    for (const l of LANGS) {
      expect(Object.keys(TABLES[l]).sort()).toEqual([...keys].sort());
      for (const k of keys) expect(TABLES[l][k].trim().length, `${l}.${k}`).toBeGreaterThan(0);
    }
  });

  it("fill in the same numbers: a text has the same {n} and {m} in every language", () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of keys) for (const l of LANGS) expect(slots(TABLES[l][k]), `${l}.${k}`).toBe(slots(TABLES.en[k]));
  });

  it("come in this order, going round, when the language button is pressed", () => {
    setLang("sv");
    expect(lang()).toBe("sv");
    const seen = [lang()];
    for (let i = 0; i < 4; i++) {
      setLang(nextLang());
      seen.push(lang());
    }
    expect(seen).toEqual(["sv", "en", "es", "it", "sv"]);
  });

  it("write a text in the language that is on, with the numbers in it", () => {
    setLang("en");
    expect(t("chapter", {n: 2})).toBe("CHAPTER 2");
    setLang("sv");
    expect(t("chapter", {n: 2})).toBe("KAPITEL 2");
    setLang("es");
    expect(t("chapter", {n: 3})).toBe("CAPÍTULO 3");
    setLang("it");
    expect(t("cupsDone", {n: 1, m: 3})).toBe("1 di 3 tazze completate");
  });

  it("say chapter, not level, on the pages of the book", () => {
    for (const l of LANGS) expect(TABLES[l].chapter).not.toMatch(/NIV|LEVEL|LIVELL/i);
  });
});
