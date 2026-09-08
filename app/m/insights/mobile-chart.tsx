"use client";

import { useMemo, useState } from "react";
import type { HousePlacement, PlanetPosition } from "@/lib/astro-types";
import {
  CX, CY, ZODIAC_R, INNER_R, PLANET_R, HOUSE_NUM_R,
  PLANET_SYMBOLS, PLANET_COLORS, SIGN_SYMBOLS, SIGN_ORDER,
  ELEMENT_MAP,
  lonToAngle, polarToCartesian, describeWedge, spreadAngles,
} from "@/lib/constellation-geometry";
import styles from "./mobile-chart.module.css";

/*
 * The birth wheel, for handsets.
 *
 * Same geometry as the desktop chart — both read lib/constellation-geometry —
 * but drawn as plain SVG. The desktop component is built on framer-motion,
 * which is not reachable from /m at all; adding it would cost tens of KB
 * gzipped against roughly 5KB of headroom, to animate a chart onto a screen
 * where it is already the largest thing.
 *
 * Dropped along with the animation: the star field, aspect lines, and the
 * hover tooltip. At 335px the first two are visual noise and the third has no
 * input to fire it. Tapping a planet reveals its detail in a line beneath the
 * wheel instead, which needs no positioning maths and cannot fall off-screen.
 */

type Props = {
  ascendantSign: string;
  houses: HousePlacement[];
  planets?: PlanetPosition[];
};

type Placed = {
  name: string;
  sign: string;
  degree: number;
  house: number;
  retrograde: boolean;
  angle: number;
};

// The mobile wheel has no stars or animation to lift the band from the sky,
// so its elemental wash needs a little more presence than the shared chart
// geometry defaults. It remains deliberately translucent to preserve the
// calm, nocturnal treatment.
const MOBILE_ELEMENT_COLORS: Record<"fire" | "earth" | "air" | "water", string> = {
  fire: "rgba(255,100,80,0.13)",
  earth: "rgba(100,200,120,0.12)",
  air: "rgba(100,180,255,0.13)",
  water: "rgba(160,100,220,0.13)",
};

