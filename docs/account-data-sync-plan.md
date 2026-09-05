# Making an account carry data

Status: **steps 0-2 built on 2026-09-05.** Written 2026-09-04 as a proposal;
what shipped is marked per step under "Order of work". Steps 3-5 are still
proposals and nothing about them is implemented.

Amended 2026-09-05, on direction that changes the target:

1. `/workspace` and `/calendar` were removed from the app, and
   `lib/workspace-store.ts` with them — less to sync, one fewer store to write.
2. **Password sign-in is not being built.** Google stays because it is the
   convenient one; `lib/identity/password.ts` and the `auth_credentials` table
   are deleted.
3. **Guest mode persists too.** Charts should reach the database whether or not
   somebody signed in with Google. A guest is not a second-class visitor whose
   work lives only in their browser.

Point 3 is the substantive one, and the good news is that the schema already
accommodates it. See "Guest mode is already an account" below.

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

Twelve tables already model this data and are entirely unused:

`clients`, `birth_profiles`, `chart_calculations`, `chart_placements`,
`chart_houses`, `chart_aspects`, `chart_findings`, `dasha_periods`,
`compatibility_reports`, `generated_artifacts`, `assets`, `consent_records`.

(`auth_credentials` was the thirteenth. It is dropped in migration 0005.)

The schema was designed for a practitioner with clients — `workspaces` is
documented as "a tenant boundary; one practitioner still receives one
workspace". That shape fits: a workspace already exists per account, and
`clients` is the natural home for "the people whose charts I have cast",
including yourself.

**This is not a database design job. The design is there and is good. What is
missing is the layer that reads and writes it.**

## Guest mode is already an account

The instinct behind "guests should get their data saved too" is right, and it
needs almost nothing new in the schema, because a guest already has the two
things a row needs to hang off.

`lib/identity/device-id.ts` issues a signed cookie per browser.
`resolveAnonymousWorkspace` in `lib/identity/anonymous-account.ts` turns that
into a `workspaces` row plus a `workspace_members` row with the subject
`anon:<device>`. A signed-in person gets the identical pair with the subject
`user:<id>`. Every other table in the schema keys on `workspace_id` and knows
nothing about which of the two it came from.

So "write the guest's charts to the database" is not a separate code path. It is
the same insert, against a workspace that already exists.

Three consequences worth stating before anyone builds on it:

- **The upgrade path is already handled.** `signInWithProvider` claims the
  device's anonymous workspace on first Google sign-in, unless another account
  already owns it. A guest who casts ten charts and then signs in keeps them,
  with no migration step, because the workspace id does not change.
- **The cookie is the account.** Clear it and the charts are unreachable — the
  workspace id is derived from the device id, and there is no email to recover
  by. That is the honest limit of guest mode, and it is the one thing worth
  saying on screen: signing in with Google is what makes the data survive a
  cleared browser or a second device.
- **A guest workspace is still personal data on a server.** Anonymous means no
  name attached, not "not personal" — a birth date, time and place identifies
  somebody. The consent rules below apply to guests exactly as they do to
  signed-in accounts. Do not treat `anon:` as a reason to skip them.

## Consent, and the nudge

`birth_profiles.consent_record_id` is `NOT NULL` with a foreign key to
`consent_records`. This is the strongest thing in the schema and it should stay
exactly as it is: **the database physically cannot hold a birth date without a
consent row pointing at it.** Not a check somebody remembers to write — the
insert fails.

The flow that follows from it:

1. First time a chart would be written for a workspace, ask. One question, in
   plain words: *save this chart to your account so you can open it on another
   device?*
2. **Yes** — insert a `consent_records` row (`purpose: "store_birth_details"`,
   `policy_version` from a constant, `capture_source: "intake"`,
   `evidence_json` holding the copy they actually saw), then write the chart.
   The purpose string is not a new invention: `scripts/verify-neon-schema.mjs`
   already inserts `store_birth_details` in its smoke test, so that is the
   established name and application code should match it rather than coin a
   second one for the same permission.
3. **No** — write nothing server-side. The chart still computes, still renders,
   still lands in `localStorage`. Declining costs the visitor no feature on the
   device in front of them, which is what makes the yes meaningful.
4. Revoking sets `revoked_at`. The partial unique index allows exactly one live
   grant per purpose, so re-granting later is another insert, not an update.

