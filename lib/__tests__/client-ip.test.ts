import { describe, expect, it } from "vitest";

import { checkRateLimit, clientKey, getClientIp, limitKeyFor } from "@/lib/rate-limiter";

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

describe("the caller as the limits count them", () => {
  /* An IPv6 subscriber is handed a whole /64 and may send from any address in
     it. Counted per address, each one was a fresh per-minute window and a
     fresh slice of the daily allowance; counted per /64 it is one caller. */
  it("counts every address in one IPv6 /64 as one caller", () => {
    const keys = new Set(
      [
        "2001:db8:1:2::1",
        "2001:db8:1:2:aaaa:bbbb:cccc:dddd",
        "2001:0DB8:0001:0002:0000:0000:0000:ffff",
        "2001:db8:1:2::1%eth0",
      ].map(limitKeyFor),
    );
    expect([...keys]).toEqual(["2001:db8:1:2::/64"]);
  });

  it("keeps different /64s apart", () => {
    expect(limitKeyFor("2001:db8:1:2::1")).not.toBe(limitKeyFor("2001:db8:1:3::1"));
    expect(limitKeyFor("::1")).toBe("0:0:0:0::/64");
  });

  it("counts IPv4 per address, in either notation", () => {
    expect(limitKeyFor("203.0.113.9")).toBe("203.0.113.9");
    expect(limitKeyFor("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(limitKeyFor("::FFFF:cb00:7109")).toBe("203.0.113.9");
    /* NAT64 keeps its IPv6 prefix: the caller is whoever holds that /64. */
    expect(limitKeyFor("64:ff9b::203.0.113.9")).toBe("64:ff9b:0:0::/64");
  });

  it("leaves the shared bucket and anything unparseable as they were", () => {
    expect(limitKeyFor("unknown")).toBe("unknown");
    for (const odd of ["1:2:3", "abc:::def", "1:2:3:4:5:6:7:8:9", "12345::1", "::1.2.3.999", "1::2::3"]) {
      expect(limitKeyFor(odd)).toBe(odd);
    }
  });

  it("is what clientKey answers for a request, while getClientIp keeps the whole address", () => {
    const request = requestWith({ "x-vercel-forwarded-for": "2001:db8:aa:bb::7" });
    expect(clientKey(request)).toBe("2001:db8:aa:bb::/64");
    expect(getClientIp(request)).toBe("2001:db8:aa:bb::7");
  });

  it("shares one per-minute window across a /64", () => {
    /* Palm reading allows five a minute. A sixth from yet another address in
       the same /64 is the same caller and is refused. */
    const from = (suffix: number) =>
      new Request("https://example.test/api/palm-reading", {
        headers: { "x-vercel-forwarded-for": `2001:db8:77:88::${suffix.toString(16)}` },
      });
    for (let suffix = 1; suffix <= 5; suffix++) expect(checkRateLimit(from(suffix))?.allowed).toBe(true);
    expect(checkRateLimit(from(6))?.allowed).toBe(false);
    /* A neighbouring /64 is someone else. */
    const neighbour = new Request("https://example.test/api/palm-reading", {
      headers: { "x-vercel-forwarded-for": "2001:db8:77:89::1" },
    });
    expect(checkRateLimit(neighbour)?.allowed).toBe(true);
  });
});
