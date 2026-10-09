/*
 * The model the chart routes write with, in one place, so that the next model
 * change is one edit rather than ten. Every route that writes a reading or a
 * note on the cheap model reads these: advanced-story, area-classics,
 * ask-classics (the answer and the screen), current-period,
 * dasha-reading, domain-brief, life-shifts, story-prose,
 * varga-commentary and yoga-classics, and the sampling scripts that mirror
 * them. Palm reading and the Opus retries choose their own models.
 *
 * History: Opus 5.5 at low effort until 2026-10-06; Claude Haiku 4.5 from
 * then, the owner's call to cut costs, run without thinking; Claude Haiku 5.5
 * from 2026-10-07, the owner's call again, at a tenth of Haiku 4.5's price
 * ($0.10/$0.50 per million tokens against $1/$5, up to 100K-token prompts).
 *
 * Haiku 5.5 thinks by default (adaptive, at medium effort), where Haiku 4.5
 * thought only when asked and took no effort setting. The routes ran without
 * thinking for cost, so they ask for low effort, the documented lever for "as
 * little thinking as the job needs": on short jobs the model can skip it. Any
 * thinking counts against max_tokens, and the same text is about 30% more
 * tokens on Haiku 5.5's tokenizer, so the caps the routes set are headroom
 * with that in mind. It also rejects temperature, top_p, top_k and assistant
 * prefills, which none of these routes send.
 */

export const CHART_MODEL = "claude-haiku-5-5";

export const CHART_EFFORT = "low" as const;
