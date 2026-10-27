import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { isTextEntry, keyboardLayout, useKeyboardLayout } from "../use-keyboard-layout";

/*
 * The intake form's keyboard layout: what counts as the keyboard being open,
 * how far the bar rises, and that the form is marked for the stylesheet.
 */

describe("keyboardLayout", () => {
  it("is open when a field has focus and the visible area shrank", () => {
    /* Safari: the page keeps its height and the keyboard covers 380px. */
    expect(
      keyboardLayout({ innerHeight: 750, visibleHeight: 370, visibleTop: 0, baseline: 750, typing: true }),
    ).toEqual({ open: true, inset: 380, keyboardTop: 370 });
  });

  it("needs no lift where the browser resizes the page", () => {
    /* Android Chrome with resizes-content: the page itself is 440px tall. */
    expect(
      keyboardLayout({ innerHeight: 440, visibleHeight: 440, visibleTop: 0, baseline: 740, typing: true }),
    ).toEqual({ open: true, inset: 0, keyboardTop: 440 });
  });

  it("follows the visible area when Safari scrolls it", () => {
    const layout = keyboardLayout({
      innerHeight: 750, visibleHeight: 370, visibleTop: 120, baseline: 750, typing: true,
    });
    expect(layout.inset).toBe(260);
    expect(layout.keyboardTop).toBe(490);
  });

  it("is closed with a hardware keyboard, the address bar moving, or nothing focused", () => {
    expect(
      keyboardLayout({ innerHeight: 740, visibleHeight: 740, visibleTop: 0, baseline: 740, typing: true }).open,
    ).toBe(false);
    expect(
      keyboardLayout({ innerHeight: 740, visibleHeight: 684, visibleTop: 0, baseline: 740, typing: true }).open,
    ).toBe(false);
    expect(
      keyboardLayout({ innerHeight: 750, visibleHeight: 370, visibleTop: 0, baseline: 750, typing: false }),
    ).toMatchObject({ open: false, inset: 0 });
  });
});

describe("isTextEntry", () => {
  const input = (type: string) => Object.assign(document.createElement("input"), { type });

  it("counts fields that open a keyboard", () => {
    for (const type of ["text", "search", "email", "tel", "number", "url", "password"]) {
      expect(isTextEntry(input(type)), type).toBe(true);
    }
    expect(isTextEntry(document.createElement("textarea"))).toBe(true);
  });

  it("leaves out pickers, toggles and buttons", () => {
    for (const type of ["date", "time", "checkbox", "radio", "submit", "button"]) {
      expect(isTextEntry(input(type)), type).toBe(false);
    }
    expect(isTextEntry(document.createElement("button"))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

/* jsdom has no visualViewport; a stand-in whose size the test sets. */
class FakeViewport extends EventTarget {
  height = 750;
  offsetTop = 0;
}

function Form() {
  const ref = useRef<HTMLFormElement>(null);
  useKeyboardLayout(ref, { field: ".field", actions: ".actions" });
  return (
    <form ref={ref} data-testid="form">
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" />
      </div>
      <input id="when" type="date" />
      <div className="actions">
        <button type="submit">Continue</button>
      </div>
    </form>
  );
}

describe("useKeyboardLayout", () => {
  let viewport: FakeViewport;
  /* Frames run when the test says, as a browser runs them after the event. */
  let frames: FrameRequestCallback[] = [];
  const flushFrames = () => {
    const due = frames;
    frames = [];
    for (const callback of due) callback(0);
  };

  beforeEach(() => {
    viewport = new FakeViewport();
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 750, configurable: true });
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "visualViewport");
  });

  const openKeyboard = (field: string) => {
    act(() => {
      document.getElementById(field)!.focus();
      viewport.height = 370;
      viewport.dispatchEvent(new Event("resize"));
      flushFrames();
    });
  };

  it("marks the form and lifts the bar while the keyboard is open", () => {
    const { getByTestId } = render(<Form />);
    const form = getByTestId("form");
    openKeyboard("name");
    expect(form.dataset.keyboard).toBe("open");
    expect(form.style.getPropertyValue("--keyboard-inset")).toBe("380px");

    act(() => {
      document.getElementById("name")!.blur();
      viewport.height = 750;
      viewport.dispatchEvent(new Event("resize"));
      flushFrames();
    });
    expect(form.dataset.keyboard).toBeUndefined();
    expect(form.style.getPropertyValue("--keyboard-inset")).toBe("0px");
  });

  it("leaves the form alone for a date field", () => {
    const { getByTestId } = render(<Form />);
    openKeyboard("when");
    expect(getByTestId("form").dataset.keyboard).toBeUndefined();
  });

  it("clears its marks when the form goes away", () => {
    const { getByTestId, unmount } = render(<Form />);
    const form = getByTestId("form");
    openKeyboard("name");
    unmount();
    expect(form.dataset.keyboard).toBeUndefined();
    expect(form.style.getPropertyValue("--keyboard-inset")).toBe("");
  });
});
