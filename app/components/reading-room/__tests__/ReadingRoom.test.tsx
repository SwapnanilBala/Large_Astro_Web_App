import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReadingRoom, { type ReadingRoomItem } from "../ReadingRoom";

/*
 * The reading room's behaviour, independent of what it lists: one item open
 * at a time, the arrow keys and Home/End moving through the rows with focus
 * following, a filter that falls back to the first row it shows, and
 * Previous/Next stopping at the ends.
 *
 * jsdom applies no CSS, so in the split layout both renderings of the open
 * item are in the tree at once -- the pane and the copy under its own row that
 * narrow screens use. Hence "two headings" wherever a reading is asserted.
 */

const NAMES = ["Alpha", "Beta", "Gamma", "Delta"];

function items(): ReadingRoomItem[] {
  return NAMES.map((name, index) => ({
    key: name.toLowerCase(),
    tags: [index % 2 === 0 ? "even" : "odd"],
    group: index < 2 ? "first" : "second",
    row: <span>{name}</span>,
    detail: (headingId: string) => <h3 id={headingId}>{name} reading</h3>,
  }));
}

const copy = {
  /* jsdom applies no stylesheet, so the class names do not matter here. */
  classes: {},
  listLabel: "Things",
  previousLabel: "Previous",
  nextLabel: "Next",
  positionLabel: (position: number, total: number) => `${position} of ${total}`,
};

const row = (name: string) => screen.getByRole("button", { name });
const openReadings = () => screen.queryAllByRole("heading", { name: /reading$/ }).map((h) => h.textContent);

beforeEach(() => {
  /* Layout APIs jsdom does not implement; the room calls them from handlers. */
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReadingRoom", () => {
  it("opens the first item, with only its row in the tab order", () => {
    render(<ReadingRoom items={items()} {...copy} />);
    expect(openReadings()).toEqual(["Alpha reading", "Alpha reading"]);
    expect(row("Alpha")).toHaveAttribute("aria-current", "true");
    expect(NAMES.map((name) => row(name).tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it("opens the row that is clicked, and only that one", () => {
    render(<ReadingRoom items={items()} {...copy} />);
    fireEvent.click(row("Gamma"));
    expect(openReadings()).toEqual(["Gamma reading", "Gamma reading"]);
    expect(row("Gamma")).toHaveAttribute("aria-current", "true");
    expect(row("Alpha")).not.toHaveAttribute("aria-current");
  });

  it("moves with the arrow keys, Home and End, and focus follows", () => {
    render(<ReadingRoom items={items()} {...copy} />);
    row("Alpha").focus();

    fireEvent.keyDown(row("Alpha"), { key: "ArrowDown" });
    expect(row("Beta")).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toBe(row("Beta"));

    fireEvent.keyDown(row("Beta"), { key: "End" });
    expect(row("Delta")).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toBe(row("Delta"));

    fireEvent.keyDown(row("Delta"), { key: "ArrowDown" });
    expect(row("Delta")).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(row("Delta"), { key: "Home" });
    expect(row("Alpha")).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toBe(row("Alpha"));
  });

  it("falls back to the first row a filter shows, and returns when it is cleared", () => {
    const filters = [
      { value: "all", label: "All", count: 4 },
      { value: "even", label: "Even", count: 2 },
    ];
    render(<ReadingRoom items={items()} filters={filters} filterLabel="Show" {...copy} />);

    fireEvent.click(row("Beta"));
    fireEvent.click(screen.getByRole("button", { name: "Even 2" }));
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
    expect(row("Alpha")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Even 2" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "All 4" }));
    expect(row("Beta")).toHaveAttribute("aria-current", "true");
  });

  it("steps with Previous and Next and stops at the ends", () => {
    render(<ReadingRoom items={items()} {...copy} />);
    const [previous] = screen.getAllByRole("button", { name: "Previous" });
    expect(previous).toBeDisabled();
    expect(screen.getAllByText("1 of 4")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
    expect(row("Beta")).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByText("2 of 4")).toHaveLength(2);

    fireEvent.click(row("Delta"));
    for (const next of screen.getAllByRole("button", { name: "Next" })) expect(next).toBeDisabled();
  });

  it("lists grouped rows under a heading per group, with its count", () => {
    const groups = [
      { key: "first", label: "First" },
      { key: "second", label: "Second" },
    ];
    render(<ReadingRoom items={items()} groups={groups} {...copy} />);
    /* The count is its own element, after a hidden comma, so a screen reader
       hears "First, 2" rather than "First2". Spacing around the comma varies
       with how the name is computed. */
    expect(screen.getByRole("heading", { name: /^First\s*,\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Second\s*,\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Things" })).toBeInTheDocument();
  });

  it("renders no pane when stacked, only the reading under its row", () => {
    /* The /m layout: the list is the page. */
    render(<ReadingRoom items={items()} layout="stacked" {...copy} />);
    expect(openReadings()).toEqual(["Alpha reading"]);
    fireEvent.click(row("Beta"));
    expect(openReadings()).toEqual(["Beta reading"]);
    expect(row("Beta").getAttribute("aria-controls")).not.toContain(" ");
  });

  it("hides the filter bar when there is nothing to choose between", () => {
    render(
      <ReadingRoom
        items={items()}
        filters={[{ value: "all", label: "All", count: 4 }]}
        filterLabel="Show"
        {...copy}
      />,
    );
    expect(screen.queryByRole("group", { name: "Show" })).toBeNull();
  });
});
