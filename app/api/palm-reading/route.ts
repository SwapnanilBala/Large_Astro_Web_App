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
const PREMIUM_TIERS = new Set(["pro", "ultimate", "admin", "premium", "premium_trial"]);

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const PALM_READING_SYSTEM_PROMPT = `You are an expert palmist well-versed in both Western and Vedic (Samudrika Shastra) palmistry traditions. Analyze the provided palm image and return a detailed, comprehensive reading that gives the person a thorough understanding of their present life situation and life trajectory.

Return ONLY valid JSON — no markdown fencing, no extra text before or after the JSON object. Your response must be a single JSON object with this exact structure:

{
  "overall_summary": "A 2-3 sentence overview of the palm reading.",
  "dominant_hand_note": "A brief note about which hand appears to be shown and what that signifies in palmistry.",
  "lines": {
    "heart_line": {
      "description": "Describe what you physically observe about this line — length, depth, curvature, starting/ending points.",
      "interpretation": "What this line suggests about the person's emotional life and relationships.",
      "strength": "strong" | "moderate" | "faint"
    },
    "head_line": {
      "description": "Describe what you physically observe about this line.",
      "interpretation": "What this line suggests about intellect and decision-making.",
      "strength": "strong" | "moderate" | "faint"
    },
    "life_line": {
      "description": "Describe what you physically observe about this line.",
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
  "guidance": "A positive, empowering closing message. Frame all findings as tendencies and potentials, not fixed destiny. Synthesize the life trajectory, career, relationship, and health insights into actionable encouragement."
}

Important guidelines:
- Be specific about what you actually see in the image.
- Frame all readings positively — palm lines show tendencies, not fixed destiny.
- The life line does NOT predict lifespan; make this clear in your interpretation.
- Draw from both Western and Vedic palmistry traditions where relevant.
- For the life_trajectory section, provide genuinely insightful and specific observations — this is the most important section for the reader.
- For career_and_purpose, connect what you see in the palm to practical career insights.
- For relationships_and_emotional, be empathetic and constructive.
- For health_and_vitality, focus on wellness and self-care rather than medical diagnoses.
- If the image is unclear or not a palm, still return the JSON structure but note the limitation in the relevant fields.`;

// ---------------------------------------------------------------------------
// Accepted media types
// ---------------------------------------------------------------------------

const VALID_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type SupabaseUserResponse = {
  id?: unknown;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function verifyPalmReadingAccess(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    throw new ApiError(
      ErrorCode.UNAUTHORIZED,
      "Sign in to use palm reading.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      "Palm reading service is temporarily unavailable.",
      { statusCode: 503 },
    );
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!userResponse.ok) {
    throw new ApiError(
      ErrorCode.UNAUTHORIZED,
      "Your session expired. Please sign in again.",
    );
  }

  const data = (await userResponse.json()) as SupabaseUserResponse;
  if (typeof data.id !== "string" || !data.id) {
    throw new ApiError(
      ErrorCode.UNAUTHORIZED,
      "Your session expired. Please sign in again.",
    );
  }

  const tier =
    typeof data.app_metadata?.subscription_tier === "string"
      ? data.app_metadata.subscription_tier
      : "guest";
  if (!PREMIUM_TIERS.has(tier)) {
    throw new ApiError(
      ErrorCode.FORBIDDEN,
      "Palm reading requires an active premium plan.",
    );
  }

  return { userId: data.id, tier };
}

function estimateBase64Bytes(base64: string) {
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
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

    await verifyPalmReadingAccess(request);

    // -- Parse body --
    const body = await request.json();
    const { image, mediaType } = body as {
      image: unknown;
      mediaType: unknown;
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create(
        {
          model: "gpt-4o",
          max_tokens: 4000,
          messages: [
            { role: "system", content: PALM_READING_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: dataUrl, detail: "high" },
                },
                {
                  type: "text",
                  text: "Analyze this palm image and provide a detailed palmistry reading.",
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
