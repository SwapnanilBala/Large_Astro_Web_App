"use client";

import { useState, memo } from "react";
import type { YogaDetectionResult } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "\u2609",
  Moon: "\u263D",
  Mercury: "\u263F",
  Venus: "\u2640",
  Mars: "\u2642",
  Jupiter: "\u2643",
  Saturn: "\u2644",
  Rahu: "\u260A",
  Ketu: "\u260B",
};

type StrengthGroup = "strong" | "moderate" | "weak";

interface YogaWithLifetimeImplications extends YogaDetectionResult {
  lifetimeImplications: string;
}

const YOGA_LIFETIME_IMPLICATIONS: Record<string, string> = {
  "Ruchaka": "Strong willpower and leadership drive throughout life. You're likely to achieve authority in your chosen field.",
  "Bhadra": "Enhanced intellect, communication skills, and business acumen. Success in intellectual pursuits, trade, and commerce.",
  "Hamsa": "Wisdom, refinement, and spiritual inclinations define your lifetime journey. Grace and elegance in all endeavors.",
  "Malavya": "Appreciation for beauty, arts, and comfort. Strong personal magnetism and success in creative pursuits and relationships.",
  "Shashasasra": "Powerful influence and destructive tendencies if challenged. Gives strength to overcome any opposition.",
  "Budha-Aditya": "Blending intellect with vigor. Strong communicative abilities paired with decisive action.",
  "Lakshmi Yoga": "Consistent material accumulation throughout life. Wealth tends to flow but requires wise management.",
  "Neecha Bhanga": "Overcoming early setbacks to achieve significant success. Life often involves transformation and redemption.",
  "Gaja Kesari": "Powerful intellect and humanitarian concerns. Life marked by influence, respect, and achievement.",
  "Pancha Mahapurusha": "One of five great yogas. Bestows unique talents and life purpose depending on which yoga is present.",
  "Raja Yoga": "Political success, authority, and material prosperity. Ability to rise to positions of influence.",
  "Dhana Yoga": "Consistent wealth accumulation and financial security throughout life.",
  "Saraswati Yoga": "Scholarly pursuits, wisdom, and intellectual achievements define your lifetime expression.",
  "Parvata Yoga": "Mountain-like solidity and substantial achievements. Reputation and lasting legacy.",
  "Ashta Lakshmi": "Multiple forms of prosperity—material, intellectual, spiritual—throughout lifetime.",
};

function getLifetimeImplications(yogaName: string, category: string): string {
  return (
    YOGA_LIFETIME_IMPLICATIONS[yogaName] ||
    `This ${category} yoga influences your lifetime patterns and life outcomes.`
  );
}

function getActivationTimeWindow(strength: StrengthGroup): string {
  const windows: Record<StrengthGroup, string> = {
    strong: "Lifetime (especially 25-60 years)",
    moderate: "Mid to late life (30-65 years)",
    weak: "Periodic / situational (triggered during transits)",
  };
  return windows[strength];
}

