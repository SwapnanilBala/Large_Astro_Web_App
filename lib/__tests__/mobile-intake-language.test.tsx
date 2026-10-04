import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import mobileMessages from "@/messages/en.mobile.json";
import { LANGUAGE_CODES, LANGUAGE_NAMES, LanguageProvider } from "@/lib/i18n-context";
import MobileIntake from "@/app/m/mobile-intake";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/*
 * The mobile tree starts a visitor in the language of where they are, and
 * this select is the only way to change it on a phone -- the desktop's
 * switcher lives in a navbar /m does not have. These pin that it is there,
 * that it shows what the visitor is reading, and that a choice sticks.
 */

function renderIntake() {
  return render(
    <LanguageProvider baseMessages={mobileMessages}>
      <MobileIntake />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "astro_location_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.documentElement.lang = "en";
  /* Translation files are not importable here; the provider reports that. */
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mobile intake: language", () => {
  it("offers every language, each named in itself", () => {
    renderIntake();
    const select = screen.getByRole("combobox", { name: "Language" });
    const options = Array.from(select.querySelectorAll("option"));
    expect(options.map((option) => option.value)).toEqual(LANGUAGE_CODES);
    for (const option of options) {
      expect(option.textContent).toBe(LANGUAGE_NAMES[option.value as keyof typeof LANGUAGE_NAMES]);
      expect(option.lang).toBe(option.value);
    }
  });

  it("shows the language the location suggested", () => {
    document.cookie = "astro_location_locale=bn-IN; path=/";
    renderIntake();
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("bn");
  });

  it("keeps a choice for the next visit, over the location", async () => {
    document.cookie = "astro_location_locale=hi-IN; path=/";
    renderIntake();
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "en" },
    });
    expect(window.localStorage.getItem("astro_language")).toBe("en");
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en");
  });
});
