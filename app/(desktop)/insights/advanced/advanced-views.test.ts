import { describe, expect, it } from "vitest";
import { getAdvancedFocusView } from "./advanced-views";

describe("getAdvancedFocusView", () => {
  it.each(["transits", "palm"])("accepts the supported %s workspace", (view) => {
    expect(getAdvancedFocusView(view)).toBe(view);
  });

  it.each([undefined, "", "live-transits", "chart-palm", "unknown"])(
    "falls back to the full library for %s",
    (view) => {
      expect(getAdvancedFocusView(view)).toBeNull();
    }
  );
});
