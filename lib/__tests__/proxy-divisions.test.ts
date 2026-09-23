// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "../../proxy";
import { IMPORTANT_DIVISIONAL_CHARTS } from "../divisional-chart-guide";

/*
 * The division page cannot 404 for itself -- the insights loading.tsx starts a
 * 200 stream before its notFound() runs -- so the proxy decides. A rewrite is
 * how that decision reaches Next: the middleware response carries the target
 * in x-middleware-rewrite, and a pass-through carries x-middleware-next.
 */
const QUERY = "?name=Test&birthDate=1990-04-15";

function decide(path: string) {
  const response = proxy(new NextRequest(`http://localhost${path}${QUERY}`));
  return {
    rewrite: response.headers.get("x-middleware-rewrite"),
    passes: response.headers.get("x-middleware-next") === "1",
  };
}

describe("proxy: unknown divisional charts", () => {
  it("passes every key division through", () => {
    for (const { division } of IMPORTANT_DIVISIONAL_CHARTS) {
      const result = decide(`/insights/divisional-charts/${division}`);
      expect(result.passes, `D${division}`).toBe(true);
      expect(result.rewrite, `D${division}`).toBeNull();
    }
  });

  it.each(["999", "3", "0", "abc", "-1", "9x"])("rewrites /%s to the not-found page", (division) => {
    const result = decide(`/insights/divisional-charts/${division}`);
    expect(result.rewrite).toMatch(/\/__unknown-division$/);
  });

  it("drops the chart query from the rewrite", () => {
    expect(decide("/insights/divisional-charts/999").rewrite).not.toContain("birthDate");
  });

  it("leaves the atlas index alone", () => {
    expect(decide("/insights/divisional-charts").rewrite).toBeNull();
  });

  it("is registered for the division paths", () => {
    expect(config.matcher).toContain("/insights/divisional-charts/:division");
  });
});
