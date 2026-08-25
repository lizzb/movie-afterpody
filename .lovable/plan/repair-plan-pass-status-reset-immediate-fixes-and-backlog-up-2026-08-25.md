# Repair plan — pass status reset, immediate fixes, and backlog updates

Approval should mean two different things depending on the item:

1. **Immediate repair build:** fix the concrete regressions and deterministic UI/copy issues listed below.
2. **Backlog-only items:** add those items to the consolidated roadmap and do not build them in this pass.

I will not stamp any pass as shipped until its acceptance checklist is verified in the app, not just present in code.

---

## 1. How to avoid over-reporting in future

### New rule for my summaries
For every multi-item pass, final summaries should include a short acceptance checklist with one of these labels per item:

- **Verified:** checked in code and in the running app, with the route/device named.
- **Implemented, not verified:** code exists, but I did not complete runtime verification.
- **Deferred:** intentionally not built.
- **Needs follow-up:** present but not meeting the requested UX quality.

I should not call a pass “built” or move it to “Already done” unless all promised acceptance items are verified or explicitly marked deferred.

### On scope size
Yes, bundling **D, O, T5, G, H, and Y** together was too large for one reliable pass. Future builds should be one of:

- one full pass, or
- one visual/UI repair pass plus one small data/admin pass.

You should not need to explicitly tell me to run verification tests. I should verify before claiming a fix is complete, especially for mobile/PWA layout, interactive popovers, filters, and stateful controls.

---

## 2. Current-state checklist from this review

### Pass D — header/title consistency and slider touch targets
- **Present:** standardized page header component, popcorn wordmark, home-screen icons/manifest, and info buttons.
- **Needs follow-up:** header text does not match your requested labels.
- **Needs follow-up:** the same info sheet appears on all screens. This is acceptable only if we decide shared explanatory content is enough; page-specific sections were not implemented.
- **Needs follow-up:** runtime slider does not show the filled blue track to the left of the handle.
- **Needs follow-up:** slider handles/hit zones still do not feel meaningfully easier to grab on mobile.

### Pass O — watchlist controls and feedback
- **Present in code:** add-to-list popover was moved to a portal, with local optimistic updates and undo snackbars.
- **Needs follow-up:** interaction still feels laggy/finicky and list creation from movie cards is unreliable enough that it must be debugged in-browser.
- **Not included:** account-synced watchlists/history. Current list/watch state is still local-first device storage, not a signed-in backend sync.

### Pass G — app settings and viewport behavior
- **Present:** viewport lock toggle and dim-watched toggle in Setup.
- **Regression:** the mobile top strip does not account for iOS safe-area/status-bar overlap.
- **Needs follow-up:** dimmed watched styling exists only on movie cards and is subtle/off by default, so it is not visibly solving the use case.

### Pass H + Y — discovery controls and ratings
- **Present:** filtering/sorting panel, “Not interested,” max-rating filter, unrated toggle, rating markers.
- **Needs follow-up:** Movies should not reuse the Tonight parameters block or label.
- **Needs follow-up:** sorting is too buried for Tonight.
- **Needs follow-up:** ratings need a minimum + maximum range control, not only max rating.
- **Needs follow-up:** “Not interested” icon/copy and recovery UX need design work.

### Pass T5 — show curation search/filter/sort
- **Present in code:** Episode coverage & show curation has show search, Active/Parked tabs, Behind-feed filter, and sorting by A-Z, episode count, unmatched count, and missing count.
- **Needs follow-up:** it should be verified in the running admin UI and made more discoverable if the controls are hard to notice inside the collapsed card.

---

## 3. Immediate repair build

### A. Fix the iOS/PWA top bar regression
- Keep the mobile strip visible but safe-area aware.
- Add top padding using `env(safe-area-inset-top)` and avoid placing controls behind the camera/status bar.
- Re-check viewport meta/status-bar settings so the app does not rely on unsafe `black-translucent` behavior without padding.
- Verify on a mobile viewport and, if possible, iPhone-shaped viewport dimensions.

### B. Correct page header labels
Use these labels:

