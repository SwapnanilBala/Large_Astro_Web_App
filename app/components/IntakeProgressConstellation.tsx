"use client";

import type { ReactNode } from "react";
import styles from "./IntakeProgressConstellation.module.css";

export interface IntakeProgressStep {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  active: boolean;
  meta?: ReactNode;
  missing?: ReactNode;
}

interface IntakeProgressConstellationProps {
  steps: IntakeProgressStep[];
  className?: string;
  ariaLabel?: string;
}

export default function IntakeProgressConstellation({
  steps,
  className,
  ariaLabel = "Intake progress",
}: IntakeProgressConstellationProps) {
  const completedCount = steps.filter((step) => step.complete).length;
  const activeIndex = steps.findIndex((step) => step.active);
  const currentStep = activeIndex >= 0 ? steps[activeIndex] : undefined;
  const summary = `${completedCount} of ${steps.length} intake steps complete${
    currentStep ? `. Current step: ${currentStep.label}` : ""
  }.`;

  return (
    <nav
      className={`${styles.constellation}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      <p className={styles.statusText}>{summary}</p>
      <ol className={styles.stepList}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const stateClass = [
            step.complete ? styles.complete : styles.pending,
            step.active ? styles.active : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li
              key={step.id}
              className={`${styles.step} ${stateClass}`}
              aria-current={step.active ? "step" : undefined}
            >
              <div className={styles.skyLine} aria-hidden="true">
                <span className={styles.node}>
                  <span className={styles.nodeInner}>{index + 1}</span>
                </span>
                {!isLast && <span className={styles.connector} />}
              </div>
              <div className={styles.copy}>
                <span className={styles.label}>{step.label}</span>
                <span className={styles.detail}>{step.detail}</span>
                {(step.meta || step.missing) && (
                  <span className={styles.supporting}>
                    {step.meta && <span>{step.meta}</span>}
                    {step.missing && (
                      <span className={styles.missing}>{step.missing}</span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
