import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { Artwork } from "@/components/Artwork";
import { EpisodeAddMovieControl } from "@/components/EpisodeAddMovieControl";
import { EpisodeAdminActions } from "@/components/EpisodeAdminActions";
import { EpisodeNotesFooter } from "@/components/EpisodeNotesFooter";
import { ExpandableText } from "@/components/ExpandableText";
import { ListenLaterButton } from "@/components/ListenLaterButton";
import { MarkListenedButton } from "@/components/MarkListenedButton";
import { CardBody, CardFooter, CardHeader } from "@/components/card/Card";
import { MediaCardFrame } from "@/components/card/MediaCardFrame";
import { ListenFooter } from "@/components/card/parts/AvailabilityFooter";
import { ConsumedDate } from "@/components/card/parts/ConsumedDate";
import {
  MovieLinkRow,
  RelationshipModeration,
  formatDuration,
  type MovieLink,
} from "@/components/card/parts/RelationshipRow";
import { PreferShowButton } from "@/components/card/parts/StatusActions";
import { EMPTY_EPISODE_DETAIL, type EpisodeDetail } from "@/lib/details";
import { listenLaterSlugs, usePrefs } from "@/lib/prefs";
import type { Episode, Podcast } from "@/lib/types";

/**
 * Pass K9/K10 — the one episode card in the app. Movie Details, Show Details,
 * Listen Later and Listened history all render this component; the surfaces
 * differ only in variant, density and which optional data they supply.
 *
 * - `detail`  rich row: description, relationships, listen footer, rating footer
 * - `compact` library/history row: same semantics, denser presentation
 *
 * Episode-level sign-off (Mark reviewed / Reopen) is offered when — and only
 * when — the card is given the episode's complete current context
 * (`episodeContext="complete"`), never because of which route renders it.
 */
export type EpisodeCardVariant = "detail" | "compact";

export interface EpisodeCardProps {
  episode: Episode;
  /** Show context: cover art, eyebrow name and the "prefer this show" control. */
  podcast?: Podcast | null | undefined;
  preferred?: boolean | undefined;
  variant?: EpisodeCardVariant | undefined;
  /** Cover-art thumbnail. Show Details already names the show, so it opts out. */
  media?: boolean | undefined;
  detail?: EpisodeDetail | undefined;
  fallbackListenUrl?: string | null | undefined;
  /** Movies this episode covers, as relationship rows. */
  movieLinks?: MovieLink[] | undefined;
  /** Titles only, where movie ids are not available on this surface. */
  movieTitles?: string[] | undefined;
  relationshipModeration?: boolean | undefined;
  /** Poster art inside each movie relationship row. */
  relationshipPosters?: boolean | undefined;
  /** The single movie ↔ episode relationship this card sits under, if any. */
  moderatedMovie?: { id: string; title: string } | null | undefined;
  /**
   * "complete" means the card shows the episode's whole current link set and
   * the metadata needed to judge it — the condition for episode-level sign-off.
   */
  episodeContext?: "complete" | "partial" | undefined;
  admin?: { show: boolean; reviewed: boolean; retired: boolean } | undefined;
  /** Listened date, shown with the shared checked-calendar treatment. */
  consumedDate?: string | null | undefined;
  showBookmark?: boolean | undefined;
  showConsumed?: boolean | undefined;
  showRatingFooter?: boolean | undefined;
  /** Optional extra footer content (reserved slot). */
  userFooterSlot?: ReactNode | undefined;
}

const minutesLabel = (seconds: number | null) =>
  seconds ? `${Math.round(seconds / 60)} min` : null;

