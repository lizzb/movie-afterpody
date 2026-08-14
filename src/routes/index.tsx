import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FilterPanel } from "@/components/FilterPanel";
import { MovieCard } from "@/components/MovieCard";
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

  const results = useMemo(() => applyFilters(entries, prefs.filters), [entries, prefs.filters]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <header className="mb-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            Tonight
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight">
            What to watch — and what to play after.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Ranked by Commentary Score: how much good podcast conversation is waiting once the
            credits roll.
          </p>
        </header>

        <FilterPanel
          filters={prefs.filters}
          genres={catalog?.genres ?? []}
          services={catalog?.services ?? []}
          mySlugs={prefs.serviceSlugs}
          resultCount={results.length}
        />

        {isLoading ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
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
          <ul className="mt-6 space-y-3">
            {results.map((entry) => (
              <MovieCard key={entry.movie.id} entry={entry} />
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
