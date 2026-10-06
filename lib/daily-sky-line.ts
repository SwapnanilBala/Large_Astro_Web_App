/**
 * Today's sky above the sign-in form, as facts the server reads and a line the
 * client writes in the reader's language.
 *
 * The facts come from app/(desktop)/login/dailySky.ts, which is server-only
 * (it runs the ephemeris). This module holds only the shape and the wording,
 * so both sign-in pages can import it into the browser.
 */
import { nakshatraName, signName } from "@/lib/chart-labels";

type Translate = (key: string, params?: Record<string, string>) => string;

export type DailySky =
  | { kind: "moon"; moonSign: string; mercuryRetrograde: boolean; nakshatra: string }
  /* The engine returned no Moon: never seen, kept so the page cannot break. */
  | { kind: "aligned" }
  /* The ephemeris threw: a tropical Sun sign from the date alone. */
  | { kind: "sun"; sunSign: string };

const MIDDOT = "·";

/** "Moon in Cancer · Mercury direct", in the reader's language. */
export function dailySkyLine(sky: DailySky, t: Translate): string {
  if (sky.kind === "aligned") return t("signIn.sky.aligned");
  if (sky.kind === "sun") return t("signIn.sky.sunClear", { sign: signName(sky.sunSign, t) });
  const moon = t("signIn.sky.moonIn", { sign: signName(sky.moonSign, t) });
  const mercury = t(sky.mercuryRetrograde ? "signIn.sky.mercuryRetrograde" : "signIn.sky.mercuryDirect");
  const line = `${moon} ${MIDDOT} ${mercury}`;
  /* A long line pairs the Moon with its nakshatra instead, as the server-side
     line always did. */
  return line.length > 50 ? `${moon} ${MIDDOT} ${nakshatraName(sky.nakshatra, t)}` : line;
}
