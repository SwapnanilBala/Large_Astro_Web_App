"use client";

/**
 * ZodiacFloater
 *
 * Decorative drifting "fact bubbles" anchored to the left/right edges of the
 * viewport, flanking the centered login panel. Three independent vertical
 * slots per side cycle through a curated bank of zodiac trivia. Bubbles fade
 * in, drift gently upward, fade out, then a fresh fact takes the slot after
 * a randomized pause.
 *
 * Hidden below 1100px to keep the centered panel uncrowded. Honors
 * `prefers-reduced-motion` by rendering one static bubble per side and
 * rotating its fact on a slow interval (no drift, no fade).
 */

import { useEffect, useRef, useState } from "react";
import styles from "./ZodiacFloater.module.css";

type ZodiacFact = {
  sign: string;
  glyph: string;
  fact: string;
};

type Side = "left" | "right";
type SlotIndex = 0 | 1 | 2;
type Phase = "in" | "hold" | "out";

type SlotKey = `${Side}-${SlotIndex}`;

type SlotState = {
  id: number;
  fact: ZodiacFact;
  phase: Phase;
};

// 24 facts: 2 per zodiac sign. Sidereal/Vedic flavor where it fits.
// Each line stays under ~140 chars; sign + U+00B7 middot + fact.
const FACTS: ReadonlyArray<ZodiacFact> = [
  { sign: "Aries", glyph: "♈", fact: "The first sign · ruled by Mars, it carries the spark of new beginnings and the courage to step into the unknown." },
  { sign: "Aries", glyph: "♈", fact: "In Vedic lore the Sun is exalted in Mesha · the spring equinox once anchored the year's true beginning here." },
  { sign: "Taurus", glyph: "♉", fact: "Venus's earthy domain · patient, sensual, and steadfast as the bull that guards the field." },
  { sign: "Taurus", glyph: "♉", fact: "The Pleiades sit on Taurus' shoulder · Vedic seers call these seven sisters Krittika, the flame nymphs." },
  { sign: "Gemini", glyph: "♊", fact: "Castor is not one star but six · a sextuple system bound by gravity, masquerading as a single point of light." },
  { sign: "Gemini", glyph: "♊", fact: "Mercury's airy twins · the messenger sign of curiosity, language, and the threshold between worlds." },
  { sign: "Cancer", glyph: "♋", fact: "The Moon's own house · Vedic tradition names it Karka, the keeper of memory, lineage, and the inner tide." },
  { sign: "Cancer", glyph: "♋", fact: "At its heart lies the Beehive Cluster, M44 · a swarm of nearly a thousand stars Galileo first resolved in 1609." },
  { sign: "Leo", glyph: "♌", fact: "Regulus, the Little King, sits almost exactly on the ecliptic · the Sun crosses it directly each August." },
  { sign: "Leo", glyph: "♌", fact: "In Vedic tradition Simha is the Sun's own house · royalty, gold, and the spine all answer to its rulership." },
  { sign: "Virgo", glyph: "♍", fact: "The second-largest constellation in the sky · Virgo sprawls across 1,294 square degrees of celestial real estate." },
  { sign: "Virgo", glyph: "♍", fact: "Mercury is exalted here · in Vedic lore Kanya holds the discernment that turns raw experience into wisdom." },
  { sign: "Libra", glyph: "♎", fact: "The only zodiac sign represented by an object · once these scales were the claws of the neighboring scorpion." },
  { sign: "Libra", glyph: "♎", fact: "Saturn is exalted in Tula · the cosmic measure that weighs every action against its quiet counterweight." },
  { sign: "Scorpio", glyph: "♏", fact: "Antares, the scorpion's heart, is so vast it would swallow Mars' orbit if dropped where our Sun now stands." },
  { sign: "Scorpio", glyph: "♏", fact: "Vedic astrology calls this sign Vrishchika · tied to Ketu, the south lunar node and keeper of buried karmic threads." },
  { sign: "Sagittarius", glyph: "♐", fact: "Sagittarius points straight at the galactic core · the supermassive black hole Sgr A* lies inside its boundary." },
  { sign: "Sagittarius", glyph: "♐", fact: "Jupiter's fiery domain · in Vedic lore Dhanu is the archer of dharma, aiming the soul toward higher meaning." },
  { sign: "Capricorn", glyph: "♑", fact: "The sea-goat is one of the oldest mythic figures · drawn by the Sumerians more than four thousand years ago." },
  { sign: "Capricorn", glyph: "♑", fact: "Saturn rules here · Makara is the slow climb from the ocean's depths toward the disciplined summit of the world." },
  { sign: "Aquarius", glyph: "♒", fact: "The Aquarid meteor shower each May is debris from Halley's Comet · last seen in 1986 and not due back until 2061." },
  { sign: "Aquarius", glyph: "♒", fact: "Aquarius hosts the Helix Nebula, 650 light-years away · often called the Eye of God, gazing back from the dark." },
  { sign: "Pisces", glyph: "♓", fact: "Two fish swimming in opposite directions · the soul's final dissolve before rebirth into a fresh zodiac round." },
  { sign: "Pisces", glyph: "♓", fact: "Vedic astrology calls Pisces Meena · Jupiter's deepest exaltation, the ocean where wisdom finally rests." },
];

const SIDES: ReadonlyArray<Side> = ["left", "right"];
const SLOT_INDICES: ReadonlyArray<SlotIndex> = [0, 1, 2];

