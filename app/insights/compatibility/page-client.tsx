"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HiOutlineCalendarDays, HiOutlineClock } from "react-icons/hi2";
import AutocompleteInput from "@/app/components/AutocompleteInput";
import BackButton from "@/app/components/BackButton";
import ZodiacSignImage from "@/app/components/ZodiacSignImage";
import type { CompatibilityApiResponse, ProfileQueryInput } from "@/lib/astro-types";
import { buildBirthDetailsPayload, parseProfileQueryString } from "@/lib/chart-query";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { profileInitialState } from "@/lib/astro-types";
import { useToast } from "@/lib/toast-context";
import { saveComparison } from "@/lib/workspace-store";

/** Derives the Western (Tropical) sun sign from a YYYY-MM-DD birth date string. */
function sunSignFromDate(birthDate: string): string {
  if (!birthDate) return "";
  const parts = birthDate.split("-");
  if (parts.length < 3) return "";
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day)) return "";

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

function CompatibilityRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation on mount after a brief delay so the transition fires
    const id = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(id);
  }, []);

  const radius = 54;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = animated ? circumference - (score / 100) * circumference : circumference;

  const color = score >= 70 ? '#4ade80' : score >= 45 ? '#fbbf24' : '#f87171';

  const label =
    score >= 70 ? 'Harmonious' :
    score >= 45 ? 'Compatible' :
    'Challenging';

  const labelColor =
    score >= 70 ? '#4ade80' :
    score >= 45 ? '#fbbf24' :
    '#f87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1 }}>
            {Math.round(score)}
          </span>
          <span style={{
            fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem',
          }}>
            Score
          </span>
        </div>
      </div>
      <span style={{
        fontSize: '0.85rem', fontWeight: 600, color: labelColor,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

const ASTRO_API = "";

const requiredFields: Array<keyof ProfileQueryInput> = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
];

type CompatibilityPageClientProps = {
  initialSearchParams: Record<string, string>;
};

type ProfileCardProps = {
  title: string;
  profile: ProfileQueryInput;
  setProfile: Dispatch<SetStateAction<ProfileQueryInput>>;
  accentColor: "aqua" | "coral";
};

function profileFromParams(
  params: Record<string, string>,
  prefix: "" | "partner"
): ProfileQueryInput {
  const defaultOffset = String(-new Date().getTimezoneOffset());

  if (!prefix) {
    const primaryQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (!key.startsWith("partner")) {
        primaryQuery.set(key, value);
      }
    }
    const profile = parseProfileQueryString(primaryQuery.toString());
    return {
      ...profile,
      timezoneOffsetMinutes: profile.timezoneOffsetMinutes || defaultOffset,
    };
  }

  return {
    ...profileInitialState,
    name: params.partnerName ?? "",
    birthDate: params.partnerBirthDate ?? "",
    birthTime: params.partnerBirthTime ?? "",
    timezoneOffsetMinutes: params.partnerTimezoneOffsetMinutes || defaultOffset,
    latitude: params.partnerLatitude ?? "",
    longitude: params.partnerLongitude ?? "",
    country: params.partnerCountry ?? "",
    state: params.partnerState ?? "",
    city: params.partnerCity ?? "",
    town: params.partnerTown ?? "",
    timeZoneId: params.partnerTimeZoneId ?? "",
  };
}

