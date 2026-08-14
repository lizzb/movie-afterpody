import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MovieCard } from "@/components/MovieCard";
import { useDiscovery } from "@/lib/discovery";

export const Route = createFileRoute("/movies")({
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
  const { entries, isLoading } = useDiscovery();
  const [term, setTerm] = useState("");

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return entries
      .filter((e) => !needle || e.movie.title.toLowerCase().includes(needle))
      .sort((a, b) => a.movie.title.localeCompare(b.movie.title));
  }, [entries, term]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <h1 className="font-display text-3xl">All movies</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The full catalogue — including movies nobody has made a commentary episode about yet.
        </p>

        <label className="relative mt-5 block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search titles"
            aria-label="Search movies"
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm shadow-card"
          />
        </label>

        {isLoading ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
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
