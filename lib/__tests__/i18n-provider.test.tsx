import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider, useTranslation } from "@/lib/i18n-context";

/*
 * The provider reads the stored language through useSyncExternalStore rather
 * than an effect. These pin what that must keep: English with nothing (or
 * nonsense) stored, the stored choice once the browser is there, <html lang>
 * following it, and a new choice written back -- and, beneath any choice, the
 * language the visitor's location suggests (the cookie proxy.ts leaves). The
 * translation files are not what is under test, so the English baseline is
 * all that is asserted on.
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

/* What proxy.ts leaves when the platform says where the visitor is. */
function setLocationLocale(value: string | null) {
  document.cookie =
    value === null
      ? "astro_location_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
      : `astro_location_locale=${value}; path=/`;
}

beforeEach(() => {
  window.localStorage.clear();
  setLocationLocale(null);
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

  it("puts a parameter in as written, dollar signs and all", () => {
    /* A string replacement would read these as patterns: "$&" as the
       placeholder itself, "$'" as the rest of the sentence, "$$" as "$". */
    function Echo() {
      const { t } = useTranslation();
      return <span data-testid="echo">{t("probe.greeting", { name: "A$&B$'C$$D" })}</span>;
    }
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Echo />
      </LanguageProvider>
    );
    expect(screen.getByTestId("echo")).toHaveTextContent("Hello, A$&B$'C$$D");
  });

  it("adopts the language the visitor's location suggests when nothing is stored", async () => {
    setLocationLocale("bn-IN");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("bn");
    await waitFor(() => expect(document.documentElement.lang).toBe("bn"));
    /* A suggestion is not a choice, so nothing is stored for it. */
    expect(window.localStorage.getItem("astro_language")).toBeNull();
  });

  it("reads the cookie in its current shape, with the table's edition", () => {
    setLocationLocale("hi-IN.2");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("hi");
  });

  it("puts a stored choice ahead of the location, English included", () => {
    setLocationLocale("hi-IN");
    window.localStorage.setItem("astro_language", "en");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("en");
  });

  it("puts a choice made on the page ahead of the location", () => {
    setLocationLocale("hi-IN");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("hi");
    fireEvent.click(screen.getByRole("button", { name: "Spanish" }));
    expect(screen.getByTestId("language")).toHaveTextContent("es");
    expect(window.localStorage.getItem("astro_language")).toBe("es");
  });

  it("ignores a location that suggests a language it does not offer", () => {
    setLocationLocale("nl-NL");
    render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("en");
  });

  it("keeps the location it first read, so the page never changes language mid-visit", () => {
    setLocationLocale("hi-IN");
    const { rerender } = render(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("hi");

    /* A later response rewrites the cookie -- a client navigation from a
       different address -- and the provider renders again. */
    setLocationLocale("fr-FR");
    rerender(
      <LanguageProvider baseMessages={baseMessages}>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("language")).toHaveTextContent("hi");
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
