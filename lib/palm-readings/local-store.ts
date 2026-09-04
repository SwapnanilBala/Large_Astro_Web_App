/**
 * Palm readings persisted on the device, scoped to a local profile.
 *
 * Replaces the former `/api/palm-readings` CRUD routes. The analysis itself
 * still runs server-side (`/api/palm-reading`); only the saved copy lives here.
 *
 * Storage note: a raw palm photo data URL runs to several megabytes, and the
 * whole localStorage origin quota is typically 5–10MB. Saved images are
 * therefore downscaled to a display-sized JPEG before they are stored, and the
 * store keeps a bounded number of readings per profile, evicting the oldest
 * when the quota is hit. Line overlays are unaffected because
 * `line_coordinates` are normalized 0–1.
 */

import { profileScopedKey } from "@/lib/local-profiles";
import type {
  JyotishContext,
  PalmReadingJSON,
  PalmReadingRecord,
  PalmReadingSummary,
} from "@/lib/palm-readings/types";

const PALM_READINGS_PREFIX = "astro_palm_readings";

/** Longest edge, in px, retained for a stored palm image. */
const STORED_IMAGE_MAX_EDGE = 720;
const STORED_IMAGE_QUALITY = 0.82;

/** Hard cap per profile; older readings fall off the end. */
const MAX_READINGS_PER_PROFILE = 25;

export const PALM_READINGS_CHANGED_EVENT = "astro:palm-readings-changed";

export type SavePalmReadingInput = {
  image_data_url: string;
  reading: PalmReadingJSON;
  jyotish_context?: JyotishContext | null;
  classical_mode?: boolean;
  title?: string | null;
  notes?: string | null;
};

function storageKey(profileId: string) {
  return profileScopedKey(PALM_READINGS_PREFIX, profileId);
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `palm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is PalmReadingRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PalmReadingRecord>;
  return typeof candidate.id === "string" && !!candidate.reading;
}

function readAll(profileId: string): PalmReadingRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecord)
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );
  } catch {
    return [];
  }
}

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PALM_READINGS_CHANGED_EVENT));
}

/**
 * Persist the list, dropping the oldest readings until it fits the quota.
 *
 * Returns false only if even a single reading will not fit, which means the
 * image is too large for this browser's storage budget.
 */
function writeAll(profileId: string, records: PalmReadingRecord[]): boolean {
  if (typeof window === "undefined") return false;

  const key = storageKey(profileId);
  const trimmed = records.slice(0, MAX_READINGS_PER_PROFILE);

  for (let attempt = trimmed.length; attempt > 0; attempt--) {
    try {
      window.localStorage.setItem(key, JSON.stringify(trimmed.slice(0, attempt)));
      notifyChanged();
      return true;
    } catch {
      // Quota exceeded — drop the oldest reading and try again.
    }
  }

  return false;
}

/**
 * Re-encode a data URL down to `STORED_IMAGE_MAX_EDGE` on its longest side.
 * Falls back to the original string if the browser cannot decode it.
 */
async function downscaleDataUrl(dataUrl: string): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return dataUrl;
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode failed"));
      element.src = dataUrl;
    });

    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longestEdge) return dataUrl;

    const scale = Math.min(1, STORED_IMAGE_MAX_EDGE / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;

    context.drawImage(image, 0, 0, width, height);
    const encoded = canvas.toDataURL("image/jpeg", STORED_IMAGE_QUALITY);
    return encoded.length < dataUrl.length ? encoded : dataUrl;
  } catch {
    return dataUrl;
  }
}

export function listPalmReadings(profileId: string | null): PalmReadingSummary[] {
  if (!profileId) return [];

  return readAll(profileId).map((record) => ({
    id: record.id,
    created_at: record.created_at,
    title: record.title,
    classical_mode: Boolean(record.classical_mode),
    reading_summary: {
      overall_summary:
        typeof record.reading?.overall_summary === "string"
          ? record.reading.overall_summary
          : "",
      dominant_hand_note:
        typeof record.reading?.dominant_hand_note === "string"
          ? record.reading.dominant_hand_note
          : "",
    },
  }));
}

export function getPalmReading(
  profileId: string | null,
  id: string
): PalmReadingRecord | null {
  if (!profileId) return null;
  return readAll(profileId).find((record) => record.id === id) ?? null;
}

export function getPalmReadingsByIds(
  profileId: string | null,
  ids: string[]
): PalmReadingRecord[] {
  if (!profileId) return [];
  const all = readAll(profileId);
  return ids
    .map((id) => all.find((record) => record.id === id))
    .filter((record): record is PalmReadingRecord => !!record);
}

export async function savePalmReading(
  profileId: string | null,
  input: SavePalmReadingInput
): Promise<PalmReadingRecord> {
  if (!profileId) {
    throw new Error("Choose a profile before saving readings.");
  }
  if (!input.image_data_url?.startsWith("data:image/")) {
    throw new Error("A palm image is required to save a reading.");
  }

  const storedImage = await downscaleDataUrl(input.image_data_url);
  const title = input.title?.trim() ? input.title.trim().slice(0, 200) : null;
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const record: PalmReadingRecord = {
    id: createId(),
    profile_id: profileId,
    created_at: nowIso(),
    title,
    image_data_url: storedImage,
    reading: input.reading,
    jyotish_context: input.jyotish_context ?? null,
    classical_mode: input.classical_mode === true,
    notes,
  };

  const stored = writeAll(profileId, [record, ...readAll(profileId)]);
  if (!stored) {
    throw new Error(
      "This device is out of storage space for saved readings. Delete an older reading and try again."
    );
  }

  return record;
}

export function updatePalmReading(
  profileId: string | null,
  id: string,
  updates: { title?: string | null; notes?: string | null }
): PalmReadingRecord | null {
  if (!profileId) return null;

  const records = readAll(profileId);
  let updated: PalmReadingRecord | null = null;

  const next = records.map((record) => {
    if (record.id !== id) return record;
    updated = {
      ...record,
      title:
        updates.title === undefined
          ? record.title
          : updates.title === null || updates.title.trim().length === 0
            ? null
            : updates.title.trim().slice(0, 200),
      notes:
        updates.notes === undefined
          ? record.notes
          : updates.notes === null || updates.notes.trim().length === 0
            ? null
            : updates.notes.trim(),
    };
    return updated;
  });

  if (!updated) return null;
  writeAll(profileId, next);
  return updated;
}

export function deletePalmReading(profileId: string | null, id: string): boolean {
  if (!profileId) return false;

  const records = readAll(profileId);
  const next = records.filter((record) => record.id !== id);
  if (next.length === records.length) return false;

  writeAll(profileId, next);
  return true;
}

/** Subscribe to palm-reading changes from this tab and from other tabs. */
export function subscribeToPalmReadings(
  profileId: string | null,
  listener: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const scopedKey = profileId ? storageKey(profileId) : null;
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === scopedKey) {
      listener();
    }
  };

  window.addEventListener(PALM_READINGS_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PALM_READINGS_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
