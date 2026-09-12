-- The paid-LLM daily ceiling stops being a per-instance number.
--
-- `lib/llm-budget.ts` has capped spend on the three routes that call Anthropic
-- or OpenAI since it was added, but it counted in a module-level Map. On a
-- serverless deployment every warm instance kept its own tally, so the real
-- ceiling was (instances x limit) and the stated number was a floor. This is
-- the shared counter that makes it the actual number.
--
-- No `user_id`, no foreign keys, and that is deliberate rather than an
-- oversight to tidy up: the traffic worth counting here is mostly anonymous,
-- and the point of counting it is precisely that nothing has vouched for it.
--
-- `caller` is the client IP, or `*` for the row that totals the whole route.
-- One table for both is what lets a single `INSERT .. ON CONFLICT DO UPDATE ..
-- RETURNING` move both counters and report both values in one round trip --
-- atomically, so two instances racing on the same key cannot both be told they
-- were under the limit.
--
-- `utc_day` is written by the application from `Date.now()`, never from
-- `current_date`. A Postgres `date` carries no zone, so letting the server pick
-- the day would key the counter on whatever the instance's clock zone was.
--
-- Rows are pruned by the application, which issues a `DELETE` for anything
-- older than seven days once per process per day. There is no scheduled job to
-- forget about: the table grows by one row per (route, caller) per day, and an
-- instance that has been told the route is spent stops writing rows at all.

CREATE TABLE "llm_budget_counters" (
	"utc_day" date NOT NULL,
	"route" varchar(120) NOT NULL,
	"caller" varchar(100) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_budget_counters_utc_day_route_caller_pk" PRIMARY KEY("utc_day","route","caller"),
	CONSTRAINT "llm_budget_counters_count_check" CHECK ("llm_budget_counters"."count" >= 0)
);
