/**
 * Narrowing for client-supplied values that get interpolated into an LLM prompt.
 *
 * The rule this enforces: a value that arrives over the wire and ends up inside
 * a prompt is untrusted input, and `typeof x === "string"` is not a validation.
 * Two things go wrong without it -- a caller can spend our key on their own
 * prompt (the request body cap is megabytes; a label is not), and a caller can
 * write text that reads as instruction rather than as data.
 *
 * Both are closed the same way: cap the length to what the field legitimately
 * holds, and keep only the characters that field is made of. The second half is
 * what matters for injection -- newlines, colons and brackets are the structure
 * an instruction needs, and a label never contains them.
 *
 * These live here rather than beside one route so the boundary is a named,
 * tested thing instead of a private helper that the next route forgets to copy.
 * stripInlineMarkdown below is the same boundary in the other direction.
 */

/** Longest label that legitimately arrives: "Purva Bhadrapada" is 16. */
export const MAX_LABEL_CHARS = 32;

/** Everything a sign, nakshatra, or planet name is made of -- and nothing else. */
const LABEL_DISALLOWED = /[^A-Za-z0-9 .'\u00b0()/-]+/g;

/**
 * Reduce an unknown value to a short, structure-free label, or `undefined`.
 *
 * Disallowed runs collapse to a single space rather than being deleted, so
 * "Leo\nAries" cannot silently fuse into one made-up sign name.
 */
export function safeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(LABEL_DISALLOWED, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return undefined;
  return cleaned.slice(0, MAX_LABEL_CHARS);
}

/**
 * Reduce an unknown value to a number inside `[min, max]`, or `undefined`.
 *
 * `typeof NaN === "number"` and `typeof Infinity === "number"`, and both render
 * into a prompt as literal text, so the finiteness check is not redundant with
 * the range check -- `NaN < min` is false.
 */
export function safeNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

/**
 * Remove inline markdown emphasis from generated prose.
 *
 * Both Anthropic routes tell the model "no markdown", and both render the
 * result as plain text into a <p>. A prompt is a request, not a guarantee --
 * an observed brief came back with `*stick*` in it, which renders as literal
 * asterisks on the page. Since the instruction is already there, any emphasis
 * marker that survives is unintended, so stripping it cannot lose meaning.
 *
 * Only paired markers are touched, and only when they wrap non-space text, so
 * a lone asterisk or an arithmetic expression is left alone.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g, "$1")
    .replace(/\*(?=\S)([^*]+?)(?<=\S)\*/g, "$1")
    .replace(/_(?=\S)([^_]+?)(?<=\S)_/g, "$1");
}
