"use client";

import { useEffect, useState } from "react";

export default function GradientBlobs() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsLight(document.documentElement.getAttribute("data-theme") === "light");
    };
    checkTheme();
    const obs = new MutationObserver(checkTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: isLight ? 0.4 : 1,
      }}
    >
      <svg
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", opacity: isLight ? 0.04 : 0.08 }}
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
        <circle cx="915"  cy="500" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="980"  cy="360" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1045" cy="430" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="1110" cy="295" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1175" cy="470" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1240" cy="355" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1305" cy="415" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="1370" cy="330" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="80"   cy="590" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="160"  cy="665" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="340"  cy="625" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="490"  cy="700" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="565"  cy="570" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="700"  cy="650" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="770"  cy="720" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="845"  cy="600" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="960"  cy="680" r="1"   fill="#C89B3C" opacity="0.7"/>
        <circle cx="1100" cy="610" r="1.5" fill="#C89B3C" opacity="0.7"/>
        <circle cx="1360" cy="690" r="1"   fill="#C89B3C" opacity="0.7"/>

        {/* ── Constellation 1 — Orion-like (bottom-left) ── */}
        {/* Lines */}
        <line x1="155" y1="700" x2="185" y2="694" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="185" y1="694" x2="215" y2="700" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="95"  y1="720" x2="155" y2="685" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="215" y1="700" x2="275" y2="670" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="155" y1="685" x2="185" y2="694" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="175" y1="760" x2="155" y2="685" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        <line x1="235" y1="810" x2="215" y2="700" stroke="#C89B3C" strokeWidth="0.6" opacity="0.5"/>
        {/* Stars */}
        <circle cx="95"  cy="720" r="2" fill="#C89B3C"/>
        <circle cx="155" cy="685" r="2" fill="#C89B3C"/>
        <circle cx="215" cy="700" r="2" fill="#C89B3C"/>
        <circle cx="275" cy="670" r="2" fill="#C89B3C"/>
        <circle cx="175" cy="760" r="2" fill="#C89B3C"/>
        <circle cx="235" cy="810" r="2" fill="#C89B3C"/>
        <circle cx="155" cy="700" r="2" fill="#C89B3C"/>
        <circle cx="185" cy="694" r="2" fill="#C89B3C"/>
        <circle cx="215" cy="700" r="2" fill="#C89B3C"/>

        {/* ── Constellation 2 — Cassiopeia W (top-right) ── */}
        {/* Lines */}
        <line x1="1090" y1="95" x2="1130" y2="65"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1130" y1="65" x2="1175" y2="88"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1175" y1="88" x2="1215" y2="58"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1215" y1="58" x2="1258" y2="82"  stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        {/* Stars */}
        <circle cx="1090" cy="95" r="1.8" fill="#C89B3C"/>
        <circle cx="1130" cy="65" r="1.8" fill="#C89B3C"/>
        <circle cx="1175" cy="88" r="1.8" fill="#C89B3C"/>
        <circle cx="1215" cy="58" r="1.8" fill="#C89B3C"/>
        <circle cx="1258" cy="82" r="1.8" fill="#C89B3C"/>

        {/* ── Constellation 3 — Leo Triangle (center-left) ── */}
        {/* Lines */}
        <line x1="320" y1="270" x2="395" y2="215" stroke="#C89B3C" strokeWidth="0.5" opacity="0.40"/>
        <line x1="395" y1="215" x2="440" y2="285" stroke="#C89B3C" strokeWidth="0.5" opacity="0.40"/>
        <line x1="440" y1="285" x2="370" y2="330" stroke="#C89B3C" strokeWidth="0.5" opacity="0.40"/>
        <line x1="370" y1="330" x2="320" y2="270" stroke="#C89B3C" strokeWidth="0.5" opacity="0.40"/>
        {/* Stars */}
        <circle cx="320" cy="270" r="1.8" fill="#C89B3C"/>
        <circle cx="395" cy="215" r="1.8" fill="#C89B3C"/>
        <circle cx="370" cy="330" r="1.8" fill="#C89B3C"/>
        <circle cx="440" cy="285" r="1.8" fill="#C89B3C"/>

        {/* ── Constellation 4 — Pleiades cluster (top-center) ── */}
        {/* Lines */}
        <line x1="620" y1="75"  x2="648" y2="58"  stroke="#1A7B6E" strokeWidth="0.4" opacity="0.35"/>
        <line x1="648" y1="58"  x2="672" y2="70"  stroke="#1A7B6E" strokeWidth="0.4" opacity="0.35"/>
        <line x1="672" y1="70"  x2="694" y2="52"  stroke="#1A7B6E" strokeWidth="0.4" opacity="0.35"/>
        <line x1="648" y1="58"  x2="660" y2="88"  stroke="#1A7B6E" strokeWidth="0.4" opacity="0.35"/>
        <line x1="660" y1="88"  x2="640" y2="100" stroke="#1A7B6E" strokeWidth="0.4" opacity="0.35"/>
        <line x1="660" y1="88"  x2="680" y2="95"  stroke="#1A7B6E" strokeWidth="0.4" opacity="0.35"/>
        {/* Stars */}
        <circle cx="620" cy="75"  r="1.5" fill="#1A7B6E"/>
        <circle cx="648" cy="58"  r="1.5" fill="#1A7B6E"/>
        <circle cx="672" cy="70"  r="1.5" fill="#1A7B6E"/>
        <circle cx="694" cy="52"  r="1.5" fill="#1A7B6E"/>
        <circle cx="660" cy="88"  r="1.5" fill="#1A7B6E"/>
        <circle cx="640" cy="100" r="1.5" fill="#1A7B6E"/>
        <circle cx="680" cy="95"  r="1.5" fill="#1A7B6E"/>

        {/* ── Constellation 5 — Southern Cross (bottom-right) ── */}
        {/* Lines */}
        <line x1="1240" y1="780" x2="1335" y2="775" stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        <line x1="1265" y1="775" x2="1295" y2="800" stroke="#C89B3C" strokeWidth="0.5" opacity="0.45"/>
        {/* Stars */}
        <circle cx="1240" cy="780" r="2" fill="#C89B3C"/>
        <circle cx="1285" cy="745" r="2" fill="#C89B3C"/>
        <circle cx="1295" cy="800" r="2" fill="#C89B3C"/>
        <circle cx="1335" cy="775" r="2" fill="#C89B3C"/>
        <circle cx="1265" cy="775" r="2" fill="#C89B3C"/>

        {/* ── Decorative mandala ornament (top-left corner) ── */}
        <g opacity="0.07" transform="translate(-20, -20)">
          <circle cx="0" cy="0" r="160" fill="none" stroke="#C89B3C" strokeWidth="0.5"/>
          <circle cx="0" cy="0" r="120" fill="none" stroke="#C89B3C" strokeWidth="0.4"/>
          <circle cx="0" cy="0" r="80"  fill="none" stroke="#C89B3C" strokeWidth="0.3"/>
          <line x1="0" y1="0" x2="160" y2="0"   stroke="#C89B3C" strokeWidth="0.3"/>
          <line x1="0" y1="0" x2="0"   y2="160" stroke="#C89B3C" strokeWidth="0.3"/>
          <line x1="0" y1="0" x2="113" y2="113" stroke="#C89B3C" strokeWidth="0.3"/>
          <line x1="0" y1="0" x2="160" y2="60"  stroke="#C89B3C" strokeWidth="0.2"/>
          <line x1="0" y1="0" x2="60"  y2="160" stroke="#C89B3C" strokeWidth="0.2"/>
          <polygon
            points="0,-30 8,-10 30,-10 12,4 20,26 0,14 -20,26 -12,4 -30,-10 -8,-10"
            fill="none"
            stroke="#C89B3C"
            strokeWidth="0.4"
          />
        </g>

        {/* ── Decorative arc ornament (bottom-right corner) ── */}
        <g opacity="0.06" transform="translate(1460, 920)">
          <circle cx="0" cy="0" r="200" fill="none" stroke="#1A7B6E" strokeWidth="0.5"/>
          <circle cx="0" cy="0" r="140" fill="none" stroke="#1A7B6E" strokeWidth="0.4"/>
          <circle cx="0" cy="0" r="80"  fill="none" stroke="#1A7B6E" strokeWidth="0.3"/>
        </g>

        {/* ── Faint dot grid ── */}
        <circle cx="200"  cy="150" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="400"  cy="150" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="600"  cy="150" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="800"  cy="150" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1000" cy="150" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1200" cy="150" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="200"  cy="350" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="400"  cy="350" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="600"  cy="350" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="800"  cy="350" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1000" cy="350" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1200" cy="350" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="200"  cy="550" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="400"  cy="550" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="600"  cy="550" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="800"  cy="550" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1000" cy="550" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1200" cy="550" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="200"  cy="750" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="400"  cy="750" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="600"  cy="750" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="800"  cy="750" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1000" cy="750" r="0.5" fill="#C89B3C" opacity="0.3"/>
        <circle cx="1200" cy="750" r="0.5" fill="#C89B3C" opacity="0.3"/>
      </svg>
    </div>
  );
}
