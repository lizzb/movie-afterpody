import { Link } from "@tanstack/react-router";
import { Check, Mic, Popcorn, Timer } from "lucide-react";
import { AddToListButton } from "@/components/AddToListButton";
import { accentFor, accentSoft, accentSolid, toAccent } from "@/lib/accents";
import type { MovieEntry } from "@/lib/discovery";

export function MovieCard({ entry }: { entry: MovieEntry }) {
  const { movie, score, genres, services, episodes, watched } = entry;
  const accent = toAccent(movie.accent ?? accentFor(movie.slug));
  const preferredCount = episodes.filter((e) => e.preferred).length;

  return (
    <li className="relative overflow-visible rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg">
      <div className="absolute right-3 top-3 z-10">
        <AddToListButton movieSlug={movie.slug} />
      </div>
      <Link
        to="/movies/$slug"
        params={{ slug: movie.slug }}
        className="flex items-start gap-4 p-4"
      >
        <div
          className={`flex size-20 shrink-0 items-center justify-center rounded-xl font-display text-2xl ${accentSolid(accent)}`}
          aria-hidden
        >
          {movie.title.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="pr-11 font-display text-xl leading-snug">
            {movie.title}
            {movie.release_year ? (
              <span className="text-muted-foreground"> ({movie.release_year})</span>
            ) : null}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{score.explanation}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2.5 py-1 ${accentSoft(accent)}`}>
              <Popcorn className="mr-1 inline size-3" aria-hidden />
              Commentary {score.score}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
              <Mic className="mr-1 inline size-3" aria-hidden />
              {episodes.length} episode{episodes.length === 1 ? "" : "s"}
              {preferredCount > 0 ? ` · ${preferredCount} yours` : ""}
            </span>
            {movie.runtime_minutes ? (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                <Timer className="mr-1 inline size-3" aria-hidden />
                {movie.runtime_minutes}m
              </span>
            ) : null}
            {watched ? (
              <span className="rounded-full bg-teal-soft px-2.5 py-1 text-teal">
                <Check className="mr-1 inline size-3" aria-hidden />
                Watched
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{genres.map((g) => g.name).join(" · ") || "Uncategorised"}</span>
            {services.length > 0 ? (
              <span className="font-semibold text-foreground">
                {services.map((s) => s.short_name).join(", ")}
              </span>
            ) : (
              <span>Not on your services</span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
