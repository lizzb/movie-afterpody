import { Link } from "@tanstack/react-router";
import { Check, Eye, EyeOff, Timer } from "lucide-react";
import { toast } from "sonner";
import { AddToListButton } from "@/components/AddToListButton";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { ScorePill } from "@/components/ScorePill";
import type { EpisodeEntry, MovieEntry } from "@/lib/discovery";
import { prefsActions, usePrefs, type ViewMode } from "@/lib/prefs";
import { isUnrated, ratingLabel } from "@/lib/ratings";

export function MovieCard({ entry, view = "rows" }: { entry: MovieEntry; view?: ViewMode }) {
  return view === "tiles" ? <MovieTile entry={entry} /> : <MovieRow entry={entry} />;
}

/** Distinct podcasts covering this movie, preferred shows first. */
function coveringPodcasts(episodes: EpisodeEntry[]) {
  const byId = new Map<string, { id: string; slug: string; name: string; artwork: string | null; accent: string; preferred: boolean; count: number }>();
  for (const ep of episodes) {
    const existing = byId.get(ep.podcast.id);
    if (existing) {
      existing.count += 1;
      existing.preferred = existing.preferred || ep.preferred;
      continue;
    }
    byId.set(ep.podcast.id, {
      id: ep.podcast.id,
      slug: ep.podcast.slug,
      name: ep.podcast.name,
      artwork: ep.podcast.artwork_url,
      accent: ep.podcast.accent,
      preferred: ep.preferred,
      count: 1,
    });
  }
  return [...byId.values()].sort(
    (a, b) => Number(b.preferred) - Number(a.preferred) || b.count - a.count,
  );
}

function WatchedButton({ slug, title, watched }: { slug: string; title: string; watched: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={watched ? "Mark as not watched" : "Mark as watched"}
      title={watched ? "Watched — tap to undo" : "Mark as watched"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.toggleWatched(slug, !watched);
        toast(watched ? `Marked as not watched: ${title}` : `Mark as watched: ${title}`, {
          action: {
            label: "Undo",
            onClick: () => prefsActions.toggleWatched(slug, watched),
          },
        });
      }}
      className={`grid size-8 place-items-center rounded-full border transition-colors ${
        watched
          ? "border-transparent bg-teal text-primary-foreground"
          : "border-border bg-card/90 text-muted-foreground hover:text-foreground"
      }`}
    >
      {watched ? <Check className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}

/** Pass H — "Not interested": excluded from Tonight, optionally hidden in Movies. */
function NotInterestedButton({ slug, title, off }: { slug: string; title: string; off: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={off}
      aria-label={off ? "Interested again" : "Not interested"}
      title={off ? "Not interested — tap to undo" : "Not interested"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.toggleNotInterested(slug, !off);
        toast(off ? `Back in suggestions: ${title}` : `Not interested: ${title}`, {
          action: {
            label: "Undo",
            onClick: () => prefsActions.toggleNotInterested(slug, off),
          },
        });
      }}
      className={`grid size-8 place-items-center rounded-full border transition-colors ${
        off
          ? "border-transparent bg-secondary text-foreground"
          : "border-border bg-card/90 text-muted-foreground hover:text-foreground"
      }`}
    >
      <EyeOff className="size-4" aria-hidden />
    </button>
  );
}

/** Certification marker; unrated titles read "NR" rather than disappearing. */
function RatingPill({ value }: { value: string | null | undefined }) {
  return (
    <span
      title={isUnrated(value) ? "No content rating on file" : `Rated ${value}`}
      className="inline-flex items-center rounded-full border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground"
    >
      {ratingLabel(value)}
    </span>
  );
}

function PodcastStrip({ episodes }: { episodes: EpisodeEntry[] }) {
  const shows = coveringPodcasts(episodes);
  if (shows.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No commentary episodes yet</p>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        {shows.slice(0, 5).map((show) => (
          <span
            key={show.id}
            title={`${show.name} · ${show.count} episode${show.count === 1 ? "" : "s"}`}
            className={`block w-7 shrink-0 overflow-hidden rounded-md ${
              show.preferred ? "ring-2 ring-berry" : ""
            }`}
          >
            <Artwork
              src={show.artwork}
              title={show.name}
              seed={show.slug}
              accent={show.accent}
              shape="cover"
              className="w-7 text-[9px]"
            />
          </span>
        ))}
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground">
        {shows.length > 5 ? `+${shows.length - 5} · ` : ""}
        {episodes.length} ep
      </span>
    </div>
  );
}

function MovieRow({ entry }: { entry: MovieEntry }) {
  const { movie, score, genres, services, episodes, watched, notInterested } = entry;
  const dim = usePrefs().dimWatched && watched;

  return (
    <li
      className={`relative overflow-visible rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg ${
        dim ? "opacity-45 saturate-50" : ""
      }`}
    >
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
        <NotInterestedButton slug={movie.slug} title={movie.title} off={notInterested} />
        <WatchedButton slug={movie.slug} title={movie.title} watched={watched} />
        <AddToListButton movieSlug={movie.slug} movieTitle={movie.title} />
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
          <h3 className="pr-28 font-display text-base font-bold leading-snug">
            {movie.title}
            {movie.release_year ? (
              <span className="font-normal text-muted-foreground"> {movie.release_year}</span>
            ) : null}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <ScorePill value={score.score} />
            <RatingPill value={movie.certification} />
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

          <div className="mt-2">
            <PodcastStrip episodes={episodes} />
          </div>

          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{score.explanation}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {services.slice(0, 3).map((s) => (
              <BrandBadge key={s.id} slug={s.slug} label={s.short_name} active />
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
  const { movie, score, services, episodes, watched, notInterested } = entry;
  const dim = usePrefs().dimWatched && watched;

  return (
    <li className={`relative ${dim ? "opacity-45 saturate-50" : ""}`}>
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
        </div>
        <h3 className="mt-2 line-clamp-2 break-anywhere text-sm font-semibold leading-snug">{movie.title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[
            movie.release_year,
            movie.runtime_minutes ? `${movie.runtime_minutes}m` : null,
            ratingLabel(movie.certification),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1.5">
          <PodcastStrip episodes={episodes} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {services.slice(0, 3).map((s) => (
            <BrandBadge key={s.id} slug={s.slug} label={s.short_name} active />
          ))}
        </div>
      </Link>
      <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1.5">
        <WatchedButton slug={movie.slug} title={movie.title} watched={watched} />
        <AddToListButton movieSlug={movie.slug} movieTitle={movie.title} />
        <NotInterestedButton slug={movie.slug} title={movie.title} off={notInterested} />
      </div>
    </li>
  );
}
