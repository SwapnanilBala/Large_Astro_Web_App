/**
 * Whose hand a palm reading is for: the tradition reads a woman's left hand
 * and a man's right, and only those two closed values ever reach the prompt.
 */
import { describe, expect, it } from "vitest";
import { PALM_READERS, parsePalmReader, readerLine, traditionalHand } from "../palm-readings/reader";

describe("the palm reader", () => {
  it("accepts the two choices and treats anything else as not saying", () => {
    expect(parsePalmReader("woman")).toBe("woman");
    expect(parsePalmReader("man")).toBe("man");
    for (const value of [undefined, null, "", "Woman", "female", "unspecified", 1, { reader: "woman" }]) {
      expect(parsePalmReader(value), String(value)).toBe("unspecified");
    }
  });

  it("reads a woman's left hand and a man's right, and no hand for someone who did not say", () => {
    expect(traditionalHand("woman")).toBe("left");
    expect(traditionalHand("man")).toBe("right");
    expect(traditionalHand("unspecified")).toBeNull();
  });

  it("tells the model only when the reader said", () => {
    expect(readerLine("woman")).toBe("[READER: a woman. Classical palmistry reads the left hand for a woman.]");
    expect(readerLine("man")).toBe("[READER: a man. Classical palmistry reads the right hand for a man.]");
    expect(readerLine("unspecified")).toBeNull();
  });

  it("offers the choices in the order the panel shows them", () => {
    expect(PALM_READERS).toEqual(["woman", "man", "unspecified"]);
  });
});
