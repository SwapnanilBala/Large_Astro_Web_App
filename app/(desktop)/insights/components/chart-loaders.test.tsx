import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ChartApiResponse } from "@/lib/astro-types";
import { LanguageProvider } from "@/lib/i18n-context";
import InsightsLoader from "./insights-loader";
import AdvancedLoader from "../advanced/advanced-loader";

/*
 * The two chart loaders, with the pages they load swapped for a marker and
 * framer-motion for plain elements, so what is measured is the loading itself:
 * which state shows, and how many requests it takes to get there. The last
 * test is the hand-off between them -- /insights puts its payload in the tab's
 * cache and /insights/advanced opens on it without asking again.
 */

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));
vi.mock("./insights-skeleton", () => ({
  default: () => <div data-testid="skeleton" />,
}));
vi.mock("./insights-content", () => ({
  default: ({ payload }: { payload: { marker: string } }) => (
    <div data-testid="content">{payload.marker}</div>
  ),
}));
vi.mock("../advanced/advanced-content", () => ({
  default: ({ payload }: { payload: { marker: string } }) => (
    <div data-testid="content">{payload.marker}</div>
  ),
}));

const paramsFor = (name: string) => ({
  name,
  birthDate: "1990-04-15",
  birthTime: "14:30",
  timezoneOffsetMinutes: "330",
  latitude: "19.0760",
  longitude: "72.8777",
  country: "India",
  state: "Maharashtra",
  city: "Mumbai",
  town: "",
  timeZoneId: "",
  engineId: "",
  birthTimeAccuracy: "",
  birthTimeSource: "",
  birthTimeFallback: "",
});

const payload = (marker: string) => ({ marker }) as unknown as ChartApiResponse;

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const inProvider = (node: ReactNode) => (
  <LanguageProvider baseMessages={{}}>{node}</LanguageProvider>
);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InsightsLoader", () => {
  it("shows the server's payload without asking for it again", () => {
    render(inProvider(<InsightsLoader chartParams={paramsFor("Server")} initialPayload={payload("server")} />));
    expect(screen.getByTestId("content")).toHaveTextContent("server");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's error, and Retry fetches the chart", async () => {
    fetchMock.mockResolvedValueOnce(json(200, payload("fetched")));
    render(inProvider(<InsightsLoader chartParams={paramsFor("Retry")} initialError="Engine offline" />));

    expect(screen.getByText("Error: Engine offline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("content")).toHaveTextContent("fetched"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches on mount when the server sent neither, and shows a failure", async () => {
    fetchMock.mockResolvedValueOnce(json(500));
    render(inProvider(<InsightsLoader chartParams={paramsFor("Neither")} />));

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Error: Chart API error (500)")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps its payload across a re-render with equal params, and takes a new one", () => {
    const initial = payload("first");
    const { rerender } = render(
      inProvider(<InsightsLoader chartParams={paramsFor("Rerender")} initialPayload={initial} />)
    );

    rerender(inProvider(<InsightsLoader chartParams={paramsFor("Rerender")} initialPayload={initial} />));
    expect(screen.getByTestId("content")).toHaveTextContent("first");

    rerender(
      inProvider(<InsightsLoader chartParams={paramsFor("Rerender")} initialPayload={payload("refreshed")} />)
    );
    expect(screen.getByTestId("content")).toHaveTextContent("refreshed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AdvancedLoader", () => {
  it("fetches a chart this tab does not have", async () => {
    fetchMock.mockResolvedValueOnce(json(200, payload("advanced")));
    render(inProvider(<AdvancedLoader chartParams={paramsFor("Fresh")} focusView={null} />));

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("content")).toHaveTextContent("advanced"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not refetch when the page re-renders with equal params", async () => {
    fetchMock.mockResolvedValueOnce(json(200, payload("once")));
    const { rerender } = render(
      inProvider(<AdvancedLoader chartParams={paramsFor("Views")} focusView={null} />)
    );
    await waitFor(() => expect(screen.getByTestId("content")).toHaveTextContent("once"));

    rerender(inProvider(<AdvancedLoader chartParams={paramsFor("Views")} focusView="transits" />));
    expect(screen.getByTestId("content")).toHaveTextContent("once");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("offers Retry after a failure, and Retry fetches again", async () => {
    fetchMock.mockResolvedValueOnce(json(502)).mockResolvedValueOnce(json(200, payload("second")));
    render(inProvider(<AdvancedLoader chartParams={paramsFor("Flaky")} focusView={null} />));

    await waitFor(() => expect(screen.getByText("Error: Chart API error (502)")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(screen.getByTestId("content")).toHaveTextContent("second"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens straight onto a chart /insights already loaded", () => {
    const reading = render(
      inProvider(<InsightsLoader chartParams={paramsFor("Handoff")} initialPayload={payload("from-insights")} />)
    );
    reading.unmount();

    render(inProvider(<AdvancedLoader chartParams={paramsFor("Handoff")} focusView={null} />));
    expect(screen.getByTestId("content")).toHaveTextContent("from-insights");
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
