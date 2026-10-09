"use client";

import { spanDays, statusAt, type DashaSpan } from "@/lib/dasha-periods";
import type { LordFacts, PeriodFacts } from "@/lib/dasha-reading-facts";
import { planetName, signName } from "@/lib/chart-labels";
import { LOCALE_TAGS, useTranslation } from "@/lib/i18n-context";
import { ClassicalNote } from "./classical-note";
import { LEVEL_LABEL_KEYS, planetStyle } from "./dasha-now";
import { formatDay, formatLength } from "./dasha-format";
import { themeLabelFor } from "./dasha-themes";
import type { DashaReadingState } from "./use-dasha-reading";
import styles from "./nakshatra-dasha-panel.module.css";

/*
 * The period the reader picked: its chain of planets, its dates, where each of
 * its planets stands in their chart and how each level meets the one above --
 * all free and immediate, worked out in the browser from the same facts the
 * reading is written from (lib/dasha-reading-facts.ts) -- and, on request,
 * the reading itself, cited to the books.
 */

type DashaPeriodCardProps = {
  /** The period picked, Maha Dasha first. */
  focus: DashaSpan[];
  now: number;
  facts: PeriodFacts | null;
  reading: DashaReadingState | undefined;
  /** Whether a reading can be asked for here: it needs the chart's birth details. */
  canRead: boolean;
  onRead: () => void;
  onFocusDepth: (depth: number) => void;
};

export function DashaPeriodCard({ focus, now, facts, reading, canRead, onRead, onFocusDepth }: DashaPeriodCardProps) {
  const { t, language } = useTranslation();
  const period = focus[focus.length - 1];
  if (!period) return null;

  const levelLabel = (level: number) => t(LEVEL_LABEL_KEYS[level] ?? "dasha.mahaDasha");
  const list = (items: string[]) =>
    new Intl.ListFormat(LOCALE_TAGS[language], { style: "long", type: "conjunction" }).format(items);
  const house = (number: number) => t(`dasha.reading.houses.h${number}`);
  const meaning = (number: number) => t(`dasha.reading.meanings.h${number}`);
  const status = statusAt(period, now);

  const lordLines = (lord: LordFacts) => {
    const lines = [t("dasha.reading.placed", { sign: signName(lord.sign, t), house: house(lord.house), meaning: meaning(lord.house) })];
    if (lord.rules.length > 0) {
      lines.push(
        t("dasha.reading.rules", {
          houses: list(lord.rules.map((ruled) => t("dasha.reading.houseWithMeaning", { house: house(ruled), meaning: meaning(ruled) }))),
        }),
      );
    }
    if (lord.actsThrough) {
      lines.push(
        t("dasha.reading.actsThrough", {
          planet: planetName(lord.actsThrough.lord, t),
          sign: signName(lord.actsThrough.sign, t),
          house: house(lord.actsThrough.house),
          meaning: meaning(lord.actsThrough.house),
        }),
      );
    }
    return lines;
  };

  const lordTags = (lord: LordFacts) =>
    [
      themeLabelFor(lord.lord, t),
      lord.dignity ? t(`dasha.reading.dignity.${lord.dignity}`) : null,
      lord.retrograde ? t("dasha.reading.retrograde") : null,
      lord.combust ? t("dasha.reading.combust") : null,
      lord.with.length > 0 ? t("dasha.reading.with", { planets: list(lord.with.map((name) => planetName(name, t))) }) : null,
    ].filter((tag): tag is string => Boolean(tag));

  return (
    <section className={styles.card} aria-labelledby="dasha-period-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <p className={styles.kicker} id="dasha-period-title">
            {t("dasha.reading.kicker")}
          </p>
          <span className={`${styles.status}${status === "now" ? ` ${styles.statusNow}` : ""}`}>
            {t(status === "now" ? "dasha.reading.statusNow" : status === "past" ? "dasha.reading.statusPast" : "dasha.reading.statusUpcoming")}
          </span>
        </div>
        <ol className={styles.chips}>
          {focus.map((span, index) => {
            const last = index === focus.length - 1;
            return (
              <li key={`${span.level}-${span.planet}-${span.start}`} style={{ display: "contents" }}>
                {index > 0 && (
                  <span className={styles.chipSep} aria-hidden="true">
                    ›
                  </span>
                )}
                {last ? (
                  <span className={`${styles.chip} ${styles.chipCurrent}`} style={planetStyle(span.planet)} aria-current="true">
                    {planetName(span.planet, t)}
                    <small>{levelLabel(span.level)}</small>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.chip}
                    style={planetStyle(span.planet)}
                    onClick={() => onFocusDepth(index + 1)}
                  >
                    {planetName(span.planet, t)}
                    <small>{levelLabel(span.level)}</small>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <p className={styles.window}>
          {t("dasha.reading.window", {
            level: levelLabel(period.level),
            dates: `${formatDay(period.start, language)} – ${formatDay(period.end, language)}`,
            length: formatLength(spanDays(period), t, language),
          })}
        </p>
      </div>

      <div className={styles.facts}>
        {facts && (
          <>
            <h4 className={styles.factsHeading}>{t("dasha.reading.factsHeading")}</h4>
            <ul className={styles.lords}>
              {facts.lords.map((lord) => (
                <li key={lord.lord} className={styles.lord} style={planetStyle(lord.lord)}>
                  <div className={styles.lordHead}>
                    <span className={styles.lordName}>
                      {planetName(lord.lord, t)}
                      <small>{lord.levels.map(levelLabel).join(" · ")}</small>
                    </span>
                    {lordTags(lord).length > 0 && (
                      <ul className={styles.tags}>
                        {lordTags(lord).map((tag) => (
                          <li key={tag} className={styles.tag}>
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {lordLines(lord).map((line) => (
                    <p key={line} className={styles.lordLine}>
                      {line}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={styles.readArea}>
        {reading === undefined && (
          <>
            <p className={styles.invite}>{t("dasha.reading.invite")}</p>
            {canRead && (
              <button type="button" className={styles.readButton} onClick={onRead}>
                {t("dasha.reading.read")}
              </button>
            )}
          </>
        )}
        {(reading?.status === "pending" || reading?.status === "ready") && (
          <ClassicalNote
            state={reading.status}
            reading={reading.status === "ready" ? reading.reading : null}
            tr={t}
            prefix="dasha.reading.note"
            headingId="dasha-period-reading"
            className={styles.note}
          />
        )}
        {reading?.status === "empty" && <p className={styles.message}>{t("dasha.reading.empty")}</p>}
        {reading?.status === "limited" && (
          <p className={styles.message}>{t(reading.signIn ? "dasha.reading.limitedSignIn" : "dasha.reading.limited")}</p>
        )}
        {reading?.status === "failed" && (
          <>
            <p className={styles.message}>{t("dasha.reading.failed")}</p>
            <button type="button" className={styles.readButton} onClick={onRead}>
              {t("errorBoundary.tryAgain")}
            </button>
          </>
        )}
        {/* How the levels meet sits under the reading's place rather than under
            the planets: it balances the two columns, which keeps the card short
            before anything is read. */}
        {facts && facts.relations.length > 0 && (
          <div className={styles.relationsBlock}>
            <h4 className={styles.factsHeading}>{t("dasha.reading.relationsHeading")}</h4>
            <ul className={styles.relations}>
              {facts.relations.map((relation) => (
                <li key={relation.level} className={styles.relation}>
                  {t(`dasha.reading.kinds.${relation.kind}`, {
                    planet: planetName(relation.lord, t),
                    parent: planetName(relation.parent, t),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
