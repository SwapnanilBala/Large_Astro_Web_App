/**
 * Mobile haptic feedback utilities.
 * Uses the Vibration API when available (Android Chrome, some iOS contexts).
 * All functions are no-ops on unsupported browsers — safe to call anywhere.
 */

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

/** Light tap feedback — button presses, tab switches */
export function hapticTap() {
  if (canVibrate) navigator.vibrate(6);
}

/** Medium feedback — form submission, successful action */
export function hapticSuccess() {
  if (canVibrate) navigator.vibrate([8, 50, 12]);
}

/** Error feedback — validation failure */
export function hapticError() {
  if (canVibrate) navigator.vibrate([30, 50, 30]);
}

/** Selection feedback — picking an option from a list */
export function hapticSelect() {
  if (canVibrate) navigator.vibrate(4);
}
