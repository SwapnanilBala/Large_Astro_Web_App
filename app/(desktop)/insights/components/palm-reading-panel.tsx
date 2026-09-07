"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { savePalmReading } from "@/lib/palm-readings/local-store";
import PalmAnnotation from "./PalmAnnotation";

/* ────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────── */

type LineReading = {
  description: string;
  interpretation: string;
  strength: "strong" | "moderate" | "faint" | "absent";
};

type LineKey = "heart_line" | "head_line" | "life_line" | "fate_line";

type LineCoord = { x: number; y: number };

type LineConfidenceEntry = {
  visibility: "clear" | "partial" | "faint" | "not_detected";
  confidence: number; // 0-1
};

type ImageQuality = {
  rating: "excellent" | "good" | "marginal" | "poor";
  issues: string[];
  reliable_for_reading: boolean;
  notes: string;
};

type JyotishCorrelationItem = {
  palm_indicator: string;
  chart_factor: string;
  reinforcement: "strong" | "moderate" | "contradictory" | "neutral";
  reading: string;
};

type JyotishCorrelation = {
  summary: string;
  correlations: JyotishCorrelationItem[];
};

type DashaRelevanceIndicator = {
  indicator: string;
  relevance_to_dasha: string;
  timing_note?: string;
};

type DashaRelevance = {
  active_period_summary: string;
  relevant_palm_indicators: DashaRelevanceIndicator[];
};

type SanskritTerm = {
  term: string;
  meaning: string;
  observation: string;
};

type ClassicalFrameworkNotes = {
  framework: string;
  sanskrit_terms: SanskritTerm[];
  classical_text_references: string[];
};

export type JyotishContext = {
  ascendant?: { sign: string; degree: number; nakshatra: string };
  moonSign?: string;
  moonNakshatra?: string;
  sunSign?: string;
  currentMahadasha?: { lord: string; remaining_years: number };
  currentAntardasha?: { lord: string; remaining_months: number };
  keyPlacements?: Array<{
    planet: string;
    sign: string;
    house: number;
    nakshatra: string;
  }>;
};

type LifeTrajectory = {
  current_phase: string;
  near_future: string;
  long_term_path: string;
  challenges: string;
  opportunities: string;
};

type CareerAndPurpose = {
  natural_talents: string;
  career_direction: string;
  purpose_alignment: string;
};

type RelationshipsAndEmotional = {
  emotional_state: string;
  relationship_dynamics: string;
  connection_style: string;
};

type HealthAndVitality = {
  energy_levels: string;
  stress_indicators: string;
  wellness_advice: string;
};

type PalmReading = {
  overall_summary: string;
  dominant_hand_note: string;
  lines: {
    heart_line: LineReading;
    head_line: LineReading;
    life_line: LineReading;
    fate_line: LineReading;
  };
  life_trajectory: LifeTrajectory;
  career_and_purpose: CareerAndPurpose;
  relationships_and_emotional: RelationshipsAndEmotional;
  health_and_vitality: HealthAndVitality;
  mounts: { prominent: string[]; interpretation: string };
  fingers: { observation: string; interpretation: string };
  special_markings: { observed: string[]; interpretation: string };
  guidance: string;

  /* ── NEW optional fields ── */
  image_quality?: ImageQuality;
  line_confidence?: Partial<Record<LineKey, LineConfidenceEntry>>;
  line_coordinates?: Partial<Record<LineKey, LineCoord[]>>;
  jyotish_correlation?: JyotishCorrelation;
  dasha_relevance?: DashaRelevance;
  classical_framework_notes?: ClassicalFrameworkNotes;
};

type Phase = "idle" | "camera" | "captured" | "analyzing" | "results";

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */

const STRENGTH_COLORS: Record<LineReading["strength"], string> = {
  strong: "var(--accent-aqua)",
  moderate: "var(--accent-gold)",
  faint: "var(--accent-coral)",
  absent: "#888",
};

const LINE_LABELS: Record<string, string> = {
  heart_line: "Heart Line",
  head_line: "Head Line",
  life_line: "Life Line",
  fate_line: "Fate Line",
};

const MAX_PALM_IMAGE_BYTES = 5 * 1024 * 1024;

