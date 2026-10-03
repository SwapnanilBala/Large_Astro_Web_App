/**
 * The North Indian chart as rendered: planets in the right houses, sign
 * numbers rotated by the ascendant, and one spoken description per house.
 *
 * The chart is a 1990-05-15 10:30 IST Mumbai birth, Cancer rising, as the
 * engine computes it.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlanetPosition } from "@/lib/astro-types";
import { LanguageProvider } from "@/lib/i18n-context";
import enMessages from "@/messages/en.json";
import NorthIndianChart from "./north-indian-chart";

const planet = (name: string, sign: string, house: number, degree: number, retro = false): PlanetPosition => ({
  name,
  sign,
  house,
  degree_in_sign: degree,
  longitude: 0,
  is_retrograde: retro,
});

const PLANETS: PlanetPosition[] = [
  planet("Sun", "Taurus", 11, 0.4),
  planet("Moon", "Sagittarius", 6, 29.85),
  planet("Mercury", "Aries", 10, 14.33, true),
  planet("Venus", "Pisces", 9, 18.77),
  planet("Mars", "Aquarius", 8, 24.4),
  planet("Jupiter", "Gemini", 12, 15.77),
  planet("Saturn", "Capricorn", 7, 1.54, true),
  planet("Rahu", "Capricorn", 7, 17.64, true),
  planet("Ketu", "Cancer", 1, 17.64, true),
];

function renderChart(onActiveHouseChange = vi.fn()) {
  const utils = render(
    <LanguageProvider baseMessages={enMessages}>
      <NorthIndianChart
        ascendantSign="Cancer"
        ascendantDegree={2.42}
        planets={PLANETS}
        activeHouse={7}
        onActiveHouseChange={onActiveHouseChange}
      />
    </LanguageProvider>,
  );
  return { ...utils, onActiveHouseChange };
}

const house = (container: HTMLElement, n: number) =>
  container.querySelector(`[data-house="${n}"]`) as SVGGElement;

describe("NorthIndianChart", () => {
  it("names the chart and describes every house, planets included", () => {
    renderChart();
    expect(screen.getByRole("group", { name: "North Indian chart with Cancer ascendant" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "House 1, Cancer: Ascendant 2°, Ketu 17°" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "House 7, Capricorn: Saturn 1° retrograde, Rahu 17°" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "House 10, Aries: Mercury 14° retrograde" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "House 2, Leo: no planets" })).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(12);
  });

  it("writes each house's sign number, rotated by the ascendant", () => {
    const { container } = renderChart();
    const expected: Record<number, string> = { 1: "4", 4: "7", 7: "10", 10: "1", 12: "3", 2: "5" };
    for (const [n, number] of Object.entries(expected)) {
      const text = house(container, Number(n)).querySelector("text");
      expect(text?.textContent, `house ${n}`).toBe(number);
    }
  });

  it("puts each planet's abbreviation in its own house", () => {
    const { container } = renderChart();
    const labelsIn = (n: number) =>
      [...house(container, n).querySelectorAll("text")].slice(1).map((text) => text.textContent);
    expect(labelsIn(1)).toEqual(["Asc2°", "Ke17°"]);
    expect(labelsIn(7)).toEqual(["Sa1°R", "Ra17°"]);
    expect(labelsIn(10)).toEqual(["Me14°R"]);
    expect(labelsIn(6)).toEqual(["Mo29°"]);
    expect(labelsIn(3)).toEqual([]);
  });

  it("marks the shared active house and reports hover and focus", () => {
    const { container, onActiveHouseChange } = renderChart();
    expect(house(container, 7).getAttribute("data-active")).toBe("true");
    expect(house(container, 6).getAttribute("data-active")).toBeNull();

    fireEvent.mouseEnter(house(container, 9));
    expect(onActiveHouseChange).toHaveBeenLastCalledWith(9);
    fireEvent.focus(house(container, 4));
    expect(onActiveHouseChange).toHaveBeenLastCalledWith(4);
    fireEvent.blur(house(container, 4));
    expect(onActiveHouseChange).toHaveBeenLastCalledWith(null);
  });

  it("makes every house reachable by keyboard", () => {
    const { container } = renderChart();
    for (let n = 1; n <= 12; n++) {
      expect(house(container, n).getAttribute("tabindex"), `house ${n}`).toBe("0");
    }
  });
});
