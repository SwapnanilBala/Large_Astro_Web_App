import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";

// ---------------------------------------------------------------------------
// Structured error logger
// ---------------------------------------------------------------------------

function logApiError(route: string, error: unknown, context?: Record<string, unknown>) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    route,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }));
}

const OPENAI_TIMEOUT_MS = 30_000;
const MAX_JSON_BODY_BYTES = 7 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Jyotish context types (request-side)
// ---------------------------------------------------------------------------

type JyotishAscendant = {
  sign: string;
  degree: number;
  nakshatra: string;
};

type JyotishDasha = {
  lord: string;
  remaining_years: number;
};

type JyotishAntardasha = {
  lord: string;
  remaining_months: number;
};

type JyotishPlacement = {
  planet: string;
  sign: string;
  house: number;
  nakshatra: string;
};

type JyotishContext = {
  ascendant?: JyotishAscendant;
  moonSign?: string;
  moonNakshatra?: string;
  sunSign?: string;
  currentMahadasha?: JyotishDasha;
  currentAntardasha?: JyotishAntardasha;
  keyPlacements?: JyotishPlacement[];
};

// ---------------------------------------------------------------------------
// System prompt
//
// Schema as of 2026-05-14. Update the comment block here whenever the JSON
// shape returned by this prompt changes — the response shape is shared with
// the palm-reading UI panel and any consumer that parses this route.
// ---------------------------------------------------------------------------

