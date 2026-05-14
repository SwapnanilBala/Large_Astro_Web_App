"use client";

import { useMemo, useState } from "react";
import styles from "./PalmAnnotation.module.css";

type PalmLineCoords = Array<{ x: number; y: number }>;

type PalmLineCoordinates = {
  heart_line?: PalmLineCoords;
  head_line?: PalmLineCoords;
  life_line?: PalmLineCoords;
  fate_line?: PalmLineCoords;
};

type LineKey = "heart_line" | "head_line" | "life_line" | "fate_line";

type PalmAnnotationProps = {
  imageDataUrl: string;
  coordinates: PalmLineCoordinates;
  className?: string;
  showLabels?: boolean;
  highlightLine?: LineKey | null;
};

const LINE_ORDER: LineKey[] = ["heart_line", "head_line", "life_line", "fate_line"];

const LINE_COLORS: Record<LineKey, string> = {
  heart_line: "#E0533A",
  head_line: "#C89B3C",
  life_line: "#2A8B7E",
  fate_line: "#7B6BA8",
};

const LINE_LABELS: Record<LineKey, string> = {
  heart_line: "Heart",
  head_line: "Head",
  life_line: "Life",
  fate_line: "Fate",
};

const LINE_DRAW_DURATION_MS = 900;
const LINE_DRAW_STAGGER_MS = 200;

/** Catmull-Rom -> cubic bezier path for a smooth curve through the points. */
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const tension = 0.5;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

type LabelPlacement = {
  key: LineKey;
  cx: number;
  cy: number;
  text: string;
  color: string;
};

