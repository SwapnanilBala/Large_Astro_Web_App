import type { ReactNode } from "react";
import DetailPageBackLink from "./detail-page-back-link";
import styles from "./detail-page-shell.module.css";

/*
 * The frame every "opened from the results page" page sits in.
 *
 * Background, back button top and bottom, centred hero. The body is whatever
 * the page is actually for. Server component on purpose: none of this needs
 * state, so a page whose body is static stays static.
 *
 * It has no translator for the same reason, so the pages pass their kicker,
 * title and lead as small client components that read their own keys, and
 * the back links are one too.
 */

type DetailPageShellProps = {
  /** Where "Back to your reading" goes, anchor included. */
  backHref: string;
  kicker: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  icon: ReactNode;
  children: ReactNode;
};

export default function DetailPageShell({
  backHref,
  kicker,
  title,
  lead,
  icon,
  children,
}: DetailPageShellProps) {
  return (
    <div className={styles.page} /* the desktop layout owns <main> */>
      <div className={styles.shell}>
        <DetailPageBackLink href={backHref} className={styles.backButton} />

        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            {icon}
          </div>
          <p className={styles.kicker}>{kicker}</p>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </header>

        {children}

        <DetailPageBackLink href={backHref} className={styles.backButtonBottom} />
      </div>
    </div>
  );
}
