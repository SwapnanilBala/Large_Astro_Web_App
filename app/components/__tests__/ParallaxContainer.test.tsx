import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import ParallaxContainer from "../ParallaxContainer";

/*
 * The spring loop used to call requestAnimationFrame unconditionally at the end
 * of every tick, so once mounted it woke on every frame for the life of the
 * page — pointer still, spring settled, or disabled for reduced motion, it made
 * no difference.
 *
 * This is asserted here rather than in the browser because the preview pane in
 * this environment runs with document.visibilityState === "hidden", where
 * requestAnimationFrame never fires at all, so a frame count measured there is
 * always zero and proves nothing either way.
 */

let frames: Array<(t: number) => void>;
let rafCalls: number;
let now: number;

/** Run queued frames, advancing the clock, until settled or the cap is hit. */
function pump(maxFrames: number): number {
  let ran = 0;
  while (frames.length && ran < maxFrames) {
    const batch = frames;
    frames = [];
    now += 16;
    act(() => {
      batch.forEach((fn) => fn(now));
    });
    ran += batch.length;
  }
  return ran;
}

beforeEach(() => {
  frames = [];
  rafCalls = 0;
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    rafCalls += 1;
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, // neither reduced-motion nor narrow: parallax enabled
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ParallaxContainer", () => {
  it("does not run the loop until the pointer moves", () => {
    render(<ParallaxContainer>content</ParallaxContainer>);
    expect(frames).toHaveLength(0);
    expect(rafCalls).toBe(0);
  });

  it("stops requesting frames once the spring settles", () => {
    render(<ParallaxContainer>content</ParallaxContainer>);

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("mousemove"), { clientX: 800, clientY: 300 }),
      );
    });
    expect(frames.length).toBeGreaterThan(0);

    /* 400 frames is over six seconds of wall clock. A spring with this
       stiffness and damping settles in well under a second, so reaching the cap
       means the loop never terminates. */
    const ran = pump(400);
    expect(ran).toBeLessThan(400);
    expect(frames).toHaveLength(0);
  });

  it("restarts on the next pointer move and settles again", () => {
    render(<ParallaxContainer>content</ParallaxContainer>);
    const move = (x: number, y: number) =>
      act(() => {
        window.dispatchEvent(
          Object.assign(new Event("mousemove"), { clientX: x, clientY: y }),
        );
      });

    move(800, 300);
    pump(400);
    expect(frames).toHaveLength(0);

    const afterFirst = rafCalls;
    move(200, 700);
    expect(rafCalls).toBeGreaterThan(afterFirst); // woke back up
    pump(400);
    expect(frames).toHaveLength(0); // and settled again
  });

  it("does not start the loop at all when motion is reduced", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<ParallaxContainer>content</ParallaxContainer>);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("mousemove"), { clientX: 800, clientY: 300 }),
      );
    });
    /* Previously the loop still ticked here and simply skipped the maths, so a
       reduced-motion visitor paid a callback every frame to compute nothing. */
    expect(rafCalls).toBe(0);
  });
});
