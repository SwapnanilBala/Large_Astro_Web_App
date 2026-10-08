/**
 * The PDF dialog's live percentage: how far a report is, measured from the
 * prose streamed so far against the length the prompt asks for, and how the
 * page reads the route's answer, whether progress lines or a cache hit's
 * plain JSON.
 */
import { describe, expect, it } from "vitest";
import {
  PROSE_PROGRESS_CEILING,
  STORY_PROSE_STREAM_TYPE,
  expectedProseWords,
  proseProgress,
  readStoryProseResponse,
  type StoryProse,
  type StoryProseProgressLine,
} from "../story-prose";

const PROSE: StoryProse = {
  introduction: "An introduction.",
  preface: ["A preface."],
  chapters: [{ id: "essence", opening: "An opening.", narrative: ["A paragraph."] }],
};

/** A streamed response, cut into chunks wherever the test says, the way a network hands it over. */
function streamed(chunks: string[], type = `${STORY_PROSE_STREAM_TYPE}; charset=utf-8`): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": type } });
}

const line = (value: unknown) => `${JSON.stringify(value)}\n`;

describe("how far a report is", () => {
  it("expects the introduction, the preface and each chapter at the lengths the prompt asks for", () => {
    /* 75 + 2 x 125 + chapters x (30 + 2 x 125) */
    expect(expectedProseWords(9)).toBe(75 + 250 + 9 * 280);
    expect(expectedProseWords(1)).toBe(75 + 250 + 280);
  });

  it("counts the words written, not the JSON around them, and the chapters begun", () => {
    const partial = '{"introduction":"Your chart opens on a quiet note","preface":["Two worlds"],"chapters":[{"id":"essence","opening":"You notice';
    const { fraction, chaptersStarted } = proseProgress(partial, 9);
    /* 11 words of prose plus the chapter id, over the 2,845 asked for; the five keys are not counted. */
    expect(fraction).toBeCloseTo(12 / expectedProseWords(9), 5);
    expect(chaptersStarted).toBe(1);
  });

  it("stays short of done however long the report runs, and never names more chapters than were asked for", () => {
    const long = `{"chapters":[${'{"id":"x","opening":"word word word"},'.repeat(5)}"${"word ".repeat(5000)}"`;
    const { fraction, chaptersStarted } = proseProgress(long, 3);
    expect(fraction).toBe(PROSE_PROGRESS_CEILING);
    expect(chaptersStarted).toBe(3);
    expect(proseProgress("", 9)).toEqual({ fraction: 0, chaptersStarted: 0 });
  });
});

describe("reading the route's answer", () => {
  it("hands over each progress line, even split across chunks, and returns the prose", async () => {
    const seen: StoryProseProgressLine[] = [];
    const lines =
      line({ type: "progress", phase: "planning", fraction: 0, chaptersStarted: 0, chapters: 9 }) +
      line({ type: "progress", phase: "writing", fraction: 0.42, chaptersStarted: 4, chapters: 9 }) +
      line({ type: "done", prose: PROSE, cached: false });
    const cut = [lines.slice(0, 30), lines.slice(30, 95), lines.slice(95)];
    const prose = await readStoryProseResponse(streamed(cut), (progress) => seen.push(progress));
    expect(prose).toEqual(PROSE);
    expect(seen.map((progress) => [progress.phase, progress.fraction, progress.chaptersStarted])).toEqual([
      ["planning", 0, 0],
      ["writing", 0.42, 4],
    ]);
  });

  it("reads a cache hit's plain JSON, with no progress to report", async () => {
    const seen: StoryProseProgressLine[] = [];
    const response = new Response(JSON.stringify({ prose: PROSE, cached: true }), {
      headers: { "Content-Type": "application/json" },
    });
    expect(await readStoryProseResponse(response, (progress) => seen.push(progress))).toEqual(PROSE);
    expect(seen).toEqual([]);
  });

  it("returns nothing for an error line, a stream that broke off, or an error status", async () => {
    const noop = () => {};
    expect(await readStoryProseResponse(streamed([line({ type: "error", message: "declined" })]), noop)).toBeNull();
    expect(await readStoryProseResponse(streamed([line({ type: "progress", phase: "writing", fraction: 0.5, chaptersStarted: 2, chapters: 9 })]), noop)).toBeNull();
    expect(await readStoryProseResponse(new Response("{}", { status: 429 }), noop)).toBeNull();
  });

  it("keeps a progress line inside its bounds, whatever arrives", async () => {
    const seen: StoryProseProgressLine[] = [];
    await readStoryProseResponse(
      streamed([line({ type: "progress", phase: "odd", fraction: 7, chaptersStarted: 40.5, chapters: 9 }), "not json\n"]),
      (progress) => seen.push(progress),
    );
    expect(seen).toEqual([{ type: "progress", phase: "planning", fraction: 1, chaptersStarted: 9, chapters: 9 }]);
  });
});
