import type { Translate } from "./classes";

/** Previous, Next and "3 of 24": the same three labels in every room. */
export function roomNavigation(tr: Translate) {
  return {
    previousLabel: tr("fullReading.previous"),
    nextLabel: tr("fullReading.next"),
    positionLabel: (position: number, total: number) =>
      tr("fullReading.position", { position: String(position), total: String(total) }),
  };
}
