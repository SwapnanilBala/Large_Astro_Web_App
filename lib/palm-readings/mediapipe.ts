/**
 * Where the palm camera loads MediaPipe's WASM from.
 *
 * The JS half of @mediapipe/tasks-vision is bundled from package.json; the
 * WASM half is fetched from a CDN at runtime, so the two are only as matched
 * as this URL makes them. It used to say @latest, which meant production ran
 * whatever was published next -- against a JS bundle it might no longer fit,
 * and without a deploy on this side to review it.
 *
 * Pinned to the installed version instead. lib/__tests__/mediapipe-version
 * fails when the dependency moves and this does not, so a bump cannot quietly
 * leave the two halves on different releases.
 */
export const MEDIAPIPE_WASM_VERSION = "0.10.32";

export const MEDIAPIPE_WASM_BASE =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_WASM_VERSION}/wasm`;

/** The hand-landmark model the camera runs. Versioned in its own path. */
export const MEDIAPIPE_HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