function StrengthBadge({ strength }: { strength: StrengthGroup }) {
  const colors: Record<StrengthGroup, { bg: string; text: string }> = {
    strong: {
      bg: "rgba(200, 155, 60, 0.15)",
      text: "rgba(255, 215, 100, 0.9)",
    },
    moderate: {
      bg: "rgba(138, 146, 169, 0.15)",
      text: "rgba(180, 190, 210, 0.9)",
    },
    weak: {
      bg: "rgba(200, 100, 100, 0.15)",
      text: "rgba(220, 150, 150, 0.9)",
    },
  };

  const color = colors[strength];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.8rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "0.3rem 0.75rem",
        borderRadius: "6px",
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.text.replace("0.9)", "0.3)")}`,
      }}
    >
      {strength}
    </span>
  );
}

interface YogaLifetimeCardProps {
  yoga: YogaWithLifetimeImplications;
}

function YogaLifetimeCard({ yoga }: YogaLifetimeCardProps) {
  const isBenefic = ["mahapurusha", "wealth", "benefic", "viparita"].includes(
    yoga.category
  );

  return (
    <article
      style={{
        padding: "1.25rem",
        borderRadius: "12px",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1px solid ${
          isBenefic
            ? "rgba(200, 155, 60, 0.2)"
            : "rgba(200, 100, 100, 0.2)"
        }`,
        backdropFilter: "blur(8px)",
        transition: "all 0.3s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background =
          "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)";
        el.style.borderColor = isBenefic
          ? "rgba(200, 155, 60, 0.4)"
          : "rgba(200, 100, 100, 0.4)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background =
          "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)";
        el.style.borderColor = isBenefic
          ? "rgba(200, 155, 60, 0.2)"
          : "rgba(200, 100, 100, 0.2)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <h4
            style={{
              margin: "0 0 0.25rem 0",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#fff",
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            {yoga.name}
          </h4>
          {yoga.sanskrit && (
            <p
              style={{
                margin: 0,
                fontSize: "0.95rem",
                color: "rgba(200, 155, 60, 0.7)",
                fontStyle: "italic",
                fontFamily: '"Cormorant Garamond", serif',
              }}
            >
              {yoga.sanskrit}
            </p>
          )}
        </div>
        <StrengthBadge strength={yoga.strength} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          padding: "0.75rem",
          background: "rgba(200, 155, 60, 0.08)",
          border: "1px solid rgba(200, 155, 60, 0.15)",
          borderRadius: "8px",
        }}
      >
        <div>
          <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.8rem", color: "rgba(200, 155, 60, 0.7)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            Manifestation Chance
          </p>
          <p style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "rgba(255, 215, 100, 0.95)" }}>
            {yoga.occurrence_chance}%
          </p>
        </div>
        <div>
          <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.8rem", color: "rgba(138, 146, 169, 0.7)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            Activation Window
          </p>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "rgba(180, 190, 210, 0.9)" }}>
            {getActivationTimeWindow(yoga.strength)}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        {yoga.involved_planets.map((planet) => (
          <span
            key={planet}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
              padding: "0.4rem 0.7rem",
              background: "rgba(138, 146, 169, 0.15)",
              border: "1px solid rgba(138, 146, 169, 0.3)",
              borderRadius: "6px",
              color: "rgba(180, 190, 210, 0.9)",
            }}
          >
            <span style={{ fontSize: "1rem" }}>
              {PLANET_GLYPHS[planet] || "●"}
            </span>
            {planet}
          </span>
        ))}
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <p
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.05rem",
            color: "rgba(255, 255, 255, 0.75)",
            lineHeight: 1.6,
          }}
        >
          <strong>Classical meaning:</strong> {yoga.description}
        </p>
        <p
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.05rem",
            color: "rgba(255, 255, 255, 0.7)",
            lineHeight: 1.6,
          }}
        >
          <strong>Life effects:</strong> {yoga.effects}
        </p>
        {yoga.cancellation && (
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              color: "rgba(200, 155, 60, 0.8)",
              lineHeight: 1.5,
            }}
          >
            <strong>⚠ Cancellation:</strong> {yoga.cancellation}
          </p>
        )}
      </div>

      <div
        style={{
          padding: "0.75rem",
          background: "rgba(200, 155, 60, 0.08)",
          border: "1px solid rgba(200, 155, 60, 0.15)",
          borderRadius: "8px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "rgba(255, 220, 140, 0.9)",
            lineHeight: 1.6,
          }}
        >
          <strong>✨ Lifetime implication:</strong> {yoga.lifetimeImplications}
        </p>
      </div>
    </article>
  );
}

type YogaLifetimeSummaryProps = {
  yogas: YogaDetectionResult[];
};

