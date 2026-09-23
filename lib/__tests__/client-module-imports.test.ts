import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as chartParams from "../chart-params";
import * as chartParamsUrl from "../chart-params-url";

/*
 * Modules that client components import, and so ship to the browser.
 *
 * A Node built-in imported by any of these does not fail the build: the
 * bundler quietly swaps in a browser shim. For `crypto` that shim is
 * crypto-browserify -- about 400 KB, with Node's stream, util and vm shims
 * behind it, and vm's polyfill is an eval the Content-Security-Policy then
 * has to refuse. That happened twice before this test existed: a cache-key
 * hash in life-shift-reading, and chart-params' engine imports reached
 * through one string helper. Neither showed up anywhere but bundle size.
 *
 * Add a module here when a client component starts importing it.
 */
const BROWSER_MODULES = [
  "lib/chart-params-url.ts",
  "lib/life-shift-reading.ts",
  "lib/current-period-reading.ts",
  "lib/varga-commentary.ts",
];

const NODE_BUILTIN =
  /from\s+["'](?:node:)?(?:crypto|fs|path|os|stream|util|vm|events|buffer|child_process|zlib|http|https|net|tls)["']/;

/* Server modules that pull the engine, the database or a crypto-backed cache. */
const SERVER_MODULE =
  /from\s+["']@\/lib\/(?:chart-params|server-cache|engines\/chart-service|db\/[\w-]+|identity\/[\w-]+|sync\/[\w-]+)["']/;

describe("modules bundled for the browser", () => {
  for (const file of BROWSER_MODULES) {
    const source = readFileSync(join(process.cwd(), file), "utf8");

    it(`${file} imports no Node built-in`, () => {
      expect(source).not.toMatch(NODE_BUILTIN);
    });

    it(`${file} imports no server-only module`, () => {
      expect(source).not.toMatch(SERVER_MODULE);
    });
  }

  it("chart-params-url imports nothing at all", () => {
    const source = readFileSync(join(process.cwd(), "lib/chart-params-url.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("chart-params still exposes the URL helpers it used to define", () => {
    expect(chartParams.buildChartHistoryQuery).toBe(chartParamsUrl.buildChartHistoryQuery);
    expect(chartParams.readChartParams).toBe(chartParamsUrl.readChartParams);
    expect(chartParams.hasAllChartParams).toBe(chartParamsUrl.hasAllChartParams);
    expect(chartParams.chartParamsToQuery).toBe(chartParamsUrl.chartParamsToQuery);
    expect(chartParams.REQUIRED_CHART_PARAMS).toBe(chartParamsUrl.REQUIRED_CHART_PARAMS);
  });
});
