/*
 * The class names a reading-room stylesheet has to define.
 *
 * ReadingRoom and the three room builders take their classes from whichever
 * stylesheet the tree passes in -- app/(desktop)/insights/full-reading/
 * reading-room.module.css or app/m/insights/reading-room.module.css -- so the
 * names are a contract between code and two CSS files that nothing in the
 * build checks. A name missing from one of them is an unstyled element in one
 * tree only. lib/__tests__/reading-room-classes.test.ts reads both
 * stylesheets against this list.
 */

export const READING_ROOM_CLASS_NAMES = [
  /* the room itself */
  "room",
  "filters",
  "filter",
  "filterCount",
  "split",
  "listColumn",
  "rows",
  "rowItem",
  "row",
  "groupLabel",
  "groupCount",
  "srOnly",
  "pane",
  "inline",
  "nav",
  "navButton",
  "navPosition",
  /* rows */
  "mark",
  "rank",
  "dot",
  "strengthMark",
  "rowText",
  "rowTitle",
  "rowMeta",
  "glyphs",
  /* readings */
  "meta",
  "tone",
  "pill",
  "title",
  "subtitle",
  "planets",
  "detailBody",
  "text",
  "otherSide",
  "label",
  "block",
  "evidence",
  "facts",
  "factDetail",
  "asideText",
  "signals",
  "basis",
  "rarity",
  "traits",
] as const;

export type ReadingRoomClassName = (typeof READING_ROOM_CLASS_NAMES)[number];

/* A CSS module object, as Next types one: any string key. The list above is
   what makes the keys used here safe to look up. */
export type ReadingRoomClasses = Readonly<Record<string, string>>;

/** The shared translator shape: the hook's `tr`, or anything that answers like it. */
export type Translate = (key: string, params?: Record<string, string>) => string;
