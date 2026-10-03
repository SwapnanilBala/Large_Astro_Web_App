import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DivisionalChartInfo } from "@/lib/astro-types";
import {
  HOUSES,
  HOUSE_POLYGONS,
  LABEL_BOXES,
  NORTH_INDIAN_SIZE,
  SIGN_NUMBER_POINTS,
  layoutHouseLabels,
  signForHouse,
  signNumber,
} from "@/lib/north-indian-chart";
import styles from "./reading-gateway-previews.module.css";

const FEATURED_CHARTS = [
  { division: 1, focus: "Life and identity" },
  { division: 9, focus: "Relationships and purpose" },
  { division: 10, focus: "Career and contribution" },
] as const;

function ChartMiniature({ chart, ascendantSign }: { chart: DivisionalChartInfo; ascendantSign: string }) {
  const size = NORTH_INDIAN_SIZE;
  const placements = chart.positions.map((position) => `${position.name} in ${position.divisional_sign}`).join(", ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={styles.miniChart}
      role="img"
      aria-label={`${chart.label} whole-sign chart: ${placements}`}
    >
      {HOUSES.map((house) => {
        const sign = signForHouse(ascendantSign, house);
        const positions = chart.positions.filter((position) => position.divisional_sign === sign);
        const layout = layoutHouseLabels(positions.map((position) => ({
          abbrev: position.name === "Ascendant" ? "Asc" : position.name.slice(0, 2),
          degree: "",
          retrograde: false,
        })), LABEL_BOXES[house]);
        const [x, y] = SIGN_NUMBER_POINTS[house];
        return (
          <g key={house}>
            <polygon
              points={HOUSE_POLYGONS[house].map(([px, py]) => `${px},${py}`).join(" ")}
              className={positions.length ? styles.occupiedHouse : styles.emptyHouse}
            />
            <text x={x} y={y} className={styles.miniSign} textAnchor="middle" dominantBaseline="central">
              {signNumber(sign)}
            </text>
            {layout.labels.map((label, index) => (
              <text
                key={positions[index].name}
                x={label.x}
                y={label.y}
                fontSize={25 * layout.scale}
                className={styles.miniPlanet}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label.abbrev}
              </text>
            ))}
          </g>
        );
      })}
      <g className={styles.miniLines} aria-hidden="true">
        <rect x={1} y={1} width={size - 2} height={size - 2} />
        <line x1={0} y1={0} x2={size} y2={size} />
        <line x1={size} y1={0} x2={0} y2={size} />
        <polygon points={`${size / 2},0 ${size},${size / 2} ${size / 2},${size} 0,${size / 2}`} />
      </g>
    </svg>
  );
}

export default function AtlasGatewayPreview({
  charts,
  historyQs,
}: {
  charts: Record<number, DivisionalChartInfo>;
  historyQs: string;
}) {
  const featured = FEATURED_CHARTS.filter(({ division }) => charts[division]);

  if (!featured.length) {
    return <p className={styles.previewEmpty}>Explore the {Object.keys(charts).length} available divisional charts in your atlas.</p>;
  }

  return (
    <nav className={styles.atlasGrid} aria-label="Featured divisional charts">
      {featured.map(({ division, focus }) => {
        const chart = charts[division];
        const ascendant = chart.positions.find((position) => position.name === "Ascendant");
        const canDraw = ascendant && signNumber(ascendant.divisional_sign) > 0;
        return (
          <Link
            key={division}
            href={`/insights/divisional-charts/${division}${historyQs ? `?${historyQs}` : ""}`}
            prefetch={false}
            className={styles.atlasLink}
          >
            <figure className={styles.atlasFigure}>
              {canDraw && <ChartMiniature chart={chart} ascendantSign={ascendant.divisional_sign} />}
              <figcaption className={styles.atlasCaption}>
                <strong>D{division} <ArrowUpRight aria-hidden="true" /></strong>
                <span>{focus}</span>
                <small>{canDraw ? `${ascendant.divisional_sign} ascendant` : "Ascendant unavailable"}</small>
              </figcaption>
            </figure>
          </Link>
        );
      })}
    </nav>
  );
}
