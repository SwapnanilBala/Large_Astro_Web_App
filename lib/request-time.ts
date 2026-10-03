import "server-only";

/**
 * The time of the request being rendered, in milliseconds.
 *
 * For server components that render per request and need "now" to place the
 * reader in time -- how far through a dasha period they are, say. Read once on
 * the server and passed down as a prop, so the server's HTML and the render
 * that hydrates it agree, and no client component reads a clock while
 * rendering. Not for anything that renders twice: a second call returns a
 * later time.
 */
export function requestTime(): number {
  return Date.now();
}