export default function MobileChart({ ascendantSign, houses, planets = [] }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const placed = useMemo<Placed[]>(() => {
    const drawable = planets.filter((p) => PLANET_SYMBOLS[p.name]);
    /* Nudge apart anything that would overlap before assigning final angles. */
    const spread = spreadAngles(drawable.map((p) => lonToAngle(p.longitude)));
    return drawable.map((p, i) => ({
      name: p.name,
      sign: p.sign,
      degree: p.degree_in_sign ?? 0,
      house: p.house ?? 0,
      retrograde: Boolean(p.is_retrograde),
      angle: spread[i],
    }));
  }, [planets]);

  /* House cusps come from the ascendant: house 1 starts at the rising sign. */
  const ascIndex = SIGN_ORDER.indexOf(ascendantSign as (typeof SIGN_ORDER)[number]);

  const active = placed.find((p) => p.name === selected) ?? null;

  return (
    <figure className={styles.wrap}>
      <svg
        viewBox="0 0 600 600"
        className={styles.svg}
        role="img"
        aria-label={`Birth wheel for ${ascendantSign} ascendant with ${placed.length} grahas`}
      >
        <defs>
          <radialGradient id="mcCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(212,165,116,0.28)" />
            <stop offset="100%" stopColor="rgba(212,165,116,0)" />
          </radialGradient>
        </defs>

        {/* Zodiac band, tinted by element */}
        {SIGN_ORDER.map((sign, i) => {
          const start = lonToAngle(i * 30);
          const end = lonToAngle((i + 1) * 30);
          return (
            <path
              key={sign}
              d={describeWedge(CX, CY, INNER_R, ZODIAC_R, start, end)}
              fill={MOBILE_ELEMENT_COLORS[ELEMENT_MAP[sign]]}
              stroke="rgba(244,214,162,0.34)"
              strokeWidth="1.1"
            />
          );
        })}

        {/* Sign glyphs on the rim */}
        {SIGN_ORDER.map((sign, i) => {
          const pos = polarToCartesian(CX, CY, (ZODIAC_R + INNER_R) / 2, lonToAngle(i * 30 + 15));
          return (
            <text
              key={sign}
              x={pos.x}
              y={pos.y}
              className={styles.signGlyph}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {/* Keep the glyphs in the wheel's gold ink instead of falling
                  back to coloured emoji, which is harder to read at handset size. */}
              {`${SIGN_SYMBOLS[sign]}\uFE0E`}
            </text>
          );
        })}

        {/* House spokes and numbers */}
        {houses.map((house, i) => {
          const startLon = ((ascIndex + i) % 12) * 30;
          const spoke = lonToAngle(startLon);
          const outer = polarToCartesian(CX, CY, INNER_R, spoke);
          const inner = polarToCartesian(CX, CY, 70, spoke);
          const label = polarToCartesian(CX, CY, HOUSE_NUM_R, lonToAngle(startLon + 15));
          return (
            <g key={house.house_number}>
              <line
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="rgba(244,214,162,0.28)" strokeWidth="1" strokeDasharray="3 5"
              />
              <text
                x={label.x} y={label.y}
                className={styles.houseNum}
                textAnchor="middle" dominantBaseline="central"
              >
                {house.house_number}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="rgba(244,214,162,0.38)" strokeWidth="1.25" />
        <circle cx={CX} cy={CY} r="88" fill="url(#mcCore)" />

        {/* Centre: the lagna */}
        <text x={CX} y={CY - 20} className={styles.coreKicker} textAnchor="middle">RASI</text>
        <text x={CX} y={CY + 12} className={styles.coreSign} textAnchor="middle">
          {ascendantSign}
        </text>
        <text x={CX} y={CY + 40} className={styles.coreKicker} textAnchor="middle">LAGNA</text>

        {/* Grahas */}
        {placed.map((p) => {
          const pos = polarToCartesian(CX, CY, PLANET_R, p.angle);
          const colour = PLANET_COLORS[p.name] ?? "#f2c26c";
          const isOn = selected === p.name;
          return (
            <g
              key={p.name}
              onClick={() => setSelected(isOn ? null : p.name)}
              className={styles.planet}
              role="button"
              tabIndex={0}
              aria-label={`${p.name} in ${p.sign}, house ${p.house}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(isOn ? null : p.name);
                }
              }}
            >
              {/* Generous invisible target: the glyph itself is far under 44px. */}
              <circle cx={pos.x} cy={pos.y} r="30" fill="transparent" />
              <circle
                cx={pos.x} cy={pos.y} r={isOn ? 20 : 16}
                fill={`${colour}${isOn ? "55" : "33"}`}
                stroke={colour}
                strokeWidth={isOn ? 2.25 : 1.5}
              />
              <text
                x={pos.x} y={pos.y}
                className={styles.planetGlyph}
                fill={colour}
                textAnchor="middle" dominantBaseline="central"
              >
                {PLANET_SYMBOLS[p.name]}
              </text>
              {p.retrograde && (
                <text
                  x={pos.x + 19} y={pos.y - 15}
                  className={styles.retro}
                  fill={colour}
                  textAnchor="middle"
                >
                  R
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className={styles.caption} aria-live="polite">
        {active ? (
          <>
            <span className={styles.captionName} style={{ color: PLANET_COLORS[active.name] }}>
              {PLANET_SYMBOLS[active.name]} {active.name}
              {active.retrograde ? " ℞" : ""}
            </span>
            <span className={styles.captionDetail}>
              {active.sign} {Math.floor(active.degree)}° · house {active.house}
            </span>
          </>
        ) : (
          <span className={styles.captionHint}>Tap a graha for its placement</span>
        )}
      </figcaption>
    </figure>
  );
}
