"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

/* ────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────── */

type LineReading = {
  description: string;
  interpretation: string;
  strength: "strong" | "moderate" | "faint" | "absent";
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
  mounts: { prominent: string[]; interpretation: string };
  fingers: { observation: string; interpretation: string };
  special_markings: { observed: string[]; interpretation: string };
  guidance: string;
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

/* ────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────── */

export default function PalmReadingPanel() {
  /* ── state ── */
  const [phase, setPhase] = useState<Phase>("idle");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [reading, setReading] = useState<PalmReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [handScore, setHandScore] = useState(0);

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
      const res = await fetch("/api/palm-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, mediaType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Analysis failed");
      }
      setReading(await res.json());
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("captured");
    }
  };

  /* ── reset ── */
  const resetAll = () => {
    stopCamera();
    setPhase("idle");
    setImageData(null);
    setImagePreview(null);
    setReading(null);
    setError(null);
    setHandDetected(false);
    setHandScore(0);
    lastLandmarksRef.current = null;
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
            <span className="palm-kicker">Pro Feature</span>
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
          {error && <div className="palm-error">{error}</div>}
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
          {error && <div className="palm-error">{error}</div>}
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
      {phase === "results" && reading && (
        <motion.div
          className="palm-results"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <div className="palm-results-top">
            <button className="palm-btn-camera" onClick={resetAll}>New Reading</button>
            {imagePreview && (
              <div className="palm-preview palm-preview--small">
                <img src={imagePreview} alt="Your palm" />
              </div>
            )}
          </div>

          {/* Overall Summary */}
          <motion.div className="palm-summary-card" variants={itemVariants}>
            <h3>Overall Summary</h3>
            <p>{reading.overall_summary}</p>
          </motion.div>

          {/* Dominant Hand Note */}
          <motion.p className="palm-hand-note" variants={itemVariants}>
            <em>{reading.dominant_hand_note}</em>
          </motion.p>

          {/* Lines Grid */}
          <motion.div className="palm-lines-grid" variants={itemVariants}>
            {(Object.entries(reading.lines) as [string, LineReading][]).map(([key, line]) => (
              <motion.div
                key={key}
                className="palm-line-card"
                style={{ borderLeftColor: STRENGTH_COLORS[line.strength] }}
                variants={itemVariants}
              >
                <div className="palm-line-header">
                  <h4>{LINE_LABELS[key] || key}</h4>
                  <span
                    className={`palm-strength palm-strength--${line.strength}`}
                  >
                    {line.strength}
                  </span>
                </div>
                <p className="palm-line-desc">{line.description}</p>
                <p className="palm-line-interp">{line.interpretation}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Mounts */}
          <motion.div className="palm-section-card" variants={itemVariants}>
            <h3>Mounts</h3>
            <div className="palm-chips">
              {reading.mounts.prominent.map((m) => (
                <span key={m} className="palm-chip">{m}</span>
              ))}
            </div>
            <p>{reading.mounts.interpretation}</p>
          </motion.div>

          {/* Fingers */}
          <motion.div className="palm-section-card" variants={itemVariants}>
            <h3>Fingers</h3>
            <p className="palm-observation">{reading.fingers.observation}</p>
            <p>{reading.fingers.interpretation}</p>
          </motion.div>

          {/* Special Markings */}
          <motion.div className="palm-section-card" variants={itemVariants}>
            <h3>Special Markings</h3>
            <div className="palm-chips">
              {reading.special_markings.observed.map((m) => (
                <span key={m} className="palm-chip">{m}</span>
              ))}
            </div>
            <p>{reading.special_markings.interpretation}</p>
          </motion.div>

          {/* Guidance */}
          <motion.div className="palm-guidance" variants={itemVariants}>
            <h3>Guidance</h3>
            <p>{reading.guidance}</p>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
