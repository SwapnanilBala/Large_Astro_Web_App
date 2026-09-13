/**
 * The two daily allowances, in one place both the server and the browser can read.
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
export const LLM_FREE_PER_DAY = 4;

/** Paid calls one signed-in account may make in one UTC day, per route. */
export const LLM_ACCOUNT_PER_DAY = 8;
