import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { MovieCard } from "@/components/MovieCard";
import { PageHeader } from "@/components/PageHeader";
import { ViewToggle } from "@/components/ViewToggle";
import { applyFilters, useDiscovery } from "@/lib/discovery";

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
  const { catalog, entries, prefs, isLoading } = useDiscovery();
  const view = prefs.viewModes["tonight"] ?? "rows";

  // Tonight never suggests "Not interested" titles, regardless of the filter.
  const results = useMemo(
    () => applyFilters(entries, prefs.filters, { alwaysHideNotInterested: true }),
    [entries, prefs.filters],
  );

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <div className="mb-3">
          <PageHeader
            icon={Sparkles}
            eyebrow="Tonight"
            title="Pick a movie. Get the afterparty."
          />
        </div>

        {!isLoading && (catalog?.availability.length ?? 0) === 0 ? (
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
          genres={catalog?.genres ?? []}
          services={catalog?.services ?? []}
          mySlugs={prefs.serviceSlugs}
          resultCount={results.length}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ranked by Commentary Score
          </p>
          <ViewToggle surface="tonight" value={view} />
        </div>

        {isLoading ? (
          <ul className="mt-3 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : results.length === 0 ? (
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
            {results.map((entry) => (
              <MovieCard key={entry.movie.id} entry={entry} view={view} />
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
