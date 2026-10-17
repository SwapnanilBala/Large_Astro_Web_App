import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/lib/i18n-context";
import enMessages from "@/messages/en.json";
import { ReadingProgress, readingPercent } from "./reading-progress";

/*
 * The bar shown while a section's reading is written. Its percentage is an
 * estimate from the elapsed time, so what is worth pinning is that it never
 * claims more than it knows: steady to 90% at the usual time, then never past
 * 98% however long the wait.
 */

describe("readingPercent", () => {
  it("climbs steadily to 90% at the usual time", () => {
    expect(readingPercent(0, 10_000)).toBe(0);
    expect(readingPercent(1_000, 10_000)).toBe(9);
    expect(readingPercent(5_000, 10_000)).toBe(45);
    expect(readingPercent(10_000, 10_000)).toBe(90);
  });

  it("creeps on past the usual time, never reaching 100%", () => {
    expect(readingPercent(15_000, 10_000)).toBeGreaterThan(90);
    expect(readingPercent(20_000, 10_000)).toBeGreaterThan(readingPercent(15_000, 10_000));
    expect(readingPercent(10 * 60_000, 10_000)).toBe(98);
  });

  it("only ever goes up", () => {
    let last = 0;
    for (let ms = 0; ms <= 60_000; ms += 250) {
      const next = readingPercent(ms, 9_000);
      expect(next).toBeGreaterThanOrEqual(last);
      last = next;
    }
  });
});

describe("ReadingProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names what is being written and shows how far it has gone", () => {
    render(
      <LanguageProvider baseMessages={enMessages}>
        <ReadingProgress label="Writing your reading" expectedMs={10_000} />
      </LanguageProvider>,
    );
    const bar = screen.getByRole("progressbar", { name: "Writing your reading" });
    expect(screen.getByText("Writing your reading")).toBeTruthy();
    expect(bar.getAttribute("aria-valuenow")).toBe("0");

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(bar.getAttribute("aria-valuenow")).toBe("45");
    expect(screen.getByText("45%")).toBeTruthy();
  });

  it("can leave the words to the section, keeping them for assistive technology", () => {
    render(
      <LanguageProvider baseMessages={enMessages}>
        <ReadingProgress label="Tracing the major lines" expectedMs={120_000} showLabel={false} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("progressbar", { name: "Tracing the major lines" })).toBeTruthy();
    expect(screen.queryByText("Tracing the major lines")).toBeNull();
  });
});