const REVEAL_DELAY_MS = 700;

const REVEAL_SEQUENCE = [
  "image_quality_warning",
  "summary",
  "annotated_image",
  "lines",
  "trajectory",
  "jyotish_correlation",
  "dasha_relevance",
  "career",
  "relationships",
  "health",
  "mounts",
  "fingers",
  "markings",
  "classical_framework",
  "guidance",
] as const;
type RevealSection = (typeof REVEAL_SEQUENCE)[number];

const VISIBILITY_BADGE_COLORS: Record<LineConfidenceEntry["visibility"], string> = {
  clear: "var(--accent-aqua)",
  partial: "var(--accent-gold)",
  faint: "var(--accent-coral)",
  not_detected: "#888",
};

const VISIBILITY_LABEL: Record<LineConfidenceEntry["visibility"], string> = {
  clear: "Clear",
  partial: "Partial",
  faint: "Faint",
  not_detected: "Not detected",
};

const REINFORCEMENT_COLORS: Record<JyotishCorrelationItem["reinforcement"], string> = {
  strong: "var(--accent-gold)",
  moderate: "var(--accent-aqua)",
  contradictory: "var(--accent-coral)",
  neutral: "#888",
};

/* ────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────── */

type PalmReadingPanelProps = {
  jyotishContext?: JyotishContext;
};

