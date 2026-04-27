"use client";

import type { ChangeEvent, FormEvent } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GiCrystalBall, GiSunrise, GiCompass, GiStarSattelites } from "react-icons/gi";
import { HiOutlineSparkles, HiOutlineChevronDown } from "react-icons/hi2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import PageTransition from "./components/PageTransition";
import AutocompleteInput from "./components/AutocompleteInput";
import ChartHistory from "./components/ChartHistory";
import ZodiacWheel from "./components/ZodiacWheel";
import ZodiacPortraitPanel from "./components/ZodiacPortraitPanel";
import FormCelebration from "./components/FormCelebration";
import Image from "next/image";
import { hapticSuccess } from "@/lib/haptics";
import OnboardingCinematic from "./components/OnboardingCinematic";
import PlanetaryAffinity from "./components/PlanetaryAffinity";
import BirthChartTeaser from "./components/BirthChartTeaser";
import CosmicTrailCursor from "./components/CosmicTrailCursor";
import { useFieldStarBurst } from "./components/FieldStarBurst";
import { useTextScramble } from "./components/TextScramble";
import CosmicBackground from "./components/CosmicBackground";
import GlassCard from "./components/GlassCard";
import PremiumInput from "./components/PremiumInput";
import PremiumButton from "./components/PremiumButton";
import PremiumDatePicker from "./components/PremiumDatePicker";
import PremiumToggle from "./components/PremiumToggle";
import styles from "./page.module.css";

const requiredFields: Array<keyof ProfileQueryInput> = [
  "name",
  "birthDate",
  // "birthTime", // Will handle requiredness conditionally
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
];
// Coarse time options for unknown birth time
const COARSE_TIME_OPTIONS = [
  { value: "morning", label: "Morning (5am–11am)" },
  { value: "afternoon", label: "Afternoon (11am–4pm)" },
  { value: "evening", label: "Evening (4pm–9pm)" },
  { value: "unknown", label: "Unknown" },
];


const withClientTimezoneDefault = (): ProfileQueryInput => ({
  ...profileInitialState,
  timezoneOffsetMinutes: "0",
  timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""
});

