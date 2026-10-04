import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import MissingChartNotice from "../MissingChartNotice";

/*
 * The notice /insights, /insights/advanced and /engine-select show when their
 * query is missing birth details.
 *
 * Those pages are server components and used to carry this copy as English
 * text. Pinned here: the notice comes out of the catalog in the provider's
 * language, and no desktop page carries it as text again.
 */

afterEach(cleanup);

function inLanguage(messages: MessageTree) {
  return render(
    <LanguageProvider baseMessages={messages}>
      <MissingChartNotice />
    </LanguageProvider>,
  );
}

describe("the missing-chart notice", () => {
  it("reads its copy from the catalog", () => {
    inLanguage(en);
    expect(screen.getByText("Missing Input")).toHaveClass("kicker");
    expect(screen.getByRole("heading", { level: 1, name: "Chart details are incomplete." })).toBeInTheDocument();
    expect(screen.getByText("Please return to intake and provide complete birth metadata.")).toHaveClass("lead");
    expect(screen.getByRole("link", { name: "Back to Intake" })).toHaveAttribute("href", "/");
  });

  /* Translation files cannot be imported dynamically here, so a provider
     whose baseline is the Spanish catalog stands in for a Spanish visitor. */
  it("is written in the visitor's language", () => {
    inLanguage(es);
    expect(screen.getByText(es.insights.missingKicker)).toHaveClass("kicker");
    expect(screen.getByRole("heading", { level: 1, name: es.insights.missingHeading })).toBeInTheDocument();
    expect(screen.getByText(es.insights.missingLead)).toHaveClass("lead");
    expect(screen.getByRole("link", { name: es.insights.backToIntake })).toHaveAttribute("href", "/");
    expect(es.insights.missingHeading).not.toBe(en.insights.missingHeading);
  });

  it("is not carried as English text by any desktop page", () => {
    const desktop = join(process.cwd(), "app", "(desktop)");
    const english = [en.insights.missingKicker, en.insights.missingHeading, en.insights.missingLead];
    const offenders = (readdirSync(desktop, { recursive: true }) as string[])
      .filter((file) => /(^|[\\/])page\.tsx$/.test(file))
      .flatMap((file) => {
        const source = readFileSync(join(desktop, file), "utf8");
        return english.filter((text) => source.includes(text)).map((text) => `${file}: ${text}`);
      });
    expect(offenders).toEqual([]);
  });
});
