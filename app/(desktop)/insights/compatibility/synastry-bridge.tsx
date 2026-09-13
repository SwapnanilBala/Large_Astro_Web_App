"use client";

import { useMemo } from "react";
import type { SynastryAspectInfo } from "@/lib/engines/compatibility-service";

/*
 * The inter-chart aspects, drawn as the thing they actually are.
 *
 * What this replaces: one card per aspect in a flat grid. Each card carried
 * four fields -- two planet names, an aspect type, an orb -- and there are
 * routinely twenty or more, so the section was a table wearing card chrome. It
 * also lost the two things a reader wants from this data at a glance: which
 * contacts are the tight ones, and whether the balance runs supportive or
 * frictional. `orb` was printed and then never used for anything, so the
 * closest aspect in the chart looked exactly as important as the widest.
 *
 * A synastry aspect is a relation between one person's planet and another's.
 * That is a bipartite graph, so this draws it as one: your planets on the left
 * rail, theirs on the right, a line for every contact between them. Line
 * weight carries orb -- tighter is heavier -- and style carries polarity, so
 * both of the missing readings are available without reading a single number.
 *
 * The rails are also the only place on this page after the header where the
 * two people stay visibly separate. Everything else -- score, themes, married
 * life -- is correctly about the pair as a unit, which is exactly why one
 * section that keeps them apart earns its place.
 */

type SynastryBridgeProps = {
  aspects: SynastryAspectInfo[];
  primaryName: string;
  partnerName: string;
};

/* Drawing order for the rails. Anything the engine emits that is not on this
   list still renders -- it sorts to the end rather than vanishing, because a
   planet silently missing from a chart reading is a worse failure than an
   unfamiliar one appearing in an odd position. */
const PLANET_ORDER = [
  "Ascendant",
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Rahu",
  "Ketu",
];

const ROW_HEIGHT = 30;
const TOP_PAD = 14;
const BOTTOM_PAD = 14;
const LEFT_RAIL = 148;
const RIGHT_RAIL = 492;
const VIEW_WIDTH = 640;

/* Orbs in this engine run 0 to about 8 degrees. A 0-degree contact is exact
   and a 7-degree one is barely speaking, so weight is mapped across that span
   rather than normalised to whatever happens to be widest in this particular
   pair -- otherwise a chart whose tightest aspect is 6 degrees would draw it
   as thick as an exact one somewhere else. */
const MAX_ORB = 8;

function strokeWidthForOrb(orb: number): number {
  const tightness = Math.max(0, Math.min(1, 1 - orb / MAX_ORB));
  return 1 + tightness * 2.6;
}

function rankPlanet(planet: string): number {
  const index = PLANET_ORDER.indexOf(planet);
  return index === -1 ? PLANET_ORDER.length : index;
}

function orderRail(planets: Set<string>): string[] {
  return [...planets].sort((a, b) => rankPlanet(a) - rankPlanet(b) || a.localeCompare(b));
}

