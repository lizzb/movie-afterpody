import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { ListErrorNotice } from "@/components/ListErrorNotice";
import { MovieCard } from "@/components/card/MovieCard";
import { PageHeader } from "@/components/PageHeader";
import { ViewToggle } from "@/components/ViewToggle";
import { usePrefs } from "@/lib/prefs";
import { useFacets, useMoviePage } from "@/lib/server-lists";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tonight — Movie Afterparty" },
      {
        name: "description",
        content:
          "Find a movie worth watching tonight on the services you actually have, and the commentary podcast episode to play right after it.",
      },
      { property: "og:title", content: "Tonight — Movie Afterparty" },
      {
        property: "og:description",
        content: "Movies paired with the best commentary podcast episodes about them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TonightPage,
});

function TonightPage() {
  const prefs = usePrefs();
  const view = prefs.viewModes["tonight"] ?? "rows";
  const [visibleCount, setVisibleCount] = useState(10);
  const facets = useFacets();

  // Pass L2b — ranked on the server over the full candidate set; Tonight never
  // suggests "Not interested" titles, regardless of the filter.
  const { rows: visibleResults, total, isLoading, error, refetch } = useMoviePage({
    filters: prefs.filters,
    limit: visibleCount,
    tonight: true,
  });

  useEffect(() => {
    setVisibleCount(10);
  }, [prefs.filters]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <div className="mb-3">
          <PageHeader
            icon={Sparkles}
            eyebrow="Tonight"
            title="What to watch, and what to play after."
          />
        </div>

        {!isLoading && !facets.isLoading && facets.availabilityCount === 0 ? (
          <p className="mb-3 rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
            No streaming availability has been imported yet, so the &ldquo;only my services&rdquo;
            filter has nothing to match.{" "}
            <Link to="/admin/ingest" className="font-semibold text-coral">
              Run the availability sync
            </Link>{" "}
            to fill it in.
          </p>
        ) : null}


        <FilterBar
          filters={prefs.filters}
          genres={facets.genres}
          services={facets.services}
          podcasts={facets.podcasts}
          mySlugs={prefs.serviceSlugs}
          resultCount={total}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Showing {Math.min(visibleResults.length, total)} of {total} matches
          </p>
          <ViewToggle surface="tonight" value={view} />
        </div>

        <div className="mt-3">
          <ListErrorNotice error={error} onRetry={refetch} />
        </div>

        {isLoading ? (
          <ul className="mt-3 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : error ? null : total === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing matches those parameters. Loosen the runtime or era, or{" "}
            <Link to="/settings" className="font-semibold text-coral">
              add a streaming service
            </Link>
            .
          </p>
        ) : (
          <ul
            className={
              view === "tiles"
                ? "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                : "mt-3 space-y-2.5"
            }
          >
            {visibleResults.map((entry) => (
              <MovieCard key={entry.movie.id} entry={entry} density={view} />
            ))}
          </ul>
        )}

        {!isLoading && visibleResults.length < total ? (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 10)}
            className="mt-4 w-full rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card transition-colors hover:bg-secondary"
          >
            Load more suggestions
          </button>
        ) : null}
      </main>
    </AppShell>
  );
}
