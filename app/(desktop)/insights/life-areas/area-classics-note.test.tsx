import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import en from "@/messages/en.json";
import lifeAreasMessages from "@/messages/en.life-areas.json";
import type { LifeDomainKey } from "@/lib/astro-types";
import { LanguageProvider, useRouteMessages, useTranslation } from "@/lib/i18n-context";
import type { AreaClassicsResponse } from "@/lib/knowledge/classical-reading";
import { ClassicalNote } from "@/app/(desktop)/insights/components/classical-note";
import { useAreaClassics } from "./use-area-classics";

/*
 * The life areas' classical note against a stubbed route, wired the way
 * life-areas-client.tsx wires it: one request for every area, then the card
 * for whichever area is open. What it asks for, that moving between areas
 * never asks again, and that every way of not getting a note leaves nothing.
 */

const CHART_QS = "name=Asha&date=1990-01-01&time=10%3A00&lat=22.57&lng=88.36&tz=330";

const RESPONSE: AreaClassicsResponse = {
  cached: false,
  readings: {
    love_life: {
      segments: [
        { text: "With Venus in your 7th house, ", sources: [] },
        { text: "the Brihat Jataka holds that you will be drawn to romance.", sources: [1] },
      ],
      sources: [
        { number: 1, book: "brihat-jataka-1885", ref: "20.8", kind: "verse", text: "if Venus occupy the 7th house, the person will be fond of quarrels" },
      ],
    },
    family: {
      segments: [
        { text: "With the lord of your 7th house in your 1st, the Strijataka promises a happy home", sources: [1] },
        { text: ", and the Brihat Jataka agrees.", sources: [2] },
      ],
      sources: [
        { number: 1, book: "strijataka-1931", ref: "12", kind: "verse", text: "If the lord of 7th joins Lagna" },
        { number: 2, book: "brihat-jataka-1885", ref: "20.4", kind: "verse", text: "if the Moon occupy the 4th house" },
      ],
    },
    career: {
      segments: [{ text: "With Mars in the 10th, the translator's notes add that you will lead.", sources: [1] }],
      sources: [{ number: 1, book: "brihat-jataka-1885", ref: "20.6", kind: "note", text: "Mars in the 10th makes a leader of men." }],
    },
  },
};

function Harness({ area }: { area: LifeDomainKey }) {
  const tr = useRouteMessages(lifeAreasMessages);
  const { language } = useTranslation();
  const classics = useAreaClassics(CHART_QS, language);
  return (
    <ClassicalNote
      state={classics.state}
      reading={classics.readings[area] ?? null}
      tr={tr}
      prefix="lifeAreas.classics"
      headingId="area-classics-heading"
      className="classical-note--single"
    />
  );
}

const renderNote = (area: LifeDomainKey) => {
  const ui = (key: LifeDomainKey) => (
    <LanguageProvider baseMessages={en}>
      <Harness area={key} />
    </LanguageProvider>
  );
  const result = render(ui(area));
  return { ...result, showArea: (key: LifeDomainKey) => result.rerender(ui(key)) };
};

function respond(body: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok, status: ok ? 200 : 429, json: async () => body } as Response);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the life areas' classical note", () => {
  it("asks once for every area, with the chart and the page language", async () => {
    const fetchSpy = respond(RESPONSE);
    renderNote("love_life");
    await screen.findByText(/drawn to romance/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(`/api/chart/area-classics?${CHART_QS}&language=en`);
  });

  it("switches notes between areas without asking again", async () => {
    const fetchSpy = respond(RESPONSE);
    const { showArea, container } = renderNote("love_life");
    await screen.findByText(/drawn to romance/);

    showArea("career");
    expect(screen.getByText(/you will lead/)).toBeInTheDocument();
    expect(container.querySelector(".classical-note-source-ref")).toHaveTextContent("Brihat Jataka 20.6 · translator's note");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("names each passage's book, and credits each book it quotes", async () => {
    respond(RESPONSE);
    const { container, showArea } = renderNote("love_life");
    await screen.findByText(/drawn to romance/);
    const credits = () => [...container.querySelectorAll(".classical-note-credit")].map((node) => node.textContent);
    expect(credits()).toEqual([lifeAreasMessages.lifeAreas.classics.credit]);

    showArea("family");
    const refs = [...container.querySelectorAll(".classical-note-source-ref")].map((node) => node.textContent);
    expect(refs).toEqual(["Strijataka, ch. 12", "Brihat Jataka 20.4"]);
    expect(credits()).toEqual([
      lifeAreasMessages.lifeAreas.classics.credit,
      lifeAreasMessages.lifeAreas.classics.creditStrijataka,
    ]);
  });

  it("shows nothing for an area the book has nothing on, while others have notes", async () => {
    respond(RESPONSE);
    const { container, showArea } = renderNote("love_life");
    await screen.findByText(/drawn to romance/);
    showArea("travel_destinations");
    expect(container.querySelector(".classical-note")).toBeNull();
  });

  it("holds its place with a status line while the notes are written", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderNote("love_life");
    expect(screen.getByRole("status")).toHaveTextContent("Reading the classics for your chart");
    expect(
      screen.getByRole("region", { name: "What the classics say about this area of your life" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it.each([
    ["the book has nothing for any area", { readings: {}, cached: false }, true],
    ["the route refuses", { error: { code: "RATE_LIMITED" } }, false],
    ["a note comes back without sources", { readings: { love_life: { segments: [{ text: "x", sources: [] }], sources: [] } } }, true],
  ])("leaves nothing behind when %s", async (_, body, ok) => {
    respond(body, ok);
    const { container } = renderNote("love_life");
    await waitFor(() => expect(container.querySelector(".classical-note")).toBeNull());
  });
});
