import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import styles from "./section-gateway.module.css";

/*
 * A results-page section that hands off to its own page.
 *
 * Three sections here — timing, the varga atlas and the full reading — were
 * long enough that they buried everything after them in the report. Each is now
 * a short card that says what is inside and links to a page built for it, where
 * the type can be larger and the explanations longer than a collapsed section
 * on a crowded page can carry.
 *
 * Generalised from divisional-charts-gateway, which already did this for the
 * varga atlas; that component's shape is preserved so the three read as one
 * pattern rather than three variations.
 */

export type GatewayChip = {
  /** Short lead-in, e.g. "D9" or "Muhurta". */
  label: string;
  /** One or two words of context. */
  note: string;
  /** Optional longer text for the title attribute. */
  title?: string;
};

type SectionGatewayProps = {
  href: string;
  icon: ReactNode;
  heading: string;
  blurb: string;
  /** Optional preview of what the page contains. */
  chips?: GatewayChip[];
  chipsLabel?: string;
  /** Small print beside the call to action. */
  footnote?: string;
  footnoteIcon?: ReactNode;
  ctaLabel: string;
};

export default function SectionGateway({
  href,
  icon,
  heading,
  blurb,
  chips,
  chipsLabel,
  footnote,
  footnoteIcon,
  ctaLabel,
}: SectionGatewayProps) {
  return (
    <div className={styles.gateway}>
      <div className={styles.copy}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3>{heading}</h3>
          <p>{blurb}</p>
        </div>
      </div>

      {chips && chips.length > 0 && (
        <div
          className={styles.chips}
          aria-label={chipsLabel}
          data-count={chips.length > 6 ? "many" : "few"}
        >
          {chips.map((chip) => (
            <span key={chip.label} title={chip.title}>
              <strong>{chip.label}</strong>
              {chip.note}
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        {footnote ? (
          <p>
            {footnoteIcon}
            {footnote}
          </p>
        ) : (
          <span />
        )}
        <Link href={href} className={styles.openLink}>
          {ctaLabel}
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
