import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import en from "@/messages/en.json";
import { LanguageProvider } from "@/lib/i18n-context";
import { normalizePersonName } from "@/lib/intake-normalize";
import PremiumDatePicker from "../PremiumDatePicker";
import PremiumInput from "../PremiumInput";

/*
 * The notes under the desktop intake's fields, as the visitor sees them.
 *
 * The normaliser returns keys and canonical values; these two inputs turn
 * them into text at render time. What is pinned here is that wiring: that a
 * note comes out of the catalog rather than as a raw key, that the field's
 * own format hint is what an unreadable entry gets, and that values are
 * written in the selected language's locale.
 */

beforeEach(() => {
  window.localStorage.clear();
  /* Translation files are not importable here; the provider reports that
     and stays on English, which is all these assert on for the wording. */
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function NameField() {
  const [value, setValue] = useState("");
  return (
    <PremiumInput
      id="name"
      label="Name"
      value={value}
      onChange={setValue}
      normalize={normalizePersonName}
    />
  );
}

function TimeField({ formatHint }: { formatHint?: string }) {
  const [value, setValue] = useState<Date | null>(null);
  return (
    <PremiumDatePicker
      id="time"
      label="Birth Time"
      value={value}
      onChange={setValue}
      formatHint={formatHint}
      showTimeSelect
      showTimeSelectOnly
      dateFormat="h:mm aa"
      preventOpenOnFocus
    />
  );
}

function renderInEnglish(ui: React.ReactElement) {
  return render(<LanguageProvider baseMessages={en}>{ui}</LanguageProvider>);
}

function type(input: HTMLElement, text: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
}

describe("PremiumInput", () => {
  it("shows the normaliser's note from the catalog", () => {
    renderInEnglish(<NameField />);
    const input = screen.getByLabelText("Name");

    type(input, "ada lovelace");

    expect(input).toHaveValue("Ada Lovelace");
    expect(screen.getByText('Capitalised as "Ada Lovelace".')).toBeInTheDocument();
  });

  it("reports why a value was rejected", () => {
    renderInEnglish(<NameField />);

    type(screen.getByLabelText("Name"), "A");

    expect(screen.getByRole("alert")).toHaveTextContent("A name needs at least two letters.");
  });

  it("names the finished field through the catalog", () => {
    renderInEnglish(<PremiumInput label="Name" value="Ada" onChange={() => {}} completed />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Name complete");
  });
});

describe("PremiumDatePicker", () => {
  it("gives text with no time in it the field's own format hint", () => {
    renderInEnglish(<TimeField formatHint="Try 14:30." />);

    type(screen.getByLabelText("Birth Time"), "hello");

    expect(screen.getByRole("alert")).toHaveTextContent("Try 14:30.");
  });

  it("falls back to the catalog's hint when the form passes none", () => {
    renderInEnglish(<TimeField />);

    type(screen.getByLabelText("Birth Time"), "hello");

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a time like 14:30 or 2:30 PM.");
  });

  it("keeps the normaliser's own note for a time that was read and is impossible", () => {
    renderInEnglish(<TimeField formatHint="Try 14:30." />);

    type(screen.getByLabelText("Birth Time"), "25:00");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hours only run from 0 to 23. Add AM or PM for a 12-hour time.",
    );
  });

  it("offers the other reading under a translated label", () => {
    renderInEnglish(<TimeField />);

    type(screen.getByLabelText("Birth Time"), "7:15");

    expect(screen.getByText("7:15 could be morning or evening — read as 7:15 AM.")).toBeInTheDocument();
    expect(screen.getByText("Did you mean")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7:15 PM" })).toBeInTheDocument();
  });

  it("writes the reading in the selected language's clock", () => {
    window.localStorage.setItem("astro_language", "fr");
    renderInEnglish(<TimeField />);
    const input = screen.getByLabelText("Birth Time");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2:30 pm" } });

    /* French keeps a 24-hour clock. */
    expect(screen.getByText(/14:30$/)).toBeInTheDocument();
  });
});
