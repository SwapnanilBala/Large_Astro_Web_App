import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import en from "@/messages/en.json";
import lifeAreasMessages from "@/messages/en.life-areas.json";
import { LanguageProvider, useRouteMessages } from "@/lib/i18n-context";
import type { AskClassicsAnswer } from "@/lib/knowledge/ask-questions";
import { AskClassicsPanel } from "./ask-classics-panel";

/*
 * "Ask the classics" against a stubbed route, wired the way
 * life-areas-client.tsx wires it: one unpaid request for the questions this
 * chart can be asked, then one per question the reader picks, never twice for
 * the same question, and nothing at all outside English.
 */

const CHART_QS = "name=Asha&date=1990-01-01&time=10%3A00&lat=22.57&lng=88.36&tz=330";
const LABELS = lifeAreasMessages.lifeAreas.ask.questions;

const CAREER: AskClassicsAnswer = {
  question: "career_year",
  cached: false,
  reading: {
    segments: [
      { text: "This year runs under your Saturn period, ", sources: [] },
      { text: "and with Mars in your 10th house the Brihat Jataka holds that you rise in your work.", sources: [1] },
    ],
    sources: [{ number: 1, book: "brihat-jataka-1885", ref: "18.10", kind: "verse", text: "If Mars occupy the 10th house..." }],
  },
};

type Reply = { status?: number; body: unknown };

/** Answers by the `question` parameter; "" is the request for which questions can be asked. */
function route(replies: Record<string, Reply>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const question = new URL(String(input), "https://example.test").searchParams.get("question") ?? "";
    const reply = replies[question] ?? { status: 500, body: {} };
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
}

function Harness() {
  const tr = useRouteMessages(lifeAreasMessages);
  return <AskClassicsPanel historyQs={CHART_QS} tr={tr} />;
}

const renderPanel = () =>
  render(
    <LanguageProvider baseMessages={en}>
      <Harness />
    </LanguageProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ask the classics", () => {
  it("offers only the questions this chart can be asked, after one request with the chart", async () => {
    const fetchSpy = route({ "": { body: { available: ["career_year", "health"] } } });
    renderPanel();
    expect(await screen.findByRole("button", { name: LABELS.career_year })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABELS.health })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: LABELS.children })).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(`/api/chart/ask-classics?${CHART_QS}`);
  });

  it("answers the question picked, under the question, with its passages, and never asks it twice", async () => {
    const fetchSpy = route({ "": { body: { available: ["career_year", "health"] } }, career_year: { body: CAREER } });
    const { container } = renderPanel();
    const chip = await screen.findByRole("button", { name: LABELS.career_year });

    fireEvent.click(chip);
    expect(await screen.findByText(/you rise in your work/)).toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: LABELS.career_year })).toBeInTheDocument();
    expect(container.querySelector(".classical-note-source-ref")).toHaveTextContent("Brihat Jataka 18.10");
    expect(fetchSpy.mock.calls[1][0]).toBe(`/api/chart/ask-classics?${CHART_QS}&question=career_year`);

    fireEvent.click(screen.getByRole("button", { name: LABELS.health }));
    fireEvent.click(chip);
    await screen.findByText(/you rise in your work/);
    const asked = fetchSpy.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("question=career_year"));
    expect(asked).toHaveLength(1);
  });

  it("says when the books have nothing on a question, and lets a failed one be asked again", async () => {
    const fetchSpy = route({
      "": { body: { available: ["career_year", "children"] } },
      children: { body: { question: "children", reading: null, cached: false } },
      career_year: { status: 502, body: { error: { code: "EXTERNAL_SERVICE_ERROR" } } },
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: LABELS.children }));
    expect(await screen.findByText(lifeAreasMessages.lifeAreas.ask.empty)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: LABELS.career_year }));
    expect(await screen.findByRole("alert")).toHaveTextContent(lifeAreasMessages.lifeAreas.ask.failed);
    fireEvent.click(screen.getByRole("button", { name: LABELS.career_year }));
    await waitFor(() =>
      expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("question=career_year"))).toHaveLength(2),
    );
  });

  it("asks a signed-out reader who has used today's questions to sign in", async () => {
    route({
      "": { body: { available: ["career_year"] } },
      career_year: { status: 429, body: { error: { code: "RATE_LIMITED", details: { scope: "anonymous" } } } },
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: LABELS.career_year }));
    expect(await screen.findByRole("alert")).toHaveTextContent(lifeAreasMessages.lifeAreas.ask.limitedSignIn);
  });

  it.each([
    ["the books can answer nothing for this chart", { body: { available: [] } }],
    ["the route fails", { status: 500, body: {} }],
  ])("does not appear when %s", async (_, reply) => {
    route({ "": reply });
    const { container } = renderPanel();
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
  });

  it("does not appear, or ask anything, in another language while the answers are English only", () => {
    window.localStorage.setItem("astro_language", "hi");
    const fetchSpy = route({ "": { body: { available: ["career_year"] } } });
    const { container } = renderPanel();
    expect(container.querySelector("section")).toBeNull();
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).startsWith("/api/chart/ask-classics"))).toHaveLength(0);
  });
});
