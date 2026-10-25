# Desktop visitor guidance

The desktop shell mounts `DesktopOnboardingProvider`. Nothing is mounted in
the `/m` tree. The controls are available at viewport widths of 1024px and up.

## Visitor experience

- New visitors get an inline welcome invitation, with no automatic modal or tour.
- “Show me around” opens Help, where readers can choose beginner or experienced
  explanations. The birth form also has an expandable explanation of its inputs.
- Engine selection offers a direct action using `DEFAULT_ENGINE_ID`, and keeps
  the method comparison available.
- After a successful chart load, visitors can opt into a four-stop introduction:
  summary, birth chart, periods, and the full-reading gateway.
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

The tour is non-modal and advances only on user action. It suspends while another
modal is open or the viewport is below the desktop threshold. Navigation and
chart changes close it. Missing steps are omitted; removing the active target
closes the tour. A Help dialog uses native modal focus handling, Escape, and
focus restoration. Shrinking below the desktop threshold closes Help and restores
page scrolling.

## Content and maintenance

English copy lives in `messages/en.onboarding.json`; translated `onboarding`
entries extend the six existing language catalogs. `onboarding-catalogs.test.ts`
checks coverage and substitution parameters.

Tour anchors are stable IDs, not translated labels or layout class names:
`top-takeaways`, `birth-chart-guide`, `vimshottari-dashas`, and `core`. The chart
and timing steps have fallback anchors. `data-chart-ready` identifies a loaded
chart and is present even when its invitation is dismissed.

Interaction tests cover opt-in behavior, persistence, replay, focus, glossary
access, interruption, chart changes, and navigation. Browser QA additionally
covers native dialog behavior, seven languages at 1024px, the complete chart
flow at 1440px, and mobile-route isolation.
