"use client";

import { useEffect, type RefObject } from "react";

/*
 * The intake form's layout while a phone's on-screen keyboard is open.
 *
 * On a large Android phone the keyboard leaves about 440px of the screen, and
 * the form's top row, question, explanation and pinned Continue bar filled
 * all of it: the field being typed in sat behind the bar, and the place
 * suggestions opened below the field, out of sight. On an iPhone the bar
 * slid under the keyboard instead, so Continue could not be reached without
 * closing it. The owner chose three changes on 2026-10-27, from screenshots:
 * - while the keyboard is open the header folds away and the bar slims
 *   (mobile.module.css, .page[data-keyboard="open"]);
 * - while place suggestions show, the bar steps aside and the list takes the
 *   room down to the keyboard (--keyboard-list-room, mobile-shell.css);
 * - the bar rides on top of the keyboard on every phone (--keyboard-inset).
 *
 * Android Chrome resizes the page around the keyboard, because the layout
 * asks it to (interactiveWidget in app/m/layout.tsx), so the fixed bar is
 * already above the keyboard and the inset comes out 0. Safari ignores that
 * request and lays the keyboard over the page, so the inset is how far the
 * bar has to rise.
 *
 * "Open" needs both a focused text field and a visible area that has
 * shrunk well below what it was before the field took focus: a focused field
 * with a hardware keyboard, or a date field whose picker is not a keyboard,
 * leaves the form as it is.
 */

/** Inputs that open a picker, a toggle or nothing, rather than a keyboard. */
const NO_KEYBOARD_TYPES = new Set([
  "button", "checkbox", "color", "date", "datetime-local", "file", "hidden",
  "image", "month", "radio", "range", "reset", "submit", "time", "week",
]);

/* A keyboard takes 35-50% of a phone's height; the address bar showing or
   hiding takes under 10%. Anything between the two counts as a keyboard. */
const OPEN_BELOW = 0.8;

export interface KeyboardInput {
  /** window.innerHeight: the layout viewport. */
  innerHeight: number;
  /** visualViewport.height and offsetTop: what is actually visible. */
  visibleHeight: number;
  visibleTop: number;
  /** The visible height before the field took focus. */
  baseline: number;
  /** A text field inside the form has focus. */
  typing: boolean;
}

export interface KeyboardLayout {
  open: boolean;
  /** How far the keyboard covers the bottom of the layout viewport, in px. */
  inset: number;
  /** Where the keyboard begins, in the same coordinates as getBoundingClientRect. */
  keyboardTop: number;
}

export function keyboardLayout(input: KeyboardInput): KeyboardLayout {
  const keyboardTop = input.visibleTop + input.visibleHeight;
  const open = input.typing && input.visibleHeight < input.baseline * OPEN_BELOW;
  return {
    open,
    inset: open ? Math.max(0, Math.round(input.innerHeight - keyboardTop)) : 0,
    keyboardTop,
  };
}

export function isTextEntry(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !NO_KEYBOARD_TYPES.has(element.type);
}

interface Selectors {
  /** The block holding a field's label and input. */
  field: string;
  /** The pinned action bar. */
  actions: string;
}

/* Room kept between the field and the edges of what is visible. */
const MARGIN = 8;
/* The gap mobile-shell.css leaves between a field and its suggestion list. */
const LIST_GAP = 6;

export function useKeyboardLayout(formRef: RefObject<HTMLFormElement | null>, selectors: Selectors) {
  const { field: fieldSelector, actions: actionsSelector } = selectors;

  useEffect(() => {
    const form = formRef.current;
    const viewport = window.visualViewport;
    if (!form || !viewport) return;

    let baseline = viewport.height;
    let frame = 0;
    let wasOpen = false;
    let lastFocused: Element | null = null;

    const apply = () => {
      frame = 0;
      const active = document.activeElement;
      const typing = isTextEntry(active) && form.contains(active);
      /* Followed while nothing is being typed, so a rotation or the address
         bar settling resets it. */
      if (!typing) baseline = viewport.height;

      const layout = keyboardLayout({
        innerHeight: window.innerHeight,
        visibleHeight: viewport.height,
        visibleTop: viewport.offsetTop,
        baseline,
        typing,
      });

      if (layout.open) form.dataset.keyboard = "open";
      else delete form.dataset.keyboard;
      form.style.setProperty("--keyboard-inset", `${layout.inset}px`);

      if (!layout.open || !typing) {
        form.style.removeProperty("--keyboard-list-room");
        wasOpen = false;
        lastFocused = null;
        return;
      }

      /* Bring the field into view once, when the keyboard opens or the focus
         moves, not on every scroll: after that the reader is in charge. A
         field with suggestions goes to the top, so the list has the room
         below it; any other field just clears the bar. */
      const suggests = active.closest(".autocomplete-wrapper") !== null;
      if (!wasOpen || lastFocused !== active) {
        const block = active.closest(fieldSelector) ?? active;
        const rect = block.getBoundingClientRect();
        const top = viewport.offsetTop + MARGIN;
        const bar = form.querySelector<HTMLElement>(actionsSelector)?.offsetHeight ?? 0;
        const bottom = layout.keyboardTop - bar - MARGIN;
        let delta = 0;
        if (suggests || rect.top < top) delta = rect.top - top;
        else if (rect.bottom > bottom) delta = rect.bottom - bottom;
        if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: "instant" });
      }
      wasOpen = true;
      lastFocused = active;

      if (suggests) {
        const room = layout.keyboardTop - active.getBoundingClientRect().bottom - LIST_GAP - MARGIN;
        form.style.setProperty("--keyboard-list-room", `${Math.round(room)}px`);
      } else {
        form.style.removeProperty("--keyboard-list-room");
      }
    };

    /* One measurement per frame: the visual viewport fires on every pixel of
       the keyboard's slide, and focusout lands before the next focusin. */
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      delete form.dataset.keyboard;
      form.style.removeProperty("--keyboard-inset");
      form.style.removeProperty("--keyboard-list-room");
    };
  }, [formRef, fieldSelector, actionsSelector]);
}
