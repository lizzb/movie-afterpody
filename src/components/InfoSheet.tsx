import { useState } from "react";
import { Info, X } from "lucide-react";

/**
 * Pass D — the single place that explains the app and its two scores.
 * Per-page description paragraphs live here so pages keep vertical space.
 */
export function InfoSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What is Movie Afterparty?"
        className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Info className="size-4" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-label="About Movie Afterparty"
            className="relative z-10 max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-popover p-5 shadow-poster sm:max-w-lg sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-bold">How this works</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Movie Afterparty pairs something to watch tonight with the commentary episode worth
                playing straight after it. Set your streaming services and parameters once, then
                Tonight ranks what is actually watchable for you.
              </p>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                  Commentary Score
                </h3>
                <p className="mt-1">
                  A deterministic 0&ndash;100 rating of how good the afterparty is: how many shows
                  covered the movie, whether they are shows you have marked as preferred, how you
                  rated and finished past episodes, and the production quality you logged. Same
                  inputs always give the same score, so it never drifts between visits.
                </p>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                  Match score
                </h3>
                <p className="mt-1">
                  How confident the pipeline is that an episode is really about that movie, based on
                  the episode title, its description, release year proximity and franchise
                  distinguishers.
                </p>
                <ul className="mt-2 space-y-1">
                  <li>
                    <span className="font-semibold text-foreground">80&ndash;100</span> &mdash;
                    strong: title and corroborating signals agree.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">60&ndash;79</span> &mdash;
                    plausible but worth a human look.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Below 60</span> &mdash; weak;
                    usually a common-word title or an ad read.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                  Content ratings
                </h3>
                <p className="mt-1">
                  Movie (MPA) and TV ratings share one ladder so they filter together. Titles with no
                  rating on file show <span className="font-semibold text-foreground">NR</span> and
                  are only included when you opt in.
                </p>
              </section>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground neon"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
