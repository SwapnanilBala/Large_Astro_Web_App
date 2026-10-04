// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../../proxy";
import { LOCATION_TABLE_VERSION } from "../location-language";
import { LOCATION_LOCALE_COOKIE } from "../location-locale-cookie";

const v = LOCATION_TABLE_VERSION;

/*
 * The proxy is where a location becomes a language: it reads the platform's
 * x-vercel-ip-* headers and leaves the answer in a cookie for
 * LanguageProvider. These pin when it writes, when it must not, and that it
 * rides along on whatever else the proxy decided for the request.
 */

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function request(
  path: string,
  { country, region, cookie, userAgent }: {
    country?: string;
    region?: string;
    cookie?: string;
    userAgent?: string;
  } = {},
) {
  const headers = new Headers();
  if (country) headers.set("x-vercel-ip-country", country);
  if (region) headers.set("x-vercel-ip-country-region", region);
  if (cookie) headers.set("cookie", `${LOCATION_LOCALE_COOKIE}=${cookie}`);
  if (userAgent) headers.set("user-agent", userAgent);
  return new NextRequest(`http://localhost${path}`, { headers });
}

const written = (path: string, options?: Parameters<typeof request>[1]) =>
  proxy(request(path, options)).cookies.get(LOCATION_LOCALE_COOKIE)?.value ?? null;

describe("proxy: the location's language", () => {
  it("leaves the language for the page on a first visit", () => {
    expect(written("/", { country: "IN", region: "UP" })).toBe(`hi-IN.${v}`);
    expect(written("/m", { country: "BD" })).toBe(`bn-BD.${v}`);
    expect(written("/login", { country: "MX" })).toBe(`es-MX.${v}`);
  });

  it("writes it for somewhere English too, so a later trip can be told apart", () => {
    expect(written("/", { country: "US" })).toBe(`en-US.${v}`);
  });

  it("writes nothing when the platform does not say where the visitor is", () => {
    expect(written("/")).toBeNull();
    expect(written("/", { region: "WB" })).toBeNull();
  });

  it("keeps the first answer within a country", () => {
    expect(written("/", { country: "IN", region: "DL", cookie: `bn-IN.${v}` })).toBeNull();
  });

  it("answers again in a new country", () => {
    expect(written("/", { country: "FR", cookie: "hi-IN" })).toBe(`fr-FR.${v}`);
  });

  it("brings a cookie from an older edition of the table up to date", () => {
    /* Chennai was given English before India went to Hindi throughout. */
    expect(written("/", { country: "IN", region: "TN", cookie: "en-IN" })).toBe(`hi-IN.${v}`);
  });

  it("rides along on the redirect that sends a phone to /m", () => {
    const response = proxy(request("/", { country: "IT", userAgent: IPHONE }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(/\/m$/);
    expect(response.cookies.get(LOCATION_LOCALE_COOKIE)?.value).toBe(`it-IT.${v}`);
  });

  it("rides along on the not-found rewrite for an unknown division", () => {
    const response = proxy(request("/insights/divisional-charts/999", { country: "ES" }));
    expect(response.headers.get("x-middleware-rewrite")).toMatch(/\/__unknown-division$/);
    expect(response.cookies.get(LOCATION_LOCALE_COOKIE)?.value).toBe(`es-ES.${v}`);
  });

  it("is readable by the page, and lasts", () => {
    const header = proxy(request("/", { country: "IN", region: "WB" })).headers.get("set-cookie") ?? "";
    expect(header).toContain(`${LOCATION_LOCALE_COOKIE}=bn-IN.${v}`);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=31536000/);
    expect(header).not.toMatch(/HttpOnly/i);
  });

  it("leaves API calls alone", () => {
    expect(written("/api/geocode?city=Pune", { country: "IN", region: "UP" })).toBeNull();
  });
});