### The prompt after a no

The ask is for a prompt that follows a "no" and makes the case for saying yes.
It is worth building, and worth building narrowly, because the failure mode is
specific: consent that was nagged out of somebody is weaker evidence than
consent freely given, and the whole value of `consent_records` is that it is
evidence. A dialog that reappears until the answer changes turns a legal record
into a record of pestering.

So: show it, once, where the benefit is real rather than hypothetical.

- **Trigger.** Not immediately after the no — at the next moment the visitor
  does something that storage would have helped with: reopening a chart from
  history, or signing in with Google on a device whose charts are local-only.
- **Content.** The concrete thing they lose, not a warning. "This chart lives
  only in this browser. Clear your history and it is gone, and it will not be
  on your phone." Then the same yes.
- **Frequency.** Once per decline, ever. Record the dismissal locally; a second
  no is final until the visitor opens settings and changes it themselves.
- **Nothing is gated.** No feature is withheld to make the point. If the prompt
  only works because the app got worse after a no, it is not persuasion.

This is a UI decision as much as a data one, and it belongs in the same release
as the `/login` copy change noted under "Things that will bite" — that screen
currently promises "nothing leaves this browser", which stops being true the
first time a consent grant is honoured.

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

0. **The consent grant.** ✅ `lib/sync/consent.ts`,
   `app/components/ChartSyncPrompt.tsx`, and the `/login` copy. The
   post-decline nudge is a one-shot that cannot fire in the view the decline
   happened in, and it gates nothing.
1. **Charts only, guests included.** ✅ `lib/sync/charts.ts` and
   `POST /api/sync/charts`. Keyed on the workspace the request resolves to —
   `anon:` or `user:`, the insert does not care — so guest mode never became a
   second code path. Idempotent on fingerprints, and a corrected birth time
   supersedes the profile rather than overwriting it.
2. **Hydrate on sign-in.** ✅ `GET /api/sync/charts`, read by
   `app/components/ChartHistory.tsx` when local history is empty. Empty only:
   charts are per workspace and that list is per local profile, so merging
   them would file one person's charts under another's name. Widening this is
   what step 3 has to solve first.
3. **Adopt existing local data.** On first sign-in, push what is already on the
   device. Without this, everyone's current work looks lost the moment they sign
   in — this cannot be deferred past step 2. Note that a guest who consented has
   already pushed, and `signInWithProvider` claims their workspace, so for them
   this step is a no-op rather than a migration.

   **Not built.** A visitor who declined, collected charts locally and then
   changes their mind still has nothing pushed but the chart they happen to be
   looking at. The rest of their history needs a deliberate backfill.

   ### The /m tree is not covered

   `app/m/insights` records no chart history at all — not locally, and so not
   remotely either. That predates this work: `recordChartVisit` has only ever
   been called from the desktop tree. A handset visitor therefore gets no
   persistence of any kind, and closing that needs the local saver first, plus
   the prompt and its strings in the mobile bundle — which the mobile layout
   treats as a real cost, since its catalogue rides in the layout and every
   handset page pays for a namespace added to it.
4. **Comparisons**, into `compatibility_reports`. Nothing stores a comparison
   locally any more, so this step now starts with deciding where a saved one
   lives at all — the table is ready, the client side is not.
5. **Palm readings.** Deliberately last: images are megabytes and belong in
   object storage with `assets` holding metadata, not in Postgres. `local-store.ts`
   already downscales to a display-sized JPEG, which is a starting point but not
   a storage strategy.

Steps 0–3 are the ones that deliver the promise. 4 and 5 are follow-ons.

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
  the agreement. See "Consent, and the nudge" above for the flow and for why the
  prompt after a decline is deliberately a one-shot.
- **A guest's charts die with the cookie.** `DEVICE_ID_SECRET` signs it and the
  workspace id is derived from it, so a cleared cookie is an unreachable
  workspace with no recovery path — no email, no password now that
  `auth_credentials` is gone. Rotating that secret has the same effect on every
  guest at once. Say the limit on screen rather than discovering it in support.

## Estimate

Steps 1–3: a few focused sessions, the bulk in the sync layer and its tests
rather than in SQL. Steps 4–5: comparable again, with step 5 gated on picking an
object store.
