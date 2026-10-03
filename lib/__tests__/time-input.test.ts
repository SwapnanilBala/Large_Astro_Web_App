import { afterEach, describe, expect, it, vi } from "vitest";
import { hasNativeTimeInput, normalizeTimeInputValue } from "../time-input";

describe("normalizeTimeInputValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads a working time input's value as the 24-hour time it is", () => {
    /* jsdom implements type="time", as every current browser does. */
    expect(hasNativeTimeInput()).toBe(true);
    expect(normalizeTimeInputValue("10:30")).toMatchObject({ status: "ok", value: "10:30" });
    expect(normalizeTimeInputValue("12:30").suggestions).toBeUndefined();
  });

  it("reads what was typed into the fallback text box leniently", () => {
    /* A browser without native time support: every input reports "text". */
    vi.spyOn(HTMLInputElement.prototype, "type", "get").mockReturnValue("text");

    expect(hasNativeTimeInput()).toBe(false);
    expect(normalizeTimeInputValue("10:30")).toMatchObject({
      status: "ambiguous",
      value: "10:30",
      suggestions: [{ value: "22:30", label: { kind: "time", value: "22:30" } }],
    });
    expect(normalizeTimeInputValue("2:30 pm").value).toBe("14:30");
  });
});
