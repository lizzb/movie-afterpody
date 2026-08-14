import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Popcorn, Sparkles, Timer } from "lucide-react";
import { useCatalog, useUserData } from "@/lib/data";
import { scoreMovie } from "@/lib/scoring";
import { accentFor, accentSoft, accentSolid, toAccent } from "@/lib/accents";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tonight — Movie Afterparty" },
      {
        name: "description",
        content:
          "Find a movie worth watching tonight and the commentary podcast episode to play right after it.",
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
  const { data: catalog, isLoading } = useCatalog();
  const { data: user } = useUserData();

  const picks = useMemo(() => {
    if (!catalog) return [];
    return catalog.movies
      .map((movie) => ({ movie, score: scoreMovie(movie.id, catalog, user) }))
      .filter((p) => p.score.episodeCount > 0)
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, 12);
  }, [catalog, user]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10">
      <header className="mb-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          Movie Afterparty
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight">
          What to watch tonight — and what to play after.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Every pick is ranked by its Commentary Score: how much great podcast conversation exists
          about the movie once the credits roll.
        </p>
      </header>

      {isLoading ? (
        <ul className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </ul>
      ) : (
        <ul className="space-y-4">
          {picks.map(({ movie, score }) => {
            const accent = toAccent(movie.accent ?? accentFor(movie.slug));
            return (
              <li
                key={movie.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex size-20 shrink-0 items-center justify-center rounded-xl font-display text-2xl ${accentSolid(accent)}`}
                    aria-hidden
                  >
                    {movie.title.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl leading-snug">
                      {movie.title}
                      {movie.release_year ? (
                        <span className="text-muted-foreground"> ({movie.release_year})</span>
                      ) : null}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{score.explanation}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-2.5 py-1 ${accentSoft(accent)}`}>
                        <Popcorn className="mr-1 inline size-3" aria-hidden />
                        Commentary {score.score}
                      </span>
                      {movie.runtime_minutes ? (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                          <Timer className="mr-1 inline size-3" aria-hidden />
                          {movie.runtime_minutes}m
                        </span>
                      ) : null}
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                        {score.episodeCount} episode{score.episodeCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
