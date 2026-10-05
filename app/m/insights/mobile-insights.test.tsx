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
import { describe, expect, it, vi } from "vitest";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import MobileLanguageProvider from "@/lib/i18n-mobile";
import hi from "@/messages/hi.json";
import MobileInsights from "./mobile-insights";

/* It records the visit and talks to the sync API; neither is under test. */
vi.mock("./mobile-chart-sync", () => ({ default: () => null }));

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
function renderPage(birth: BirthDetailsInput, engine_id: string, messages?: MessageTree) {
  const payload = buildChart({ ...birth, engine_id }) as unknown as ChartApiResponse;
  const page = (
    <MobileInsights
      payload={payload}
      error=""
      desktopHref="/insights"
      historyQs=""
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

/* The engine names the planets in English. Everywhere the page prints one --
   the positions table, the chart and its tap line, the dasha periods, the
   current chapter and the nakshatra's lord -- it goes through the catalogs. */
describe("MobileInsights planet names in Hindi", () => {
  const LATIN = /[A-Za-z]/;

  it("names every planet in Hindi in the positions table", () => {
    renderPage(BENGALURU, "lahiri_classic", hi);
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
    renderPage(BENGALURU, "lahiri_classic", hi);
    const sun = screen.getByRole("button", { name: /^सूर्य / });
    expect(sun.textContent).toBe("सू");
    /* The nodes always move backwards: the abbreviation, then व for वक्री. */
    expect(screen.getByRole("button", { name: /^राहु / }).textContent).toBe("राव");

    fireEvent.click(sun);
    expect(screen.getByRole("figure").querySelector("figcaption")!.textContent).toMatch(/^सूर्य /);
  });

  it("names the dasha lords in Hindi", () => {
    renderPage(BENGALURU, "lahiri_classic", hi);
    const periods = screen.getByRole("columnheader", { name: hi.mobileInsights.colPeriod }).closest("table")!;
    const lords = within(periods)
      .getAllByRole("rowheader")
      .map((header) => header.textContent ?? "");
    expect(lords.length).toBeGreaterThan(0);
    expect(lords.filter((lord) => LATIN.test(lord))).toEqual([]);

    const now = screen.getByRole("heading", { name: hi.mobileInsights.nowLabel }).closest("section")!;
    expect(now.querySelector("p")!.textContent).not.toMatch(LATIN);
    expect(screen.getByText(/^पद \d · /).textContent).not.toMatch(LATIN);
  });
});
