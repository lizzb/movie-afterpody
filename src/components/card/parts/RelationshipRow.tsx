import { Link } from "@tanstack/react-router";
import { Artwork } from "@/components/Artwork";
import { ConfirmMatchButton } from "@/components/ConfirmMatchButton";
import { FlagMatchButton } from "@/components/FlagMatchButton";
import { CardBodyRow } from "@/components/card/Card";

/** "1h 42m" / "42m" for episode durations. */
export function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export interface EpisodeLink {
  id: string;
  title: string;
  released_at: string | null;
  duration_seconds: number | null;
}

export interface MovieLink {
  id: string;
  slug: string;
  title: string;
  release_year: number | null;
  poster_url?: string | null;
  accent?: string;
}

/** Confirm / flag controls for one movie ↔ episode relationship. */
export function RelationshipModeration({
  episodeId,
  movieId,
  movieTitle,
  episodeTitle,
}: {
  episodeId: string;
  movieId: string;
  movieTitle: string;
  episodeTitle: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <ConfirmMatchButton episodeId={episodeId} movieId={movieId} />
      <FlagMatchButton
        episodeId={episodeId}
        movieId={movieId}
        movieTitle={movieTitle}
        episodeTitle={episodeTitle}
      />
    </span>
  );
}

/** One episode relationship inside a movie card. */
export function EpisodeLinkRow({
  episode,
  movieId,
  movieTitle,
  moderation = false,
}: {
  episode: EpisodeLink;
  movieId: string;
  movieTitle: string;
  moderation?: boolean;
}) {
  return (
    <CardBodyRow
      control={
        moderation ? (
          <RelationshipModeration
            episodeId={episode.id}
            movieId={movieId}
            movieTitle={movieTitle}
            episodeTitle={episode.title}
          />
        ) : undefined
      }
    >
      <span className="line-clamp-2">
        {episode.released_at ? `${episode.released_at}: ` : ""}
        {episode.title}
        {episode.duration_seconds ? ` (${formatDuration(episode.duration_seconds)})` : ""}
      </span>
    </CardBodyRow>
  );
}

/** One movie relationship inside an episode card. */
export function MovieLinkRow({
  movie,
  episodeId,
  episodeTitle,
  moderation = false,
  poster = false,
}: {
  movie: MovieLink;
  episodeId: string;
  episodeTitle: string;
  moderation?: boolean;
  poster?: boolean;
}) {
  return (
    <CardBodyRow
      control={
        moderation ? (
          <RelationshipModeration
            episodeId={episodeId}
            movieId={movie.id}
            movieTitle={movie.title}
            episodeTitle={episodeTitle}
          />
        ) : undefined
      }
    >
      <Link
        to="/movies/$slug"
        params={{ slug: movie.slug }}
        onClick={(e) => e.stopPropagation()}
        className="flex min-w-0 items-center gap-2 font-semibold text-foreground hover:text-coral"
      >
        {poster ? (
          <Artwork
            src={movie.poster_url ?? null}
            title={movie.title}
            seed={movie.slug}
            accent={movie.accent ?? null}
            className="w-8 shrink-0 text-[10px]"
          />
        ) : null}
        <span className="line-clamp-1 min-w-0">
          {movie.title}
          {movie.release_year ? (
            <span className="font-normal text-muted-foreground"> ({movie.release_year})</span>
          ) : null}
        </span>
      </Link>
    </CardBodyRow>
  );
}
