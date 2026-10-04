import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import en from "@/messages/en.json";
import type { YogaDetectionResult } from "@/lib/astro-types";
import { LanguageProvider } from "@/lib/i18n-context";
import type { YogaClassicsResponse } from "@/lib/knowledge/yoga-classics";
import { YogaClassicsCard } from "./yoga-classics-card";

/*
 * The card against a stubbed route: what it asks for, what it shows once the
 * note lands, and that every way of not getting one leaves nothing behind.
 */

const YOGAS = [
  { yoga_id: "veena", occurrence_chance: 12, strength: "moderate", involved_planets: ["Sun", "Moon"] },
  { yoga_id: "sunapha", occurrence_chance: 40, strength: "strong", involved_planets: ["Moon", "Saturn"] },
] as unknown as YogaDetectionResult[];

const READING: YogaClassicsResponse = {
  cached: false,
  reading: {
    segments: [
      { text: "The Brihat Jataka holds that Sunapha formed by Saturn brings leadership of groups.", sources: [1] },
      { text: "\n\nIt calls Veena Yoga Vallaki", sources: [2, 3] },
      { text: ", and the notes add more.", sources: [] },
    ],
    sources: [
      { number: 1, ref: "13.8", kind: "verse", text: "If the yoga planet be Saturn, a person will be the chief of parties of men." },
      { number: 2, ref: "12.10", kind: "verse", text: "If all the planets occupy any seven signs the yoga is known as Vallaki ;" },
      { number: 3, ref: "12.17", kind: "note", text: "A person born in a Vallaki yoga will delight in music and dance." },
    ],
  },
};

function respond(body: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => body } as Response);
}

function renderCard() {
  return render(
    <LanguageProvider baseMessages={en}>
      <YogaClassicsCard yogas={YOGAS} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  /* The provider cannot import translation files here and says so. */
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the classical yoga card", () => {
  it("asks once, with the ranked yogas and the page language", async () => {
    const fetchSpy = respond(READING);
    renderCard();
    await screen.findByText(/leadership of groups/);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/chart/yoga-classics");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      yogas: [
        { id: "sunapha", planets: ["Moon", "Saturn"], strength: "strong" },
        { id: "veena", planets: ["Sun", "Moon"], strength: "moderate" },
      ],
      language: "en",
    });
  });

  it("holds its place with a status line while the note is written", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.getByRole("status")).toHaveTextContent("Reading the Brihat Jataka for your yogas");
    expect(screen.getByRole("region", { name: "What the Brihat Jataka says about your yogas" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows the note in paragraphs, marked against numbered verses quoted as printed", async () => {
    respond(READING);
    const { container } = renderCard();
    await screen.findByText(/leadership of groups/);

    const paragraphs = container.querySelectorAll(".yoga-classics-reading p");
    expect(paragraphs).toHaveLength(2);
    expect([...container.querySelectorAll(".yoga-classics-mark")].map((mark) => mark.textContent)).toEqual([
      "1",
      "2,3",
    ]);

    expect(screen.getByText("The verses (3)")).toBeInTheDocument();
    const items = container.querySelectorAll(".yoga-classics-sources li");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Brihat Jataka 13.8");
    expect(items[2]).toHaveTextContent("Brihat Jataka 12.17 · translator's note");
    expect(items[1].querySelector("q")).toHaveAttribute("lang", "en");
    expect(screen.getByText(/The numbers point to the verses they come from/)).toBeInTheDocument();
    expect(screen.queryByText(/\bAI\b/)).toBeNull();
  });

  it.each([
    ["the route has no verses for these yogas", { reading: null, cached: false }, true],
    ["the route fails", { error: { code: "RATE_LIMITED" } }, false],
    ["the note comes back without sources", { reading: { segments: [{ text: "x", sources: [] }], sources: [] } }, true],
  ])("leaves nothing behind when %s", async (_, body, ok) => {
    respond(body, ok);
    const { container } = renderCard();
    await waitFor(() => expect(container.querySelector(".yoga-classics")).toBeNull());
  });
});
