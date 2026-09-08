import { motion } from "framer-motion";
import { svgCoord } from "@/lib/svg-precision";
import { formatDayAxis, formatDayShort } from "@/lib/format-week";
import type { WeeklyEnergyDay, WeeklyEnergyWeek } from "@/lib/astro-types";
import styles from "./weekly-energy-panel.module.css";

/*
 * The seven-day energy line.
 *
 * A pure function of its props: no hooks, no clock, no measurement. `animate`
 * arrives from the parent, which owns useReducedMotion, for the same reason
 * house-support-panel.tsx keeps its rings hook-free -- it stays
 * server-renderable and cannot get into a state its props do not describe.
 *
 * No ResizeObserver and no measured width. The viewBox is a fixed unit space
 * scaled by CSS, which is the idiom the other SVGs here use; measuring would
 * force client-only rendering and paint once at the wrong size first.
 */

const W = 640;
const H = 300;
/* right is wide because the band labels (High / Balanced / Low) live there. */
const PAD = { top: 24, right: 58, bottom: 42, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/*
 * The visible score range, not 0-100.
 *
 * Measured over 2,912 real days the score runs p05 31, median 54, p95 80. On a
 * 0-100 axis every week would be a nearly flat line through the middle of the
 * plot; on 15-95 the median sits at 49% of the height and the two band lines
 * (46 and 66) land at 39% and 64%, so a week's shape is actually legible. Same
 * reasoning as RING_MAX_PERCENT in house-support-panel.tsx: pick the range that
 * shows the differences that matter.
 *
 * Scores outside it pin to the edge rather than drawing outside the plot. That
 * costs under 1% of days at each end, and the number is still printed in the
 * accessible table, so nothing is hidden.
 */
const Y_MIN = 15;
const Y_MAX = 95;

const DAY_COUNT = 7;

export type WeeklyEnergyChartProps = {
  days: WeeklyEnergyDay[];
  bands: WeeklyEnergyWeek["bands"];
  peak: WeeklyEnergyWeek["peak"];
  altText: string;
  weekLabel: string;
  animate: boolean;
  /** Namespaces the gradient and the a11y ids; two charts can share a page. */
  idPrefix: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* Every coordinate goes through svgCoord. (i + 0.5) * (540/7) is a repeating
   fraction, which is exactly the server/client last-place divergence that file
   documents -- and React discards a mismatched tree rather than patching it. */
function xFor(index: number): number {
  return svgCoord(PAD.left + (index + 0.5) * (PLOT_W / DAY_COUNT));
}

function yFor(score: number): number {
  const fraction = (clamp(score, Y_MIN, Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN);
  return svgCoord(PAD.top + PLOT_H * (1 - fraction));
}

export default function WeeklyEnergyChart({
  days,
  bands,
  peak,
  altText,
  weekLabel,
  animate,
  idPrefix,
}: WeeklyEnergyChartProps) {
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const areaId = `${idPrefix}-area`;

  const points = days.map((day, index) => ({ x: xFor(index), y: yFor(day.score), day }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const floor = yFor(Y_MIN);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${floor} L ${points[0].x} ${floor} Z`;

  const highY = yFor(bands.high_min);
  const lowY = yFor(bands.low_max);
  const topY = svgCoord(PAD.top);
  const bottomY = svgCoord(PAD.top + PLOT_H);

  const peakIndex = days.findIndex((d) => d.date === peak.date);
  const peakPoint = points[peakIndex >= 0 ? peakIndex : 0];

  /*
   * Callout placement, in TS rather than CSS because there are four cases and
   * three of them are about not being clipped by the plot's own padding.
   */
  const calloutAnchor: "start" | "middle" | "end" =
    peakIndex <= 1 ? "start" : peakIndex >= DAY_COUNT - 2 ? "end" : "middle";
  const calloutAbove = peakPoint.y > PAD.top + 54;
  const calloutY = svgCoord(calloutAbove ? peakPoint.y - 16 : peakPoint.y + 16);
  const calloutDx = calloutAnchor === "start" ? 10 : calloutAnchor === "end" ? -10 : 0;

  const lineTransition = animate
    ? { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const }
    : { duration: 0 };

  return (
    <div className={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.chart}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>{`Your weekly energy, ${weekLabel}`}</title>
        <desc id={descId}>{altText}</desc>

        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.areaStopTop} />
            <stop offset="100%" className={styles.areaStopBottom} />
          </linearGradient>
        </defs>

        {/* Bands first, so everything else sits on top of them. They are the
            reference frame and are never animated. */}
        <g aria-hidden="true">
          <rect
            x={PAD.left} y={topY} width={PLOT_W} height={svgCoord(highY - topY)}
            className={styles.bandHigh}
          />
          <rect
            x={PAD.left} y={highY} width={PLOT_W} height={svgCoord(lowY - highY)}
            className={styles.bandBalanced}
          />
          <rect
            x={PAD.left} y={lowY} width={PLOT_W} height={svgCoord(bottomY - lowY)}
            className={styles.bandLow}
          />

          <line x1={PAD.left} y1={highY} x2={svgCoord(PAD.left + PLOT_W)} y2={highY} className={styles.bandRule} />
          <line x1={PAD.left} y1={lowY} x2={svgCoord(PAD.left + PLOT_W)} y2={lowY} className={styles.bandRule} />

          {points.map((p) => (
            <line
              key={`tick-${p.day.date}`}
              x1={p.x} y1={topY} x2={p.x} y2={bottomY}
              className={styles.columnTick}
            />
          ))}
        </g>

        {/* Band labels, in the right-hand pad. */}
        <g className={styles.bandLabels} aria-hidden="true">
          <text x={svgCoord(W - PAD.right + 10)} y={svgCoord((topY + highY) / 2)}>High</text>
          <text x={svgCoord(W - PAD.right + 10)} y={svgCoord((highY + lowY) / 2)}>Balanced</text>
          <text x={svgCoord(W - PAD.right + 10)} y={svgCoord((lowY + bottomY) / 2)}>Low</text>
        </g>

        <path d={areaPath} fill={`url(#${areaId})`} className={styles.area} aria-hidden="true" />

        {/* Straight segments, deliberately not a spline. Catmull-Rom over seven
            points overshoots past a local maximum and puts the curve's visual
            peak between two days -- which would leave the callout pointing at a
            day the line does not peak on. */}
        <motion.path
          d={linePath}
          className={styles.line}
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={lineTransition}
          aria-hidden="true"
        />

        {points.map((p, index) => (
          <motion.circle
            key={p.day.date}
            cx={p.x}
            cy={p.y}
            r={index === peakIndex && peak.is_significant ? 6 : 4}
            className={styles.dot}
            data-band={p.day.band}
            data-peak={index === peakIndex && peak.is_significant ? "true" : undefined}
            initial={animate ? { opacity: 0, scale: 0.4 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={animate ? { delay: 0.35 + index * 0.06, duration: 0.3 } : { duration: 0 }}
            aria-hidden="true"
          />
        ))}

        {/* Real <text>, so the callout is already in the accessibility tree. */}
        <g className={styles.callout} transform={`translate(${peakPoint.x}, ${calloutY})`}>
          <text textAnchor={calloutAnchor} dx={calloutDx} className={styles.calloutDay}>
            {peak.is_significant ? formatDayShort(peak.date) : "Steady week"}
          </text>
          <text
            textAnchor={calloutAnchor}
            dx={calloutDx}
            dy={calloutAbove ? -14 : 14}
            className={styles.calloutLabel}
          >
            {peak.is_significant ? peak.label : "no standout day"}
          </text>
        </g>

        <g className={styles.axis} aria-hidden="true">
          {points.map((p) => {
            const { weekday, day } = formatDayAxis(p.day.date);
            return (
              <text key={`axis-${p.day.date}`} x={p.x} y={svgCoord(H - PAD.bottom + 20)} textAnchor="middle">
                <tspan x={p.x}>{weekday}</tspan>
                <tspan x={p.x} dy="15" className={styles.axisDay}>{day}</tspan>
              </text>
            );
          })}
        </g>
      </svg>

      {/* The SVG carries the picture; this carries the numbers. Same division
          as house-support-panel.tsx, and the reason there is no hover tooltip:
          a tooltip would need a keyboard equivalent, a focus ring per dot and a
          live region to say the same thing this already says. */}
      <table className={styles.srOnly}>
        <caption>{`Weekly energy scores, ${weekLabel}`}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Date</th>
            <th scope="col">Score</th>
            <th scope="col">Band</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDayAxis(day.date).weekday}</th>
              <td>{day.date}</td>
              <td>{day.score}</td>
              <td>{day.band}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
