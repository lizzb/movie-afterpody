import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Info, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { MovieCard } from "@/components/MovieCard";
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

  const results = useMemo(() => applyFilters(entries, prefs.filters), [entries, prefs.filters]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <header className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="size-3" aria-hidden />
              Tonight
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">
              What to watch — and what to play after.
            </h1>
          </div>
          <span
            title="Commentary Score ranks by how much good podcast conversation is waiting once the credits roll."
            className="mb-1 shrink-0 text-muted-foreground"
          >
            <Info className="size-4" aria-hidden />
          </span>
        </header>

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
