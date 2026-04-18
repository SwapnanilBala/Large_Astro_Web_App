"use client";

const GLYPH_MAP: Record<string, string> = {
  Aries:       "\u2648",
  Taurus:      "\u2649",
  Gemini:      "\u264A",
  Cancer:      "\u264B",
  Leo:         "\u264C",
  Virgo:       "\u264D",
  Libra:       "\u264E",
  Scorpio:     "\u264F",
  Sagittarius: "\u2650",
  Capricorn:   "\u2651",
  Aquarius:    "\u2652",
  Pisces:      "\u2653",
};

type Tone = "gold" | "muted" | "active";

type Props = {
  sign: string;
  size?: number;
  tone?: Tone;
  className?: string;
};

export default function ZodiacGlyph({ sign, size = 32, tone = "gold", className }: Props) {
  const glyph = GLYPH_MAP[sign];
  if (!glyph) return null;

  const gradientId = `zg-${sign}-${tone}`;
  const stops =
    tone === "muted"
      ? [
          { offset: "0%", color: "rgba(232, 200, 122, 0.55)" },
          { offset: "100%", color: "rgba(200, 155, 60, 0.45)" },
        ]
      : tone === "active"
      ? [
          { offset: "0%", color: "#FFE3A6" },
          { offset: "100%", color: "#E8B040" },
        ]
      : [
          { offset: "0%", color: "#F2D489" },
          { offset: "100%", color: "#C89B3C" },
        ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label={sign}
      role="img"
      className={className}
      style={{ display: "inline-block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {stops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={tone === "active" ? 1.1 : 0.35} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontSize="22"
        fontFamily="'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif"
        fontWeight="600"
        fill={`url(#${gradientId})`}
        stroke="rgba(60, 30, 10, 0.45)"
        strokeWidth="0.6"
        paintOrder="stroke fill"
        filter={`url(#${gradientId}-glow)`}
      >
        {glyph}
      </text>
    </svg>
  );
}

export { GLYPH_MAP };
