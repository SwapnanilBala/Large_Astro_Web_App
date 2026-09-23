// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/suggest/route";

/*
 * /api/suggest answers typing, so it must not use the public Nominatim server,
 * whose policy forbids autocomplete. It asks Photon instead; these tests pin
 * the request it makes and the shaping it does on the way back. Each case
 * uses its own query because the route caches by query.
 */

type Feature = { properties: Record<string, string> };

function photonReturns(features: Feature[], status = 200) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ type: "FeatureCollection", features }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function suggest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/suggest");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = await GET(new NextRequest(url));
  return response.json();
}

const place = (name: string, state: string, country: string, countrycode: string): Feature => ({
  properties: { name, state, country, countrycode },
});

afterEach(() => vi.unstubAllGlobals());

describe("/api/suggest", () => {
  it("asks Photon, never Nominatim, and identifies itself", async () => {
    const fetchMock = photonReturns([place("Mumbai", "Maharashtra", "India", "IN")]);
    await suggest({ q: "Mumba", type: "city" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const target = new URL(url);
    expect(target.host).toBe("photon.komoot.io");
    expect(target.searchParams.get("q")).toBe("Mumba");
    expect(target.searchParams.get("layer")).toBe("city");
    expect(target.searchParams.get("lang")).toBe("en");
    expect(url).not.toContain("nominatim");
    expect(new Headers(init.headers).get("User-Agent")).toMatch(/^LagnaAtelier\/1\.0 \(\+/);
  });

  it("keeps one entry per place, not per name", async () => {
    photonReturns([
      place("Springfield", "Massachusetts", "United States", "US"),
      place("Springfield", "Illinois", "United States", "US"),
      place("Springfield", "Ohio", "United States", "US"),
      place("Springfield", "Ohio", "United States", "US"),
    ]);
    const results = await suggest({ q: "Springfiel", type: "city" });
    expect(results.map((r: { state: string }) => r.state)).toEqual(["Massachusetts", "Illinois", "Ohio"]);
  });

  it("stays inside a country the visitor has chosen", async () => {
    photonReturns([
      place("Mumbué", "Bié Province", "Angola", "AO"),
      place("Mumbai", "Maharashtra", "India", "IN"),
    ]);
    const results = await suggest({ q: "Mumb", type: "city", country: "India" });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: "Mumbai", state: "Maharashtra", country: "India" });
    expect(results[0].displayName).toBe("Mumbai, Maharashtra, India");
  });

  it("ranks a chosen state first without hiding the rest", async () => {
    photonReturns([
      place("Aurangabad", "Bihar", "India", "IN"),
      place("Aurangabad", "Maharashtra", "India", "IN"),
    ]);
    const results = await suggest({ q: "Aurangab", type: "city", country: "India", state: "Maharashtra" });
    expect(results.map((r: { state: string }) => r.state)).toEqual(["Maharashtra", "Bihar"]);
  });

  it("puts the city ahead of a town or village that matched the prefix first", async () => {
    photonReturns([
      { properties: { name: "Mumbué", state: "Bié Province", country: "Angola", countrycode: "AO", osm_key: "place", osm_value: "town" } },
      { properties: { name: "Mumbai", state: "Maharashtra", country: "India", countrycode: "IN", osm_key: "place", osm_value: "city" } },
      { properties: { name: "Mumbles", state: "Wales", country: "United Kingdom", countrycode: "GB", osm_key: "place", osm_value: "village" } },
    ]);
    const results = await suggest({ q: "Mumbx", type: "city" });
    expect(results.map((r: { name: string }) => r.name)).toEqual(["Mumbai", "Mumbué", "Mumbles"]);
  });

  it("fails quiet when Photon is unavailable", async () => {
    photonReturns([], 503);
    const body = await suggest({ q: "Anywher", type: "city" });
    expect(body.results).toEqual([]);
    expect(body.error).toBeTruthy();
  });
});