function YogaLifetimeSummary({ yogas }: YogaLifetimeSummaryProps) {
  const { t } = useTranslation();
  const [expandedStrength, setExpandedStrength] = useState<
    StrengthGroup | "all"
  >("all");

  if (!yogas || yogas.length === 0) {
    return (
      <section
        style={{
          padding: "2rem",
          borderRadius: "12px",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center",
        }}
      >
        <p style={{ color: "rgba(255, 255, 255, 0.6)", margin: 0 }}>
          No planetary yogas detected in this chart at this time.
        </p>
      </section>
    );
  }

  const strongYogas = yogas.filter((y) => y.strength === "strong");
  const moderateYogas = yogas.filter((y) => y.strength === "moderate");
  const weakYogas = yogas.filter((y) => y.strength === "weak");

  const yogasWithImplications: YogaWithLifetimeImplications[] = yogas.map(
    (yoga) => ({
      ...yoga,
      lifetimeImplications: getLifetimeImplications(yoga.name, yoga.category),
    })
  );

  const strongWithImplications = yogasWithImplications.filter(
    (y) => y.strength === "strong"
  );
  const moderateWithImplications = yogasWithImplications.filter(
    (y) => y.strength === "moderate"
  );
  const weakWithImplications = yogasWithImplications.filter(
    (y) => y.strength === "weak"
  );

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "rgba(200, 155, 60, 0.8)",
            fontWeight: 600,
          }}
        >
          Lifetime Yogas Overview
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 700,
            color: "#fff",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
          }}
        >
          Your Planetary Yogas
        </h2>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "rgba(255, 255, 255, 0.7)",
          lineHeight: 1.7,
          maxWidth: "900px",
        }}
      >
        Yogas are classical planetary combinations that shape your lifetime
        patterns and influence major life outcomes. Below are all the yogas
        detected in your birth chart, organized by strength. Each yoga carries
        specific implications for your life's trajectory.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {strongYogas.length > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "rgba(255, 215, 100, 0.95)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgba(255, 215, 100, 0.95)",
                  }}
                />
                Strong Yogas ({strongYogas.length})
              </h3>
            </div>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.9rem",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              These powerful yogas significantly amplify your natural talents and
              life pattern. They are active and strongly present in your chart.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(360px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {strongWithImplications.map((yoga) => (
                <YogaLifetimeCard key={yoga.yoga_id} yoga={yoga} />
              ))}
            </div>
          </div>
        )}

        {moderateYogas.length > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "rgba(180, 190, 210, 0.9)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgba(180, 190, 210, 0.9)",
                  }}
                />
                Moderate Yogas ({moderateYogas.length})
              </h3>
            </div>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.9rem",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              These moderate yogas provide supportive influences. Their effects
              are present but may require conscious development to fully manifest.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(360px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {moderateWithImplications.map((yoga) => (
                <YogaLifetimeCard key={yoga.yoga_id} yoga={yoga} />
              ))}
            </div>
          </div>
        )}

        {weakYogas.length > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "rgba(220, 150, 150, 0.9)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgba(220, 150, 150, 0.9)",
                  }}
                />
                Weak Yogas ({weakYogas.length})
              </h3>
            </div>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.9rem",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              These subtle yogas have minimal influence but can still provide
              supportive qualities in specific life areas.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(360px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {weakWithImplications.map((yoga) => (
                <YogaLifetimeCard key={yoga.yoga_id} yoga={yoga} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "1.5rem",
          background:
            "linear-gradient(135deg, rgba(138, 146, 169, 0.1) 0%, rgba(138, 146, 169, 0.05) 100%)",
          border: "1px solid rgba(138, 146, 169, 0.2)",
          borderRadius: "12px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "rgba(200, 200, 220, 0.8)",
            lineHeight: 1.6,
          }}
        >
          <strong>💡 Understanding your yogas:</strong> The combination of strong,
          moderate, and weak yogas creates your unique lifetime blueprint. Strong
          yogas provide dominant life themes, moderate yogas offer support, and
          weak yogas provide subtle nuances. The strength of a yoga is influenced
          by planetary positions, sign placements, and house positions in your
          birth chart.
        </p>
      </div>
    </section>
  );
}

export default memo(YogaLifetimeSummary);
