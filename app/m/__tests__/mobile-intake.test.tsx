import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import enMobile from "@/messages/en.mobile.json";
import { LanguageProvider } from "@/lib/i18n-context";
import { formatBirthDateDisplay } from "@/lib/intake-normalize";
import MobileIntake from "../mobile-intake";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/*
 * The mobile intake's birth date, typed in the interface language.
 *
 * A working date input holds an ISO value and needs no reading. These are
 * about a browser without one, where the field is a plain text box and what
 * the visitor types goes through the normaliser, given the interface
 * language, both when the field is left and when the question is submitted.
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

describe("the mobile intake's sex at birth", () => {
  it("starts on prefer not to say, and keeps a choice in the shared draft", () => {
    const { container } = render(
      <LanguageProvider baseMessages={enMobile}>
        <MobileIntake />
      </LanguageProvider>,
    );
    expect(screen.getByRole("button", { name: "Prefer not to say" })).toHaveAttribute("aria-pressed", "true");

    const name = container.querySelector<HTMLInputElement>("#m-name");
    if (!name) throw new Error("The name question is not on screen.");
    fireEvent.change(name, { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Woman" }));

    expect(screen.getByRole("button", { name: "Woman" })).toHaveAttribute("aria-pressed", "true");
    const stored = JSON.parse(window.localStorage.getItem("astro_intake_draft:local") ?? "{}");
    expect(stored.draft?.birthSex).toBe("female");
  });
});

/* Answer the name question and return the date field that replaces it. */
function openDateQuestion(): HTMLInputElement {
  const { container } = render(
    <LanguageProvider baseMessages={enMobile}>
      <MobileIntake />
    </LanguageProvider>,
  );
  const name = container.querySelector<HTMLInputElement>("#m-name");
  if (!name?.form) throw new Error("The name question is not on screen.");
  fireEvent.change(name, { target: { value: "Ada" } });
  fireEvent.submit(name.form);

  const date = container.querySelector<HTMLInputElement>("#m-birth-date");
  if (!date) throw new Error("The date question did not open.");
  expect(date.type).toBe("text");
  return date;
}

describe("MobileIntake's birth date, typed in French", () => {
  it("is read when the field is left", () => {
    const date = openDateQuestion();

    fireEvent.change(date, { target: { value: "15 juin 1990" } });
    fireEvent.blur(date);

    expect(date).toHaveValue("1990-06-15");
    expect(screen.getByText(formatBirthDateDisplay("1990-06-15", "fr-FR"))).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is read on submit when the field never lost focus", () => {
    const date = openDateQuestion();

    fireEvent.change(date, { target: { value: "15 juin 1990" } });
    fireEvent.submit(date.form as HTMLFormElement);

    expect(document.querySelector("#m-birth-time")).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem("astro_intake_draft:local") ?? "{}");
    expect(stored.draft?.birthDate).toBe("1990-06-15");
  });
});