function ProfileCard({ title, profile, setProfile, accentColor }: ProfileCardProps) {
  const { t } = useTranslation();
  const signBorderColor = accentColor === "aqua"
    ? "rgba(100,200,255,0.5)"
    : "rgba(255,100,150,0.5)";
  const signShadowColor = accentColor === "aqua"
    ? "rgba(100,200,255,0.25)"
    : "rgba(255,100,150,0.25)";
  const profileSign = sunSignFromDate(profile.birthDate);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profile.country.trim() && !profile.city.trim()) {
      return;
    }

    if (geoTimer.current) {
      clearTimeout(geoTimer.current);
    }

    geoTimer.current = setTimeout(async () => {
      setGeoStatus("loading");

      try {
        const params = new URLSearchParams();
        if (profile.city.trim()) params.set("city", profile.city.trim());
        if (profile.state.trim()) params.set("state", profile.state.trim());
        if (profile.country.trim()) params.set("country", profile.country.trim());
        if (profile.birthDate.trim()) params.set("birthDate", profile.birthDate.trim());
        if (profile.birthTime.trim()) params.set("birthTime", profile.birthTime.trim());

        const response = await fetch(`/api/geocode?${params.toString()}`);
        const data = await response.json();

        if (!data.found) {
          setGeoStatus("not-found");
          return;
        }

        setProfile((previous) => ({
          ...previous,
          latitude: String(data.lat),
          longitude: String(data.lon),
          timezoneOffsetMinutes:
            typeof data.timezoneOffsetMinutes === "number"
              ? String(data.timezoneOffsetMinutes)
              : previous.timezoneOffsetMinutes,
          timeZoneId: typeof data.timeZoneId === "string" ? data.timeZoneId : previous.timeZoneId,
        }));
        setGeoStatus("found");
      } catch {
        setGeoStatus("not-found");
      }
    }, 700);

    return () => {
      if (geoTimer.current) {
        clearTimeout(geoTimer.current);
      }
    };
  }, [
    profile.birthDate,
    profile.birthTime,
    profile.city,
    profile.country,
    profile.state,
    setProfile,
  ]);

  const updateField =
    (field: keyof ProfileQueryInput) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((previous) => ({ ...previous, [field]: value }));
    };

  const setField = (field: keyof ProfileQueryInput) => (value: string) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
  };

  return (
    <section className="rules-panel compatibility-profile-card">
      <div className="rules-header">
        <p className="kicker">Profile</p>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          {profileSign && (
            <ZodiacSignImage
              sign={profileSign}
              size={36}
              style={{
                border: `2px solid ${signBorderColor}`,
                boxShadow: `0 0 12px ${signShadowColor}`,
                flexShrink: 0,
              }}
            />
          )}
          {profile.name || title}
        </h2>
      </div>
      <p className="section-intro">
        Fine-tune the birth profile and let the app resolve coordinates plus historical timezone context automatically.
      </p>

      <div className="input-grid">
        <label className="input-glow-gold">
          Name
          <input type="text" value={profile.name} onChange={updateField("name")} />
        </label>
        <label className="input-glow-aqua">
          Birth date
          <div className="datetime-field">
            <input type="date" value={profile.birthDate} onChange={updateField("birthDate")} />
            <HiOutlineCalendarDays className="datetime-icon datetime-icon-aqua" />
          </div>
        </label>
      </div>

      <div className="input-grid">
        <label className="input-glow-coral">
          Birth time
          <div className="datetime-field">
            <input type="time" value={profile.birthTime} onChange={updateField("birthTime")} />
            <HiOutlineClock className="datetime-icon datetime-icon-coral" />
          </div>
        </label>
        <label className="input-glow-violet">
          UTC offset (minutes)
          <input
            type="number"
            value={profile.timezoneOffsetMinutes}
            onChange={updateField("timezoneOffsetMinutes")}
            min={-720}
            max={840}
          />
        </label>
      </div>

      <div className="input-grid two-col">
        <label className="input-glow-gold">
          Country
          <AutocompleteInput
            value={profile.country}
            onChange={setField("country")}
            onSelect={setField("country")}
            placeholder="Country"
            suggestType="country"
            required
          />
        </label>
        <label className="input-glow-rose">
          State
          <AutocompleteInput
            value={profile.state}
            onChange={setField("state")}
            onSelect={setField("state")}
            placeholder="State or province"
            suggestType="state"
            required
          />
        </label>
      </div>

      <label className="input-glow-aqua">
        City
        <AutocompleteInput
          value={profile.city}
          onChange={setField("city")}
          onSelect={setField("city")}
          placeholder="City"
          suggestType="city"
          required
        />
      </label>

      {geoStatus !== "idle" && (
        <p className={`geo-status ${geoStatus}`}>
          {geoStatus === "loading" && t("compatibility.resolving")}
          {geoStatus === "found" &&
            `Location resolved: ${Number(profile.latitude).toFixed(4)}, ${Number(profile.longitude).toFixed(4)}${
              profile.timeZoneId ? ` • ${profile.timeZoneId}` : ""
            }`}
          {geoStatus === "not-found" && t("compatibility.locationError")}
        </p>
      )}

      <div className="input-grid three-col">
        <label className="input-glow-aqua">
          Latitude
          <input type="number" value={profile.latitude} onChange={updateField("latitude")} />
        </label>
        <label className="input-glow-coral">
          Longitude
          <input type="number" value={profile.longitude} onChange={updateField("longitude")} />
        </label>
        <label className="input-glow-violet">
          Time zone ID
          <input type="text" value={profile.timeZoneId} onChange={updateField("timeZoneId")} />
        </label>
      </div>
    </section>
  );
}