- Tonight: eyebrow **Tonight**, title **What to watch, and what to play after.**
- Movies: eyebrow **Movies**, title **Browse all movies**
- Shows: eyebrow **Shows**, title **Browse all podcasts**
- Lists: eyebrow **Lists**, title **Watchlists & History**
- Setup: eyebrow **Setup**, title **Settings**

Also change **Filters & sort** to **Filters & Sort**.

### C. Split Tonight controls from Movies controls
- Keep Tonight’s control surface as “Tonight’s parameters.”
- Create a distinct Movies browsing control surface so Movies does not visually duplicate Tonight.
- Movies should keep filter access easy, but use a browse/search-oriented layout: title search, visible sort/access chip, and compact filter entry point rather than the full Tonight parameter block.
- Clarify counts as “showing X of Y” when a visible cap or load-more pattern is active.

### D. Fix slider visuals and touch targets
- Restore the filled blue track on **Max runtime** from the left edge to the handle.
- Make runtime and year handles easier to grab: minimum 44px hit area, larger visible handles, wider track.
- Before implementation, present 2-4 visual options for the slider treatment, because this is a touch/visual refinement.

### E. Default Tonight to unwatched
- Set the default Tonight filters so **Unwatched** is selected by default.
- Preserve existing user overrides from stored preferences.

### F. Watchlist and watched controls
- Debug add-to-list from Tonight cards and movie detail in the browser.
- Fix checkbox/list creation refresh issues so the popover reflects current list membership immediately.
- Add clearer snackbars:
  - `Mark as watched: {Title}`
  - `Added to {List}: {Title}`
  - `Removed from {List}: {Title}`
  - `Created {List} and added: {Title}`
- Use undo actions consistently where safe.

### G. Make dim-watched visible and consistent
- Strengthen dimmed watched styling so it is clearly visible when enabled.
- Apply it consistently to movie cards and list/history surfaces where watched movies appear.

### H. Make Setup podcast rows navigable
- In Setup > Podcasts, clicking the podcast title or cover art should navigate to that podcast detail page.
- Keep the follow/preferred button independent so tapping it does not navigate.

### I. Verify Pass T5 rather than re-building it blindly
- Open Episode coverage & show curation in the running admin page.
- Verify search, Active/Parked, Behind-feed, and sort controls work.
- If the controls are present but unclear, improve labels/layout; if any control is broken, fix it.

---

## 4. Design decisions to present before building those pieces

These should be shown as options before implementation rather than silently choosing one.

### Slider/touch target options for Pass D remnants
Provide 2-4 visuals for the Tonight runtime/year controls, likely including:

1. **Thick rail, floating handles:** wider cyan fill, 32px visible handles, 48px invisible hit area.
2. **Inset rail with grab knobs:** rail sits in a shallow groove; handles have stronger contrast and larger touch rings.
3. **Stepper-assisted slider:** slider remains primary, but small minus/plus controls help with precise mobile adjustments.
4. **Compact numeric chips + slider:** current value chips sit beside the labels while the slider gets a larger grab zone.

### Rating range options
Provide 2-3 visuals for minimum + maximum allowed rating:

1. **Dual-handle rating ladder:** one rail from TV-Y to NC-17 with a highlighted allowed range.
2. **Segmented rating band:** tappable rating steps where the selected allowed band is filled.
3. **Two compact selectors:** “Minimum” and “Maximum” chips that open a small picker; less visual noise, less slider-like.

### On-page sorting options for Tonight
Provide 2-4 UI/UX alternates for surfacing sort outside the expanded parameters panel:

1. **Sort chip row above results:** Commentary, Episodes, Shortest, Newest as compact chips.
2. **Single visible sort button:** current sort label next to result count; opens only sort choices.
3. **Mode segmented control:** “Best match / Short / New / Most covered” as a small segmented control.
4. **Results-toolbar dropdown:** right-aligned, desktop-friendly; keeps filters separate from sorting.

### Icon alternatives
Backlog-only: propose visual icon options for **Unwatched** and **Not interested** before changing those metaphors.

---

