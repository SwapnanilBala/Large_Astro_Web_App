import type { ProfileQueryInput } from "@/lib/astro-types";
import {
  normalizeBirthDate,
  normalizeBirthTime,
  normalizePersonName,
  normalizePlaceName,
} from "@/lib/intake-normalize";

/* A date can hold a comma of its own, which the split into parts cut in two:
 * "May 15, 1990", and Bengali's "15 মে, 1990", the way the app itself writes
 * one. So a part that is no date alone is read again together with the part
 * after it, and the result says how many parts it took. */
function readDate(
  part: string,
  next: string | undefined,
  locale: string | undefined,
): { value: string; parts: 1 | 2 } | null {
  const alone = normalizeBirthDate(part, { locale });
  if (alone.value) return { value: alone.value, parts: 1 };
  if (next === undefined) return null;
  const joined = normalizeBirthDate(`${part}, ${next}`, { locale });
  return joined.value ? { value: joined.value, parts: 2 } : null;
}

/**
 * Read the desktop intake's paste box: one comma-separated line
 * ("Name, date, time, place") into the whole form.
 *
 * Each part goes through the normalisers the individual fields use, so a date
 * or time pasted here is read, and repaired, exactly as it would be typed into
 * its own box, and in the interface language too, given its `locale` (one of
 * LOCALE_TAGS). The parts are matched by what they parse as rather than by
 * position, because people write the birth moment in either order and
 * sometimes leave the time out entirely.
 *
 * Null for a line with too few parts to be one.
 */
export function parseSmartFill(text: string, locale?: string): Partial<ProfileQueryInput> | null {
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const parsed: Partial<ProfileQueryInput> = {};
  const leftovers: string[] = [];

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];

    if (index === 0) {
      const name = normalizePersonName(part);
      if (name.value) {
        parsed.name = name.value;
        continue;
      }
    }

    if (!parsed.birthDate) {
      const date = readDate(part, parts[index + 1], locale);
      if (date) {
        parsed.birthDate = date.value;
        index += date.parts - 1;
        continue;
      }
    }

    if (!parsed.birthTime) {
      const time = normalizeBirthTime(part, { locale });
      if (time.value) {
        parsed.birthTime = time.value;
        continue;
      }
    }

    leftovers.push(part);
  }

  /* Whatever is left is the place, written outward: "City, State, Country". */
  const place = leftovers.map((part) => normalizePlaceName(part).value || part);
  if (place.length >= 3) {
    [parsed.city, parsed.state, parsed.country] = place;
  } else if (place.length === 2) {
    parsed.city = place[0];
    parsed.state = "";
    parsed.country = place[1];
  } else if (place.length === 1) {
    parsed.city = place[0];
  }

  return parsed;
}
