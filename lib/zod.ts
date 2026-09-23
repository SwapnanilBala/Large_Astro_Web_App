/**
 * The one place the app's shared schemas take `z` from.
 *
 * Zod 4 compiles object parsers with `new Function` when it can, and finds out
 * whether it can by trying: `new Function("")` inside a try/catch. The
 * Content-Security-Policy in next.config.ts forbids eval in the browser, so
 * that probe is refused. Zod falls back to its interpreter and nothing breaks,
 * but every page that validates anything reported a CSP violation for it.
 *
 * `jitless` skips the probe and uses the interpreter from the start, which is
 * what the browser was already getting. Browser only: the server has no CSP to
 * trip, and keeps the compiled parsers.
 */
import { z } from "zod";

if (typeof window !== "undefined") {
  z.config({ jitless: true });
}

export { z };
