import { Link } from "@tanstack/react-router";
import { Check, Mic, Timer } from "lucide-react";
import { AddToListButton } from "@/components/AddToListButton";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { ScorePill } from "@/components/ScorePill";
import type { MovieEntry } from "@/lib/discovery";
import type { ViewMode } from "@/lib/prefs";

export function MovieCard({ entry, view = "rows" }: { entry: MovieEntry; view?: ViewMode }) {
  return view === "tiles" ? <MovieTile entry={entry} /> : <MovieRow entry={entry} />;
}

function MovieRow({ entry }: { entry: MovieEntry }) {
  const { movie, score, genres, services, episodes, watched } = entry;
  const preferredCount = episodes.filter((e) => e.preferred).length;

  return (
    <li className="relative overflow-visible rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg">
      <div className="absolute right-3 top-3 z-10">
        <AddToListButton movieSlug={movie.slug} />
      </div>
      <Link to="/movies/$slug" params={{ slug: movie.slug }} className="flex items-start gap-3 p-3">
        <Artwork
          src={movie.poster_url}
          title={movie.title}
          seed={movie.slug}
          accent={movie.accent}
          className="w-16 text-base"
        />
        <div className="min-w-0 flex-1">
          <h3 className="pr-11 font-display text-base font-bold leading-snug">
            {movie.title}
            {movie.release_year ? (
              <span className="font-normal text-muted-foreground"> {movie.release_year}</span>
            ) : null}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <ScorePill value={score.score} />
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
              <Mic className="size-3" aria-hidden />
              {episodes.length}
              {preferredCount > 0 ? ` · ${preferredCount} yours` : ""}
            </span>
            {movie.runtime_minutes ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                <Timer className="size-3" aria-hidden />
                {movie.runtime_minutes}m
              </span>
            ) : null}
            {watched ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-1 text-teal">
                <Check className="size-3" aria-hidden />
                Watched
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{score.explanation}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {services.slice(0, 3).map((s) => (
              <BrandBadge key={s.id} slug={s.slug} label={s.short_name} active showLabel={false} />
            ))}
            <span className="text-[11px] text-muted-foreground">
              {genres.map((g) => g.name).join(" · ") || "Uncategorised"}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function MovieTile({ entry }: { entry: MovieEntry }) {
  const { movie, score, services, episodes, watched } = entry;

  return (
    <li className="relative">
      <Link to="/movies/$slug" params={{ slug: movie.slug }} className="group block">
        <div className="relative">
          <Artwork
            src={movie.poster_url}
            title={movie.title}
            seed={movie.slug}
            accent={movie.accent}
            className="w-full text-3xl shadow-poster"
          />
          <span className="absolute left-1.5 top-1.5">
            <ScorePill value={score.score} compact />
          </span>
          {watched ? (
            <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-teal text-primary-foreground">
              <Check className="size-3.5" aria-hidden />
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{movie.title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[movie.release_year, movie.runtime_minutes ? `${movie.runtime_minutes}m` : null]
            .filter(Boolean)
            .join(" · ")}
          {` · ${episodes.length} ep`}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {services.slice(0, 3).map((s) => (
            <BrandBadge key={s.id} slug={s.slug} label={s.short_name} active showLabel={false} />
          ))}
        </div>
      </Link>
      <div className="absolute right-1.5 top-1.5 z-10">
        <AddToListButton movieSlug={movie.slug} />
      </div>
    </li>
  );
}
