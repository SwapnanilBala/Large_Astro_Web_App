import type { ReactNode } from "react";
import { render as renderBare, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DeterministicRule, DivisionalChartInfo } from "@/lib/astro-types";
import { LanguageProvider } from "@/lib/i18n-context";
import en from "@/messages/en.json";
import AtlasGatewayPreview from "./atlas-gateway-preview";
import TimingGatewayPreview from "./timing-gateway-preview";
import ReadingEvidencePreview from "./reading-evidence-preview";

afterEach(cleanup);

/* The previews read their labels through the desktop provider, in English here. */
const render = (node: ReactNode) =>
  renderBare(<LanguageProvider baseMessages={en}>{node}</LanguageProvider>);

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

function finding(id: string, rank: number): DeterministicRule {
  return {
    id,
    instance_key: id,
    tier: "signature",
    category: "career",
    priority: "high",
    display: { headline: id, body: `Reading for ${id}`, rarity_label: "A notable pattern" },
    selection: { selected: rank > 0, rank, strength: 1, score: 0.9 },
    evidence: {
      technical_note: "Sun in Taurus",
      claims: [{ label: "Sun placement", value: "Taurus", kind: "placement" }],
      matched_conditions: [],
      rarity: { fire_rate: 0.1, score: 0.9, band: "uncommon", observed_count: 100, sample_size: 1000, low_confidence: false, dataset_version: "test" },
    },
  };
}

describe("Reading evidence preview", () => {
  it("uses the reading's ranking and the selected finding's evidence without reordering the input", () => {
    const rules = [finding("Unselected", 0), finding("Second finding", 2), finding("First finding", 1)];
    rules[2].evidence.claims[0].value = "Libra";
    render(<ReadingEvidencePreview rules={rules} yogaCount={5} />);
    expect(screen.getByRole("heading", { name: "First finding" })).toBeInTheDocument();
    expect(screen.getByText("Reading for First finding")).toBeInTheDocument();
    expect(screen.getByText("Libra")).toBeInTheDocument();
    expect(screen.queryByText("Taurus")).not.toBeInTheDocument();
    expect(rules.map((rule) => rule.id)).toEqual(["Unselected", "Second finding", "First finding"]);
  });

  it("uses the actual technical note when structured placement claims are absent", () => {
    const rule = finding("A finding", 1);
    rule.evidence.claims = [];
    render(<ReadingEvidencePreview rules={[rule]} yogaCount={0} />);
    expect(screen.getByText("Sun in Taurus")).toBeInTheDocument();
    expect(screen.queryByText("Sun placement")).not.toBeInTheDocument();
  });

  it("shows honest zero counts without fabricating a finding for an empty chart", () => {
    render(<ReadingEvidencePreview rules={[]} yogaCount={0} />);
    expect(screen.getByText("No matched findings are available for this chart.")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
