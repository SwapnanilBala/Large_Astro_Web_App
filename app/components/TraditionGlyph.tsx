import type { ReactElement } from "react";

type TraditionKey =
  | "lahiri"
  | "raman"
  | "krishnamurti"
  | "fagan_bradley"
  | "pushyapaksha"
  | "yukteshwar";

type TraditionGlyphProps = {
  tradition: TraditionKey;
  className?: string;
};

const commonProps = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/* Lahiri: a four-point star, echoing the Chitra/Spica fixed-star anchor. */
function LahiriGlyph() {
  return (
    <svg {...commonProps}>
      <path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z" />
    </svg>
  );
}

/* Raman: a signet ring, for a named practitioner's lineage. */
function RamanGlyph() {
  return (
    <svg {...commonProps}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
    </svg>
  );
}

/* Krishnamurti: a subdivided dial, for the KP sub-lord technique. */
function KrishnamurtiGlyph() {
  return (
    <svg {...commonProps}>
      <line x1="18" y1="12" x2="21" y2="12" />
      <line x1="15" y1="17.2" x2="16.5" y2="19.8" />
      <line x1="9" y1="17.2" x2="7.5" y2="19.8" />
      <line x1="6" y1="12" x2="3" y2="12" />
      <line x1="9" y1="6.8" x2="7.5" y2="4.2" />
      <line x1="15" y1="6.8" x2="16.5" y2="4.2" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Fagan-Bradley: a compass rose, for the Western sidereal standard. */
function FaganBradleyGlyph() {
  return (
    <svg {...commonProps}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="6.5" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M12 4 L14 8 L12 6.7 L10 8 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Pushyapaksha: a loose star cluster, echoing its delta Cancri anchor. */
function PushyapakshaGlyph() {
  return (
    <svg {...commonProps}>
      <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* Yukteshwar: a single-turn spiral, echoing his writing on precessional cycles. */
function YukteshwarGlyph() {
  return (
    <svg {...commonProps}>
      <path d="M12 5 A7 7 0 1 1 5 12 A5 5 0 1 1 10 16 A3 3 0 1 1 13.5 13.5" />
    </svg>
  );
}

const GLYPHS: Record<TraditionKey, () => ReactElement> = {
  lahiri: LahiriGlyph,
  raman: RamanGlyph,
  krishnamurti: KrishnamurtiGlyph,
  fagan_bradley: FaganBradleyGlyph,
  pushyapaksha: PushyapakshaGlyph,
  yukteshwar: YukteshwarGlyph,
};

export default function TraditionGlyph({ tradition, className }: TraditionGlyphProps) {
  const Glyph = GLYPHS[tradition];
  return (
    <span className={className}>
      <Glyph />
    </span>
  );
}