/** Push overlapping labels apart vertically. Iterates up to 5 passes. */
function deconflictLabels(
  labels: LabelPlacement[],
  minVerticalPx: number,
): LabelPlacement[] {
  const out = labels.map((l) => ({ ...l }));
  for (let pass = 0; pass < 5; pass++) {
    let moved = false;
    const sorted = [...out].sort((a, b) => a.cy - b.cy);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (Math.abs(a.cx - b.cx) > 60) continue;
      const dy = b.cy - a.cy;
      if (dy < minVerticalPx) {
        b.cy = a.cy + minVerticalPx;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

export default function PalmAnnotation({
  imageDataUrl,
  coordinates,
  className,
  showLabels = true,
  highlightLine = null,
}: PalmAnnotationProps) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  );

  const presentLines = useMemo<LineKey[]>(
    () =>
      LINE_ORDER.filter((key) => {
        const pts = coordinates[key];
        return Array.isArray(pts) && pts.length > 0;
      }),
    [coordinates],
  );

  const containerClass = className
    ? `${styles.container} ${className}`
    : styles.container;

  // Empty state: render image alone
  if (presentLines.length === 0) {
    return (
      <div className={containerClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageDataUrl} alt="Palm" className={styles.image} />
      </div>
    );
  }

  const w = naturalSize?.w ?? 0;
  const h = naturalSize?.h ?? 0;
  const diagonal = w && h ? Math.sqrt(w * w + h * h) : 0;
  const strokeWidth = diagonal * 0.006;
  const dotRadius = diagonal * 0.004;
  const labelOffsetPx = diagonal * 0.05;
  const minLabelGapPx = 28;

  // Build line geometry in pixel coordinates (only when we know dimensions).
  const lineData = useMemo(() => {
    if (!w || !h) return [];
    return presentLines.map((key) => {
      const rawPoints = coordinates[key] ?? [];
      const points = rawPoints.map((p) => ({
        x: p.x * w,
        y: p.y * h,
      }));
      return {
        key,
        points,
        path: buildSmoothPath(points),
        color: LINE_COLORS[key],
      };
    });
  }, [presentLines, coordinates, w, h]);

  // Place labels at the END of each line, offset away from image center.
  const labelPlacements = useMemo<LabelPlacement[]>(() => {
    if (!w || !h || !showLabels) return [];
    const cx = w / 2;
    const cy = h / 2;
    const raw: LabelPlacement[] = lineData
      .filter((l) => l.points.length > 0)
      .map((l) => {
        const end = l.points[l.points.length - 1];
        const dx = end.x - cx;
        const dy = end.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
          key: l.key,
          cx: end.x + (dx / dist) * labelOffsetPx,
          cy: end.y + (dy / dist) * labelOffsetPx,
          text: LINE_LABELS[l.key],
          color: l.color,
        };
      });
    return deconflictLabels(raw, minLabelGapPx);
  }, [lineData, w, h, showLabels, labelOffsetPx]);

  return (
    <div className={containerClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageDataUrl}
        alt="Palm"
        className={styles.image}
        onLoad={(e) => {
          const target = e.currentTarget;
          if (target.naturalWidth && target.naturalHeight) {
            setNaturalSize({
              w: target.naturalWidth,
              h: target.naturalHeight,
            });
          }
        }}
      />
      {naturalSize ? (
        <svg
          className={styles.svg}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <filter
              id="palm-line-shadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur in="SourceAlpha" stdDeviation={diagonal * 0.003} />
              <feOffset dx="0" dy={diagonal * 0.0015} result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.55" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {lineData.map((line, idx) => {
            const isHighlighted = highlightLine === line.key;
            const isDimmed = highlightLine !== null && !isHighlighted;
            const baseOpacity =
              highlightLine === null ? 0.75 : isHighlighted ? 1 : 0.35;
            const drawDelay = idx * LINE_DRAW_STAGGER_MS;
            const labelDelay = drawDelay + LINE_DRAW_DURATION_MS;

            return (
              <g
                key={line.key}
                style={{ opacity: baseOpacity }}
                data-line={line.key}
                data-dimmed={isDimmed || undefined}
              >
                <path
                  className={`${styles.line} ${styles.lineDraw}`}
                  d={line.path}
                  stroke={line.color}
                  strokeWidth={strokeWidth}
                  pathLength={1000}
                  style={
                    {
                      "--draw-length": "1000",
                      "--draw-delay": `${drawDelay}ms`,
                    } as React.CSSProperties
                  }
                />
                {line.points.map((pt, i) => (
                  <circle
                    key={i}
                    className={styles.dot}
                    cx={pt.x}
                    cy={pt.y}
                    r={dotRadius}
                    fill={line.color}
                    style={
                      {
                        "--dot-delay": `${labelDelay + i * 30}ms`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </g>
            );
          })}

          {showLabels &&
            labelPlacements.map((label) => {
              const idx = lineData.findIndex((l) => l.key === label.key);
              const labelDelay =
                idx * LINE_DRAW_STAGGER_MS + LINE_DRAW_DURATION_MS;
              const padX = diagonal * 0.018;
              const padY = diagonal * 0.012;
              const fontSize = diagonal * 0.022;
              const textWidth = label.text.length * fontSize * 0.62 + padX * 2;
              const textHeight = fontSize + padY * 2;
              return (
                <g
                  key={label.key}
                  className={styles.labelGroup}
                  style={
                    {
                      "--label-delay": `${labelDelay}ms`,
                    } as React.CSSProperties
                  }
                >
                  <rect
                    className={styles.labelPill}
                    x={label.cx - textWidth / 2}
                    y={label.cy - textHeight / 2}
                    width={textWidth}
                    height={textHeight}
                    rx={textHeight / 2}
                    ry={textHeight / 2}
                    fill={label.color}
                    fillOpacity={0.55}
                    stroke={label.color}
                    strokeOpacity={0.9}
                  />
                  <text
                    className={styles.labelText}
                    x={label.cx}
                    y={label.cy}
                    fontSize={fontSize}
                  >
                    {label.text}
                  </text>
                </g>
              );
            })}
        </svg>
      ) : null}
    </div>
  );
}

export type { PalmAnnotationProps, PalmLineCoords, PalmLineCoordinates };
