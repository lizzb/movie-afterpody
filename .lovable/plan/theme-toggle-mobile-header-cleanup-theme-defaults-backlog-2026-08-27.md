# Theme toggle: mobile header cleanup + theme-defaults backlog

## Build now — remove the theme toggle from the mobile header

The mobile top strip currently shows: brand, Ingest (admins), the three-way theme toggle, and the account chip. On a 390px screen with Ingest visible, that row cramps and the "Signed in" chip squeezes.

Change:
- Remove `<ThemeToggle />` from the mobile strip in `src/components/AppShell.tsx` only. The desktop header keeps it, and Setup keeps its prominent toggle in the page header.
- Let the account chip take the freed space so "Signed in" / "Sign in" reads cleanly next to Ingest at 390px.
- No changes to theme logic, storage, or `ThemeToggle` itself.

Verification: at 390px with Ingest visible, the strip fits on one line with no truncation of the account chip; theme switching still works from Setup; desktop header unchanged; light and dark checked.

## Backlog only — Pass G5: Theme defaults and toggle placement

Filed into `.lovable/plan/current-consolidated-roadmap.md`, not built.

1. **Respect system defaults (~8k).** Make `system` the default theme for a first-time visitor (today the stored default is explicit), so the OS light/dark choice is adopted on first launch and the manual override is rarely needed. Existing users keep whatever they already chose.
2. **Top-level settings placement (~6k).** Guarantee the manual theme control is visible without scrolling on Setup — it currently sits in the page header, so this is a verification-and-adjust pass (label it, group it with the App settings block if that reads better on mobile).
3. **Desktop mode kept separate (~10k, NEEDS DESIGN).** Treat any desktop/mobile view switch as a layout fallback utility, not a display theme: it must not sit in the same control group as light/dark. Needs a design decision on where it lives (Setup "Advanced" row vs nothing at all, since the browser already offers "Request desktop site").

## Technical notes

- Single-file edit for the build item: `src/components/AppShell.tsx`, mobile strip block only.
- `useThemeClass()` stays mounted in `AppShell`, so system-theme following is unaffected by removing the control.
