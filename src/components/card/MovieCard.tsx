import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Timer } from "lucide-react";
import { AddToListButton } from "@/components/AddToListButton";
import { Artwork } from "@/components/Artwork";
import { ScorePill } from "@/components/ScorePill";
import { CardBadges, CardBody, CardFooter, CardHeader } from "@/components/card/Card";
import { MediaCardFrame } from "@/components/card/MediaCardFrame";
import { StreamingFooter } from "@/components/card/parts/AvailabilityFooter";
import { ConsumedDate } from "@/components/card/parts/ConsumedDate";
import { PodcastCoverage } from "@/components/card/parts/PodcastCoverage";
import { EpisodeLinkRow, type EpisodeLink } from "@/components/card/parts/RelationshipRow";
import {
  NotInterestedButton,
  RatingPill,
  WatchedButton,
} from "@/components/card/parts/StatusActions";
import type { MovieEntry } from "@/lib/discovery";
import { usePrefs, type ViewMode } from "@/lib/prefs";
import { ratingLabel } from "@/lib/ratings";

/**
 * Pass K8 — the one movie card in the app. Every surface that presents a movie
 * (Tonight, Movies, Show Details → Movies, Watchlists, Watched history) renders
 * this component; the differences between those surfaces are variants, props
 * and slots, never a second copy of this markup.
 *
 * - `browse`       full-density row/tile: coverage, score explanation, services, genres
 * - `compact`      library/history row: coverage, services, genres, optional consumed date
 * - `relationship` show-detail row: one body row per covering episode, moderated inline
 */
export type MovieCardVariant = "browse" | "compact" | "relationship";

export interface MovieCardProps {
  entry: MovieEntry;
  variant?: MovieCardVariant;
  /** Presentation density — `rows` or `tiles`, not a separate component. */
  density?: ViewMode;
  /** Relationship rows: the episodes that cover this movie on this surface. */
  episodeLinks?: EpisodeLink[];
  /** Show confirm/flag controls on each relationship row (admin surfaces). */
  relationshipModeration?: boolean;
  /** Watched date, shown in the metadata row with the shared treatment. */
  consumedDate?: string | null;
  /**
   * Optional slot for the user's own reaction to the movie (Pass U83). Renders
   * nothing until reactions exist.
   */
  userRatingSlot?: ReactNode;
  /** Optional external (critic/audience) rating — renders when supplied. */
  externalRating?: number | null;
  showBookmark?: boolean;
  showConsumed?: boolean;
  showNotInterested?: boolean;
}

export function MovieCard({
  entry,
  variant = "browse",
  density = "rows",
  episodeLinks,
  relationshipModeration = false,
  consumedDate = null,
  userRatingSlot,
  externalRating = null,
  showBookmark = true,
  showConsumed = true,
  showNotInterested = true,
}: MovieCardProps) {
  const { movie, score, genres, services, episodes, watched, notInterested, onMyServices } = entry;
  const dim = usePrefs().dimWatched && watched;

  const controls = (
    <>
      {showNotInterested ? (
        <NotInterestedButton slug={movie.slug} title={movie.title} off={notInterested} />
      ) : null}
      {showConsumed ? (
        <WatchedButton slug={movie.slug} title={movie.title} watched={watched} />
      ) : null}
      {showBookmark ? <AddToListButton movieSlug={movie.slug} movieTitle={movie.title} /> : null}
    </>
  );
  const controlCount = Number(showNotInterested) + Number(showConsumed) + Number(showBookmark);

  if (density === "tiles") {
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
          <h3 className="mt-2 line-clamp-2 break-anywhere text-sm font-semibold leading-snug">
            {movie.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {[
              movie.release_year,
              movie.runtime_minutes ? `${movie.runtime_minutes}m` : null,
              ratingLabel(movie.certification),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {variant === "browse" ? (
            <div className="mt-1.5">
              <PodcastCoverage episodes={episodes} />
            </div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <StreamingFooter
              services={services}
              limit={3}
              active={variant === "relationship" ? onMyServices : true}
              showLabel={variant === "browse"}
              emptyText=""
            />
          </div>
        </Link>
        {controlCount > 0 ? (
          <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1.5">{controls}</div>
        ) : null}
      </li>
    );
  }

  const posterWidth =
    variant === "browse" ? "w-16 text-base" : variant === "relationship" ? "w-14 text-base" : "w-12 text-sm";

  return (
    <MediaCardFrame
      dim={dim}
      className="overflow-visible p-3"
      linkTo={
        variant === "relationship" ? undefined : { to: "/movies/$slug", params: { slug: movie.slug } }
      }
      controls={controlCount > 0 ? controls : undefined}
      media={
        <Artwork
          src={movie.poster_url}
          title={movie.title}
          seed={movie.slug}
          accent={movie.accent}
          className={posterWidth}
        />
      }
      header={
        variant === "relationship" ? (
          <Link to="/movies/$slug" params={{ slug: movie.slug }} className="block">
            <CardHeader
              reserveRight={controlCount as 1 | 2 | 3}
              title={movie.title}
              h2={movie.release_year ?? undefined}
            />
          </Link>
        ) : (
          <CardHeader
            reserveRight={controlCount as 1 | 2 | 3}
            title={movie.title}
            h2={movie.release_year ?? undefined}
          />
        )
      }
      badges={
        <CardBadges>
          <ScorePill value={score.score} compact />
          <RatingPill value={movie.certification} />
          {movie.runtime_minutes ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
              <Timer className="size-3" aria-hidden />
              {movie.runtime_minutes}m
            </span>
          ) : null}
          {externalRating != null ? (
            <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-1 text-gold">
              {externalRating.toFixed(1)}
            </span>
          ) : null}
          {consumedDate !== null ? <ConsumedDate date={consumedDate} /> : null}
        </CardBadges>
      }
      body={
        <CardBody>
          {variant === "relationship" ? (
            (episodeLinks ?? []).length > 0 ? (
              (episodeLinks ?? []).map((ep) => (
                <EpisodeLinkRow
                  key={ep.id}
                  episode={ep}
                  movieId={movie.id}
                  movieTitle={movie.title}
                  moderation={relationshipModeration}
                />
              ))
            ) : (
              <p>No commentary episodes yet</p>
            )
          ) : (
            <>
              <PodcastCoverage episodes={episodes} verbose={variant === "browse"} />
              {variant === "browse" ? <p className="line-clamp-2">{score.explanation}</p> : null}
            </>
          )}
        </CardBody>
      }
      footer={
        <CardFooter>
          <StreamingFooter
            services={services}
            genres={genres}
            limit={variant === "browse" ? 3 : undefined}
            active={variant === "relationship" ? onMyServices : true}
            showLabel={variant === "browse"}
            emptyText={variant === "browse" ? "" : "Not on your services"}
          />
        </CardFooter>
      }
      userFooter={userRatingSlot}
    />
  );
}
