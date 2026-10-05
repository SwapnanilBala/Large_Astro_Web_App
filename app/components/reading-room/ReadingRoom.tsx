"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import type { ReadingRoomClasses } from "./classes";

/*
 * The reading room: a list, and the chosen item read in full with its
 * evidence.
 *
 * The full reading used to be a grid of cards -- two abreast for the findings,
 * three for the yogas -- which on a desktop meant some twenty screens of boxes
 * that all looked alike, and on a phone one long column of them. Here the list
 * carries one line per item, so the whole set can be scanned at once, and only
 * one item is read at a time, with its evidence already open.
 *
 * Both trees render it; each passes its own stylesheet as `classes` (the
 * desktop's gold on navy, /m's ink and paper), and the class names every
 * stylesheet must define are listed in classes.ts.
 *
 * Two layouts:
 *
 *   split    (desktop) a pinned list on the left, scrolling on its own, and
 *            the reading on the right flowing with the page. Below 1024px the
 *            stylesheet hides the pane and shows the copy of the reading that
 *            sits under its own row, so both renderings are in the markup and
 *            CSS picks one, rather than a media-query hook choosing after
 *            hydration and repainting.
 *   stacked  (/m) the list is the page and the reading opens under its row;
 *            no pane is rendered at all.
 *
 * One item is always open. Selection is held by key and derived against the
 * filter during render: an item the filter hides falls back to the first one
 * shown, and comes back if the filter is cleared.
 */

export type ReadingRoomItem = {
  key: string;
  /** Filter values this item matches. Every item matches "all". */
  tags?: readonly string[];
  /** The group the row is listed under, when the room has groups. */
  group?: string;
  /** One line in the list. */
  row: ReactNode;
  /** The reading itself. `headingId` belongs on its title, which labels the region. */
  detail: (headingId: string) => ReactNode;
};

export type ReadingRoomFilter = { value: string; label: string; count: number };
export type ReadingRoomGroup = { key: string; label: string };

/** Everything a room shows apart from how it is styled and laid out. */
export type ReadingRoomContent = {
  items: ReadingRoomItem[];
  /** Accessible name of the list. */
  listLabel: string;
  filters?: ReadingRoomFilter[];
  filterLabel?: string;
  groups?: ReadingRoomGroup[];
  previousLabel: string;
  nextLabel: string;
  /** "3 of 24", in the reader's language. */
  positionLabel: (position: number, total: number) => string;
};

type ReadingRoomProps = ReadingRoomContent & {
  classes: ReadingRoomClasses;
  layout?: "split" | "stacked";
};

const ALL = "all";

