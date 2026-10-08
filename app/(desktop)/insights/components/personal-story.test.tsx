import { describe, expect, it } from "vitest";
import type { StoryProseProgressLine } from "@/lib/story-prose";
import { storyPercent } from "./personal-story";

/*
 * The PDF dialog's percentage: fixed points for the quick steps, and the
 * writing step's measured share of the words in between.
 */

const writing = (fraction: number, chaptersStarted = 0): StoryProseProgressLine => ({
  type: "progress",
  phase: fraction > 0 ? "writing" : "planning",
  fraction,
  chaptersStarted,
  chapters: 9,
});

describe("the PDF dialog's percentage", () => {
  it("holds fixed points for the quick steps", () => {
    expect(storyPercent("calculating", null)).toBe(2);
    expect(storyPercent("verifying", null)).toBe(6);
    expect(storyPercent("typesetting", writing(0.97, 9))).toBe(95);
  });

  it("runs the writing step from 8 to 92 as the words come in", () => {
    expect(storyPercent("writing", null)).toBe(8);
    expect(storyPercent("writing", writing(0))).toBe(8);
    expect(storyPercent("writing", writing(0.5, 5))).toBe(50);
    expect(storyPercent("writing", writing(1, 9))).toBe(92);
  });

  it("only ever rises from one step to the next", () => {
    const steps = [
      storyPercent("calculating", null),
      storyPercent("verifying", null),
      storyPercent("writing", writing(0)),
      storyPercent("writing", writing(0.4, 3)),
      storyPercent("writing", writing(0.97, 9)),
      storyPercent("typesetting", writing(0.97, 9)),
    ];
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it("is nothing when no report is being made", () => {
    expect(storyPercent("idle", writing(0.5))).toBe(0);
    expect(storyPercent("error", null)).toBe(0);
  });
});
