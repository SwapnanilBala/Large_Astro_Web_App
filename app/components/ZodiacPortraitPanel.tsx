"use client";

import Image from "next/image";
import { ZODIAC_IMAGE_MAP } from "./ZodiacSignImage";

const SIGN_DATES: Record<string, string> = {
  Aries:       "Mar 21 — Apr 19",
  Taurus:      "Apr 20 — May 20",
  Gemini:      "May 21 — Jun 20",
  Cancer:      "Jun 21 — Jul 22",
  Leo:         "Jul 23 — Aug 22",
  Virgo:       "Aug 23 — Sep 22",
  Libra:       "Sep 23 — Oct 22",
  Scorpio:     "Oct 23 — Nov 21",
  Sagittarius: "Nov 22 — Dec 21",
  Capricorn:   "Dec 22 — Jan 19",
  Aquarius:    "Jan 20 — Feb 18",
  Pisces:      "Feb 19 — Mar 20",
};

const SIGN_ELEMENT: Record<string, string> = {
  Aries: "Fire",   Taurus: "Earth", Gemini: "Air",   Cancer: "Water",
  Leo:   "Fire",   Virgo:  "Earth", Libra:  "Air",   Scorpio: "Water",
  Sagittarius: "Fire", Capricorn: "Earth", Aquarius: "Air", Pisces: "Water",
};

const SIGN_RULER: Record<string, string> = {
  Aries: "Mars",    Taurus: "Venus",   Gemini: "Mercury", Cancer: "Moon",
  Leo:   "Sun",     Virgo:  "Mercury", Libra:  "Venus",   Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

type Props = {
  sign: string | null;
  /** Optional positional offset — defaults are centered overlay */
  className?: string;
  style?: React.CSSProperties;
};

export default function ZodiacPortraitPanel({ sign, className, style }: Props) {
  const active = sign && ZODIAC_IMAGE_MAP[sign] ? sign : null;
  const src = active ? ZODIAC_IMAGE_MAP[active] : null;

  return (
    <div
      className={`zodiac-portrait-panel ${active ? "is-visible" : ""} ${className ?? ""}`}
      aria-hidden={!active}
      style={style}
    >
      {/* Ornate gold corner filigrees */}
      <span className="zpp-corner zpp-corner-tl" aria-hidden="true" />
      <span className="zpp-corner zpp-corner-tr" aria-hidden="true" />
      <span className="zpp-corner zpp-corner-bl" aria-hidden="true" />
      <span className="zpp-corner zpp-corner-br" aria-hidden="true" />

      <div className="zpp-frame">
        <div className="zpp-photo-wrap">
          {src && (
            <Image
              key={active}
              src={src}
              alt={active ?? ""}
              width={240}
              height={240}
              className="zpp-photo"
              priority={false}
            />
          )}
          <span className="zpp-photo-vignette" aria-hidden="true" />
        </div>

        <div className="zpp-info">
          <h3 className="zpp-name">{active ?? ""}</h3>
          <p className="zpp-dates">{active ? SIGN_DATES[active] : ""}</p>
          <div className="zpp-meta">
            <span className="zpp-chip">{active ? SIGN_ELEMENT[active] : ""}</span>
            <span className="zpp-chip">{active ? `Ruled by ${SIGN_RULER[active]}` : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
