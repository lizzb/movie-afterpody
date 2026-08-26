# Pass G2 — Truly lock the layout (backlog only)

## Problem

With "Lock the layout" on in Setup, a two-finger drag (and sometimes a one-finger swipe near an overflowing row) still slides the whole page sideways. The current lock only rewrites the viewport meta tag (`maximum-scale=1, user-scalable=no`), which iOS Safari mostly ignores outside an installed PWA, and which does nothing about horizontal *scroll* — the drag is real overflow, not zoom.

## What to build

1. **Find the overflow, don't just hide it.** Audit the surfaces that can exceed viewport width: horizontal chip rails in `FilterBar` / genre + service chips, the admin ingest tables, long unbroken movie/episode titles, and any `min-w`/fixed-width card. Fix the offenders at the source (`min-w-0`, `break-words`, contained scroll rails) so the page has no horizontal scroll even with the lock off.
2. **Lock class on `<html>`/`<body>`.** When `prefs.viewportLock` is on, apply a `layout-locked` class from `AppShell` that sets `overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: pan-y pinch-zoom` (or `pan-y` when zoom is also locked), and `max-width: 100vw` — so the page can only scroll vertically.
3. **Keep intentional horizontal scrollers working.** Any element that is meant to scroll sideways (chip rails, admin tables) opts back in with `touch-action: pan-x pan-y` and its own `overflow-x-auto`, so locking the page doesn't break those.
4. **Block gesture zoom in the app shell.** Non-passive `touchmove`/`gesturestart` handlers on the shell that `preventDefault()` multi-touch gestures only while the lock is on, so a two-finger drag can't pan or scale the page.
5. **Keep the accessibility escape hatch.** Lock off restores the permissive viewport meta, drops the class and the listeners, and leaves pinch zoom fully available. Setup copy updated to say the toggle prevents sideways drag and pinch zoom.

## Verification (before calling it done)

- Locked: two-finger drag and one-finger side swipe on Tonight, Movies, Shows, Lists, Setup produce zero horizontal movement; `document.scrollingElement.scrollWidth === clientWidth` on every tab at 390px wide.
- Locked: chip rails and admin tables still scroll sideways by touch.
- Unlocked: pinch zoom works again and nothing is clipped.
- Checked at 390px, 768px and desktop, in light and dark.

## Notes

Backlog only — this is filed into the consolidated roadmap on approval, not implemented now.
