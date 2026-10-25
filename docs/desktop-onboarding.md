# Desktop visitor guidance

The desktop shell mounts `DesktopOnboardingProvider`. Nothing is mounted in
the `/m` tree. The controls are available at viewport widths of 1024px and up.

## Visitor experience

- New visitors get an inline welcome invitation, with no automatic modal or tour.
- “Show me around” opens Help, where readers can choose beginner or experienced
  explanations. The birth form also has an expandable explanation of its inputs.
- Engine selection offers a direct action using `DEFAULT_ENGINE_ID`, and keeps
  the method comparison available.
- Help puts the walkthrough controls above the introductory text. On the birth
  form, the guide follows the current question and focuses its field on request.
  It continues through method selection and into the chart when the reader uses
  the normal form and generation controls.
- The chart walkthrough has up to seven stops: summary, birth chart, life areas,
  periods, timing tools, full reading, and divisional charts. Each stop includes
  a task and, where applicable, an action targeting a real control or page link.
- The explanation sits beside the highlighted section when space permits.
  Readers can jump to a topic or minimize the guide to inspect the page freely.
- Returning readers can launch a saved-chart walkthrough directly from Help on
  another page. The requested guide waits for the chart to load and explains
  missing-chart/error states instead of silently disappearing.
- Help in the navbar reopens the introduction and a ten-term glossary. Contextual
  term buttons open the corresponding definition. Detail pages have expandable
  instructions.

## Persistence and interruptions

`lib/onboarding-store.ts` stores only four preferences under
`astro_desktop_guidance`: welcome dismissal, chart invitation dismissal, tour
completion, and audience. It contains no birth details or reading content.
Changes propagate to other tabs. Blocked storage falls back to memory for the
current tab. There is no account synchronization or analytics.

“Explore on my own” on the welcome card suppresses both invitations. Chart-tour
exit suppresses future chart invitations; Help can always restart it. Existing
chart readers receive no first-time invitation. Creating another chart, signing
in, or updating the copy does not reset preferences.

The tour is non-modal and advances only on user action. The intake explanation
follows the form's own current question without filling or submitting anything.
It suspends while another modal is open or the viewport is below the desktop
threshold. Ordinary navigation and chart changes close it; an explicitly started
form guide follows the expected form -> method -> chart route transitions.
Loading boundaries do not cancel this progression. Missing chart stops are
omitted; removing an active target from a ready chart closes its tour. A Help
dialog uses native modal focus handling, Escape, and
focus restoration. Shrinking below the desktop threshold closes Help and restores
page scrolling.

## Content and maintenance

English copy lives in `messages/en.onboarding.json`; translated `onboarding`
entries extend the six existing language catalogs. `onboarding-catalogs.test.ts`
checks coverage and substitution parameters.

Tour anchors are stable IDs and `data-guide-*` attributes, not translated labels
or layout class names. Chart stops use `top-takeaways`, `birth-chart-guide`,
`ultimate`, `vimshottari-dashas`, `timing`, `core`, and `divisional-charts`.
`GuidedWalkthrough.tsx` owns targets, task controls, and panel placement.
`data-chart-ready` identifies a loaded
chart and is present even when its invitation is dismissed.

Interaction tests cover opt-in behavior, persistence, replay, focus, glossary
access, interruption, chart changes, navigation, saved-chart replay, loading
errors, and progression through the form/method/chart routes. Browser QA also
covers real view switches, life-area links, period choices, topic jumping,
minimization, seven languages at 1024px, the complete flow at 1440px, and
mobile-route isolation.
