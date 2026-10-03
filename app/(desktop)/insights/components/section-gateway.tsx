import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import styles from "./section-gateway.module.css";

/* Shared typography and navigation; each section supplies its own chart preview. */

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
  eyebrow?: string;
  variant?: "timing" | "atlas" | "reading";
  heading: string;
  blurb: string;
  children?: ReactNode;
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
  eyebrow = "Explore your chart",
  variant = "timing",
  heading,
  blurb,
  children,
  chips,
  chipsLabel,
  footnote,
  footnoteIcon,
  ctaLabel,
}: SectionGatewayProps) {
  return (
    <div className={styles.gateway} data-variant={variant}>
      <header className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.icon} aria-hidden="true">{icon}</span>
          {eyebrow}
        </p>
        <h3>{heading}</h3>
        <p className={styles.blurb}>{blurb}</p>
      </header>

      {children ? <div className={styles.preview}>{children}</div> : chips && chips.length > 0 && (
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
        <Link href={href} className={styles.openLink} prefetch={false}>
          {ctaLabel}
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
