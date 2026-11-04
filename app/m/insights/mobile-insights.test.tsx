/**
 * The mobile chart's houses under a cusp-based house system.
 *
 * The South Indian square numbers each cell by sign, counted from the lagna.
 * Under Whole Sign that is also every planet's bhava, but under Placidus and
 * the other cusp systems a planet's bhava can be another house. The tap line
 * and the positions table lead with the house the cell shows and, under those
 * systems only, add the bhava with its system named, because that is the
 * house the readings count from.
 *
 * The charts are real ones from buildChart: 1990-05-15 10:30 IST in Bengaluru,
 * Cancer rising, where the Sun in Taurus is house 11 by sign and bhava 10
 * under Placidus, and Saturn in Capricorn is house 7 by sign and bhava 6.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import MobileLanguageProvider from "@/lib/i18n-mobile";
import hi from "@/messages/hi.json";
import en from "@/messages/en.mobile-insights.json";
import MobileInsights from "./mobile-insights";

/* It records the visit and talks to the sync API; neither is under test. */
vi.mock("./mobile-chart-sync", () => ({ default: () => null }));

/* Today's written readings ask their routes; here every route is down, so the
   page shows what it shows without them. */
const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: false, status: 503, json: async () => ({}) }) as Response);
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const BENGALURU: BirthDetailsInput = {
  name: "Test",
  birth_date: "1990-05-15",
  birth_time: "10:30",
  timezone_offset_minutes: 330,
  latitude: 12.9716,
  longitude: 77.5946,
  country: "India",
  state: "Karnataka",
  city: "Bengaluru",
  town: "",
  time_zone_id: "Asia/Kolkata",
};

/* Inside the Arctic Circle, where Placidus is undefined and the engine
   computes Porphyry houses in its place. */
const TROMSO: BirthDetailsInput = {
  ...BENGALURU,
  birth_date: "1990-06-15",
  birth_time: "14:30",
  timezone_offset_minutes: 120,
  latitude: 69.6492,
  longitude: 18.9553,
  country: "Norway",
  state: "",
  city: "Tromso",
  time_zone_id: "Europe/Oslo",
};

/* `messages` renders the page in another language. The provider cannot
   import() a language file under vitest, so that catalog goes in as the
   baseline instead, as BackButton.test.tsx does. */
/* The page opens on the tab its hash names; most of these look at the chart. */
function renderPage(birth: BirthDetailsInput, engine_id: string, messages?: MessageTree, tab = "chart") {
  window.history.replaceState(null, "", `#${tab}`);
  const payload = buildChart({ ...birth, engine_id }) as unknown as ChartApiResponse;
  const page = (
    <MobileInsights
      payload={payload}
      error=""
      desktopHref="/insights"
      historyQs="name=Test&birthDate=1990-05-15"
      birthDate={birth.birth_date}
      birthTime={birth.birth_time}
      kalatra={null}
      asOf={Date.parse("2026-10-03T12:00:00Z")}
    />
  );
  render(
    messages ? (
      <LanguageProvider baseMessages={messages}>{page}</LanguageProvider>
    ) : (
      <MobileLanguageProvider>{page}</MobileLanguageProvider>
    )
  );
  return payload;
}

const positionsTable = () => screen.getByRole("columnheader", { name: "Hse" }).closest("table")!;

/** The cells after a planet's name: sign, degree, house, and the bhava when shown. */
function rowOf(planet: string): string[] {
  const header = within(positionsTable()).getByRole("rowheader", { name: new RegExp(`^${planet}`) });
  return within(header.closest("tr")!)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "");
}

