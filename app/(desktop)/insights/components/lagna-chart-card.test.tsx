/**
 * The chart card under a cusp-based house system.
 *
 * The positions table, the "most active area" fact and the North Indian
 * diamond all have to describe the same chart. They used to read the API's
 * houses, which under Placidus put eight planets in house 3; the card now
 * reads each planet's house off its sign, as the constellation wheel does, and
 * this pins all three to that.
 *
 * The chart is a 1990-05-15 10:30 IST Mumbai birth, Cancer rising, with the
 * houses the Lahiri Placidus engine returns for it.
 */
import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChartApiResponse, PlanetPosition } from "@/lib/astro-types";
import { LanguageProvider } from "@/lib/i18n-context";
import enMessages from "@/messages/en.json";
import LagnaChartCard from "./lagna-chart-card";

vi.mock("@/lib/use-chart-style", () => ({
  useChartStyle: () => ["north-indian", vi.fn()],
}));

const planet = (name: string, longitude: number, sign: string, house: number, retro = false): PlanetPosition => ({
  name,
  longitude,
  sign,
  house,
  degree_in_sign: longitude % 30,
  is_retrograde: retro,
});

/* `house` as Placidus reports it; every other field is the same under any
   house system. */
const PLANETS: PlanetPosition[] = [
  planet("Sun", 30.4, "Taurus", 3),
  planet("Moon", 269.85, "Sagittarius", 3),
  planet("Mercury", 14.33, "Aries", 3, true),
  planet("Venus", 348.77, "Pisces", 3),
  planet("Mars", 324.4, "Aquarius", 3),
  planet("Jupiter", 75.77, "Gemini", 3),
  planet("Saturn", 271.54, "Capricorn", 3, true),
  planet("Rahu", 287.64, "Capricorn", 3, true),
  planet("Ketu", 107.64, "Cancer", 1, true),
];

const payload = {
  chart: {
    ascendant: { longitude: 92.42, sign: "Cancer", degree_in_sign: 2.42 },
    planets: PLANETS,
    houses: Array.from({ length: 12 }, (_, index) => ({
      house_number: index + 1,
      sign: "Sagittarius",
      planets: index === 2 ? PLANETS.filter((p) => p.house === 3).map((p) => p.name) : index === 0 ? ["Ketu"] : [],
    })),
    shadbala: [],
  },
} as unknown as ChartApiResponse;

function renderCard() {
  return render(
    <LanguageProvider baseMessages={enMessages}>
      <LagnaChartCard payload={payload} />
    </LanguageProvider>,
  );
}

const rowFor = (name: string) => screen.getByRole("rowheader", { name: new RegExp(`^${name}`) }).closest("tr")!;

describe("LagnaChartCard", () => {
  it("lists each planet in its sign's house", () => {
    renderCard();
    const houseOf = (name: string) => within(rowFor(name)).getAllByRole("cell")[1].textContent;

    expect(houseOf("Sun")).toBe("11");
    expect(houseOf("Moon")).toBe("6");
    expect(houseOf("Mercury")).toBe("10");
    expect(houseOf("Jupiter")).toBe("12");
    expect(houseOf("Saturn")).toBe("7");
    expect(houseOf("Ketu")).toBe("1");
  });

  it("names the busiest house of the chart it draws", () => {
    renderCard();
    const fact = screen.getByText("Most active area").nextElementSibling;

    expect(fact?.textContent).toBe("House 7 · Capricorn");
    expect(screen.getByText("Saturn and Rahu concentrate in this part of the chart.")).toBeTruthy();
  });

  it("draws the diamond from the same placements, and highlights across the two", async () => {
    const { container } = renderCard();
    const seventh = await screen.findByRole("img", { name: "House 7, Capricorn: Saturn 1° retrograde, Rahu 17°" });

    expect(screen.getByRole("img", { name: "House 3, Virgo: no planets" })).toBeTruthy();

    fireEvent.mouseEnter(rowFor("Saturn"));
    expect(seventh.getAttribute("data-active")).toBe("true");
    expect(container.querySelector('[data-house="3"]')?.getAttribute("data-active")).toBeNull();
  });
});