function buildCompatibilityQueryString(primary: ProfileQueryInput, partner: ProfileQueryInput) {
  return new URLSearchParams({
    name: primary.name,
    birthDate: primary.birthDate,
    birthTime: primary.birthTime,
    timezoneOffsetMinutes: primary.timezoneOffsetMinutes,
    latitude: primary.latitude,
    longitude: primary.longitude,
    country: primary.country,
    state: primary.state,
    city: primary.city,
    town: primary.town,
    timeZoneId: primary.timeZoneId,
    partnerName: partner.name,
    partnerBirthDate: partner.birthDate,
    partnerBirthTime: partner.birthTime,
    partnerTimezoneOffsetMinutes: partner.timezoneOffsetMinutes,
    partnerLatitude: partner.latitude,
    partnerLongitude: partner.longitude,
    partnerCountry: partner.country,
    partnerState: partner.state,
    partnerCity: partner.city,
    partnerTown: partner.town,
    partnerTimeZoneId: partner.timeZoneId,
  }).toString();
}

export default function CompatibilityPageClient({
  initialSearchParams,
}: CompatibilityPageClientProps) {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const [primary, setPrimary] = useState<ProfileQueryInput>(() =>
    profileFromParams(initialSearchParams, "")
  );
  const [partner, setPartner] = useState<ProfileQueryInput>(() =>
    profileFromParams(initialSearchParams, "partner")
  );
  const [result, setResult] = useState<CompatibilityApiResponse | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  const canSubmit = useMemo(() => {
    return [primary, partner].every((profile) =>
      requiredFields.every((field) => profile[field].trim().length > 0)
    );
  }, [partner, primary]);

  const submitCompatibility = useCallback(async (saveResult: boolean) => {
    if (!canSubmit) {
      setError(t("compatibility.incompleteProfiles"));
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const response = await fetch(`${ASTRO_API}/api/compatibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primary: buildBirthDetailsPayload(primary),
          partner: buildBirthDetailsPayload(partner),
          save_result: false,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: "Compatibility request failed." }));
        throw new Error(payload.detail ?? "Compatibility request failed.");
      }

      const payload = (await response.json()) as CompatibilityApiResponse;
      if (saveResult && user) {
        const saved = await saveComparison(user.user_id, {
          primary_name: payload.primary_client.name,
          partner_name: payload.partner_client.name,
          compatibility_score: payload.compatibility_score,
          summary: payload.summary,
          query_string: buildCompatibilityQueryString(primary, partner),
        });
        payload.saved_comparison_id = saved.saved_comparison_id;
      }
      setResult(payload);
      pushToast(
        saveResult ? "Compatibility report saved." : "Compatibility report ready.",
        "success"
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Compatibility request failed.");
      pushToast("Compatibility request failed.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, partner, primary, pushToast, user]);

  const shareCompatibility = async () => {
    const url = `${window.location.origin}/insights/compatibility?${buildCompatibilityQueryString(primary, partner)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${primary.name} + ${partner.name} compatibility`,
          url,
        });
        pushToast("Share sheet opened.", "info");
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast("Compatibility link copied.", "success");
    } catch {
      pushToast("Could not share the compatibility link.", "error");
    }
  };

  useEffect(() => {
    if (!canSubmit || result || autoSubmittedRef.current) {
      return;
    }

    const hasPartnerSeed =
      partner.name.trim() &&
      partner.birthDate.trim() &&
      partner.birthTime.trim() &&
      partner.city.trim();

    if (!hasPartnerSeed) {
      return;
    }

    autoSubmittedRef.current = true;
    void submitCompatibility(false);
  }, [canSubmit, partner, result, submitCompatibility]);

  return (
    <div className="insights-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <BackButton />

      <section className="dashboard-shell">
        <p className="kicker">Synastry Analysis</p>
        <h1>Compatibility workspace</h1>
        <p className="lead">
          Compare two full birth profiles, inspect the strongest synastry links, and save the report
          into your Supabase-backed account workspace.
        </p>

        <div className="compatibility-grid">
          <ProfileCard title="Primary profile" profile={primary} setProfile={setPrimary} accentColor="aqua" />
          <ProfileCard title="Partner profile" profile={partner} setProfile={setPartner} accentColor="coral" />
        </div>

        <div className="workspace-actions">
          <button type="button" onClick={() => void submitCompatibility(false)} disabled={isSubmitting}>
            {isSubmitting ? "Calculating..." : "Run compatibility"}
          </button>
          <button
            type="button"
            onClick={() => void submitCompatibility(true)}
            disabled={isSubmitting || !isAuthenticated}
          >
            {isSubmitting ? "Saving..." : "Save to workspace"}
          </button>
          <button
            type="button"
            onClick={() => void shareCompatibility()}
            disabled={isSubmitting || !result}
          >
            Share compatibility
          </button>
          {!isAuthenticated && (
            <Link href="/login" className="ghost-link">
              Sign in to save reports
            </Link>
          )}
        </div>

        {error && <p className="error-note">{error}</p>}

        {result && (
          <>
            <div className="workspace-summary-grid">
              <article className="metric-card metric-card--score-ring">
                <h3>Compatibility score</h3>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <ZodiacSignImage
                      sign={sunSignFromDate(primary.birthDate)}
                      size={72}
                      style={{
                        border: "2px solid rgba(100,200,255,0.5)",
                        boxShadow: "0 0 20px rgba(100,200,255,0.25)",
                      }}
                    />
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", opacity: 0.7 }}>
                      {result.primary_client.name}
                    </p>
                  </div>
                  <span style={{ fontSize: "1.5rem", opacity: 0.4 }}>✦</span>
                  <div style={{ textAlign: "center" }}>
                    <ZodiacSignImage
                      sign={sunSignFromDate(partner.birthDate)}
                      size={72}
                      style={{
                        border: "2px solid rgba(255,100,150,0.5)",
                        boxShadow: "0 0 20px rgba(255,100,150,0.25)",
                      }}
                    />
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", opacity: 0.7 }}>
                      {result.partner_client.name}
                    </p>
                  </div>
                </div>
                <CompatibilityRing score={result.compatibility_score} />
                <small>Composite synastry score from aspects and elemental fit.</small>
              </article>
              <article className="metric-card">
                <h3>Saved report</h3>
                <p>{result.saved_comparison_id ? "Yes" : "Not yet"}</p>
                <small>
                  {result.saved_comparison_id
                    ? "This comparison is now available from the workspace page."
                    : "Save the report to store it with notes and export."}
                </small>
              </article>
            </div>

            <section className="rules-panel">
              <div className="rules-header">
                <p className="kicker">Summary</p>
                <h2>Relationship themes</h2>
              </div>
              <p className="section-intro">{result.summary}</p>
              <div className="rules-list">
                {result.themes.map((theme) => {
                  const ZODIAC_SIGNS = [
                    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
                    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
                  ];
                  const signsInTitle = ZODIAC_SIGNS.filter((s) =>
                    theme.title.includes(s)
                  );
                  const signsInInsight = ZODIAC_SIGNS.filter((s) =>
                    theme.insight.includes(s)
                  );
                  return (
                    <article key={theme.title} className="rule-card rule-medium">
                      <header>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          {signsInTitle.map((s) => (
                            <ZodiacSignImage key={s} sign={s} size={24} style={{ flexShrink: 0 }} />
                          ))}
                          {theme.title}
                        </h3>
                        <span>{Math.round(theme.confidence_score * 100)}%</span>
                      </header>
                      <p style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        {signsInInsight.length > 0 && signsInInsight.map((s) => (
                          <ZodiacSignImage key={s} sign={s} size={24} style={{ flexShrink: 0 }} />
                        ))}
                        {theme.insight}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rules-panel">
              <div className="rules-header">
                <p className="kicker">Synastry</p>
                <h2>Inter-chart aspects</h2>
              </div>
              <div className="workspace-card-grid">
                {result.synastry_aspects.map((aspect) => (
                  <article key={`${aspect.primary_planet}-${aspect.partner_planet}-${aspect.aspect_type}`} className="workspace-card">
                    <div className="workspace-card-header">
                      <div>
                        <h3>
                          {aspect.primary_planet} to {aspect.partner_planet}
                        </h3>
                        <p>{aspect.aspect_type}</p>
                      </div>
                      <span className={`access-pill ${aspect.harmonious ? "access-pill--premium" : "access-pill--limited"}`}>
                        {aspect.harmonious ? "Supportive" : "Friction"}
                      </span>
                    </div>
                    <p className="workspace-card-meta">Orb: {aspect.orb.toFixed(2)} degrees</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
