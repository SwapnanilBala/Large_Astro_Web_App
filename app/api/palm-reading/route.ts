import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";

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

// ---------------------------------------------------------------------------
// POST /api/palm-reading
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
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

    // -- Check API key --
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "OPENAI_API_KEY not configured. Add it to .env.local",
      );
    }

    // -- Call OpenAI Vision API --
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const dataUrl = `data:${mediaType};base64,${image}`;

    const response = await client.chat.completions.create({
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
    });

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
    console.error("Palm reading API error:", error);
    return errorResponse(error, "Palm reading failed");
  }
}