## 5. Tonight recommendation volume plan

The jump to 121 recommendations is a product problem, not just a count display issue. The Tonight page should behave like a recommendation surface, not another catalogue page.

Recommended first implementation:

- Show the **top 10** Tonight recommendations by default.
- Add **Load more suggestions** below the list.
- Show counts as: `Showing 10 of 121 matches`.
- Keep the full Movies page for catalogue-style browsing.

Possible filter additions:

- **Minimum Commentary Score:** useful, but defaulting to 75 could hide too much for users who have not selected preferred podcasts or have sparse data. Safer default: no hard minimum until we compare score distribution, or use a soft “Best only” toggle with a visible count.
- **Exclude holiday movies:** feasible as a first pass using standalone words `Santa` and `Christmas` in title/description. The proposed seasonal default needs a date rule correction: checked by default **Jan 8-Nov 2**, unchecked during holiday season **Nov 3-Jan 7**.

Backlog-only: file a fuller seasonal inclusion/exclusion pass rather than building robust holiday logic now.

---

## 6. Clarifications for current behavior

### Why Tonight and Movies look so similar
They currently use the same filter component and the same global filter preferences. Tonight applies one extra rule: it always hides “Not interested” titles. This shared component is the reason the Movies page currently shows “Tonight’s parameters.” It is not a separate server query; the app loads the catalogue and filters client-side.

### What “Not interested” currently does
Pressing the hide/Not interested control stores that movie slug in local device preferences. It then:

- removes the movie from Tonight unconditionally;
- hides it from Movies when “Hide not interested” is on;
- can be immediately reversed through the snackbar Undo action.

There is currently no dedicated screen to review or edit all “Not interested” items. That is a reasonable UX need, not too much of an edge case, especially because the action can feel permanent.

---

## 7. Backlog-only roadmap updates

Add these to the consolidated roadmap, without building them in the immediate repair pass:

1. **Pass D remnants:** slider/touch target visual refinement, with visual options required before implementation.
2. **Not interested UX:** clearer copy, alternate icons, “Hidden / Not interested” management list, restore actions, and less ominous snackbar language.
3. **Rating range filter:** minimum + maximum rating range, with visual options before build.
4. **Podcast page episode sorting/filtering:** clarify default order and add controls for newest/oldest, matched/unmatched, duration, and possibly title search.
5. **Default Tonight parameters in Setup:** user can save their preferred defaults for Tonight filters.
6. **Seasonal recommendations:** robust include/exclude seasonal movie UX beyond the first `Santa`/`Christmas` rule.
7. **Kids/family-heavy suggestions:** investigate audience-focus filters using ratings and genres; may be mostly solved by rating minimum/maximum.
8. **Account-synced watchlists/history:** troubleshoot and plan migration from local-only list/watch state to signed-in backend data.
9. **Commentary Score copy:** rewrite the “same inputs always give the same score” explanation so it distinguishes deterministic scoring from user preference changes that intentionally change the inputs.
10. **Split Pass J:**
    - **J1:** episode rows with truncated descriptions + expand, consistent controls on movie/podcast pages, podcast segmented view toggle.
    - **J2:** dedicated episode pages later, once external ratings/comments exist.

---

## 8. Verification checklist before calling the repair pass done

- Desktop and mobile screenshots for Tonight, Movies, Shows, Lists, Setup.
- iPhone/PWA-safe-area check for the top strip.
- Browser interaction check: create a watchlist from a Tonight card, add/remove that movie, close/reopen popover, verify checkbox state.
- Browser interaction check: mark watched on Tonight and movie detail, verify snackbar title and watched/dimmed state.
- Browser interaction check: Setup podcast title/artwork navigates to detail; follow button does not navigate.
- Browser interaction check: Movies page no longer says “Tonight’s parameters.”
- Browser interaction check: Max runtime track fill is visible.
- Admin check: T5 show curation search/filter/sort controls are visible and functional.
- Roadmap update: move the over-broad “shipped” stamp for D/O/T5/G/H/Y into a more honest partial/verified status, and file backlog-only items separately.
