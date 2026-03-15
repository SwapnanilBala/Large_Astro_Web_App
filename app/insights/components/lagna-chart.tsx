import type { HousePlacement } from "@/lib/astro-types";

type LagnaChartProps = {
  ascendantSign: string;
  houses: HousePlacement[];
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mars: "\u2642",
  Mercury: "\u263F",
  Jupiter: "\u2643",
  Venus: "\u2640",
  Saturn: "\u2644",
  Rahu: "\u260A",
  Ketu: "\u260B",
};

const HOUSE_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 300, y: 60 },
  2: { x: 500, y: 105 },
  3: { x: 545, y: 300 },
  4: { x: 500, y: 495 },
  5: { x: 300, y: 540 },
  6: { x: 100, y: 495 },
  7: { x: 55, y: 300 },
  8: { x: 100, y: 105 },
  9: { x: 175, y: 175 },
  10: { x: 175, y: 425 },
  11: { x: 425, y: 425 },
  12: { x: 425, y: 175 },
};

function getPlanetSymbol(name: string): string {
  return PLANET_SYMBOLS[name] ?? name.slice(0, 2);
}

export default function LagnaChart({ ascendantSign, houses }: LagnaChartProps) {
  return (
    <section className="lagna-panel">
      <svg viewBox="0 0 600 600" className="lagna-svg">
        {/* Outer rectangle */}
        <rect
          x="0"
          y="0"
          width="600"
          height="600"
          fill="rgba(2, 13, 22, 0.86)"
          stroke="rgba(108, 225, 212, 0.36)"
          strokeWidth="2"
        />

        {/* Diagonal lines */}
        <line
          x1="0"
          y1="0"
          x2="600"
          y2="600"
          stroke="rgba(242, 194, 108, 0.16)"
          strokeWidth="1"
        />
        <line
          x1="600"
          y1="0"
          x2="0"
          y2="600"
          stroke="rgba(242, 194, 108, 0.16)"
          strokeWidth="1"
        />

        {/* Inner diamond */}
        <polygon
          points="300,0 600,300 300,600 0,300"
          fill="none"
          stroke="rgba(242, 194, 108, 0.3)"
          strokeWidth="1.5"
        />

        {/* House regions */}
        {houses.map((house) => {
          const pos = HOUSE_POSITIONS[house.house_number];
          if (!pos) return null;

          const symbols = house.planets.map(getPlanetSymbol).join(" ");

          return (
            <g key={house.house_number}>
              {/* Sign label */}
              <text
                x={pos.x}
                y={pos.y}
                fill="#6ce1d4"
                fontSize="12"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {house.sign}
              </text>

              {/* Planet symbols */}
              {house.planets.length > 0 && (
                <text
                  x={pos.x}
                  y={pos.y + 18}
                  fill="#f2c26c"
                  fontSize="20"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {symbols}
                </text>
              )}
            </g>
          );
        })}

        {/* Center: Chart title */}
        <text
          x="300"
          y="252"
          fill="rgba(242, 194, 108, 0.85)"
          fontSize="11"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ textTransform: "uppercase", letterSpacing: "3px", fontWeight: 600 }}
        >
          North Indian Kundali
        </text>

        {/* Center: decorative separator */}
        <line
          x1="260"
          y1="265"
          x2="340"
          y2="265"
          stroke="rgba(242, 194, 108, 0.25)"
          strokeWidth="0.5"
        />

        {/* Center: ascendant sign name */}
        <text
          x="300"
          y="290"
          fill="#eef7ff"
          fontSize="24"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {ascendantSign}
        </text>

        {/* Center: "Lagna" label */}
        <text
          x="300"
          y="320"
          fill="#b9d0e1"
          fontSize="11"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ textTransform: "uppercase", letterSpacing: "3px" }}
        >
          Lagna
        </text>
      </svg>
    </section>
  );
}