export function EpisodeCard({
  episode,
  podcast = null,
  preferred = false,
  variant = "detail",
  media = true,
  detail = EMPTY_EPISODE_DETAIL,
  fallbackListenUrl = null,
  movieLinks,
  movieTitles,
  relationshipModeration = false,
  relationshipPosters = false,
  moderatedMovie = null,
  episodeContext = "partial",
  admin,
  consumedDate = null,
  showBookmark = true,
  showConsumed = true,
  showRatingFooter = true,
  userFooterSlot,
}: EpisodeCardProps) {
  const prefs = usePrefs();
  const listening = prefs.listening[episode.slug] ?? "not_started";
  const saved = listenLaterSlugs(prefs).includes(episode.slug);
  const listenUrl = detail.listenUrl ?? fallbackListenUrl ?? podcast?.website_url ?? null;
  const complete = episodeContext === "complete";

  const meta = [
    episode.episode_number != null && variant === "detail" && !media
      ? `Episode ${episode.episode_number}`
      : null,
    episode.released_at ?? (variant === "detail" && !media ? "Date unknown" : null),
    variant === "detail" && !media
      ? episode.duration_seconds
        ? formatDuration(episode.duration_seconds)
        : null
      : minutesLabel(episode.duration_seconds),
  ].filter(Boolean) as string[];

  const showNameEyebrow = media && podcast;

  const controls = (
    <>
      {moderatedMovie ? (
        <RelationshipModeration
          episodeId={episode.id}
          movieId={moderatedMovie.id}
          movieTitle={moderatedMovie.title}
          episodeTitle={episode.title}
        />
      ) : null}
      {showConsumed ? (
        <MarkListenedButton episodeSlug={episode.slug} listening={listening} />
      ) : null}
      {showBookmark ? (
        <ListenLaterButton
          episodeSlug={episode.slug}
          episodeTitle={episode.title}
          saved={saved}
        />
      ) : null}
    </>
  );
  const controlSlots = Math.min(
    3,
    (moderatedMovie ? 2 : 0) + Number(showConsumed) + Number(showBookmark),
  ) as 1 | 2 | 3;

  return (
    <MediaCardFrame
      className="p-3"
      controls={controlSlots > 0 ? controls : undefined}
      media={
        media && podcast ? (
          <div className="flex w-12 flex-col items-center gap-1.5">
            <Link to="/podcasts/$slug" params={{ slug: podcast.slug }} className="w-full">
              <Artwork
                src={podcast.artwork_url}
                title={podcast.name}
                seed={podcast.slug}
                accent={podcast.accent}
                shape="circle"
                className="w-12 text-base"
              />
            </Link>
            <PreferShowButton slug={podcast.slug} name={podcast.name} preferred={preferred} />
          </div>
        ) : undefined
      }
      header={
        <>
          <CardHeader
            reserveRight={controlSlots}
            eyebrow={
              showNameEyebrow && podcast ? (
                <>
                  <Link
                    to="/podcasts/$slug"
                    params={{ slug: podcast.slug }}
                    className="hover:text-foreground"
                  >
                    {podcast.name}
                  </Link>
                  {preferred ? (
                    <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[10px] normal-case tracking-normal text-coral">
                      Preferred
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {meta.map((part, i) => (
                    <span key={part} className="flex items-center gap-x-2">
                      {i > 0 ? (
                        <span aria-hidden className="text-muted-foreground/60">
                          &bull;
                        </span>
                      ) : null}
                      <span>{part}</span>
                    </span>
                  ))}
                </span>
              )
            }
            title={episode.title}
          />
          {showNameEyebrow ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{meta.join(" · ")}</span>
              {consumedDate !== null ? <ConsumedDate date={consumedDate} /> : null}
            </p>
          ) : consumedDate !== null ? (
            <p className="mt-1">
              <ConsumedDate date={consumedDate} />
            </p>
          ) : null}
        </>
      }
      body={
        <>
          {variant === "detail" ? (
            <ExpandableText
              text={detail.description}
              className="mt-2 text-xs text-muted-foreground"
            />
          ) : null}
          <CardBody>
            {movieLinks && movieLinks.length > 0
              ? movieLinks.map((m) => (
                  <MovieLinkRow
                    key={m.id}
                    movie={m}
                    episodeId={episode.id}
                    episodeTitle={episode.title}
                    moderation={relationshipModeration}
                    poster={relationshipPosters}
                  />
                ))
              : movieLinks
                ? (
                    /* Pass U64 — status truth on the link-less line: why it is
                       empty, plus the way to fix it when it should not be. */
                    <div className="flex flex-wrap items-center gap-2">
                      <p>No movie linked yet</p>
                      {admin?.retired ? (
                        <span
                          title="Marked as not about a movie — retired from every review queue"
                          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold"
                        >
                          <Ban className="size-3" aria-hidden />
                          Not about a movie
                        </span>
                      ) : null}
                      {admin?.show && !admin.retired ? (
                        <span className="ml-auto">
                          <EpisodeAddMovieControl episodeId={episode.id} />
                        </span>
                      ) : null}
                    </div>
                  )
                : null}
            {movieTitles && movieTitles.length > 0 ? (
              <p className="line-clamp-2">Covers {movieTitles.join(", ")}</p>
            ) : null}
          </CardBody>
        </>
      }
      footer={
        <CardFooter
          trailing={
            admin?.show ? (
              <EpisodeAdminActions
                episodeId={episode.id}
                reviewed={admin.reviewed}
                retired={admin.retired}
                includeReview={complete}
                {...(complete && movieLinks
                  ? { linkedMovieIds: movieLinks.map((m) => m.id) }
                  : {})}
              />
            ) : undefined
          }
        >
          <ListenFooter
            listenUrl={listenUrl}
            sources={detail.sources}
            emphasis={variant === "detail" ? "primary" : "secondary"}
          />
        </CardFooter>
      }
      userFooter={
        <>
          {showRatingFooter ? (
            <EpisodeNotesFooter
              episodeSlug={episode.slug}
              rating={prefs.ratings[episode.slug] ?? null}
              listening={listening}
              quality={prefs.quality[episode.slug] ?? null}
              listenUrl={listenUrl}
            />
          ) : null}
          {userFooterSlot}
        </>
      }
    />
  );
}