const BASE_SCHEMA_BLOCK = `Return ONLY valid JSON — no markdown fencing, no extra text before or after the JSON object. Your response must be a single JSON object with this exact structure:

{
  "overall_summary": "A 2-3 sentence overview of the palm reading.",
  "dominant_hand_note": "A brief note about which hand appears to be shown and what that signifies in palmistry.",
  "lines": {
    "heart_line": {
      "description": "Describe what you physically observe about this line — length, depth, curvature, starting/ending points. If the line is not detected, say so explicitly here.",
      "interpretation": "What this line suggests about the person's emotional life and relationships. If not detected, note the absence and what that traditionally implies.",
      "strength": "strong" | "moderate" | "faint"
    },
    "head_line": {
      "description": "Describe what you physically observe about this line, or note its absence.",
      "interpretation": "What this line suggests about intellect and decision-making.",
      "strength": "strong" | "moderate" | "faint"
    },
    "life_line": {
      "description": "Describe what you physically observe about this line, or note its absence.",
      "interpretation": "What this line suggests about vitality and life path. Note: the life line does NOT predict lifespan.",
      "strength": "strong" | "moderate" | "faint"
    },
    "fate_line": {
      "description": "Describe what you physically observe, or note its absence.",
      "interpretation": "What this line (or its absence) suggests about career and life direction.",
      "strength": "strong" | "moderate" | "faint" | "absent"
    }
  },
  "life_trajectory": {
    "current_phase": "What phase of life the palm suggests they are in — growth, transition, stability, awakening, etc. Be specific and insightful.",
    "near_future": "What the lines, markings, and overall palm composition suggest about the coming period (months to a couple of years ahead).",
    "long_term_path": "The broader life direction and arc indicated by the palm — where their energy and lines point them toward.",
    "challenges": "Current or upcoming challenges suggested by the palm — breaks in lines, islands, crossings, or other indicators.",
    "opportunities": "Opportunities, strengths, and favorable signs to leverage based on what the palm reveals."
  },
  "career_and_purpose": {
    "natural_talents": "What the palm reveals about innate talents — finger shapes, mount development, head line characteristics.",
    "career_direction": "Career and professional trajectory insights drawn from the fate line, head line, and mount of Jupiter/Saturn.",
    "purpose_alignment": "How aligned they appear to be with their life purpose — signs of fulfillment or restlessness in the palm."
  },
  "relationships_and_emotional": {
    "emotional_state": "Current emotional landscape as revealed by the heart line depth, color, and markings.",
    "relationship_dynamics": "What the palm says about their approach to relationships — attachment style, openness, depth of connection.",
    "connection_style": "How they connect with others — the spaces between fingers, heart line curvature, and mount of Venus."
  },
  "health_and_vitality": {
    "energy_levels": "What the palm suggests about their current vitality — life line depth, color, and overall hand firmness.",
    "stress_indicators": "Any signs of stress, tension, or burnout — grille patterns, fragmented lines, or other markers.",
    "wellness_advice": "Holistic wellness suggestions based on palmistry traditions — areas to nurture and protect."
  },
  "mounts": {
    "prominent": ["List the mounts that appear most developed"],
    "interpretation": "What the prominent mounts suggest about the person's character."
  },
  "fingers": {
    "observation": "Describe notable features — length, shape, spacing.",
    "interpretation": "What finger characteristics suggest in palmistry."
  },
  "special_markings": {
    "observed": ["List any crosses, stars, triangles, islands, or other markings you can see"],
    "interpretation": "What these markings traditionally signify."
  },
  "guidance": "A positive, empowering closing message. Frame all findings as tendencies and potentials, not fixed destiny. Synthesize the life trajectory, career, relationship, and health insights into actionable encouragement.",
  "image_quality": {
    "rating": "excellent" | "good" | "marginal" | "poor",
    "issues": ["e.g. blurry", "poor lighting", "partial palm visible", "fingers cropped"],
    "reliable_for_reading": true | false,
    "notes": "1-2 sentences on overall image quality. Set reliable_for_reading to false when rating is 'poor'."
  },
  "line_confidence": {
    "heart_line": { "visibility": "clear" | "partial" | "faint" | "not_detected", "confidence": 0.0 to 1.0 },
    "head_line":  { "visibility": "clear" | "partial" | "faint" | "not_detected", "confidence": 0.0 to 1.0 },
    "life_line":  { "visibility": "clear" | "partial" | "faint" | "not_detected", "confidence": 0.0 to 1.0 },
    "fate_line":  { "visibility": "clear" | "partial" | "faint" | "not_detected", "confidence": 0.0 to 1.0 }
  },
  "line_coordinates": {
    // Normalized coordinates 0.0-1.0 relative to the image, origin top-left, x to the right, y down.
    // Each detected line is an array of 3-6 ordered points along its visible path
    // (start -> middle -> end, with extra interior points for curved lines).
    // OMIT a line's key entirely if its line_confidence visibility is "not_detected".
    "heart_line": [{ "x": 0.0, "y": 0.0 }],
    "head_line":  [{ "x": 0.0, "y": 0.0 }],
    "life_line":  [{ "x": 0.0, "y": 0.0 }],
    "fate_line":  [{ "x": 0.0, "y": 0.0 }]
  }
}

Conditional sections — include ONLY when the corresponding input was provided. If the input is missing, OMIT the entire section (do not include the key with an empty value):

  // Include "jyotish_correlation" ONLY when [NATAL CHART CONTEXT] appears in the user message:
  "jyotish_correlation": {
    "summary": "2-3 sentence overview of how the palm and natal chart agree or diverge.",
    "correlations": [
      {
        "palm_indicator": "e.g. 'Strong Sun mount'",
        "chart_factor": "e.g. 'Sun exalted in Aries in 10th house'",
        "reinforcement": "strong" | "moderate" | "contradictory" | "neutral",
        "reading": "1-2 sentences synthesizing the palm finding with the chart factor."
      }
      // 3 to 6 entries total
    ]
  }

  // Include "dasha_relevance" ONLY when a "Current Mahadasha:" line appears in the user message:
  "dasha_relevance": {
    "active_period_summary": "1-2 sentences naming the current dasha period and its themes.",
    "relevant_palm_indicators": [
      {
        "indicator": "e.g. 'Prominent fate line, deep and unbroken'",
        "relevance_to_dasha": "1-2 sentences linking this palm feature to the dasha lord's themes.",
        "timing_note": "Optional, e.g. 'Most pronounced in the next 18 months'"
      }
      // 2 to 5 entries total
    ]
  }

  // Include "classical_framework_notes" ONLY when [FRAMEWORK: Hasta Samudrika Shastra] appears in the user message:
  "classical_framework_notes": {
    "framework": "Hasta Samudrika Shastra",
    "sanskrit_terms": [
      {
        "term": "e.g. 'Manibandha'",
        "meaning": "e.g. 'wrist bracelet lines'",
        "observation": "what was observed regarding this term in the image"
      }
      // 3 to 6 entries
    ],
    "classical_text_references": ["e.g. 'Brihat Samhita Ch. 68'", "Samudrika Lakshana"]
  }

CRITICAL: omit conditional sections entirely when their inputs are absent. Never emit empty stubs. Return ONLY valid JSON — no markdown, no code fences, no commentary.`;