export default function SynastryBridge({
  aspects,
  primaryName,
  partnerName,
}: SynastryBridgeProps) {
  const model = useMemo(() => {
    const leftRail = orderRail(new Set(aspects.map((a) => a.primary_planet)));
    const rightRail = orderRail(new Set(aspects.map((a) => a.partner_planet)));

    const leftY = new Map(leftRail.map((p, i) => [p, TOP_PAD + i * ROW_HEIGHT + ROW_HEIGHT / 2]));
    const rightY = new Map(rightRail.map((p, i) => [p, TOP_PAD + i * ROW_HEIGHT + ROW_HEIGHT / 2]));

    /* Widest first, so the tight contacts are painted last and sit on top of
       the loose ones they cross. */
    const links = [...aspects]
      .sort((a, b) => b.orb - a.orb)
      .map((aspect) => ({
        aspect,
        y1: leftY.get(aspect.primary_planet) ?? 0,
        y2: rightY.get(aspect.partner_planet) ?? 0,
      }));

    const height =
      TOP_PAD + Math.max(leftRail.length, rightRail.length) * ROW_HEIGHT + BOTTOM_PAD;

    const supportive = aspects.filter((a) => a.harmonious).length;

    return { leftRail, rightRail, leftY, rightY, links, height, supportive };
  }, [aspects]);

  if (aspects.length === 0) {
    return (
      <p className="section-intro">
        No inter-chart aspects came back inside the orbs this engine uses.
      </p>
    );
  }

  const { leftRail, rightRail, leftY, rightY, links, height, supportive } = model;
  const friction = aspects.length - supportive;

  return (
    <div className="bridge">
      <div className="bridge-rail-heads">
        <span className="bridge-rail-head bridge-rail-head--primary">{primaryName}</span>
        <span className="bridge-rail-head bridge-rail-head--partner">{partnerName}</span>
      </div>

      {/* The picture is for sighted readers; the list below carries the same
          facts for everyone else. aria-hidden rather than role="img" with a
          long label, because a twenty-aspect summary read as one string is
          worse than the list. */}
      <svg
        className="bridge-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <g className="bridge-links">
          {links.map(({ aspect, y1, y2 }) => {
            const key = `${aspect.primary_planet}-${aspect.partner_planet}-${aspect.aspect_type}`;
            const mid = (LEFT_RAIL + RIGHT_RAIL) / 2;
            const d = `M ${LEFT_RAIL} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${RIGHT_RAIL} ${y2}`;
            return (
              <g
                key={key}
                className={`bridge-link ${aspect.harmonious ? "is-supportive" : "is-friction"}`}
              >
                {/* A 1px line is not a pointer target. This invisible twin is
                    what the cursor actually finds. */}
                <path className="bridge-link-hit" d={d} />
                <path
                  className="bridge-link-line"
                  d={d}
                  strokeWidth={strokeWidthForOrb(aspect.orb)}
                />
                <title>
                  {`${aspect.primary_planet} ${aspect.aspect_type} ${aspect.partner_planet} — orb ${aspect.orb.toFixed(2)}°, ${aspect.harmonious ? "supportive" : "friction"}`}
                </title>
              </g>
            );
          })}
        </g>

        <g className="bridge-nodes">
          {leftRail.map((planet) => (
            <g key={`l-${planet}`}>
              <text className="bridge-label bridge-label--left" x={LEFT_RAIL - 14} y={leftY.get(planet)}>
                {planet}
              </text>
              <circle className="bridge-node" cx={LEFT_RAIL} cy={leftY.get(planet)} r={4.5} />
            </g>
          ))}
          {rightRail.map((planet) => (
            <g key={`r-${planet}`}>
              <circle className="bridge-node" cx={RIGHT_RAIL} cy={rightY.get(planet)} r={4.5} />
              <text className="bridge-label bridge-label--right" x={RIGHT_RAIL + 14} y={rightY.get(planet)}>
                {planet}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <p className="bridge-legend">
        <span className="bridge-key bridge-key--supportive" aria-hidden="true" />
        {supportive} supportive
        <span className="bridge-key bridge-key--friction" aria-hidden="true" />
        {friction} friction
        <span className="bridge-legend-note">thicker line, tighter orb</span>
      </p>

      <details className="bridge-table">
        <summary>Every aspect, as a list</summary>
        <ul>
          {[...aspects]
            .sort((a, b) => a.orb - b.orb)
            .map((aspect) => (
              <li
                key={`${aspect.primary_planet}-${aspect.partner_planet}-${aspect.aspect_type}`}
                data-polarity={aspect.harmonious ? "supportive" : "friction"}
              >
                <span className="bridge-table-pair">
                  {aspect.primary_planet} {aspect.aspect_type} {aspect.partner_planet}
                </span>
                <span className="bridge-table-orb">{aspect.orb.toFixed(2)}°</span>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}
