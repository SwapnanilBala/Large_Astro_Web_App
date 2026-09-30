import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider, useTranslation } from "@/lib/i18n-context";

/*
 * The provider reads the stored language through useSyncExternalStore rather
 * than an effect. These pin what that must keep: English with nothing (or
 * nonsense) stored, the stored choice once the browser is there, <html lang>
 * following it, and a new choice written back. The translation files are not
 * what is under test, so the English baseline is all that is asserted on.
 */

function Probe() {
  const { language, setLanguage, t } = useTranslation();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="text">{t("probe.greeting", { name: "Ada" })}</span>
      <button type="button" onClick={() => setLanguage("es")}>
        Spanish
      </button>
    </div>
  );
}

const baseMessages = { probe: { greeting: "Hello, {name}" } };

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
  /* A translation file that cannot be imported here is reported, not thrown. */
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LanguageProvider", () => {
  it("starts in English when nothing is stored", () => {
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("en");
    expect(screen.getByTestId("text")).toHaveTextContent("Hello, Ada");
    expect(document.documentElement.lang).toBe("en");
  });

  it("adopts the stored language, and <html lang> follows it", async () => {
    window.localStorage.setItem("astro_language", "hi");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("hi");
    await waitFor(() => expect(document.documentElement.lang).toBe("hi"));
    /* English stands in for any key the language does not have. */
    expect(screen.getByTestId("text")).toHaveTextContent("Hello, Ada");
  });

  it("ignores a stored value that is not a language it offers", () => {
    window.localStorage.setItem("astro_language", "xx");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("en");
  });

  it("switches on a choice and stores it for the next visit", async () => {
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Spanish" }));

    expect(screen.getByTestId("language")).toHaveTextContent("es");
    expect(window.localStorage.getItem("astro_language")).toBe("es");
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });
});