export default function ReadingRoom({
  items,
  listLabel,
  filters,
  filterLabel,
  groups,
  previousLabel,
  nextLabel,
  positionLabel,
  classes: c,
  layout = "split",
}: ReadingRoomProps) {
  const baseId = useId();
  const [filter, setFilter] = useState(ALL);
  const [selectedKey, setSelectedKey] = useState(items[0]?.key ?? "");

  const visible = filter === ALL ? items : items.filter((item) => item.tags?.includes(filter));
  const selected = visible.find((item) => item.key === selectedKey) ?? visible[0];
  const index = selected ? visible.indexOf(selected) : -1;

  const paneId = `${baseId}-pane`;
  const inlineId = `${baseId}-inline`;
  const controls = layout === "split" ? `${paneId} ${inlineId}` : inlineId;

  /* After the new reading renders, make sure its top is in view: a reader who
     had scrolled down a long reading would otherwise land in the middle of the
     next one. Run from the event, not an effect -- it answers what the reader
     did, not what was rendered. */
  function bringIntoView(room: Element | null) {
    requestAnimationFrame(() => {
      const target = Array.from(room?.querySelectorAll<HTMLElement>("[data-room-reading]") ?? []).find(
        (element) => element.offsetParent !== null,
      );
      if (!target) return;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      if (target.getBoundingClientRect().top < margin) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    });
  }

  function select(key: string, origin: Element) {
    setSelectedKey(key);
    bringIntoView(origin.closest("[data-reading-room]"));
  }

  function step(delta: number, origin: Element) {
    const next = visible[index + delta];
    if (!next) return;
    select(next.key, origin);
    const room = origin.closest("[data-reading-room]");
    const row = Array.from(room?.querySelectorAll<HTMLElement>("[data-room-key]") ?? []).find(
      (element) => element.dataset.roomKey === next.key,
    );
    row?.scrollIntoView({ block: "nearest" });
  }

  /* Roving focus: only the open row is in the tab order, and the arrow keys
     move through the rest -- 34 yogas should not cost 34 presses of Tab. */
  function onListKeyDown(event: KeyboardEvent<HTMLElement>) {
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, visible.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = visible.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = visible[next];
    if (!target) return;
    select(target.key, event.currentTarget);
    Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-room-key]"))
      .find((element) => element.dataset.roomKey === target.key)
      ?.focus();
  }

  const nav = (
    <div className={c.nav}>
      <button
        type="button"
        className={c.navButton}
        onClick={(event) => step(-1, event.currentTarget)}
        disabled={index <= 0}
      >
        <FiArrowLeft aria-hidden="true" />
        {previousLabel}
      </button>
      <span className={c.navPosition}>{positionLabel(index + 1, visible.length)}</span>
      <button
        type="button"
        className={c.navButton}
        onClick={(event) => step(1, event.currentTarget)}
        disabled={index >= visible.length - 1}
      >
        {nextLabel}
        <FiArrowRight aria-hidden="true" />
      </button>
    </div>
  );

  function renderRow(item: ReadingRoomItem) {
    const open = item.key === selected?.key;
    return (
      <li key={item.key} className={c.rowItem}>
        <button
          type="button"
          className={c.row}
          data-room-key={item.key}
          tabIndex={open ? 0 : -1}
          aria-current={open ? "true" : undefined}
          aria-controls={controls}
          onClick={(event) => select(item.key, event.currentTarget)}
        >
          {item.row}
        </button>
        {open && (
          <div
            id={inlineId}
            className={c.inline}
            role="region"
            aria-labelledby={`${inlineId}-title`}
            data-room-reading=""
          >
            {item.detail(`${inlineId}-title`)}
            {nav}
          </div>
        )}
      </li>
    );
  }

  const grouped = groups
    ? groups
        .map((group) => ({ group, members: visible.filter((item) => item.group === group.key) }))
        .filter(({ members }) => members.length > 0)
    : null;

  return (
    <div className={c.room} data-reading-room="" data-layout={layout}>
      {filters && filters.length > 1 && (
        <div className={c.filters} role="group" aria-label={filterLabel}>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={c.filter}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className={c.filterCount}>{option.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className={c.split}>
        <div
          className={c.listColumn}
          role="group"
          aria-label={listLabel}
          onKeyDown={onListKeyDown}
        >
          {grouped ? (
            grouped.map(({ group, members }) => (
              <section key={group.key} aria-labelledby={`${baseId}-${group.key}`}>
                <h3 id={`${baseId}-${group.key}`} className={c.groupLabel}>
                  {group.label}
                  {/* The gap separates the count on screen; this separates it
                      for a screen reader, which would say "Benefic15". */}
                  <span className={c.srOnly}>, </span>
                  <span className={c.groupCount}>{members.length}</span>
                </h3>
                <ul className={c.rows}>{members.map(renderRow)}</ul>
              </section>
            ))
          ) : (
            <ul className={c.rows}>{visible.map(renderRow)}</ul>
          )}
        </div>

        {layout === "split" && selected && (
          <section
            id={paneId}
            className={c.pane}
            aria-labelledby={`${paneId}-title`}
            data-room-reading=""
          >
            {selected.detail(`${paneId}-title`)}
            {nav}
          </section>
        )}
      </div>
    </div>
  );
}
