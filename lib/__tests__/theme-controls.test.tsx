import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import desktopMessages from "@/messages/en.json";
import mobileMessages from "@/messages/en.mobile.json";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import ThemeToggle from "@/app/components/ThemeToggle";
import MobileIntake from "@/app/m/mobile-intake";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/*
 * Light and dark, from the desktop navbar's switch and the mobile intake's
 * button. Both flip <html data-theme> the way the bootstrap in app/layout.tsx
 * sets it on load, remember it under the bootstrap's key, and say what a press
 * will do. Where the knob sits and which icon shows is CSS on data-theme,
 * which jsdom does not lay out, so the attribute is what is asserted.
 */

function inProvider(messages: MessageTree, node: ReactNode) {
  return render(<LanguageProvider baseMessages={messages}>{node}</LanguageProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = "dark";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("desktop theme switch", () => {
  it("offers light from dark, and dark from light, remembering each", async () => {
    inProvider(desktopMessages, <ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("lagna-theme")).toBe("light");

    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("lagna-theme")).toBe("dark");
  });

  it("follows a theme set before it mounted", () => {
    document.documentElement.dataset.theme = "light";
    inProvider(desktopMessages, <ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });
});

describe("mobile theme button", () => {
  it("is on the intake, and switches the theme the same way", async () => {
    inProvider(mobileMessages, <MobileIntake />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("lagna-theme")).toBe("light");
    expect(await screen.findByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it("does not submit the form it sits in", async () => {
    /* With the name answered, a submit would move on to the birth date, so
       staying on the first question is the proof. */
    window.localStorage.setItem(
      "astro_intake_draft:local",
      JSON.stringify({ draft: { name: "Test Visitor" } }),
    );
    inProvider(mobileMessages, <MobileIntake />);
    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue("Test Visitor"));
    const question = screen.getByRole("heading", { level: 1 }).textContent;

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(question);
  });
});