/** Taps a planet on the chart and returns the line written under it. */
function tap(planet: string): string {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${planet} in `) }));
  return screen.getByRole("figure").querySelector("figcaption")!.textContent ?? "";
}

describe("MobileInsights houses", () => {
  it("keeps one house column and the plain tap line under Whole Sign", () => {
    const payload = renderPage(BENGALURU, "lahiri_classic");
    expect(payload.chart.house_system).toBe("whole_sign");

    expect(within(positionsTable()).queryByRole("columnheader", { name: "Bhava" })).toBeNull();
    expect(rowOf("Sun")[2]).toBe("11");
    expect(rowOf("Saturn")[2]).toBe("7");
    expect(tap("Sun")).toMatch(/^Sun in Taurus 0°\d\d', house 11$/);
    expect(screen.queryByText(/^Hse counts houses by sign/)).toBeNull();
  });

  it("adds the Placidus bhava beside the sign house", () => {
    const payload = renderPage(BENGALURU, "lahiri_placidus");
    expect(payload.chart.house_system).toBe("placidus");

    expect(within(positionsTable()).getByRole("columnheader", { name: "Bhava" })).toBeTruthy();
    /* House by sign first, matching the chart's cell, then the bhava. */
    expect(rowOf("Sun").slice(2)).toEqual(["11", "10"]);
    expect(rowOf("Saturn").slice(2)).toEqual(["7", "6"]);
    expect(rowOf("Moon").slice(2)).toEqual(["6", "6"]);

    expect(tap("Sun")).toMatch(/^Sun in Taurus 0°\d\d', house 11 · bhava 10 \(Placidus\)$/);
    expect(
      screen.getByText("Hse counts houses by sign, as the chart does. Bhava is the house under Placidus, the system the readings use.")
    ).toBeTruthy();
  });

  it("names the stand-in system inside the polar circles", () => {
    const payload = renderPage(TROMSO, "krishnamurti_placidus");
    expect(payload.chart.house_system).toBe("porphyry");

    const sun = payload.chart.planets.find((planet) => planet.name === "Sun")!;
    expect(tap("Sun")).toMatch(new RegExp(`· bhava ${sun.house} \\(Porphyry\\)$`));
    expect(screen.getByText(/Bhava is the house under Porphyry/)).toBeTruthy();
  });
});

type Tree = Record<string, unknown>;

function merge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] =
      value && typeof value === "object" && out[key] && typeof out[key] === "object"
        ? merge(out[key] as Tree, value as Tree)
        : value;
  }
  return out;
}

/* The Hindi catalog with anything still staged for the fold merged in: a
   visitor who chose Hindi, before the fold and after it. */
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const hindi: MessageTree = (existsSync(FRAGMENT_DIR) ? readdirSync(FRAGMENT_DIR) : [])
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  .reduce<Tree>((tree, fragment) => merge(tree, (fragment.hi as Tree) ?? {}), hi as Tree);

/* The engine names planets, signs and nakshatras in English. Everywhere the
   page prints one -- the identity row, the positions table, the chart and its
   tap line, the house list, the dasha periods and the current chapter -- it
   goes through the catalogs. */
describe("MobileInsights chart names in Hindi", () => {
  const LATIN = /[A-Za-z]/;

  it("names every planet in Hindi in the positions table", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi);
    const table = screen.getByRole("columnheader", { name: hi.mobileInsights.colHouse }).closest("table")!;
    /* The name is the row header's first text; the flags follow it. */
    const names = within(table)
      .getAllByRole("rowheader")
      .map((header) => header.firstChild?.textContent ?? "");
    expect(names).toHaveLength(9);
    expect(names).toEqual(expect.arrayContaining(["सूर्य", "चंद्र", "शनि", "राहु", "केतु"]));
    expect(names.filter((name) => LATIN.test(name))).toEqual([]);
  });

  it("writes the chart's planets as Hindi abbreviations, and taps them in Hindi", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi);
    const sun = screen.getByRole("button", { name: /^सूर्य / });
    expect(sun.textContent).toBe("सू");
    /* The nodes always move backwards: the abbreviation, then व for वक्री. */
    expect(screen.getByRole("button", { name: /^राहु / }).textContent).toBe("राव");

    fireEvent.click(sun);
    expect(screen.getByRole("figure").querySelector("figcaption")!.textContent).toMatch(/^सूर्य /);
  });

  it("names the dasha lords in Hindi", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi, "timing");
    const periods = screen.getByRole("columnheader", { name: hi.mobileInsights.colPeriod }).closest("table")!;
    const lords = within(periods)
      .getAllByRole("rowheader")
      .map((header) => header.textContent ?? "");
    expect(lords.length).toBeGreaterThan(0);
    expect(lords.filter((lord) => LATIN.test(lord))).toEqual([]);

    fireEvent.click(screen.getByRole("tab", { name: hi.mobileInsights.tabToday }));
    const now = screen.getByRole("heading", { name: hi.mobileInsights.nowLabel }).closest("section")!;
    expect(now.querySelector("p")!.textContent).not.toMatch(LATIN);
    fireEvent.click(screen.getByRole("tab", { name: hi.mobileInsights.tabChart }));
    expect(screen.getByText(/^पद \d · /).textContent).not.toMatch(LATIN);
  });

  it("names the lagna, the nakshatra and the moon's sign in Hindi", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi);
    const identity = screen.getByText(hi.mobileInsights.factNakshatra, { selector: "dt" }).closest("dl")!;
    /* Cancer rising: the lagna reads कर्क. */
    expect(within(identity).getByText("कर्क")).toBeTruthy();
    expect(identity.textContent).not.toMatch(LATIN);
  });

  it("names the signs in Hindi in the positions table", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi);
    const table = screen.getByRole("columnheader", { name: hi.mobileInsights.colHouse }).closest("table")!;
    const signs = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
    expect(signs).toHaveLength(9);
    /* The Sun in Taurus. */
    expect(signs[0]).toMatch(/वृषभ$/);
    expect(signs.filter((sign) => LATIN.test(sign))).toEqual([]);
  });

  it("labels the chart's cells, its centre and its tap line in Hindi", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi);
    const chart = screen.getByRole("figure");
    expect(within(chart).getByRole("group").getAttribute("aria-label")).toBe("राशि कुंडली, कर्क लग्न");
    /* Every cell's sign, the planets, the centre and the hint: no Latin left. */
    expect(chart.textContent).toMatch(/वृश्चिक/);
    expect(chart.textContent).not.toMatch(LATIN);

    fireEvent.click(within(chart).getByRole("button", { name: /^सूर्य / }));
    expect(chart.querySelector("figcaption")!.textContent).toMatch(/^सूर्य वृषभ /);
    expect(chart.querySelector("figcaption")!.textContent).not.toMatch(LATIN);
  });

  it("names each house's sign in Hindi in the house list", () => {
    renderPage(BENGALURU, "lahiri_classic", hindi);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(hi.mobileInsights.houseRolesTitle) }));
    /* "{sign} · {bindus}" beside each house, and its spoken form. */
    const readouts = screen.getAllByText(/^\S+ · \d+$/);
    expect(readouts).toHaveLength(12);
    expect(readouts[0].textContent).toMatch(/^कर्क · \d+$/);
    expect(readouts.map((readout) => readout.textContent).filter((text) => LATIN.test(text ?? ""))).toEqual([]);
    expect(screen.getAllByText(/^\S+, \d+ बिंदु$/)).toHaveLength(12);
  });
});

/*
 * The page in tabs: Today, Chart, Timing, Readings, Ask. The hash names the
 * tab, so a link or a reload opens on it; Today's written readings start only
 * once Today is on screen, since each comes out of the reader's daily
 * allowance.
 */
describe("MobileInsights tabs", () => {
  const tabNamed = (key: keyof typeof en.mobileInsights) => screen.getByRole("tab", { name: en.mobileInsights[key] as string });

  it("opens on Today, with where the reader is in their timeline", () => {
    renderPage(BENGALURU, "lahiri_classic", undefined, "");
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(tabNamed("tabToday").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: en.mobileInsights.nowLabel })).toBeTruthy();
    /* The chart's table is a tab away. */
    expect(screen.queryByRole("columnheader", { name: "Hse" })).toBeNull();
  });

  it("asks for Today's readings on Today, and not for a link to another tab", () => {
    renderPage(BENGALURU, "lahiri_classic", undefined, "chart");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(tabNamed("tabToday"));
    const asked = fetchMock.mock.calls.map(([url]) => String(url));
    expect(asked).toContain("/api/chart/current-period");
    expect(asked.some((url) => url.startsWith("/api/chart/life-shifts?name=Test"))).toBe(true);
  });

  it("names the tab in the address, and moves between tabs with the arrow keys", () => {
    renderPage(BENGALURU, "lahiri_classic", undefined, "");
    fireEvent.click(tabNamed("tabTiming"));
    expect(window.location.hash).toBe("#timing");
    expect(tabNamed("tabTiming").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(window.location.hash).toBe("#readings");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(window.location.hash).toBe("#ask");
  });

  it("puts the dasha cycle on Timing, with the way on to the timing pages", () => {
    renderPage(BENGALURU, "lahiri_classic", undefined, "timing");
    expect(screen.getByRole("columnheader", { name: en.mobileInsights.colPeriod })).toBeTruthy();
    const timing = screen.getByRole("link", { name: new RegExp(en.mobileInsights.timingToolsLink) });
    expect(timing.getAttribute("href")).toBe("/insights/timing?name=Test&birthDate=1990-05-15");
    const chapters = screen.getByRole("link", { name: new RegExp(en.mobileInsights.shiftsLink) });
    expect(chapters.getAttribute("href")).toBe("/insights/life-shifts?name=Test&birthDate=1990-05-15");
  });

  it("shows four readings that deserve attention, and the rest on request", () => {
    const payload = renderPage(BENGALURU, "lahiri_classic", undefined, "readings");
    const high = (payload.chart.deterministic_rules ?? []).filter((rule) => rule.priority === "high").length;
    const shown = () => screen.getAllByRole("heading", { level: 3 }).length;
    expect(shown()).toBe(Math.min(4, high));
    if (high > 4) {
      const more = screen.getByRole("button", { name: new RegExp(`^${high - 4} more reading`) });
      fireEvent.click(more);
      expect(shown()).toBe(high);
    }
  });
});
