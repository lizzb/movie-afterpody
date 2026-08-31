import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clapperboard, Mic, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CatalogAddCard } from "@/components/CatalogAddCard";
import { FilterBar } from "@/components/FilterBar";
import { MovieCard } from "@/components/MovieCard";
import { PageHeader } from "@/components/PageHeader";
import { ViewToggle } from "@/components/ViewToggle";
import { applyFilters, useDiscovery } from "@/lib/discovery";
import { NO_FILTERS, prefsActions } from "@/lib/prefs";

export const Route = createFileRoute("/movies/")({
  head: () => ({
    meta: [
      { title: "Browse movies — Movie Afterparty" },
      {
        name: "description",
        content:
          "Search the whole Movie Afterparty catalogue and see how much commentary exists for each movie.",
      },
      { property: "og:title", content: "Browse movies — Movie Afterparty" },
      {
        property: "og:description",
        content: "Every catalogued movie with its Commentary Score and podcast episodes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MoviesPage,
});

function MoviesPage() {
  const { entries, catalog, prefs, isLoading } = useDiscovery();
  const view = prefs.viewModes["movies"] ?? "rows";
  const [term, setTerm] = useState("");

  // Pass H5 — Movies browses with its own filter object, wide open by default.
  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return applyFilters(entries, prefs.movieFilters).filter(
      (e) => !needle || e.movie.title.toLowerCase().includes(needle),
    );
  }, [entries, prefs.movieFilters, term]);

  const showMatches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    return (catalog?.podcasts ?? [])
      .filter((p) => p.name.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [catalog, term]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <PageHeader
          icon={Clapperboard}
          eyebrow="Movies"
          title="Browse all movies"
          subtitle={`${entries.length} title${entries.length === 1 ? "" : "s"} in the catalogue`}
        />

        <div className="mt-4 flex items-center gap-2">
          <label className="relative block flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search every movie in the app"
            aria-label="Search movies"
            className="w-full rounded-xl border border-border bg-card py-3.5 pl-9 pr-4 text-base shadow-card transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
          />
          </label>
          <ViewToggle surface="movies" value={view} />
        </div>

        <div className="mt-3">
          <FilterBar
            filters={prefs.movieFilters}
            genres={catalog?.genres ?? []}
            services={catalog?.services ?? []}
            mySlugs={prefs.serviceSlugs}
            resultCount={results.length}
            totalCount={entries.length}
            variant="movies"
            showNotInterested
            collapsible
            defaults={NO_FILTERS}
            onApply={(next) => prefsActions.setMovieFilters(next)}
          />
        </div>


        {showMatches.length > 0 ? (
          <section className="mt-5 rounded-2xl border border-border bg-card p-3 shadow-card">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Shows matching &ldquo;{term.trim()}&rdquo;
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {showMatches.map((p) => (
                <Link
                  key={p.id}
                  to="/podcasts/$slug"
                  params={{ slug: p.slug }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Mic className="size-3" aria-hidden />
                  {p.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : results.length === 0 ? (
          term.trim() ? (
            <CatalogAddCard kind="movie" term={term.trim()} />
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              The catalogue is empty. Ingest a podcast to start building it.
            </p>
          )
        ) : (
          <ul
            className={
              view === "tiles"
                ? "mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                : "mt-5 space-y-2.5"
            }
          >
            {results.map((entry) => (
              <MovieCard key={entry.movie.id} entry={entry} view={view} />
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
