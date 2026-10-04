import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import en from "@/messages/en.json";
import { LanguageProvider } from "@/lib/i18n-context";
import {
  formatBirthDateDisplay,
  formatClockDisplay,
  normalizePersonName,
} from "@/lib/intake-normalize";
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
      preventOpenOnFocus
    />
  );
}

function DateField({ initial = null }: { initial?: Date | null }) {
  const [value, setValue] = useState<Date | null>(initial);
  return (
    <PremiumDatePicker
      id="date"
      label="Birth Date"
      value={value}
      onChange={setValue}
      maxDate={new Date(2026, 7, 17)}
      minDate={new Date(1900, 0, 1)}
      showMonthDropdown
      showYearDropdown
      preventOpenOnFocus
    />
  );
}

function renderInEnglish(ui: React.ReactElement) {
  return render(<LanguageProvider baseMessages={en}>{ui}</LanguageProvider>);
}

/* The provider adopts the stored language on its first client render. Its
   translation file cannot load here, so the catalog stays English; the
   picker's language does not depend on the catalog. */
function renderIn(language: string, ui: React.ReactElement) {
  window.localStorage.setItem("astro_language", language);
  return renderInEnglish(ui);
}

/* The weekday names over the calendar, as they are seen. */
function weekdayNames(): string[] {
  return Array.from(
    document.querySelectorAll('.react-datepicker__day-name [aria-hidden="true"]'),
    (name) => name.textContent ?? "",
  );
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

describe("PremiumDatePicker in the interface language", () => {
  beforeEach(() => {
    /* Opening the calendar scrolls to make room for it; jsdom cannot scroll. */
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  });

  it("keeps English as it always was", () => {
    renderInEnglish(
      <>
        <DateField />
        <TimeField />
      </>,
    );

    type(screen.getByLabelText("Birth Date"), "5 June 1990");
    type(screen.getByLabelText("Birth Time"), "7:15");

    expect(screen.getByLabelText("Birth Date")).toHaveValue("05 Jun 1990");
    expect(screen.getByLabelText("Birth Time")).toHaveValue("7:15 AM");
  });

  it("writes the field as the read-out under it does", () => {
    renderIn(
      "fr",
      <>
        <DateField />
        <TimeField />
      </>,
    );

    type(screen.getByLabelText("Birth Date"), "15/05/1990");
    type(screen.getByLabelText("Birth Time"), "7:15 pm");

    expect(screen.getByLabelText("Birth Date")).toHaveValue(
      formatBirthDateDisplay("1990-05-15", "fr-FR"),
    );
    /* French keeps a 24-hour clock. */
    expect(screen.getByLabelText("Birth Time")).toHaveValue("19:15");
  });

  it("reads back what it wrote once the visitor edits it", () => {
    renderIn(
      "hi",
      <>
        <DateField />
        <TimeField />
      </>,
    );

    type(screen.getByLabelText("Birth Date"), "15 जन॰ 1990");
    type(screen.getByLabelText("Birth Time"), "7:15 pm");

    expect(screen.getByLabelText("Birth Date")).toHaveValue(
      formatBirthDateDisplay("1990-01-15", "hi-IN"),
    );
    expect(screen.getByLabelText("Birth Time")).toHaveValue(formatClockDisplay("19:15", "hi-IN"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens a calendar in the language", async () => {
    renderIn("fr", <DateField initial={new Date(1990, 4, 15)} />);

    fireEvent.click(screen.getByLabelText("Birth Date"));

    /* The language's calendar arrives in a chunk of its own, and a French week
       starts on Monday. */
    await waitFor(() =>
      expect(weekdayNames()).toEqual(["lu", "ma", "me", "je", "ve", "sa", "di"]),
    );
    expect(document.querySelector(".react-datepicker__current-month")).toHaveTextContent(
      "mai 1990",
    );
  });

  it("lists the times on the language's clock", () => {
    renderIn("fr", <TimeField />);

    fireEvent.click(screen.getByLabelText("Birth Time"));

    const times = Array.from(
      document.querySelectorAll(".react-datepicker__time-list-item"),
      (item) => item.textContent,
    );
    expect(times).toContain("07:15");
    expect(times).toContain("19:15");
    expect(times.join(" ")).not.toMatch(/AM|PM/);
  });

  it("heads the list of times with the catalog's caption", () => {
    const messages = { ...en, home: { ...en.home, timeCaption: "Heure" } };
    render(
      <LanguageProvider baseMessages={messages}>
        <TimeField />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByLabelText("Birth Time"));

    expect(document.querySelector(".react-datepicker-time__header")).toHaveTextContent("Heure");
  });
});