const STANDARD_GUIDELINES = `Important guidelines:
- Be specific about what you actually see in the image.
- Frame all readings positively — palm lines show tendencies, not fixed destiny.
- The life line does NOT predict lifespan; make this clear in your interpretation.
- Draw from both Western and Vedic palmistry traditions where relevant.
- For the life_trajectory section, provide genuinely insightful and specific observations — this is the most important section for the reader.
- For career_and_purpose, connect what you see in the palm to practical career insights.
- For relationships_and_emotional, be empathetic and constructive.
- For health_and_vitality, focus on wellness and self-care rather than medical diagnoses.
- ALWAYS assess image_quality first. Be honest: if the image is blurry, poorly lit, partial, or fingers are cropped, list the issues and set reliable_for_reading=false when rating is "poor". Still produce the full reading, but temper the interpretive depth for poor images.
- ALWAYS provide line_confidence for all four lines. Lines that are "not_detected" must still appear in the "lines" section, with description and interpretation noting the absence.
- ALWAYS provide line_coordinates as normalized [0,1] points (origin top-left). Minimum 3 points per detected line (start, middle, end); up to 6 for clearly curved lines. OMIT a line's coordinate key entirely when its visibility is "not_detected".
- If the image is unclear or not a palm, still return the JSON structure but note the limitation in the relevant fields and in image_quality.`;

const CLASSICAL_GUIDELINES = `Important guidelines (Hasta Samudrika Shastra mode):
- Use ONLY the classical Vedic framework. Do not introduce Western palmistry terminology or interpretive frames.
- Use Sanskrit terms (e.g. Hridaya Rekha, Mastaka Rekha, Ayu Rekha, Bhagya Rekha, Manibandha, Surya Rekha) and provide concise English meanings inline.
- Cite classical texts where appropriate (Brihat Samhita Ch. 68, Samudrika Lakshana, Hasta Sanjeevani) in classical_text_references.
- Frame interpretations through the classical lens of dharma, karma, ayu, artha, and moksha rather than modern psychology.
- The life line (Ayu Rekha) traditionally indicates pranic vitality — explicitly note it does NOT fix lifespan.
- ALWAYS assess image_quality first. Be honest about blur, lighting, partial palms, or cropped fingers; set reliable_for_reading=false when rating is "poor".
- ALWAYS provide line_confidence for all four lines. "not_detected" lines must still appear in "lines" with the absence noted.
- ALWAYS provide line_coordinates as normalized [0,1] points (origin top-left). 3-6 points per detected line. OMIT a line's coordinate key entirely when its visibility is "not_detected".
- classical_framework_notes MUST be included in this mode.`;

const STANDARD_SYSTEM_PROMPT = `You are an expert palmist well-versed in both Western and Vedic (Samudrika Shastra) palmistry traditions. Analyze the provided palm image and return a detailed, comprehensive reading that gives the person a thorough understanding of their present life situation and life trajectory.

${BASE_SCHEMA_BLOCK}

${STANDARD_GUIDELINES}`;

