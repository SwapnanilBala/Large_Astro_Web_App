# Making an account carry data

Status: **proposal, nothing built.** Written 2026-09-04, after the session-read
work landed. Nothing here is implemented until it is approved.

Amended 2026-09-05: `/workspace` and `/calendar` were removed from the app, and
`lib/workspace-store.ts` with them. What that changes for this plan is listed
under "Where things stand" — less to sync, and one fewer store to write.

## Where things stand

Signing in works and persists. What it produces is an identity and an empty
room: `auth_users`, `auth_identities`, `auth_sessions`, `workspaces`,
`workspace_members`. Those five tables are the only ones any code touches — the
sole importers of `@/lib/db/schema` are `lib/identity/{session,link-account,anonymous-account}.ts`.

Everything a person would actually miss lives in `localStorage`:

| Key | Store | What it is |
| --- | --- | --- |
| `astro_local_profiles` | `lib/local-profiles.ts` | up to 5 device profiles |
| `astro_chart_history` | `lib/chart-history-store.ts` | recently cast charts |
| `astro_palm_readings` | `lib/palm-readings/local-store.ts` | palm readings + images |
| `astro_birth_details_history` | — | birth-detail autofill |

`astro_workspace_saved_charts` and `astro_workspace_saved_comparisons` were on
this list. They held a second copy of what `astro_chart_history` already keeps,
plus saved comparisons that only `/workspace` could open; both keys are gone
from the code and remain only on the profile-delete scrub list, to clear rows
left in browsers that used the old page. Nothing is lost to sync there —
chart history is the same data under different field names.

So signing in on a second device gets you a working account with nothing in it.
That is the gap.

Thirteen tables already model this data and are entirely unused:

`clients`, `birth_profiles`, `chart_calculations`, `chart_placements`,
`chart_houses`, `chart_aspects`, `chart_findings`, `dasha_periods`,
`compatibility_reports`, `generated_artifacts`, `assets`, `consent_records`,
`auth_credentials`.

The schema was designed for a practitioner with clients — `workspaces` is
documented as "a tenant boundary; one practitioner still receives one
workspace". That shape fits: a workspace already exists per account, and
`clients` is the natural home for "the people whose charts I have cast",
including yourself.

**This is not a database design job. The design is there and is good. What is
missing is the layer that reads and writes it.**

## The decision that shapes everything

Does Neon become the source of truth, or a mirror of the device?

**Mirror (recommended).** `localStorage` stays primary. Writes are echoed to
Neon when signed in. On sign-in from an empty device, the account's data is
pulled down. Keeps the offline-first behaviour `dc39ce3` deliberately built,
ships incrementally, and a sync failure costs a sync rather than a chart. The
price is conflict rules — two devices editing the same chart need a resolution,
and last-write-wins on `updated_at` is the honest default here because the data
is overwhelmingly append-only.

**Source of truth.** Every read goes through the API. Coherent, no conflicts,
but it is a rewrite of every store, it breaks offline use, and it puts a network
round trip in front of the chart the app exists to draw. Not recommended now.

The rest of this assumes mirror.

## Proposed shape

A repository layer — `lib/sync/` — that nothing in the UI imports directly.
Stores call into it; it no-ops when signed out.

```
lib/sync/
  index.ts          push(entity, payload) / pull(workspaceId)
  charts.ts         chart_history -> clients/birth_profiles/chart_calculations
  comparisons.ts    compatibility results -> compatibility_reports
  readings.ts       palm readings -> generated_artifacts + assets
```

Two API routes, both requiring a resolved session and scoping every query to the
caller's `workspace_id`:

- `GET /api/sync` — everything in the account's workspace since a cursor
- `POST /api/sync` — accept a batch of local records, upsert, return applied ids

(Named `/api/sync` rather than `/api/workspace/sync`: `workspaces` is still the
tenant table these queries scope to, but `/workspace` is no longer a page, and a
route named after a deleted one invites the wrong reading.)

## Order of work

1. **Charts only.** `clients` + `birth_profiles` + `chart_calculations`. This is
   the one that makes signing in worth doing, and it exercises the whole path
   end to end. Ship it before anything else.
2. **Hydrate on sign-in.** When a signed-in device has no local charts, pull the
   account's. This is where "my charts followed me" actually becomes true.
3. **Adopt existing local data.** On first sign-in, push what is already on the
   device. Without this, everyone's current work looks lost the moment they sign
   in — this cannot be deferred past step 2.
4. **Comparisons**, into `compatibility_reports`. Nothing stores a comparison
   locally any more, so this step now starts with deciding where a saved one
   lives at all — the table is ready, the client side is not.
5. **Palm readings.** Deliberately last: images are megabytes and belong in
   object storage with `assets` holding metadata, not in Postgres. `local-store.ts`
   already downscales to a display-sized JPEG, which is a starting point but not
   a storage strategy.

Steps 1–3 are the ones that deliver the promise. 4 and 5 are follow-ons.

## Things that will bite

- **Two id spaces.** Local records use `crypto.randomUUID()`; the tables use
  `uuid` primary keys. Reuse the local id as the server id rather than mapping
  between them — a mapping table is a second source of truth.
- **The anonymous workspace is already claimed.** `signInWithProvider` attaches
  the device's workspace on first sign-in, and skips it when another account
  owns it. Sync must respect that, or two people sharing a browser merge their
  charts.
- **Profiles are not accounts.** Five device profiles can exist under one
  account. `clients` is where they should land — not `auth_users` — or signing
  out will look like deleting your family's charts.
- **Deletions must sync.** A chart deleted on one device and pulled back from
  another is worse than no sync. Needs soft deletes; most tables already carry
  the timestamps for it.
- **`consent_records` exists for a reason.** Moving personal birth data off the
  device and onto a server is a different privacy posture from "nothing leaves
  this browser" — which is what `/login` currently promises on screen. That copy
  has to change in the same release, and the table is already there to record
  the agreement.

## Estimate

Steps 1–3: a few focused sessions, the bulk in the sync layer and its tests
rather than in SQL. Steps 4–5: comparable again, with step 5 gated on picking an
object store.
