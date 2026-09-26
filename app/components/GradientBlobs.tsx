"use client";

import { useMemo, useSyncExternalStore } from "react";

/* 
 * Constellation star-field background with time-of-day color shifting
 * Night: Deep purple/indigo (0-5h, 20-24h)
 * Dawn: Soft coral/gold (5-8h)  
 * Day: Aqua/teal (8-17h)
 * Dusk: Rose/violet (17-20h)
 */

interface TimeOfDay {
  phase: "night" | "dawn" | "day" | "dusk";
  accentColor: string;
  secondaryColor: string;
  glowOpacity: number;
}

type Phase = TimeOfDay["phase"];

const TIME_OF_DAY: Record<Phase, TimeOfDay> = {
  dawn: {
    phase: "dawn",
    accentColor: "#E8A87C", // Coral/gold
    secondaryColor: "#F2C26C",
    glowOpacity: 0.15,
  },
  day: {
    phase: "day",
    accentColor: "#1A7B6E", // Aqua/teal
    secondaryColor: "#6CE1D4",
    glowOpacity: 0.12,
  },
  dusk: {
    phase: "dusk",
    accentColor: "#B85C8A", // Rose/violet
    secondaryColor: "#8C64DC",
    glowOpacity: 0.15,
  },
  night: {
    phase: "night",
    accentColor: "#4A3B7A", // Deep purple/indigo
    secondaryColor: "#1A7B6E",
    glowOpacity: 0.18,
  },
};

