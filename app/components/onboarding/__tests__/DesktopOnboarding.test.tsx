import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n-context";
import { chartHistoryKey } from "@/lib/chart-history-store";
import {
  ONBOARDING_KEY,
  parseGuidance,
  readGuidanceSnapshot,
  saveGuidance,
  subscribeToGuidance,
} from "@/lib/onboarding-store";
import {
  ChartGuidance,
  DesktopHelpButton,
  DesktopOnboardingProvider,
  TermHelp,
  WelcomeGuidance,
} from "../DesktopOnboarding";

const route = vi.hoisted(() => ({ path: "/insights" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));

function Fixture({
  chartKey = "fixture",
  specificCard = false,
  hideTiming = false,
}: {
  chartKey?: string;
  specificCard?: boolean;
  hideTiming?: boolean;
}) {
  return (
    <LanguageProvider baseMessages={{}}>
      <DesktopOnboardingProvider>
        <DesktopHelpButton />
        <WelcomeGuidance />
        <ChartGuidance chartKey={chartKey} uncertainTime={false} />
        <section id="top-takeaways">Summary</section>
        <section id="chart-map">
          Chart{specificCard && <div id="birth-chart-guide">Birth chart</div>}
        </section>
        {!hideTiming && <section id="timing">Timing</section>}
        <section id="core">
          <a href="/insights/full-reading?fixture=kept">Reading</a>
        </section>
        <TermHelp terms={["dasha"]} />
      </DesktopOnboardingProvider>
    </LanguageProvider>
  );
}

beforeEach(() => {
  route.path = "/insights";
  localStorage.clear();
  // Also clear the store's in-memory fallback.
  const unsubscribe = subscribeToGuidance(() => {});
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
  unsubscribe();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("desktop onboarding", () => {
  it("offers guidance without starting a tour and remembers dismissal on remount", () => {
    const view = render(<Fixture />);
    expect(screen.getByText("New to Lagna Atelier?")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Chart introduction" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Explore on my own" })[0],
    );
    expect(screen.queryByText("New to Lagna Atelier?")).not.toBeInTheDocument();
    view.unmount();
    render(<Fixture />);
    expect(
      screen.queryByRole("button", { name: "Start chart introduction" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByRole("button", { name: "Start chart introduction" }),
    ).toBeInTheDocument();
  });

  it("does not show first-time invitations to existing chart readers", () => {
    localStorage.setItem(
      chartHistoryKey(),
      JSON.stringify([{ name: "Reader", queryString: "fixture=1" }]),
    );
    render(<Fixture />);
    expect(screen.queryByText("New to Lagna Atelier?")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your chart is ready. Need a starting point?"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
  });

  it("supports Back, completion, query-preserving links, and replay from Help", () => {
    render(<Fixture />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start chart introduction" }),
    );
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Start with Top Takeaways" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    for (let index = 0; index < 3; index++)
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("link", { name: "Open full reading" }),
    ).toHaveAttribute("href", "/insights/full-reading?fixture=kept");
    fireEvent.click(
      screen.getByRole("button", { name: "Finish introduction" }),
    );
    expect(parseGuidance(readGuidanceSnapshot()).tourCompleted).toBe(true);
    expect(
      screen.queryByRole("region", { name: "Chart introduction" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Replay chart introduction" }),
    );
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("opens a term definition and closes with Escape without losing Help", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Explain Dasha" }));
    expect(
      screen
        .getByText(/A planetary period used in Vedic astrology/)
        .closest("details"),
    ).toHaveAttribute("open");
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a glossary definition from inside the Help panel", () => {
    route.path = "/insights/timing";
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("How to use this section"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Explain Dasha" }),
    );
    expect(
      within(screen.getByRole("dialog"))
        .getByText(/A planetary period used in Vedic astrology/)
        .closest("details"),
    ).toHaveAttribute("open");
  });

  it("prefers the chart card over its parent fallback and omits unavailable steps", () => {
    render(<Fixture specificCard hideTiming />);
    const card = document.getElementById("birth-chart-guide")!;
    fireEvent.click(
      screen.getByRole("button", { name: "Start chart introduction" }),
    );
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(card.scrollIntoView).toHaveBeenLastCalledWith({
      block: "start",
      behavior: "instant",
    });
    expect(card.className).toContain("tourTarget");
    expect(document.getElementById("chart-map")!.className).not.toContain(
      "tourTarget",
    );
  });

  it("suspends for another modal and exits when the chart changes", async () => {
    const view = render(<Fixture />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start chart introduction" }),
    );
    const other = document.createElement("div");
    other.setAttribute("aria-modal", "true");
    document.body.appendChild(other);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Chart introduction" }),
      ).not.toBeInTheDocument(),
    );
    other.remove();
    await waitFor(() => expect(screen.getByText("1 of 4")).toBeInTheDocument());
    view.rerender(<Fixture chartKey="different-chart" />);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Chart introduction" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("does not resurrect an introduction after navigating away and back", () => {
    const view = render(<Fixture />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start chart introduction" }),
    );
    route.path = "/insights/timing";
    view.rerender(<Fixture />);
    route.path = "/insights";
    view.rerender(<Fixture />);
    expect(
      screen.queryByRole("region", { name: "Chart introduction" }),
    ).not.toBeInTheDocument();
  });
});

describe("guidance preferences", () => {
  it("ignores malformed and incorrectly typed persisted values", () => {
    expect(parseGuidance("not json").welcomeDismissed).toBe(false);
    expect(
      parseGuidance('{"tourCompleted":"true","audience":"unknown"}'),
    ).toMatchObject({ tourCompleted: false, audience: "beginner" });
  });

  it("keeps dismissal usable when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    saveGuidance({ chartDismissed: true });
    expect(parseGuidance(readGuidanceSnapshot()).chartDismissed).toBe(true);
  });

  it("writes only tutorial preferences", () => {
    saveGuidance({ audience: "experienced", welcomeDismissed: true });
    expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!)).toEqual({
      audience: "experienced",
      welcomeDismissed: true,
      chartDismissed: false,
      tourCompleted: false,
    });
  });
});
