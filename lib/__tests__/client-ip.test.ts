import { describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/rate-limiter";

/**
 * Who the rate limiter and the daily LLM budget think is calling.
 *
 * This is a security boundary rather than a utility: both per-caller ceilings
 * are exactly as strong as this function's answer is hard to choose. If a
 * caller can pick what comes back, they get a fresh per-minute window and a
 * fresh slice of the daily budget on every request, and the only thing left
 * standing between them and the API bill is the route's global day total.
 *
 * So the cases below are mostly attacks, and the property being pinned is dull
 * on purpose: a header the platform did not write must not change the answer.
 */

function requestWith(headers: Record<string, string>) {
  return new Request("https://example.test/api/palm-reading", { headers });
}

/* What Vercel puts on a real request. */
const PLATFORM = {
  "x-vercel-forwarded-for": "203.0.113.9",
  "x-real-ip": "203.0.113.9",
  "x-forwarded-for": "203.0.113.9",
};

describe("headers a client can forge", () => {
  it("ignores cf-connecting-ip, because nothing here runs behind Cloudflare", () => {
    /* This header led the list until 2026-09-12. Deployment is Vercel, so no
       proxy ever set it and it arrived verbatim from the caller -- one line of
       curl for a brand new identity, once per request. */
    expect(getClientIp(requestWith({ ...PLATFORM, "cf-connecting-ip": "1.2.3.4" }))).toBe(
      "203.0.113.9",
    );
  });

  it("gives one caller one identity however many times they rotate the forgery", () => {
    const seen = new Set(
      ["1.2.3.4", "5.6.7.8", "9.9.9.9", "203.0.113.77"].map((spoof) =>
        getClientIp(requestWith({ ...PLATFORM, "cf-connecting-ip": spoof })),
      ),
    );
    /* One bucket, not four. This is the whole point. */
    expect([...seen]).toEqual(["203.0.113.9"]);
  });

  it("reads the right-hand end of a forwarding chain, not the client's end", () => {
    /* A chain is appended to by each hop, so the leftmost entry is whatever the
       caller opened with and the rightmost is what the nearest trusted proxy
       observed. */
    expect(getClientIp(requestWith({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("is not fooled by padding the chain out", () => {
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.9" })),
    ).toBe("203.0.113.9");
  });
});

describe("headers the platform sets", () => {
  it("prefers Vercel's own namespace over the generic names", () => {
    /* `x-vercel-*` is replaced by Vercel on the way in, so it is the one name
       here a caller definitely cannot choose. */
    expect(
      getClientIp(
        requestWith({
          "x-vercel-forwarded-for": "203.0.113.9",
          "x-real-ip": "198.51.100.1",
          "x-forwarded-for": "198.51.100.2",
        }),
      ),
    ).toBe("203.0.113.9");
  });

  it("falls back through the generic names for a different host", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(requestWith({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("keeps IPv6 intact", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "2001:db8::8a2e:370:7334" }))).toBe(
      "2001:db8::8a2e:370:7334",
    );
  });

  it("reduces a mangled value to address characters and a bounded length", () => {
    /* An allowlist of hex/IPv6 characters, not a parser -- `c` survives
       `<script>` because it is a legal hex digit. That is fine and is not
       worth tightening: the result is a Map key and a varchar(100), never
       something parsed as an address, so what matters is that it is bounded
       and that the caller could not choose it. Strict validation would carry
       the real risk instead, by dumping every visitor into one shared
       "unknown" bucket the day the platform sends a shape it does not like. */
    expect(getClientIp(requestWith({ "x-real-ip": "203.0.113.9<script>" }))).toBe("203.0.113.9c");
    /* Sanitised down to nothing falls through to the shared bucket rather than
       becoming an empty-string identity of its own. */
    expect(getClientIp(requestWith({ "x-real-ip": "z".repeat(500) }))).toBe("unknown");
    expect(getClientIp(requestWith({ "x-real-ip": "a".repeat(500) }))).toHaveLength(80);
  });
});

describe("no forwarding header at all", () => {
  it("puts unattributable traffic in one shared bucket", () => {
    /* Local dev, or a host that sets nothing. A fresh allowance per request
       would be the same as having no per-caller limit, so they share. */
    expect(getClientIp(requestWith({}))).toBe("unknown");
    expect(getClientIp(requestWith({ "user-agent": "curl/8.0" }))).toBe("unknown");
  });
});
