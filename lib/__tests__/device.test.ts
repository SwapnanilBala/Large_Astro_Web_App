import { describe, expect, it } from "vitest";
import {
  hasMobileRoute,
  isMobilePath,
  isMobileUserAgent,
  readViewPreference,
  resolveRoute,
  toDesktopPath,
  toMobilePath,
} from "../device";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ipad:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1",
  mac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

describe("isMobileUserAgent", () => {
  it("detects handsets", () => {
    expect(isMobileUserAgent(UA.iphone)).toBe(true);
    expect(isMobileUserAgent(UA.androidPhone)).toBe(true);
  });

  it("treats tablets and desktops as desktop", () => {
    /* Android tablets send "Android" without "Mobile"; iPadOS presents a
     * desktop-class viewport (and often a macOS UA). Both belong on the
     * shared tree, not in a 375px-first layout. */
    expect(isMobileUserAgent(UA.androidTablet)).toBe(false);
    expect(isMobileUserAgent(UA.ipad)).toBe(false);
    expect(isMobileUserAgent(UA.mac)).toBe(false);
    expect(isMobileUserAgent(UA.windows)).toBe(false);
  });

  it("is safe on a missing User-Agent", () => {
    expect(isMobileUserAgent(null)).toBe(false);
    expect(isMobileUserAgent(undefined)).toBe(false);
    expect(isMobileUserAgent("")).toBe(false);
  });
});

describe("path mapping", () => {
  it("maps between the two trees", () => {
    expect(toMobilePath("/")).toBe("/m");
    expect(toMobilePath("/insights")).toBe("/m/insights");
    expect(toDesktopPath("/m")).toBe("/");
    expect(toDesktopPath("/m/insights")).toBe("/insights");
  });

  it("round-trips", () => {
    for (const path of ["/", "/insights"]) {
      expect(toDesktopPath(toMobilePath(path))).toBe(path);
    }
  });

  it("is idempotent and tolerates trailing slashes", () => {
    expect(toMobilePath("/m/insights")).toBe("/m/insights");
    expect(toDesktopPath("/insights")).toBe("/insights");
    expect(toMobilePath("/insights/")).toBe("/m/insights");
  });

  it("recognises the mobile tree without matching lookalike paths", () => {
    expect(isMobilePath("/m")).toBe(true);
    expect(isMobilePath("/m/insights")).toBe(true);
    /* "/muhurta" starts with the same letter — must not be treated as mobile. */
    expect(isMobilePath("/muhurta")).toBe(false);
    expect(isMobilePath("/")).toBe(false);
  });

  it("only claims routes that actually have a mobile counterpart", () => {
    expect(hasMobileRoute("/")).toBe(true);
    expect(hasMobileRoute("/insights")).toBe(true);
    expect(hasMobileRoute("/pricing")).toBe(false);
    expect(hasMobileRoute("/insights/advanced")).toBe(false);
  });
});

describe("readViewPreference", () => {
  it("prefers the query parameter over the cookie", () => {
    expect(readViewPreference("desktop", "mobile")).toBe("desktop");
    expect(readViewPreference(null, "mobile")).toBe("mobile");
  });

  it("ignores anything that is not a known preference", () => {
    expect(readViewPreference("tablet", null)).toBeNull();
    expect(readViewPreference(null, null)).toBeNull();
  });
});

describe("resolveRoute", () => {
  it("sends phones to the mobile tree", () => {
    expect(resolveRoute({ pathname: "/", userAgent: UA.iphone, preference: null })).toEqual({
      action: "redirect",
      pathname: "/m",
    });
    expect(
      resolveRoute({ pathname: "/insights", userAgent: UA.androidPhone, preference: null }),
    ).toEqual({ action: "redirect", pathname: "/m/insights" });
  });

  it("sends desktops off the mobile tree", () => {
    expect(resolveRoute({ pathname: "/m/insights", userAgent: UA.mac, preference: null })).toEqual({
      action: "redirect",
      pathname: "/insights",
    });
  });

  it("leaves correctly-placed requests alone", () => {
    expect(resolveRoute({ pathname: "/", userAgent: UA.mac, preference: null })).toEqual({
      action: "pass",
    });
    expect(resolveRoute({ pathname: "/m", userAgent: UA.iphone, preference: null })).toEqual({
      action: "pass",
    });
  });

  it("never redirects a route that has no mobile counterpart", () => {
    /* A phone visiting /pricing stays on /pricing rather than 404ing at /m/pricing. */
    expect(resolveRoute({ pathname: "/pricing", userAgent: UA.iphone, preference: null })).toEqual({
      action: "pass",
    });
  });

  it("lets an explicit preference beat the User-Agent, in both directions", () => {
    /* A phone user who asked for the desktop layout keeps it and is not
     * bounced back on the next navigation. */
    expect(resolveRoute({ pathname: "/", userAgent: UA.iphone, preference: "desktop" })).toEqual({
      action: "pass",
    });
    expect(resolveRoute({ pathname: "/m", userAgent: UA.mac, preference: "mobile" })).toEqual({
      action: "pass",
    });
    expect(resolveRoute({ pathname: "/", userAgent: UA.mac, preference: "mobile" })).toEqual({
      action: "redirect",
      pathname: "/m",
    });
  });
});