function currentPhase(): Phase {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

/* Re-read once a minute, as the interval this replaced did. */
function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

/*
 * The server renders night, and so does hydration; the visitor's own hour
 * arrives on the next render. The server used to render the phase for its
 * own clock -- UTC on Vercel -- which a visitor in another hour hydrated
 * against, and a mismatched attribute is not patched, so the wrong palette
 * could sit there until the phase next changed.
 */
const phaseOnTheServer = (): Phase => "night";

const COARSE_POINTER = "(pointer: coarse)";

/* Mobile is a coarse pointer or a narrow window. The width half is why this
   listens to resize as well as to the pointer query. */
function subscribeToViewport(onChange: () => void) {
  const list = window.matchMedia(COARSE_POINTER);
  list.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    list.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

const readIsMobile = () => window.matchMedia(COARSE_POINTER).matches || window.innerWidth < 768;
const desktopOnTheServer = () => false;

export default function GradientBlobs() {
  const isMobile = useSyncExternalStore(subscribeToViewport, readIsMobile, desktopOnTheServer);
  const phase = useSyncExternalStore(subscribeToClock, currentPhase, phaseOnTheServer);
  const timeOfDay = TIME_OF_DAY[phase];

  const accentFill = useMemo(() => timeOfDay.accentColor, [timeOfDay]);
  const secondaryFill = useMemo(() => timeOfDay.secondaryColor, [timeOfDay]);

  // On mobile: render a much simpler background (just a few dots, no constellations)
  if (isMobile) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: 0.7,
          background: `radial-gradient(ellipse at 50% 0%, ${accentFill}20 0%, transparent 50%)`,
        }}
      >
        <svg
          viewBox="0 0 400 800"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: "100%", height: "100%", opacity: 0.06 }}
        >
          {/* Minimal scatter stars for mobile — 18 dots with time-of-day colors */}
          <circle cx="40" cy="60" r="1" fill={accentFill} opacity="0.6"/>
          <circle cx="120" cy="140" r="1.2" fill={accentFill} opacity="0.5"/>
          <circle cx="250" cy="80" r="1" fill={secondaryFill} opacity="0.6"/>
          <circle cx="340" cy="200" r="1.2" fill={accentFill} opacity="0.5"/>
          <circle cx="80" cy="320" r="1" fill={secondaryFill} opacity="0.6"/>
          <circle cx="200" cy="260" r="1.2" fill={accentFill} opacity="0.5"/>
          <circle cx="310" cy="380" r="1" fill={secondaryFill} opacity="0.5"/>
          <circle cx="60" cy="480" r="1.2" fill={accentFill} opacity="0.6"/>
          <circle cx="180" cy="440" r="1" fill={accentFill} opacity="0.5"/>
          <circle cx="350" cy="520" r="1.2" fill={secondaryFill} opacity="0.6"/>
          <circle cx="100" cy="600" r="1" fill={accentFill} opacity="0.5"/>
          <circle cx="280" cy="640" r="1.2" fill={accentFill} opacity="0.5"/>
          <circle cx="50" cy="720" r="1" fill={secondaryFill} opacity="0.6"/>
          <circle cx="220" cy="760" r="1.2" fill={accentFill} opacity="0.5"/>
          <circle cx="360" cy="700" r="1" fill={accentFill} opacity="0.5"/>
          <circle cx="150" cy="180" r="1" fill={secondaryFill} opacity="0.4"/>
          <circle cx="300" cy="550" r="1" fill={accentFill} opacity="0.4"/>
          <circle cx="240" cy="400" r="1.2" fill={secondaryFill} opacity="0.4"/>
        </svg>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: 1,
        background: `radial-gradient(ellipse at 20% 10%, ${accentFill}18 0%, transparent 40%),
             radial-gradient(ellipse at 80% 90%, ${secondaryFill}12 0%, transparent 35%)`,
        transition: "background 2s ease",
      }}
    >
      <svg
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", opacity: 0.08 }}
      >
        {/* ── Background scatter stars ── */}
        <circle cx="72"   cy="43"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="145"  cy="130" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="230"  cy="58"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="310"  cy="195" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="388"  cy="82"  r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="460"  cy="168" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="535"  cy="38"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="590"  cy="205" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="660"  cy="130" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="730"  cy="55"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="795"  cy="175" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="860"  cy="95"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="920"  cy="220" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="985"  cy="48"  r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="1050" cy="160" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1115" cy="30"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1180" cy="185" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="1250" cy="115" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1315" cy="200" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1380" cy="70"  r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="50"   cy="310" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="120"  cy="420" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="195"  cy="365" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="265"  cy="480" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="345"  cy="395" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="485"  cy="455" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="560"  cy="320" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="640"  cy="490" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="715"  cy="380" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="780"  cy="440" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="850"  cy="310" r="1.5" fill="#C89B3C" opacity="0.7"/>

        {/* ── Constellation 1 — Orion-like (bottom-left) ── */}
        <line x1="155" y1="700" x2="185" y2="694" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="185" y1="694" x2="215" y2="700" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="95"  y1="720" x2="155" y2="685" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="215" y1="700" x2="275" y2="670" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <circle cx="95"  cy="720" r="2" fill="#C89B3C"/>
        <circle cx="155" cy="685" r="2" fill="#C89B3C"/>
        <circle cx="215" cy="700" r="2" fill="#C89B3C"/>
        <circle cx="275" cy="670" r="2" fill="#C89B3C"/>

        {/* ── Constellation 2 — Cassiopeia W (top-right) ── */}
        <line x1="1090" y1="95" x2="1130" y2="65"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1130" y1="65" x2="1175" y2="88"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1175" y1="88" x2="1215" y2="58"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1215" y1="58" x2="1258" y2="82"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <circle cx="1090" cy="95" r="1.8" fill="#C89B3C"/>
        <circle cx="1130" cy="65" r="1.8" fill="#C89B3C"/>
        <circle cx="1175" cy="88" r="1.8" fill="#C89B3C"/>
        <circle cx="1215" cy="58" r="1.8" fill="#C89B3C"/>
        <circle cx="1258" cy="82" r="1.8" fill="#C89B3C"/>

        {/* ── Decorative mandala ornament (top-left corner) ── */}
        <g opacity="0.07" transform="translate(-20, -20)">
          <circle cx="0" cy="0" r="160" fill="none" stroke="#C89B3C" strokeWidth="0.5"/>
          <circle cx="0" cy="0" r="120" fill="none" stroke="#C89B3C" strokeWidth="0.4"/>
          <circle cx="0" cy="0" r="80"  fill="none" stroke="#C89B3C" strokeWidth="0.3"/>
        </g>

        {/* ── Decorative arc ornament (bottom-right corner) ── */}
        <g opacity="0.06" transform="translate(1460, 920)">
          <circle cx="0" cy="0" r="200" fill="none" stroke="#1A7B6E" strokeWidth="0.5"/>
          <circle cx="0" cy="0" r="140" fill="none" stroke="#1A7B6E" strokeWidth="0.4"/>
        </g>
      </svg>
    </div>
  );
}
