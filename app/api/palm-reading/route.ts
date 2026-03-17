import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const PALM_READING_SYSTEM_PROMPT = `You are an expert palmist well-versed in both Western and Vedic (Samudrika Shastra) palmistry traditions. Analyze the provided palm image and return a detailed reading.

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
  "guidance": "A positive, empowering closing message. Frame all findings as tendencies and potentials, not fixed destiny."
}

Important guidelines:
- Be specific about what you actually see in the image.
- Frame all readings positively — palm lines show tendencies, not fixed destiny.
- The life line does NOT predict lifespan; make this clear in your interpretation.
- Draw from both Western and Vedic palmistry traditions where relevant.
- If the image is unclear or not a palm, still return the JSON structure but note the limitation in the relevant fields.`;

// ---------------------------------------------------------------------------
// Accepted media types
// ---------------------------------------------------------------------------

const VALID_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ValidMediaType = "image/jpeg" | "image/png" | "image/webp";

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
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "ANTHROPIC_API_KEY not configured. Add it to .env.local",
      );
    }

    // -- Call Claude Vision API --
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 2000,
      system: PALM_READING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as ValidMediaType,
                data: image,
              },
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
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "No text response received from Claude",
      );
    }

    const rawText = textBlock.text;

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
