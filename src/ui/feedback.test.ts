import {describe, expect, it} from "vitest";
import {FEEDBACK_KINDS, FEEDBACK_MAX, cleanFeedback, feedbackDoc, isFeedbackKind, submitFeedback} from "./feedback";

describe("what is written on the back cover", () => {
  it("is cleaned: no control characters or angle brackets, no more than one empty line in a row, and not too long", () => {
    expect(cleanFeedback("  Hello\u0007 <b>there</b>  ")).toBe("Hello bthere/b");
    expect(cleanFeedback("a\r\n\r\n\r\n\r\nb")).toBe("a\n\nb");
    expect(cleanFeedback("a   \nb")).toBe("a\nb");
    expect(cleanFeedback("x".repeat(FEEDBACK_MAX + 50))).toHaveLength(FEEDBACK_MAX);
    expect(cleanFeedback("   \n  ")).toBe("");
  });

  it("is one of three kinds: a question, an idea or a problem", () => {
    expect(FEEDBACK_KINDS).toEqual(["support", "idea", "problem"]);
    expect(isFeedbackKind("idea")).toBe(true);
    expect(isFeedbackKind("spam")).toBe(false);
    expect(isFeedbackKind(3)).toBe(false);
  });

  it("makes a document with only the fields the database accepts", () => {
    const doc = feedbackDoc("problem", "  It broke  ", "d1", "  Kalle  ", "sv-SE-extra", 123);
    expect(doc).toEqual({device: "d1", name: "Kalle", kind: "problem", text: "It broke", lang: "sv-SE", at: 123});
    expect(Object.keys(doc).sort()).toEqual(["at", "device", "kind", "lang", "name", "text"]);
    expect(feedbackDoc("idea", "x", "d".repeat(80), "", "en", 1).device).toHaveLength(40);
  });

  it("sends nothing when there is nothing written", async () => {
    expect(await submitFeedback("idea", "   ", "en")).toBe("empty");
    expect(await submitFeedback("nope" as never, "hello", "en")).toBe("empty");
  });
});