// Initial stagger (ms) so bubbles don't all appear at once on mount.
const INITIAL_DELAYS: Record<SlotKey, number> = {
  "left-0": 0,
  "left-1": 1800,
  "left-2": 3600,
  "right-0": 900,
  "right-1": 2700,
  "right-2": 4500,
};

const FADE_IN_MS = 1200;
const HOLD_MS = 13000;
const FADE_OUT_MS = 1500;
// Total visible lifetime: ~15.7s (within the 14–18s spec).
const MIN_GAP_MS = 3000;
const MAX_GAP_MS = 7000;
// Reduced-motion: rotate the static fact every 10s.
const REDUCED_ROTATE_MS = 10000;

function buildKey(side: Side, slot: SlotIndex): SlotKey {
  return `${side}-${slot}` as SlotKey;
}

function pickFact(exclude: ReadonlySet<string>): ZodiacFact {
  const candidates = FACTS.filter((f) => !exclude.has(f.fact));
  const pool = candidates.length > 0 ? candidates : FACTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ZodiacFloater() {
  // Slots start empty; the effect populates them after mount so SSR output
  // is stable and identical between server and client.
  const [slots, setSlots] = useState<Partial<Record<SlotKey, SlotState>>>({});
  const slotsRef = useRef<Partial<Record<SlotKey, SlotState>>>({});
  const idCounterRef = useRef<number>(0);

  // Keep ref in sync so timer callbacks can read latest state without
  // re-binding the effect on every tick.
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    const reduced = prefersReducedMotion();

    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    const intervals: Array<ReturnType<typeof setInterval>> = [];

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timeouts.push(id);
    };

    const setSlot = (key: SlotKey, next: SlotState | null) => {
      setSlots((prev) => {
        const copy = { ...prev };
        if (next === null) {
          delete copy[key];
        } else {
          copy[key] = next;
        }
        return copy;
      });
    };

    const activeFactStrings = (excludeKey: SlotKey): Set<string> => {
      const active = new Set<string>();
      for (const k of Object.keys(slotsRef.current) as SlotKey[]) {
        if (k === excludeKey) continue;
        const s = slotsRef.current[k];
        if (s) active.add(s.fact.fact);
      }
      return active;
    };

    const cycleAnimated = (key: SlotKey) => {
      const fact = pickFact(activeFactStrings(key));
      idCounterRef.current += 1;
      const id = idCounterRef.current;
      setSlot(key, { id, fact, phase: "in" });

      schedule(() => setSlot(key, { id, fact, phase: "hold" }), FADE_IN_MS);
      schedule(() => setSlot(key, { id, fact, phase: "out" }), FADE_IN_MS + HOLD_MS);
      schedule(() => {
        setSlot(key, null);
        const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
        schedule(() => cycleAnimated(key), gap);
      }, FADE_IN_MS + HOLD_MS + FADE_OUT_MS);
    };

    if (reduced) {
      // One static bubble per side (slot 0); rotate the fact every 10s.
      for (const side of SIDES) {
        const key = buildKey(side, 0);
        const seed = pickFact(activeFactStrings(key));
        idCounterRef.current += 1;
        setSlot(key, { id: idCounterRef.current, fact: seed, phase: "hold" });

        const interval = setInterval(() => {
          const next = pickFact(activeFactStrings(key));
          idCounterRef.current += 1;
          setSlot(key, { id: idCounterRef.current, fact: next, phase: "hold" });
        }, REDUCED_ROTATE_MS);
        intervals.push(interval);
      }
    } else {
      for (const side of SIDES) {
        for (const slot of SLOT_INDICES) {
          const key = buildKey(side, slot);
          schedule(() => cycleAnimated(key), INITIAL_DELAYS[key]);
        }
      }
    }

    return () => {
      for (const t of timeouts) clearTimeout(t);
      for (const i of intervals) clearInterval(i);
    };
    // Effect intentionally runs once on mount; the timer chain re-schedules
    // itself, so we deliberately avoid re-binding on slot updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotClass = (slot: SlotIndex): string => {
    if (slot === 0) return styles.slotTop;
    if (slot === 1) return styles.slotMid;
    return styles.slotBottom;
  };

  const phaseClass = (phase: Phase, side: Side): string => {
    if (phase === "in") return side === "left" ? styles.bubbleInLeft : styles.bubbleInRight;
    if (phase === "out") return side === "left" ? styles.bubbleOutLeft : styles.bubbleOutRight;
    return side === "left" ? styles.bubbleHoldLeft : styles.bubbleHoldRight;
  };

  return (
    <div className={styles.layer} aria-hidden="true">
      {SIDES.map((side) =>
        SLOT_INDICES.map((slot) => {
          const key = buildKey(side, slot);
          const state = slots[key];
          const sideClass = side === "left" ? styles.columnLeft : styles.columnRight;
          if (!state) {
            return <div key={key} className={`${styles.slot} ${sideClass} ${slotClass(slot)}`} />;
          }
          return (
            <div key={key} className={`${styles.slot} ${sideClass} ${slotClass(slot)}`}>
              <div key={state.id} className={`${styles.bubble} ${phaseClass(state.phase, side)}`}>
                <div className={styles.signLine}>
                  <span className={styles.glyph}>{state.fact.glyph}</span>
                  <span className={styles.signName}>{state.fact.sign}</span>
                </div>
                <p className={styles.factText}>{state.fact.fact}</p>
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
}
