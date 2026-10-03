import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DivisionalChartInfo } from "@/lib/astro-types";
import AtlasGatewayPreview from "./atlas-gateway-preview";
import TimingGatewayPreview from "./timing-gateway-preview";

afterEach(cleanup);

function chart(division: number, ascendantSign = "Aries"): DivisionalChartInfo {
  return {
    division,
    label: `D${division}`,
    description: "Test chart",
    positions: [
      { name: "Ascendant", rashi_sign: "Aries", divisional_sign: ascendantSign, part_index: 0, degree_in_divisional_sign: 5 },
      { name: "Sun", rashi_sign: "Taurus", divisional_sign: "Taurus", part_index: 0, degree_in_divisional_sign: 10 },
      { name: "Moon", rashi_sign: "Gemini", divisional_sign: "Gemini", part_index: 0, degree_in_divisional_sign: 20 },
    ],
  };
}

describe("Atlas gateway preview", () => {
  it("shows actual chart placements and keeps the profile query on each detail link", () => {
    render(<AtlasGatewayPreview charts={{ 1: chart(1), 9: chart(9, "Libra"), 10: chart(10, "Cancer") }} historyQs="name=Reader&birthDate=1990-06-15" />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByRole("img", { name: /D9 whole-sign chart: Ascendant in Libra, Sun in Taurus, Moon in Gemini/ })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    [1, 9, 10].forEach((division, index) => {
      expect(links[index]).toHaveAttribute("href", `/insights/divisional-charts/${division}?name=Reader&birthDate=1990-06-15`);
    });
  });

  it("does not manufacture previews for divisions missing from the payload", () => {
    render(<AtlasGatewayPreview charts={{ 9: chart(9) }} historyQs="" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/insights/divisional-charts/9");
  });

  it("keeps the chart link available without inventing an ascendant", () => {
    const missingAscendant = chart(9);
    missingAscendant.positions = missingAscendant.positions.filter((position) => position.name !== "Ascendant");
    render(<AtlasGatewayPreview charts={{ 9: missingAscendant }} historyQs="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Ascendant unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });
});

describe("Timing gateway preview", () => {
  it("links each stop to its matching timing section with birth details intact", () => {
    render(<TimingGatewayPreview href="/insights/timing?name=Reader" />);
    expect(screen.getByRole("link", { name: /Forecast/ })).toHaveAttribute("href", "/insights/timing?name=Reader#forecast");
    expect(screen.getByRole("link", { name: /Muhurta/ })).toHaveAttribute("href", "/insights/timing?name=Reader#muhurta");
    expect(screen.getByRole("link", { name: /Year ahead/ })).toHaveAttribute("href", "/insights/timing?name=Reader#varshaphal");
    expect(screen.queryByText("Current chapter")).not.toBeInTheDocument();
  });
});
