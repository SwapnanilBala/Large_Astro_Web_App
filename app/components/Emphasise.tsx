import type { ReactNode } from "react";

/* Only these two tags, matched literally. */
const EMPHASIS = /<(b|strong)>([\s\S]*?)<\/\1>/g;

/**
 * Renders a catalog string whose emphasis is marked up inside the string.
 *
 * The alternative is cutting the sentence at every tag boundary, which hands a
 * translator " and " as a key of its own and pins the word order to English --
 * the mobile house-group legend would arrive as twelve fragments. Keeping the
 * markup in the string keeps it one sentence, and a language that emphasises a
 * different word can move the tags.
 *
 * Real elements, not innerHTML: the tag set is fixed and the text between the
 * tags is only ever inserted as a child, so a translation cannot bring markup
 * of its own along.
 */
export default function Emphasise({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(EMPHASIS)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push(text.slice(cursor, at));
    const Tag = match[1] as "b" | "strong";
    parts.push(<Tag key={at}>{match[2]}</Tag>);
    cursor = at + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