export default function PalmReadingPanel({ jyotishContext }: PalmReadingPanelProps = {}) {
  /* ── state ── */
  const [phase, setPhase] = useState<Phase>("idle");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [reading, setReading] = useState<PalmReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [handScore, setHandScore] = useState(0);
  const [classicalMode, setClassicalMode] = useState(false);
  const [imageQualityDismissed, setImageQualityDismissed] = useState(false);
  const [revealedSections, setRevealedSections] = useState<Set<RevealSection>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* ── refs ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const drawingUtilsRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastLandmarksRef = useRef<any>(null);
  const handConnectionsRef = useRef<any>(null);
  const DrawingUtilsClassRef = useRef<any>(null);

  /* ── MediaPipe initialization ── */
  const initMediaPipe = useCallback(async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const { HandLandmarker, FilesetResolver, DrawingUtils } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      handLandmarkerRef.current = handLandmarker;
      handConnectionsRef.current = HandLandmarker.HAND_CONNECTIONS;
      DrawingUtilsClassRef.current = DrawingUtils;

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          drawingUtilsRef.current = new DrawingUtils(ctx);
        }
      }
    } catch (err) {
      console.error("MediaPipe init failed:", err);
    }
  }, []);

  useEffect(() => {
    initMediaPipe();
    return () => {
      stopCamera();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── detection loop ── */
  const detectLoop = useCallback(() => {
    const detect = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = handLandmarkerRef.current;
      const du = drawingUtilsRef.current;

      if (!video || !canvas || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      // Lazily init DrawingUtils when canvas is available
      if (!du && DrawingUtilsClassRef.current) {
        const ctx2d = canvas.getContext("2d");
        if (ctx2d) {
          drawingUtilsRef.current = new DrawingUtilsClassRef.current(ctx2d);
        }
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      if (!du) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      const results = landmarker.detectForVideo(video, performance.now());

      if (results.landmarks && results.landmarks.length > 0) {
        const score = results.handedness?.[0]?.[0]?.score ?? 0;
        setHandDetected(true);
        setHandScore(score);
        lastLandmarksRef.current = results.landmarks[0];

        du.drawConnectors(results.landmarks[0], handConnectionsRef.current, {
          color: "#6ce1d4",
          lineWidth: 2,
        });
        du.drawLandmarks(results.landmarks[0], {
          color: "#f2c26c",
          lineWidth: 1,
          radius: 3,
        });
      } else {
        setHandDetected(false);
        setHandScore(0);
        lastLandmarksRef.current = null;
      }

      rafRef.current = requestAnimationFrame(detect);
    };
    rafRef.current = requestAnimationFrame(detect);
  }, []);

  /* ── camera lifecycle ── */
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setPhase("camera");
      detectLoop();
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        streamRef.current = stream;
        setPhase("camera");
        detectLoop();
      } catch {
        setError("Camera access denied. Please use the upload option instead.");
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  /* ── capture frame ── */
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Draw landmarks on captured image too
    if (lastLandmarksRef.current && DrawingUtilsClassRef.current && handConnectionsRef.current) {
      try {
        const du2 = new DrawingUtilsClassRef.current(ctx);
        du2.drawConnectors(lastLandmarksRef.current, handConnectionsRef.current, {
          color: "#6ce1d4",
          lineWidth: 2,
        });
        du2.drawLandmarks(lastLandmarksRef.current, {
          color: "#f2c26c",
          lineWidth: 1,
          radius: 3,
        });
      } catch { /* fallback: no landmarks on capture */ }
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1];
    if (Math.floor((base64.length * 3) / 4) > MAX_PALM_IMAGE_BYTES) {
      setError("Palm image is too large. Please capture a closer, lower-resolution image under 5MB.");
      return;
    }

    setImageData(base64);
    setImagePreview(dataUrl);
    setMediaType("image/jpeg");
    stopCamera();
    setPhase("captured");
  };

  /* ── file upload handler ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_PALM_IMAGE_BYTES) {
      setError("Palm image is too large. Please upload an image under 5MB.");
      return;
    }

    const mt = file.type as typeof mediaType;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mt)) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setImageData(base64);
      setImagePreview(dataUrl);
      setMediaType(mt);
      setPhase("captured");
    };
    reader.readAsDataURL(file);
  };

  /* ── API call ── */
  const analyzePalm = async () => {
    if (!imageData) return;

    setPhase("analyzing");
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const body: Record<string, unknown> = { image: imageData, mediaType };
      if (classicalMode) body.classicalMode = true;
      if (jyotishContext) body.jyotishContext = jyotishContext;
      const res = await fetch("/api/palm-reading", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || err.detail || "Analysis failed");
      }
      setReading(await res.json());
      setSaveState("idle");
      setSaveError(null);
      setImageQualityDismissed(false);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("captured");
    }
  };

  /* ── reset ── */
  const clearRevealTimers = useCallback(() => {
    revealTimersRef.current.forEach((t) => clearTimeout(t));
    revealTimersRef.current = [];
  }, []);

  const resetAll = () => {
    stopCamera();
    setPhase("idle");
    setImageData(null);
    setImagePreview(null);
    setReading(null);
    setError(null);
    setHandDetected(false);
    setHandScore(0);
    setRevealedSections(new Set());
    setSaveState("idle");
    setSaveError(null);
    setImageQualityDismissed(false);
    clearRevealTimers();
    lastLandmarksRef.current = null;
  };

  /* ── which reveal sections actually apply to this reading? ── */
  const applicableSections = useMemo<RevealSection[]>(() => {
    if (!reading) return [];
    const out: RevealSection[] = [];
    const showImageWarning =
      reading.image_quality &&
      (reading.image_quality.reliable_for_reading === false ||
        reading.image_quality.rating === "marginal");
    if (showImageWarning) out.push("image_quality_warning");
    out.push("summary");
    if (
      reading.line_coordinates &&
      Object.values(reading.line_coordinates).some(
        (pts) => Array.isArray(pts) && pts.length > 0,
      )
    ) {
      out.push("annotated_image");
    }
    out.push("lines");
    if (reading.life_trajectory) out.push("trajectory");
    if (reading.jyotish_correlation) out.push("jyotish_correlation");
    if (reading.dasha_relevance) out.push("dasha_relevance");
    if (reading.career_and_purpose) out.push("career");
    if (reading.relationships_and_emotional) out.push("relationships");
    if (reading.health_and_vitality) out.push("health");
    if (reading.mounts) out.push("mounts");
    if (reading.fingers) out.push("fingers");
    if (reading.special_markings) out.push("markings");
    if (reading.classical_framework_notes) out.push("classical_framework");
    out.push("guidance");
    return out;
  }, [reading]);

  /* ── progressive reveal effect ── */
  useEffect(() => {
    if (phase !== "results" || !reading) return;
    clearRevealTimers();

    // Detect prefers-reduced-motion at effect time (SSR-safe).
    let reduced = false;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      try {
        reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        reduced = false;
      }
    }

    if (reduced) {
      setRevealedSections(new Set(applicableSections));
      return;
    }

    // Reveal first section immediately, then stagger the rest.
    setRevealedSections(new Set(applicableSections.slice(0, 1)));
    for (let i = 1; i < applicableSections.length; i++) {
      const t = setTimeout(() => {
        setRevealedSections((prev) => {
          const next = new Set(prev);
          next.add(applicableSections[i]);
          return next;
        });
      }, i * REVEAL_DELAY_MS);
      revealTimersRef.current.push(t);
    }

    return () => clearRevealTimers();
  }, [phase, reading, applicableSections, clearRevealTimers]);

  const skipAnimations = useCallback(() => {
    clearRevealTimers();
    setRevealedSections(new Set(applicableSections));
  }, [applicableSections, clearRevealTimers]);

  /* ── save reading ── */
  const saveReading = async () => {
    if (!reading || !imagePreview) return;
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    setSaveError(null);
    try {
      // The store downscales the image before writing — a full-resolution palm
      // photo would exhaust the browser's storage quota on its own.
      await savePalmReading({
        image_data_url: imagePreview,
        reading,
        jyotish_context: jyotishContext ?? null,
        classical_mode: classicalMode,
      });
      setSaveState("saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save reading");
      setSaveState("error");
    }
  };

  /* ── status helpers ── */
  const statusText = !handDetected
    ? "No hand detected"
    : handScore > 0.7
      ? "Palm detected clearly!"
      : "Hand detected — hold steady";

  const statusClass = !handDetected
    ? "palm-status"
    : handScore > 0.7
      ? "palm-status palm-status--clear"
      : "palm-status palm-status--detected";

  /* ── stagger animation variants ── */
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  };

  /* ── render ── */
  return (
    <section className="palm-panel">
      {/* Hidden canvas for capture */}
      <canvas ref={captureCanvasRef} style={{ display: "none" }} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {/* ═══ IDLE ═══ */}
      {phase === "idle" && (
        <div className="palm-idle">
          <div className="palm-header">
            <span className="palm-kicker">Palm Reading</span>
            <h2 className="palm-heading">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: "middle" }}>
                <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0" />
                <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" />
              </svg>
              Palm Reading Analysis
            </h2>
          </div>
          <p className="palm-intro">
            Use your camera or upload an image of your palm for an AI-powered analysis of your palm lines,
            mounts, and special markings. Get personalized insights based on ancient palmistry traditions.
          </p>

          {/* Classical mode toggle */}
          <label className="palm-toggle">
            <span className="palm-toggle-text">
              <span className="palm-toggle-title">Hasta Samudrika Shastra mode</span>
              <span className="palm-toggle-subtitle">Classical Vedic palmistry only</span>
            </span>
            <span
              className={`palm-toggle-switch ${classicalMode ? "is-on" : ""}`}
              role="switch"
              aria-checked={classicalMode}
            >
              <input
                type="checkbox"
                checked={classicalMode}
                onChange={(e) => setClassicalMode(e.target.checked)}
                className="palm-toggle-input"
              />
              <span className="palm-toggle-thumb" />
            </span>
          </label>

          <div className="palm-actions">
            <button className="palm-btn-camera" onClick={startCamera}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Open Camera
            </button>
            <button className="palm-btn-upload" onClick={() => fileInputRef.current?.click()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Image
            </button>
          </div>
          <ul className="palm-tips">
            <li>Place your dominant hand flat, palm facing the camera</li>
            <li>Ensure good, even lighting without harsh shadows</li>
            <li>Keep your fingers slightly spread apart</li>
          </ul>
          {error && (
            <div className="palm-error">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ═══ CAMERA ═══ */}
      {phase === "camera" && (
        <div className="palm-camera-phase">
          <div className="palm-camera-wrap">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="palm-camera-video"
            />
            <canvas ref={canvasRef} className="palm-camera-overlay" />
          </div>

          <div className={statusClass}>
            <span className="palm-status-dot" />
            {statusText}
          </div>

          <div className="palm-confidence">
            <div className="palm-confidence-bar" style={{ width: `${Math.round(handScore * 100)}%` }} />
            <span className="palm-confidence-label">{Math.round(handScore * 100)}% confidence</span>
          </div>

          <div className="palm-actions">
            <button className="palm-capture-btn" onClick={captureFrame} disabled={!handDetected || handScore <= 0.7} title="Capture">
              <span className="palm-capture-inner" />
            </button>
          </div>
          <div className="palm-actions" style={{ marginTop: 8 }}>
            <button className="palm-btn-upload" onClick={() => { stopCamera(); resetAll(); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ═══ CAPTURED ═══ */}
      {phase === "captured" && (
        <div className="palm-captured-phase">
          {imagePreview && (
            <div className="palm-preview">
              <img src={imagePreview} alt="Captured palm" />
            </div>
          )}
          <div className="palm-actions">
            <button className="palm-btn-camera" onClick={() => { setImageData(null); setImagePreview(null); startCamera(); }}>
              Retake
            </button>
            <button className="palm-btn-upload" onClick={resetAll}>Upload Different Image</button>
          </div>
          <button className="palm-submit" onClick={analyzePalm}>
            Analyze My Palm
          </button>
          {error && (
            <div className="palm-error">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYZING ═══ */}
      {phase === "analyzing" && (
        <div className="palm-loading">
          {imagePreview && (
            <div className="palm-preview palm-preview--dimmed">
              <img src={imagePreview} alt="Analyzing palm" />
            </div>
          )}
          <div className="palm-loading-content">
            <div className="palm-loading-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0" />
                <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" />
              </svg>
            </div>
            <p className="palm-loading-text">Reading your palm<span className="palm-dots" /></p>
          </div>
          {/* Skeleton layout */}
          <div className="palm-skeleton">
            <div className="palm-skel-block palm-skel-summary" />
            <div className="palm-skel-grid">
              <div className="palm-skel-block" />
              <div className="palm-skel-block" />
              <div className="palm-skel-block" />
              <div className="palm-skel-block" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {phase === "results" && reading && (() => {
        const sectionVariants = {
          hidden: { opacity: 0, y: 18 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
        };
        const isRevealed = (id: RevealSection) => revealedSections.has(id);
        const allRevealed = revealedSections.size >= applicableSections.length;
        const iq = reading.image_quality;
        const showHardWarning =
          !!iq && iq.reliable_for_reading === false && !imageQualityDismissed;
        const showSoftWarning =
          !!iq && iq.reliable_for_reading !== false && iq.rating === "marginal";
        const lineKeys: LineKey[] = ["heart_line", "head_line", "life_line", "fate_line"];
        const lineCoords = reading.line_coordinates ?? {};
        const hasAnyCoords = lineKeys.some(
          (k) => Array.isArray(lineCoords[k]) && (lineCoords[k] as LineCoord[]).length > 0,
        );
        return (
          <div className="palm-results">
            <div className="palm-results-top">
              <button className="palm-btn-camera" onClick={resetAll}>New Reading</button>
              <button
                className="palm-save-btn"
                onClick={saveReading}
                disabled={saveState === "saving" || saveState === "saved"}
                title={saveState === "saved" ? "Already saved" : "Save this reading to this device"}
              >
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                  ? "Saved ✓"
                  : "Save reading"}
              </button>
              {!allRevealed && (
                <button
                  className="palm-skip-btn"
                  onClick={skipAnimations}
                  type="button"
                >
                  Skip animations
                </button>
              )}
              {imagePreview && (
                <div className="palm-preview palm-preview--small">
                  <img src={imagePreview} alt="Your palm" />
                </div>
              )}
            </div>
            {saveState === "saved" && (
              <div className="palm-save-toast">
                Saved to your readings{" "}
                <a href="/insights/palm-history" className="palm-save-link">
                  View history &#8599;
                </a>
              </div>
            )}
            {saveState === "error" && saveError && (
              <div className="palm-error" role="alert">
                {saveError}
              </div>
            )}

            {/* Image quality warning (hard) */}
            {isRevealed("image_quality_warning") && showHardWarning && iq && (
              <motion.div
                className="palm-image-warning palm-image-warning--hard"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
                role="alert"
              >
                <div className="palm-image-warning-head">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <span className="palm-image-warning-title">
                    Image quality may affect accuracy
                  </span>
                  <button
                    type="button"
                    className="palm-image-warning-dismiss"
                    onClick={() => setImageQualityDismissed(true)}
                    aria-label="Dismiss warning"
                  >
                    &times;
                  </button>
                </div>
                {iq.notes && <p className="palm-image-warning-notes">{iq.notes}</p>}
                {Array.isArray(iq.issues) && iq.issues.length > 0 && (
                  <ul className="palm-image-warning-list">
                    {iq.issues.map((issue, i) => (
                      <li key={`${issue}-${i}`}>{issue}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
            {/* Image quality warning (soft / marginal) */}
            {isRevealed("image_quality_warning") && showSoftWarning && iq && (
              <motion.div
                className="palm-image-warning palm-image-warning--soft"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <div className="palm-image-warning-head">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span className="palm-image-warning-title">
                    Image is marginal — interpret with care
                  </span>
                </div>
                {iq.notes && <p className="palm-image-warning-notes">{iq.notes}</p>}
              </motion.div>
            )}

            {/* Overall Summary */}
            {isRevealed("summary") && (
              <motion.div
                className="palm-summary-card"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Overall Summary</h3>
                <p>{reading.overall_summary}</p>
                {reading.dominant_hand_note && (
                  <p className="palm-hand-note">
                    <em>{reading.dominant_hand_note}</em>
                  </p>
                )}
              </motion.div>
            )}

            {/* Annotated Image */}
            {isRevealed("annotated_image") && hasAnyCoords && imagePreview && (
              <motion.div
                className="palm-section-card palm-section-card--annotated"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Annotated Palm</h3>
                <PalmAnnotation
                  imageDataUrl={imagePreview}
                  coordinates={lineCoords}
                  showLabels={true}
                  highlightLine={null}
                />
              </motion.div>
            )}

            {/* Lines Grid */}
            {isRevealed("lines") && reading.lines && (
              <motion.div
                className="palm-lines-grid"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                {(Object.entries(reading.lines) as [string, LineReading][]).map(
                  ([key, line]) => {
                    const conf =
                      reading.line_confidence?.[key as LineKey];
                    const visibility = conf?.visibility;
                    const pct =
                      conf && typeof conf.confidence === "number"
                        ? Math.round(Math.max(0, Math.min(1, conf.confidence)) * 100)
                        : null;
                    return (
                      <div
                        key={key}
                        className="palm-line-card"
                        style={{ borderLeftColor: STRENGTH_COLORS[line.strength] }}
                      >
                        <div className="palm-line-header">
                          <h4>{LINE_LABELS[key] || key}</h4>
                          <span className={`palm-strength palm-strength--${line.strength}`}>
                            {line.strength}
                          </span>
                        </div>
                        {visibility && (
                          <div
                            className={`palm-line-confidence palm-line-confidence--${visibility}`}
                            style={{ color: VISIBILITY_BADGE_COLORS[visibility] }}
                          >
                            <span
                              className="palm-line-confidence-dot"
                              style={{ background: VISIBILITY_BADGE_COLORS[visibility] }}
                            />
                            {VISIBILITY_LABEL[visibility]}
                            {visibility !== "not_detected" && pct !== null && ` (${pct}%)`}
                          </div>
                        )}
                        <p className="palm-line-desc">{line.description}</p>
                        <p className="palm-line-interp">{line.interpretation}</p>
                      </div>
                    );
                  },
                )}
              </motion.div>
            )}

            {/* Life Trajectory */}
            {isRevealed("trajectory") && reading.life_trajectory && (
              <motion.div
                className="palm-trajectory-hero"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Life Trajectory</h3>
                <div className="palm-trajectory-grid">
                  <div className="palm-trajectory-item">
                    <span className="palm-trajectory-label">Current Phase</span>
                    <p>{reading.life_trajectory.current_phase}</p>
                  </div>
                  <div className="palm-trajectory-item">
                    <span className="palm-trajectory-label">Near Future</span>
                    <p>{reading.life_trajectory.near_future}</p>
                  </div>
                  <div className="palm-trajectory-item">
                    <span className="palm-trajectory-label">Long-Term Path</span>
                    <p>{reading.life_trajectory.long_term_path}</p>
                  </div>
                  <div className="palm-trajectory-item palm-trajectory-item--challenge">
                    <span className="palm-trajectory-label">Challenges</span>
                    <p>{reading.life_trajectory.challenges}</p>
                  </div>
                  <div className="palm-trajectory-item palm-trajectory-item--opportunity">
                    <span className="palm-trajectory-label">Opportunities</span>
                    <p>{reading.life_trajectory.opportunities}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Jyotish Correlation */}
            {isRevealed("jyotish_correlation") && reading.jyotish_correlation && (
              <motion.div
                className="palm-section-card palm-section-card--jyotish"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Chart &times; Palm Synthesis</h3>
                {reading.jyotish_correlation.summary && (
                  <p className="palm-section-lead">
                    {reading.jyotish_correlation.summary}
                  </p>
                )}
                {Array.isArray(reading.jyotish_correlation.correlations) &&
                  reading.jyotish_correlation.correlations.length > 0 && (
                    <ul className="palm-correlation-list">
                      {reading.jyotish_correlation.correlations.map((c, i) => (
                        <li key={i} className="palm-correlation-item">
                          <div className="palm-correlation-row">
                            <span className="palm-correlation-palm">
                              {c.palm_indicator}
                            </span>
                            <span className="palm-correlation-link">&harr;</span>
                            <span className="palm-correlation-chart">
                              {c.chart_factor}
                            </span>
                            <span
                              className={`palm-reinforcement palm-reinforcement--${c.reinforcement}`}
                              style={{
                                background: REINFORCEMENT_COLORS[c.reinforcement] + "22",
                                color: REINFORCEMENT_COLORS[c.reinforcement],
                                borderColor: REINFORCEMENT_COLORS[c.reinforcement],
                              }}
                            >
                              {c.reinforcement}
                            </span>
                          </div>
                          {c.reading && (
                            <p className="palm-correlation-reading">{c.reading}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
              </motion.div>
            )}

            {/* Dasha Relevance */}
            {isRevealed("dasha_relevance") && reading.dasha_relevance && (
              <motion.div
                className="palm-section-card palm-section-card--dasha"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Active Dasha Lens</h3>
                {reading.dasha_relevance.active_period_summary && (
                  <p className="palm-section-lead">
                    {reading.dasha_relevance.active_period_summary}
                  </p>
                )}
                {Array.isArray(reading.dasha_relevance.relevant_palm_indicators) &&
                  reading.dasha_relevance.relevant_palm_indicators.length > 0 && (
                    <ul className="palm-dasha-list">
                      {reading.dasha_relevance.relevant_palm_indicators.map(
                        (item, i) => (
                          <li key={i} className="palm-dasha-item">
                            <h4 className="palm-dasha-indicator">{item.indicator}</h4>
                            <p>{item.relevance_to_dasha}</p>
                            {item.timing_note && (
                              <p className="palm-dasha-timing">
                                <em>{item.timing_note}</em>
                              </p>
                            )}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
              </motion.div>
            )}

            {/* Career & Purpose */}
            {isRevealed("career") && reading.career_and_purpose && (
              <motion.div
                className="palm-section-card palm-section-card--career"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Career &amp; Life Purpose</h3>
                <div className="palm-subsection">
                  <h4>Natural Talents</h4>
                  <p>{reading.career_and_purpose.natural_talents}</p>
                </div>
                <div className="palm-subsection">
                  <h4>Career Direction</h4>
                  <p>{reading.career_and_purpose.career_direction}</p>
                </div>
                <div className="palm-subsection">
                  <h4>Purpose Alignment</h4>
                  <p>{reading.career_and_purpose.purpose_alignment}</p>
                </div>
              </motion.div>
            )}

            {/* Relationships & Emotional */}
            {isRevealed("relationships") && reading.relationships_and_emotional && (
              <motion.div
                className="palm-section-card palm-section-card--relationships"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Relationships &amp; Emotional Landscape</h3>
                <div className="palm-subsection">
                  <h4>Emotional State</h4>
                  <p>{reading.relationships_and_emotional.emotional_state}</p>
                </div>
                <div className="palm-subsection">
                  <h4>Relationship Dynamics</h4>
                  <p>{reading.relationships_and_emotional.relationship_dynamics}</p>
                </div>
                <div className="palm-subsection">
                  <h4>Connection Style</h4>
                  <p>{reading.relationships_and_emotional.connection_style}</p>
                </div>
              </motion.div>
            )}

            {/* Health & Vitality */}
            {isRevealed("health") && reading.health_and_vitality && (
              <motion.div
                className="palm-section-card palm-section-card--health"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Health &amp; Vitality</h3>
                <div className="palm-subsection">
                  <h4>Energy Levels</h4>
                  <p>{reading.health_and_vitality.energy_levels}</p>
                </div>
                <div className="palm-subsection">
                  <h4>Stress Indicators</h4>
                  <p>{reading.health_and_vitality.stress_indicators}</p>
                </div>
                <div className="palm-subsection">
                  <h4>Wellness Advice</h4>
                  <p>{reading.health_and_vitality.wellness_advice}</p>
                </div>
              </motion.div>
            )}

            {/* Mounts */}
            {isRevealed("mounts") && reading.mounts && (
              <motion.div
                className="palm-section-card"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Mounts</h3>
                {Array.isArray(reading.mounts.prominent) && reading.mounts.prominent.length > 0 && (
                  <div className="palm-chips">
                    {reading.mounts.prominent.map((m) => (
                      <span key={m} className="palm-chip">{m}</span>
                    ))}
                  </div>
                )}
                {reading.mounts.interpretation && <p>{reading.mounts.interpretation}</p>}
              </motion.div>
            )}

            {/* Fingers */}
            {isRevealed("fingers") && reading.fingers && (
              <motion.div
                className="palm-section-card"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Fingers</h3>
                {reading.fingers.observation && (
                  <p className="palm-observation">{reading.fingers.observation}</p>
                )}
                {reading.fingers.interpretation && <p>{reading.fingers.interpretation}</p>}
              </motion.div>
            )}

            {/* Special Markings */}
            {isRevealed("markings") && reading.special_markings && (
              <motion.div
                className="palm-section-card"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Special Markings</h3>
                {Array.isArray(reading.special_markings.observed) &&
                  reading.special_markings.observed.length > 0 && (
                    <div className="palm-chips">
                      {reading.special_markings.observed.map((m) => (
                        <span key={m} className="palm-chip">{m}</span>
                      ))}
                    </div>
                  )}
                {reading.special_markings.interpretation && (
                  <p>{reading.special_markings.interpretation}</p>
                )}
              </motion.div>
            )}

            {/* Classical framework notes */}
            {isRevealed("classical_framework") && reading.classical_framework_notes && (
              <motion.div
                className="palm-section-card palm-section-card--classical"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Hasta Samudrika Shastra Framework</h3>
                {Array.isArray(reading.classical_framework_notes.sanskrit_terms) &&
                  reading.classical_framework_notes.sanskrit_terms.length > 0 && (
                    <ul className="palm-sanskrit-list">
                      {reading.classical_framework_notes.sanskrit_terms.map((t, i) => (
                        <li key={`${t.term}-${i}`} className="palm-sanskrit-item">
                          <span className="palm-sanskrit-term">{t.term}</span>
                          <span className="palm-sanskrit-meaning">{t.meaning}</span>
                          {t.observation && (
                            <p className="palm-sanskrit-observation">{t.observation}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                {Array.isArray(
                  reading.classical_framework_notes.classical_text_references,
                ) &&
                  reading.classical_framework_notes.classical_text_references.length > 0 && (
                    <div className="palm-classical-refs">
                      {reading.classical_framework_notes.classical_text_references.map(
                        (ref, i) => (
                          <span key={`${ref}-${i}`} className="palm-chip palm-chip--ref">
                            {ref}
                          </span>
                        ),
                      )}
                    </div>
                  )}
              </motion.div>
            )}

            {/* Guidance */}
            {isRevealed("guidance") && reading.guidance && (
              <motion.div
                className="palm-guidance"
                variants={sectionVariants}
                initial="hidden"
                animate="show"
              >
                <h3>Guidance</h3>
                <p>{reading.guidance}</p>
              </motion.div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
