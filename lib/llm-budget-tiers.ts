/**
 * The daily allowances, and palm reading's weekly cap, in one place both the
 * server and the browser can read.
 *
 * `lib/llm-budget.ts` is the enforcement and cannot be imported from a client
 * component -- it reaches the session store and the counters table -- so the
 * numbers themselves live here, with no imports, and that module builds its
 * per-route config from them.
 *
 * They are here rather than only there because the sign-in prompt states them
 * in prose. When they were written out as words in six message catalogs, the
 * copy said "two of each reading a day" for a while after the limit became
 * five: the catalogs are the last place anyone thinks to look when changing a
 * number in a config object. Now the prose interpolates these, and the only way
 * to make it wrong again is to edit the sentence itself.
 */

/** Paid calls one signed-out address may make in one UTC day, per route. */
export const LLM_FREE_PER_DAY = 10;

/** Paid calls one signed-in account may make in one UTC day, per route. */
export const LLM_ACCOUNT_PER_DAY = 20;

/**
 * Palm readings one account may have in one UTC week, Monday to Sunday: the
 * owner's hard cap of 2026-11-02. A reading is the dearest call in the app
 * (about $0.17 on Opus 5). Since 2026-11-04 palm reading requires an account,
 * so there is no signed-out allowance for it at all.
 */
export const PALM_READINGS_PER_WEEK = 2;
