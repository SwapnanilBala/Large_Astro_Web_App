"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import styles from "./reading-room.module.css";

/*
 * The reading room: a list on the left, the chosen item in full on the right.
 *
 * The full reading used to be a grid of cards -- two abreast for the findings,
 * three for the yogas -- which on a desktop meant some twenty screens of boxes
 * that all looked alike. Here the list carries one line per item, so the whole
 * set can be scanned at once, and only one item is read at a time, with its
 * evidence already open beside it.
 *
 * On wide screens the list is pinned and scrolls on its own while the reading
 * flows with the page, so a long reading scrolls like any text and the next
 * item is always one click away. Below 1024px there is no room for two
 * columns: the list is the page, and the chosen item opens in place under its
 * own row. Both renderings are always in the markup and CSS picks one, rather
 * than a media-query hook choosing after hydration -- that would paint one
 * layout on the server and swap it on the client.
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
  /** The reading itself. `headingId` belongs on its title, which labels the pane. */
  detail: (headingId: string) => ReactNode;
};

export type ReadingRoomFilter = { value: string; label: string; count: number };
export type ReadingRoomGroup = { key: string; label: string };

type ReadingRoomProps = {
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
}: ReadingRoomProps) {
  const baseId = useId();
  const [filter, setFilter] = useState(ALL);
  const [selectedKey, setSelectedKey] = useState(items[0]?.key ?? "");

  const visible = filter === ALL ? items : items.filter((item) => item.tags?.includes(filter));
  const selected = visible.find((item) => item.key === selectedKey) ?? visible[0];
  const index = selected ? visible.indexOf(selected) : -1;

  const paneId = `${baseId}-pane`;
  const inlineId = `${baseId}-inline`;

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
    <div className={styles.nav}>
      <button
        type="button"
        className={styles.navButton}
        onClick={(event) => step(-1, event.currentTarget)}
        disabled={index <= 0}
      >
        <FiArrowLeft aria-hidden="true" />
        {previousLabel}
      </button>
      <span className={styles.navPosition}>{positionLabel(index + 1, visible.length)}</span>
      <button
        type="button"
        className={styles.navButton}
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
      <li key={item.key} className={styles.rowItem}>
        <button
          type="button"
          className={styles.row}
          data-room-key={item.key}
          tabIndex={open ? 0 : -1}
          aria-current={open ? "true" : undefined}
          aria-controls={`${paneId} ${inlineId}`}
          onClick={(event) => select(item.key, event.currentTarget)}
        >
          {item.row}
        </button>
        {open && (
          <div
            id={inlineId}
            className={styles.inline}
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
    <div className={styles.room} data-reading-room="">
      {filters && filters.length > 1 && (
        <div className={styles.filters} role="group" aria-label={filterLabel}>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.filter}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className={styles.filterCount}>{option.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.split}>
        <div
          className={styles.listColumn}
          role="group"
          aria-label={listLabel}
          onKeyDown={onListKeyDown}
        >
          {grouped ? (
            grouped.map(({ group, members }) => (
              <section key={group.key} aria-labelledby={`${baseId}-${group.key}`}>
                <h3 id={`${baseId}-${group.key}`} className={styles.groupLabel}>
                  {group.label}
                  {/* The gap separates the count on screen; this separates it
                      for a screen reader, which would say "Benefic15". */}
                  <span className={styles.srOnly}>, </span>
                  <span className={styles.groupCount}>{members.length}</span>
                </h3>
                <ul className={styles.rows}>{members.map(renderRow)}</ul>
              </section>
            ))
          ) : (
            <ul className={styles.rows}>{visible.map(renderRow)}</ul>
          )}
        </div>

        {selected && (
          <section
            id={paneId}
            className={styles.pane}
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
