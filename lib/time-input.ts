import { normalizeBirthTime, type IntakeFieldResult } from "@/lib/intake-normalize";

/**
 * Whether this browser has a working `<input type="time">`.
 *
 * One without it renders the field as a plain text box, and says so: the
 * input's `type` reads back "text". Asked of a detached probe rather than of
 * the field itself, so the answer is there when the field is not — the mobile
 * intake re-reads its whole draft on submit, by which point the time question
 * has usually unmounted.
 */
export function hasNativeTimeInput(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("input");
  probe.setAttribute("type", "time");
  return probe.type === "time";
}

/**
 * Read the birth time held by an `<input type="time">`.
 *
 * Where the control works, its value is a 24-hour "HH:mm" whatever the OS
 * picker showed, and it is read as one. Read as typed text instead, a 10:30
 * picked from the morning side of the wheel came back as "could be morning or
 * evening" with a 10:30 PM chip beside it, one tap from moving the birth time
 * twelve hours. Where the control does not work, the field is a text box, and
 * what was typed there gets the lenient reading every typed time gets.
 */
export function normalizeTimeInputValue(value: string): IntakeFieldResult {
  return normalizeBirthTime(value, { clock24: hasNativeTimeInput() });
}