export default function Home() {
  const [unknownTime, setUnknownTime] = useState(false);
  const [coarseTime, setCoarseTime] = useState("");
  const { user } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileQueryInput>(withClientTimezoneDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latLonExpanded, setLatLonExpanded] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSavedDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Smart fill state
  const [smartFillText, setSmartFillText] = useState("");
  const [smartFillExpanded, setSmartFillExpanded] = useState(false);

  // Sequential field highlight state (soft unlock - all fields visible, next step highlighted)
  const [highlightedField, setHighlightedField] = useState<string>("name");
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());

  // Scroll cue visibility (fades after user scrolls past 100px)
  const [scrolled, setScrolled] = useState<boolean>(false);
  // Mobile sticky bar visibility (shows when scrolled past form on mobile)
  const [showStickyBar, setShowStickyBar] = useState<boolean>(false);
  
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 100);
      // Show sticky bar on mobile when scrolled past 300px
      setShowStickyBar(window.scrollY > 300 && window.innerWidth < 768);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  
  // Field refs for star burst animations
  const nameRef = useRef<HTMLDivElement>(null);
  const birthDateRef = useRef<HTMLDivElement>(null);
  const birthTimeRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  
  // Star burst hook
  const { BurstContainer, burstAt } = useFieldStarBurst();
  
  // Text scramble for heading
  const [headingScrambleActive, setHeadingScrambleActive] = useState(true);
  
  // Text scramble for heading - declared here, used after headingText is defined
  const headingText = t("home.heading");
  const scrambledHeading = useTextScramble(headingText, headingScrambleActive, { duration: 1500 });

  /* ── Scroll-reveal & validation shimmer ── */
  const formRef = useRef<HTMLFormElement>(null);
  const prevDraftRef = useRef<ProfileQueryInput>(withClientTimezoneDefault());
  const [validatedFields, setValidatedFields] = useState<Set<string>>(new Set());
  const shimmerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Soft unlock effect - highlight next field based on completion
  useEffect(() => {
    const fieldOrder = ["name", "birthDate", "birthTime", "country", "state", "city"];
    
    // Find the first unfilled field to highlight
    for (const field of fieldOrder) {
      if (draft[field as keyof ProfileQueryInput].trim().length === 0) {
        setHighlightedField(field);
        return;
      }
    }
    
    // All fields filled, no highlight needed
    setHighlightedField("");
  }, [draft]);

  /* ── Mystical tagline rotation ── */
  const mysticalPhrases = useMemo(() => {
    const phrases: string[] = [];
    for (let i = 1; ; i++) {
      const key = `home.mysticalPhrase${i}`;
      const val = t(key);
      if (val === key) break;   // t() returns the key when missing
      phrases.push(val);
    }
    return phrases.length > 0 ? phrases : ["Written in the Stars"];
  }, [t]);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [hoveredSign, setHoveredSign] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % mysticalPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [mysticalPhrases.length]);

  // Deactivate heading scramble after animation
  useEffect(() => {
    const timer = setTimeout(() => setHeadingScrambleActive(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  /* ── Panel & wheel refs (no scroll transforms — clean render) ── */
  const wheelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  /* Field reveal removed — was causing layout bounce on load
     (fields started at translateY(20px) then jumped to 0) */

  /* ── Validation shimmer: detect empty -> non-empty transitions ── */
  useEffect(() => {
    const prev = prevDraftRef.current;
    const fieldsToCheck: Array<keyof ProfileQueryInput> = [
      "name", "birthDate", "birthTime", "country", "state", "city",
    ];

    const newlyValid: string[] = [];
    for (const f of fieldsToCheck) {
      if (prev[f].trim() === "" && draft[f].trim() !== "") {
        newlyValid.push(f);
      }
    }

    if (newlyValid.length > 0) {
      setValidatedFields((s) => {
        const next = new Set(s);
        newlyValid.forEach((f) => next.add(f));
        return next;
      });
      
      // Mark fields as completed for star burst
      newlyValid.forEach(field => {
        if (!completedFields.has(field)) {
          setCompletedFields(prev => new Set([...prev, field]));
          
          // Trigger star burst at field position
          const fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
            name: nameRef,
            birthDate: birthDateRef,
            birthTime: birthTimeRef,
            country: countryRef,
            state: stateRef,
            city: cityRef,
          };
          
          const fieldColorMap: Record<string, "gold" | "aqua" | "coral" | "violet" | "rose"> = {
            name: "gold",
            birthDate: "aqua",
            birthTime: "coral",
            country: "violet",
            state: "rose",
            city: "gold",
          };
          
          const ref = fieldRefs[field];
          if (ref?.current) {
            const rect = ref.current.getBoundingClientRect();
            burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, fieldColorMap[field]);
          }
        }
      });

      // Remove shimmer class after animation completes
      for (const f of newlyValid) {
        const existing = shimmerTimers.current.get(f);
        if (existing) clearTimeout(existing);
        shimmerTimers.current.set(
          f,
          setTimeout(() => {
            setValidatedFields((s) => {
              const next = new Set(s);
              next.delete(f);
              return next;
            });
            shimmerTimers.current.delete(f);
          }, 650)
        );
      }
    }

    prevDraftRef.current = { ...draft };
  }, [draft, completedFields, burstAt]);

  useEffect(() => {
    const clientOffset = String(-new Date().getTimezoneOffset());
    setDraft((previous) => ({ ...previous, timezoneOffsetMinutes: clientOffset }));
  }, []);

  /* ── Restore draft from localStorage on mount (runs after timezone default) ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("astro_intake_draft");
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      // Validate shape: every key in profileInitialState must be a string
      const keys = Object.keys(profileInitialState) as Array<keyof ProfileQueryInput>;
      const isValid = keys.every((k) => typeof parsed[k] === "string");
      if (!isValid) return;
      setDraft(parsed as unknown as ProfileQueryInput);
    } catch {
      // localStorage may throw in private browsing or if data is corrupt
    }
  }, []);

  /* ── Auto-save draft to localStorage (debounced 500ms) ── */
  useEffect(() => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);

    draftSaveTimer.current = setTimeout(() => {
      try {
        // Only save if user has entered something meaningful
        const userFields: Array<keyof ProfileQueryInput> = [
          "name", "birthDate", "birthTime", "country", "state", "city",
        ];
        const hasContent = userFields.some((f) => draft[f].trim().length > 0);
        if (!hasContent) {
          localStorage.removeItem("astro_intake_draft");
          return;
        }
        localStorage.setItem("astro_intake_draft", JSON.stringify(draft));
        setDraftSaved(true);
        if (draftSavedDisplayTimer.current) clearTimeout(draftSavedDisplayTimer.current);
        draftSavedDisplayTimer.current = setTimeout(() => setDraftSaved(false), 1500);
      } catch {
        // localStorage may throw in private browsing
      }
    }, 500);

    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [draft]);

  const draftCountry = draft.country;
  const draftState = draft.state;
  const draftCity = draft.city;
  const draftBirthDate = draft.birthDate;
  const draftBirthTime = draft.birthTime;

  useEffect(() => {
    if (!draftCountry.trim() && !draftCity.trim()) return;

    if (geoTimer.current) clearTimeout(geoTimer.current);

    geoTimer.current = setTimeout(async () => {
      setGeoStatus("loading");
      try {
        const params = new URLSearchParams();
        if (draftCity.trim()) params.set("city", draftCity.trim());
        if (draftState.trim()) params.set("state", draftState.trim());
        if (draftCountry.trim()) params.set("country", draftCountry.trim());
        if (draftBirthDate.trim()) params.set("birthDate", draftBirthDate.trim());
        if (draftBirthTime.trim()) params.set("birthTime", draftBirthTime.trim());

        const res = await fetch(`/api/geocode?${params.toString()}`);
        const data = await res.json();

        if (data.found) {
          setDraft((prev) => ({
            ...prev,
            latitude: String(data.lat),
            longitude: String(data.lon),
            timezoneOffsetMinutes:
              typeof data.timezoneOffsetMinutes === "number"
                ? String(data.timezoneOffsetMinutes)
                : prev.timezoneOffsetMinutes,
            timeZoneId: typeof data.timeZoneId === "string" ? data.timeZoneId : prev.timeZoneId,
          }));
          setGeoStatus("found");
        } else {
          setGeoStatus("not-found");
        }
      } catch {
        setGeoStatus("not-found");
      }
    }, 800);

    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [draftBirthDate, draftBirthTime, draftCity, draftCountry, draftState]);

  const canSubmit = useMemo(() => {
    return requiredFields.every((field) => draft[field].trim().length > 0);
  }, [draft]);

  /* ── Cosmic charge level (0-1) based on visible form fields ── */
  const chargeLevel = useMemo(() => {
    const chargeKeys: Array<keyof ProfileQueryInput> = ["name", "birthDate", "birthTime", "country", "state", "city"];
    const filled = chargeKeys.filter((f) => draft[f].trim().length > 0).length;
    return filled / chargeKeys.length;
  }, [draft]);

  const submitWrapperRef = useRef<HTMLDivElement>(null);

  /* ── Particle burst on click ── */
  const spawnParticles = useCallback((originX: number, originY: number) => {
    const wrapper = submitWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = originX - rect.left;
    const cy = originY - rect.top;
    const count = 12 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      const size = 3 + Math.random() * 2;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const isGold = Math.random() > 0.5;
      const color = isGold ? "rgba(242,194,108,0.9)" : "rgba(108,225,212,0.9)";

      particle.style.cssText = [
        "position:absolute",
        `left:${cx}px`,
        `top:${cy}px`,
        `width:${size}px`,
        `height:${size}px`,
        "border-radius:50%",
        `background:${color}`,
        "pointer-events:none",
        "z-index:10",
        `--dx:${dx}px`,
        `--dy:${dy}px`,
        "animation:cosmicParticleBurst 600ms ease-out forwards",
      ].join(";");
      wrapper.appendChild(particle);
      setTimeout(() => particle.remove(), 650);
    }
  }, []);

  /* ── Ripple effect on click ── */
  const spawnRipple = useCallback((originX: number, originY: number) => {
    const wrapper = submitWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = originX - rect.left;
    const cy = originY - rect.top;

    const ripple = document.createElement("span");
    ripple.style.cssText = [
      "position:absolute",
      `left:${cx}px`,
      `top:${cy}px`,
      "width:0",
      "height:0",
      "border-radius:50%",
      "background:rgba(242,194,108,0.3)",
      "transform:translate(-50%,-50%)",
      "pointer-events:none",
      "z-index:9",
      "animation:cosmicRippleExpand 500ms ease-out forwards",
    ].join(";");
    wrapper.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  }, []);

  const handleSubmitClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      hapticSuccess();
      spawnParticles(e.clientX, e.clientY);
      spawnRipple(e.clientX, e.clientY);
    },
    [spawnParticles, spawnRipple],
  );

  const updateField =
    (field: keyof ProfileQueryInput) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraft((previous) => ({
        ...previous,
        [field]: event.target.value
      }));
    };

  const setField = (field: keyof ProfileQueryInput) => (value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  // Smart fill parser - handles various formats
  const parseSmartFill = (text: string) => {
    const parts = text.split(',').map(p => p.trim());
    if (parts.length < 3) return null;

    let parsed: Partial<ProfileQueryInput> = {};
    let partIndex = 0;

    // Extract name (first part)
    if (parts[partIndex]) {
      parsed.name = parts[partIndex];
      partIndex++;
    }

    // Extract date (various formats: "14 Mar 1995", "March 14 1995", "1995-03-14")
    if (parts[partIndex]) {
      const dateStr = parts[partIndex];
      const dateMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/) || 
                       dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/) ||
                       dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      
      if (dateMatch) {
        const months: Record<string, string> = {
          jan: '01', january: '01',
          feb: '02', february: '02',
          mar: '03', march: '03',
          apr: '04', april: '04',
          may: '05',
          jun: '06', june: '06',
          jul: '07', july: '07',
          aug: '08', august: '08',
          sep: '09', september: '09',
          oct: '10', october: '10',
          nov: '11', november: '11',
          dec: '12', december: '12'
        };
        
        let year, month, day;
        if (dateStr.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
          [year, month, day] = [dateMatch[1], dateMatch[2].padStart(2, '0'), dateMatch[3].padStart(2, '0')];
        } else {
          const [, dOrM, mOrD, y] = dateMatch;
          if (parseInt(dOrM) > 31) {
            // First part is month name
            const monthNum = months[mOrD.toLowerCase()] || mOrD.padStart(2, '0');
            [year, month, day] = [y, monthNum, dOrM.padStart(2, '0')];
          } else {
            // First part is day
            const monthNum = months[mOrD.toLowerCase()] || mOrD.padStart(2, '0');
            [year, month, day] = [y, monthNum, dOrM.padStart(2, '0')];
          }
        }
        parsed.birthDate = `${year}-${month}-${day}`;
        partIndex++;
      }
    }

    // Extract time (various formats: "3:45 PM", "15:45", "3.45pm")
    if (parts[partIndex]) {
      const timeStr = parts[partIndex];
      const timeMatch = timeStr.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
      
      if (timeMatch) {
        let [, hours, minutes, meridiem] = timeMatch;
        let h = parseInt(hours);
        const m = minutes;
        
        if (meridiem?.toLowerCase() === 'pm' && h !== 12) {
          h += 12;
        } else if (meridiem?.toLowerCase() === 'am' && h === 12) {
          h = 0;
        }
        
        parsed.birthTime = `${String(h).padStart(2, '0')}:${m}`;
        partIndex++;
      }
    }

    // Extract location (remaining parts combined)
    if (parts[partIndex]) {
      const locationParts = parts.slice(partIndex);
      // Try to parse as "City, State Country" or "City, Country"
      if (locationParts.length >= 2) {
        parsed.city = locationParts[0];
        parsed.state = locationParts[1];
        if (locationParts[2]) {
          parsed.country = locationParts[2];
        } else {
          parsed.country = locationParts[1];
          parsed.state = "";
        }
      } else {
        parsed.city = locationParts[0];
      }
    }

    return parsed;
  };

  const handleSmartFill = () => {
    const parsed = parseSmartFill(smartFillText);
    if (parsed) {
      setDraft(prev => ({ ...prev, ...parsed }));
      setSmartFillText("");
      setSmartFillExpanded(false);
    }
  };

  const clearGeoResults = () => {
    setDraft((prev) => ({
      ...prev,
      latitude: "",
      longitude: "",
      timezoneOffsetMinutes: String(-new Date().getTimezoneOffset()),
      timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
    }));
    setGeoStatus("idle");
  };

  // Cascading handlers: changing a parent clears its children
  const handleCountryChange = (value: string) => {
    setDraft((prev) => ({ ...prev, country: value, state: "", city: "" }));
    clearGeoResults();
  };

  const handleCountrySelect = (value: string) => {
    setDraft((prev) => ({ ...prev, country: value, state: "", city: "" }));
    clearGeoResults();
  };

  const handleStateChange = (value: string) => {
    setDraft((prev) => ({ ...prev, state: value, city: "" }));
    clearGeoResults();
  };

  const handleStateSelect = (value: string) => {
    setDraft((prev) => ({ ...prev, state: value, city: "" }));
    clearGeoResults();
  };

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const params = new URLSearchParams();

    Object.entries(draft).forEach(([key, value]) => {
      params.set(key, value.trim());
    });

    try {
      localStorage.removeItem("astro_intake_draft");
    } catch {
      // localStorage may throw in private browsing
    }

    router.push(`/engine-select?${params.toString()}`);
  };

  return (
    <div className={styles.professionalIntake}>
      <OnboardingCinematic />
      <CosmicBackground />
      <FormCelebration isComplete={canSubmit} />

      {/* ── Floating Cosmic Particles ── */}
      <div className={styles.cosmicParticles}>
        {Array.from({ length: 24 }, (_, i) => {
          const size = 1.5 + (i % 3) * 1;
          const left = ((i * 17 + 7) % 100);
          const bottom = -((i * 13) % 20);
          const duration = 12 + (i % 7) * 3;
          const delay = (i * 1.3) % 14;
          const isGold = i % 3 === 0;
          const color = isGold
            ? "rgba(242, 194, 108, 0.6)"
            : i % 3 === 1
            ? "rgba(108, 225, 212, 0.5)"
            : "rgba(255, 255, 255, 0.4)";
          return (
            <span
              key={i}
              className={styles.cosmicParticle}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${left}%`,
                bottom: `${bottom}%`,
                background: color,
                boxShadow: `0 0 ${size * 2}px ${color}`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>



      {/* ── Hero wrapper: positions wheel behind the panel ── */}
      <div className={styles.heroWrapper}>
        {/* ── Animated Constellation Background ── */}
        <div className={styles.constellationBg}>
          <svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            {/* Constellation lines */}
            <line x1="120" y1="150" x2="250" y2="200" />
            <line x1="250" y1="200" x2="310" y2="120" />
            <line x1="310" y1="120" x2="420" y2="180" />
            <line x1="420" y1="180" x2="380" y2="300" />
            <line x1="250" y1="200" x2="380" y2="300" />
            <line x1="500" y1="100" x2="600" y2="170" />
            <line x1="600" y1="170" x2="650" y2="280" />
            <line x1="650" y1="280" x2="550" y2="340" />
            <line x1="550" y1="340" x2="500" y2="100" />
            <line x1="200" y1="450" x2="300" y2="500" />
            <line x1="300" y1="500" x2="280" y2="620" />
            <line x1="280" y1="620" x2="150" y2="580" />
            <line x1="150" y1="580" x2="200" y2="450" />
            <line x1="500" y1="480" x2="620" y2="520" />
            <line x1="620" y1="520" x2="680" y2="450" />
            <line x1="680" y1="450" x2="720" y2="580" />
            <line x1="620" y1="520" x2="720" y2="580" />
            <line x1="100" y1="350" x2="180" y2="400" />
            <line x1="180" y1="400" x2="200" y2="450" />
            <line x1="650" y1="280" x2="680" y2="450" />
            <line x1="380" y1="300" x2="350" y2="420" />
            <line x1="350" y1="420" x2="500" y2="480" />
            <line x1="420" y1="650" x2="500" y2="700" />
            <line x1="500" y1="700" x2="580" y2="680" />
            <line x1="420" y1="650" x2="280" y2="620" />
            {/* Constellation nodes */}
            <circle className={styles.constellationNode} cx="120" cy="150" r="2" />
            <circle className={styles.constellationNode} cx="250" cy="200" r="1.5" />
            <circle className={styles.constellationNode} cx="310" cy="120" r="2" />
            <circle className={styles.constellationNode} cx="420" cy="180" r="1.5" />
            <circle className={styles.constellationNode} cx="380" cy="300" r="2" />
            <circle className={styles.constellationNode} cx="500" cy="100" r="1.5" />
            <circle className={styles.constellationNode} cx="600" cy="170" r="2" />
            <circle className={styles.constellationNode} cx="650" cy="280" r="1.5" />
            <circle className={styles.constellationNode} cx="550" cy="340" r="2" />
            <circle className={styles.constellationNode} cx="200" cy="450" r="1.5" />
            <circle className={styles.constellationNode} cx="300" cy="500" r="2" />
            <circle className={styles.constellationNode} cx="280" cy="620" r="1.5" />
            <circle className={styles.constellationNode} cx="150" cy="580" r="2" />
            <circle className={styles.constellationNode} cx="500" cy="480" r="1.5" />
            <circle className={styles.constellationNode} cx="620" cy="520" r="2" />
            <circle className={styles.constellationNode} cx="680" cy="450" r="1.5" />
            <circle className={styles.constellationNode} cx="720" cy="580" r="2" />
            <circle className={styles.constellationNode} cx="100" cy="350" r="1.5" />
            <circle className={styles.constellationNode} cx="180" cy="400" r="2" />
            <circle className={styles.constellationNode} cx="350" cy="420" r="1.5" />
            <circle className={styles.constellationNode} cx="420" cy="650" r="2" />
            <circle className={styles.constellationNode} cx="500" cy="700" r="1.5" />
            <circle className={styles.constellationNode} cx="580" cy="680" r="2" />
          </svg>
        </div>

        <div ref={wheelRef} className={styles.parallaxWheel}>
          <ZodiacWheel onHoveredChange={setHoveredSign} />
          <ZodiacPortraitPanel sign={hoveredSign} />
        </div>
      </div>{/* /heroWrapper */}

      {/* === HEADER SECTION === */}
      <header className={styles.intakeHeader}>
        <div className={styles.brandBadge}>
          <HiOutlineSparkles />
          <span>Swiss Ephemeris</span>
        </div>
        <h1 className={styles.pageTitle}>Reveal My Destiny</h1>
        <p className={styles.pageSubtitle}>The Universe Speaks — Discover Your Cosmic Blueprint</p>
        
        {/* Progress indicator — 9 dots, one per required field */}
        <div className={styles.progressDots} role="progressbar" aria-label="Form completion progress">
          {requiredFields.map((field) => {
            const value = draft[field];
            const filled = typeof value === "string" && value.trim().length > 0;
            return (
              <span
                key={field}
                className={`${styles.progressDot} ${filled ? styles.progressDotFilled : ""}`}
                aria-hidden="true"
              />
            );
          })}
        </div>

        {/* Scroll-to-begin cue */}
        <div
          className={`${styles.scrollCue} ${scrolled ? styles.scrollCueHidden : ""}`}
          aria-hidden="true"
        >
          <span>Scroll to begin</span>
          <HiOutlineChevronDown />
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className={styles.mainContent}>
        <form ref={formRef} className={styles.intakeForm} onSubmit={submitProfile}>
          <div className={styles.formIntro}>
            <span className={styles.formEyebrow}>Client birth intake</span>
            <h2 className={styles.formTitle}>Map the exact sky they arrived under.</h2>
            <p className={styles.formCopy}>
              Enter the core birth details and we will tune the chart preview as each coordinate locks into place.
            </p>
          </div>

          <div className={styles.formLayout}>
            {/* LEFT COLUMN: Form Fields */}
            <div className={styles.formColumn}>
              <div className={styles.formSectionCard}>
                <div className={styles.cardAura} aria-hidden="true" />
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.cardKicker}>Precision profile</span>
                    <h3 className={styles.cardTitle}>Birth Details</h3>
                  </div>
                  <div className={styles.cardSeal} aria-hidden="true">
                    <GiCrystalBall />
                  </div>
                </div>
              {/* ── Smart Fill Field ── */}
              <div className={styles.smartFillWrapper}>
                <button
                  type="button"
                  className={styles.smartFillToggle}
                  onClick={() => setSmartFillExpanded(!smartFillExpanded)}
                >
                  <HiOutlineSparkles />
                  <span>Quick Fill (Paste client data)</span>
                  <HiOutlineChevronDown className={`${styles.smartFillArrow} ${smartFillExpanded ? styles.expanded : ''}`} />
                </button>
                
                {smartFillExpanded && (
                  <div className={styles.smartFillContent}>
                    <textarea
                      value={smartFillText}
                      onChange={(e) => setSmartFillText(e.target.value)}
                      placeholder='Jane Doe, 14 Mar 1995, 3:45 PM, Brooklyn NY'
                      className={styles.smartFillTextarea}
                      rows={2}
                    />
                    <div className={styles.smartFillHint}>
                      Format: Name, Date, Time, Location (comma-separated)
                    </div>
                    <button
                      type="button"
                      onClick={handleSmartFill}
                      className={styles.smartFillButton}
                      disabled={smartFillText.trim().length < 10}
                    >
                      Fill Form
                    </button>
                  </div>
                )}
              </div>

              {/* ── Name Field ── */}
              <div className={styles.premiumField}>
                <PremiumInput
                  label={t("home.formName")}
                  value={draft.name}
                  onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
                  placeholder={t("home.formNamePlaceholder")}
                  required
                />
              </div>


              {/* ── Birth Date + Birth Time Row ── */}
              <div className={styles.dateTimeRow}>
                <div className={styles.premiumField}>
                  <PremiumDatePicker
                    label={t("home.formBirthDate")}
                    value={draft.birthDate ? new Date(draft.birthDate + "T00:00:00") : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, "0");
                        const dd = String(date.getDate()).padStart(2, "0");
                        setDraft((prev) => ({ ...prev, birthDate: `${yyyy}-${mm}-${dd}` }));
                      }
                    }}
                    placeholder="Select birth date"
                    dateFormat="dd MMM yyyy"
                    required
                    maxDate={new Date()}
                    minDate={new Date(1900, 0, 1)}
                    showYearDropdown
                    showMonthDropdown
                    yearDropdownItemNumber={100}
                  />
                </div>

                <div className={styles.premiumField}>
                  {!unknownTime ? (
                    <PremiumDatePicker
                      label={t("home.formBirthTime")}
                      value={draft.birthTime ? (() => { const [h, m] = draft.birthTime.split(":"); const d = new Date(); d.setHours(Number(h), Number(m), 0, 0); return d; })() : null}
                      onChange={(date: Date | null) => {
                        if (date) {
                          const hh = String(date.getHours()).padStart(2, "0");
                          const mm = String(date.getMinutes()).padStart(2, "0");
                          setDraft((prev) => ({ ...prev, birthTime: `${hh}:${mm}` }));
                        }
                      }}
                      placeholder="Select birth time"
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeCaption="Time"
                      dateFormat="h:mm aa"
                      required={!unknownTime}
                    />
                  ) : (
                    <div className={styles.approxTimePanel}>
                      <div className={styles.approxTimeHeader}>
                        <span className={styles.approxTimeLabel}>Approximate birth time</span>
                        <span className={styles.approxTimeHint}>Choose the closest window</span>
                      </div>
                      <div className={styles.approxTimeOptions}>
                        {COARSE_TIME_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.approxTimeOption} ${
                              coarseTime === option.value ? styles.approxTimeOptionSelected : ""
                            }`}
                            onClick={() => setCoarseTime(option.value)}
                            aria-pressed={coarseTime === option.value}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Unknown birth time option ── */}
              <div className={styles.unknownTimeOption}>
                <PremiumToggle
                  label="I don't know my exact birth time"
                  checked={unknownTime}
                  onChange={(checked) => {
                    setUnknownTime(checked);
                    if (!checked) setCoarseTime("");
                    setDraft((prev) => ({ ...prev, birthTime: checked ? "" : prev.birthTime }));
                  }}
                />
              </div>

              {/* ── Section Divider ── */}
              <div className={`${styles.sectionDivider} ${styles.sectionDividerSpaced}`}>
                <div className={styles.dividerLine}></div>
                <span className={styles.dividerText}>Location</span>
                <div className={styles.dividerLine}></div>
              </div>

              {/* ── Country Field ── */}
              <div className={styles.premiumField}>
                <div className={styles.autocompleteWrapper}>
                  <label>{t("home.formCountry")}</label>
                  <AutocompleteInput
                    value={draft.country}
                    onChange={handleCountryChange}
                    onSelect={handleCountrySelect}
                    placeholder={t("home.formCountryPlaceholder")}
                    suggestType="country"
                    required
                  />
                </div>
              </div>

              {/* ── State Field ── */}
              <div className={styles.premiumField}>
                <div className={styles.autocompleteWrapper}>
                  <label>{t("home.formState")}</label>
                  <AutocompleteInput
                    value={draft.state}
                    onChange={handleStateChange}
                    onSelect={handleStateSelect}
                    placeholder={t("home.formStatePlaceholder")}
                    suggestType="state"
                    contextCountry={draft.country}
                    required
                  />
                </div>
              </div>

              {/* ── City Field ── */}
              <div className={styles.premiumField}>
                <div className={styles.autocompleteWrapper}>
                  <label>{t("home.formCity")}</label>
                  <AutocompleteInput
                    value={draft.city}
                    onChange={setField("city")}
                    onSelect={setField("city")}
                    placeholder={t("home.formCityPlaceholder")}
                    suggestType="city"
                    contextCountry={draft.country}
                    contextState={draft.state}
                    required
                  />
                </div>
              </div>

              {/* ── Lat/Lon Toggle ── */}
              <div 
                className={styles.coordsToggleWrapper}
                onClick={() => setLatLonExpanded(!latLonExpanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLatLonExpanded(!latLonExpanded); }}
              >
                <span className={styles.coordsToggleText}>
                  <GiCompass />
                  Enter coordinates manually
                </span>
                <span className={`${styles.coordsToggleArrow} ${latLonExpanded ? styles.expanded : ''}`}>&#9662;</span>
              </div>

              {latLonExpanded && (
                <div className={styles.latLonFields}>
                  <PremiumInput
                    label="Latitude"
                    value={draft.latitude}
                    onChange={(value) => setField("latitude")(value)}
                    placeholder="e.g. 40.7128"
                    required
                  />
                  <PremiumInput
                    label="Longitude"
                    value={draft.longitude}
                    onChange={(value) => setField("longitude")(value)}
                    placeholder="e.g. -74.0060"
                    required
                  />
                </div>
              )}

              </div>{/* /formSectionCard */}
            </div>{/* /formColumn */}


            {/* RIGHT COLUMN: Chart Preview */}
            <aside className={styles.previewColumn}>
              <div className={styles.previewCard}>
                <h3 className={styles.previewTitle}>
                  <GiStarSattelites /> Chart Preview
                </h3>
                {/* Use BirthChartTeaser for enhanced preview */}
                <BirthChartTeaser
                  name={draft.name}
                  birthDate={draft.birthDate}
                  birthTime={draft.birthTime}
                  country={draft.country}
                  state={draft.state}
                  city={draft.city}
                  unknownTime={unknownTime}
                  coarseTime={coarseTime}
                />

                {geoStatus === "found" && (
                  <div className={styles.coordinatesDisplay}>
                    <button 
                      type="button"
                      className={styles.coordsToggle}
                      onClick={() => setLatLonExpanded(!latLonExpanded)}
                    >
                      <GiCompass /> Show Precise Lat & Lon
                    </button>
                    {latLonExpanded && (
                      <div className={styles.coordsGrid}>
                        <span>Lat: {Number(draft.latitude).toFixed(4)}</span>
                        <span>Lon: {Number(draft.longitude).toFixed(4)}</span>
                        {draft.timeZoneId && <span>TZ: {draft.timeZoneId}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Draft saved indicator */}
              {draftSaved && (
                <div className={styles.draftIndicator}>
                  Draft saved
                </div>
              )}
            </aside>
          </div>{/* /formLayout */}

          {/* PRIMARY CTA */}
          <div className={styles.primaryAction}>
            <PremiumButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              disabled={!canSubmit}
              icon={<GiCrystalBall />}
            >
              {isSubmitting ? "Generating..." : "Generate Chart Intelligence"}
            </PremiumButton>
            {!canSubmit && (
              <p className={styles.actionHint}>
                Complete all fields to generate your chart
              </p>
            )}
            <p className={styles.trustMicrocopy}>
              🔒 Encrypted · Never shared · ~60 seconds
            </p>
          </div>

        </form>
      </main>

      {/* === FOOTER === */}
      <footer className={styles.intakeFooter}>
        <ChartHistory userName={user?.display_name} />
      </footer>

      {/* Mobile Sticky Submit Bar */}
      {showStickyBar && (
        <div className={styles.mobileStickyBar}>
          <div className={styles.stickyProgress}>
            <span className={styles.stickyProgressText}>
              {requiredFields.filter(f => draft[f].trim().length > 0).length}/{requiredFields.length} complete
            </span>
            <div className={styles.stickyProgressBar}>
              <div 
                className={styles.stickyProgressFill}
                style={{ 
                  width: `${(requiredFields.filter(f => draft[f].trim().length > 0).length / requiredFields.length) * 100}%` 
                }}
              />
            </div>
          </div>
          <PremiumButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              const form = formRef.current;
              if (form && canSubmit) {
                form.requestSubmit();
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            disabled={!canSubmit}
            icon={<GiCrystalBall />}
          >
            Continue
          </PremiumButton>
        </div>
      )}
    </div>
  );
}