const CLASSICAL_SYSTEM_PROMPT = `You are a traditional Vedic palmist (Samudrika-shastri) reading strictly within the Hasta Samudrika Shastra framework. You do NOT use Western palmistry concepts, vocabulary, or interpretive models. All observations and readings are grounded in classical Indian palmistry as preserved in texts such as Brihat Samhita (Ch. 68), Samudrika Lakshana, and Hasta Sanjeevani.

${BASE_SCHEMA_BLOCK}

${CLASSICAL_GUIDELINES}`;

// ---------------------------------------------------------------------------
// Accepted media types
// ---------------------------------------------------------------------------

const VALID_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function estimateBase64Bytes(base64: string) {
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

// ---------------------------------------------------------------------------
// Jyotish context validation / sanitization
//
// We accept the context defensively — any malformed sub-field is dropped
// rather than erroring, so a partial chart still adds whatever value it can.
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeJyotishContext(raw: unknown): JyotishContext | undefined {
  if (!isPlainObject(raw)) return undefined;
  const out: JyotishContext = {};

  const ascendant = raw.ascendant;
  if (
    isPlainObject(ascendant) &&
    typeof ascendant.sign === "string" &&
    typeof ascendant.degree === "number" &&
    typeof ascendant.nakshatra === "string"
  ) {
    out.ascendant = {
      sign: ascendant.sign,
      degree: ascendant.degree,
      nakshatra: ascendant.nakshatra,
    };
  }

  if (typeof raw.moonSign === "string") out.moonSign = raw.moonSign;
  if (typeof raw.moonNakshatra === "string") out.moonNakshatra = raw.moonNakshatra;
  if (typeof raw.sunSign === "string") out.sunSign = raw.sunSign;

  const maha = raw.currentMahadasha;
  if (
    isPlainObject(maha) &&
    typeof maha.lord === "string" &&
    typeof maha.remaining_years === "number"
  ) {
    out.currentMahadasha = {
      lord: maha.lord,
      remaining_years: maha.remaining_years,
    };
  }

  const antar = raw.currentAntardasha;
  if (
    isPlainObject(antar) &&
    typeof antar.lord === "string" &&
    typeof antar.remaining_months === "number"
  ) {
    out.currentAntardasha = {
      lord: antar.lord,
      remaining_months: antar.remaining_months,
    };
  }

  if (Array.isArray(raw.keyPlacements)) {
    const placements: JyotishPlacement[] = [];
    for (const p of raw.keyPlacements) {
      if (
        isPlainObject(p) &&
        typeof p.planet === "string" &&
        typeof p.sign === "string" &&
        typeof p.house === "number" &&
        typeof p.nakshatra === "string"
      ) {
        placements.push({
          planet: p.planet,
          sign: p.sign,
          house: p.house,
          nakshatra: p.nakshatra,
        });
      }
      if (placements.length >= 12) break; // hard ceiling — spec mentions ~9
    }
    if (placements.length > 0) out.keyPlacements = placements;
  }

  // If nothing valid was extracted, treat as missing.
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

function buildUserMessage(
  classicalMode: boolean,
  jyotish: JyotishContext | undefined,
): string {
  const parts: string[] = [];

  if (classicalMode) {
    parts.push("[FRAMEWORK: Hasta Samudrika Shastra — classical Vedic palmistry only]");
  }

  parts.push("Analyze this palm image and provide a detailed palmistry reading.");

  if (jyotish) {
    const lines: string[] = [];
    lines.push("");
    lines.push("[NATAL CHART CONTEXT — use for jyotish_correlation and dasha_relevance sections]");
    if (jyotish.ascendant) {
      lines.push(
        `Ascendant: ${jyotish.ascendant.sign} ${jyotish.ascendant.degree}° (${jyotish.ascendant.nakshatra} nakshatra)`,
      );
    }
    if (jyotish.moonSign || jyotish.moonNakshatra) {
      const moonParts = [jyotish.moonSign, jyotish.moonNakshatra ? `(${jyotish.moonNakshatra})` : ""].filter(Boolean);
      lines.push(`Moon: ${moonParts.join(" ")}`);
    }
    if (jyotish.sunSign) {
      lines.push(`Sun: ${jyotish.sunSign}`);
    }
    if (jyotish.currentMahadasha) {
      lines.push(
        `Current Mahadasha: ${jyotish.currentMahadasha.lord} (${jyotish.currentMahadasha.remaining_years} years remaining)`,
      );
    }
    if (jyotish.currentAntardasha) {
      lines.push(
        `Current Antardasha: ${jyotish.currentAntardasha.lord} (${jyotish.currentAntardasha.remaining_months} months remaining)`,
      );
    }
    if (jyotish.keyPlacements && jyotish.keyPlacements.length > 0) {
      lines.push("Key placements:");
      for (const p of jyotish.keyPlacements) {
        lines.push(`  - ${p.planet} in ${p.sign}, ${p.house}th house, ${p.nakshatra}`);
      }
    }
    parts.push(lines.join("\n"));
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// POST /api/palm-reading
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_JSON_BODY_BYTES) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Palm image is too large. Please upload an image under 5MB.",
        { statusCode: 413 },
      );
    }

    // -- Parse body --
    const body = await request.json();
    const {
      image,
      mediaType,
      classicalMode,
      jyotishContext,
    } = body as {
      image: unknown;
      mediaType: unknown;
      classicalMode?: unknown;
      jyotishContext?: unknown;
    };

    // -- Validate input --
    if (!image || typeof image !== "string" || image.trim().length === 0) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "image must be a non-empty base64-encoded string",
      );
    }

    if (
      !mediaType ||
      typeof mediaType !== "string" ||
      !VALID_MEDIA_TYPES.has(mediaType)
    ) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        `mediaType must be one of: ${[...VALID_MEDIA_TYPES].join(", ")}`,
      );
    }

    if (estimateBase64Bytes(image) > MAX_IMAGE_BYTES) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Palm image is too large. Please upload an image under 5MB.",
        { statusCode: 413 },
      );
    }

    // -- Optional fields: graceful handling --
    const isClassicalMode = classicalMode === true;
    const sanitizedJyotish = sanitizeJyotishContext(jyotishContext);

    // -- Check API key --
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Palm reading service is temporarily unavailable.",
        { statusCode: 503 },
      );
    }

    // -- Call OpenAI Vision API --
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const dataUrl = `data:${mediaType};base64,${image}`;

    const systemPrompt = isClassicalMode
      ? CLASSICAL_SYSTEM_PROMPT
      : STANDARD_SYSTEM_PROMPT;

    const userText = buildUserMessage(isClassicalMode, sanitizedJyotish);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create(
        {
          model: "gpt-4o",
          max_tokens: 4500,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: dataUrl, detail: "high" },
                },
                {
                  type: "text",
                  text: userText,
                },
              ],
            },
          ],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeout);
    }

    // -- Extract text from response --
    const rawText = response.choices[0]?.message?.content;
    if (!rawText) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "No text response received from OpenAI",
      );
    }

    // -- Parse JSON from response --
    let reading: Record<string, unknown>;
    try {
      reading = JSON.parse(rawText);
    } catch {
      // Try to extract JSON object from surrounding text
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new ApiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          "Failed to parse palm reading response as JSON",
        );
      }
      reading = JSON.parse(match[0]);
    }

    return NextResponse.json(reading);
  } catch (error) {
    const isTimeout =
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.message?.includes("aborted"));
    logApiError("/api/palm-reading", error, {
      type: isTimeout ? "timeout" : "unknown",
    });
    if (isTimeout) {
      return errorResponse(
        new ApiError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          "Palm reading service timed out — please try again",
        ),
        "Palm reading timed out",
      );
    }
    if (error instanceof ApiError) {
      return errorResponse(error, "Palm reading failed");
    }
    return errorResponse(
      new ApiError(
        ErrorCode.INTERNAL,
        "Palm reading failed. Please try again.",
      ),
      "Palm reading failed",
    );
  }
}
