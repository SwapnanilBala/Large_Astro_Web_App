import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import { LanguageProvider } from "@/lib/i18n-context";
import { formatBirthDateDisplay } from "@/lib/intake-normalize";
import { ToastProvider } from "@/lib/toast-context";
import CompatibilityPageClient from "../page-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

/*
 * A birth date typed into the compatibility form in the interface language.
 *
 * As on /m, a working date input holds an ISO value and needs no reading;
 * this is the browser without one, where the field is a text box and what is
 * typed is read on blur, given the interface language.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("astro_language", "fr");
  /* Translation files are not importable here; the provider reports that and
     stays on English, which the date's language does not depend on. */
  vi.spyOn(console, "error").mockImplementation(() => {});

  /* No native date input. React assigns an input's type through the property
     on every render, so the setter is what has to give way. */
  const type = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "type");
  vi.spyOn(HTMLInputElement.prototype, "type", "set").mockImplementation(function (
    this: HTMLInputElement,
    value: string,
  ) {
    type?.set?.call(this, value === "date" ? "text" : value);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the compatibility form's birth date, typed in French", () => {
  it("is read when the field is left", () => {
    render(
      <LanguageProvider baseMessages={en}>
        <ToastProvider>
          <CompatibilityPageClient initialSearchParams={{}} />
        </ToastProvider>
      </LanguageProvider>,
    );
    /* Yours, then theirs: both profiles are forms while they are empty. */
    const [date] = screen.getAllByLabelText(/Birth Date/);
    expect(date).toHaveProperty("type", "text");

    fireEvent.change(date, { target: { value: "15 juin 1990" } });
    fireEvent.blur(date);

    expect(date).toHaveValue("1990-06-15");
    expect(screen.getByText(formatBirthDateDisplay("1990-06-15", "fr-FR"))).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
