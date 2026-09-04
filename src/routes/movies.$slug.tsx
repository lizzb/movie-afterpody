import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BackLink } from "@/components/BackLink";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Heart,
  Star,
  Timer,
} from "lucide-react";
import { AddToListButton } from "@/components/AddToListButton";
import { AppShell } from "@/components/AppShell";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { ScorePill } from "@/components/ScorePill";
import { FlagMatchButton } from "@/components/FlagMatchButton";
import { EpisodeAdminActions } from "@/components/EpisodeAdminActions";
import { MarkListenedButton } from "@/components/MarkListenedButton";
import { PlatformBadges } from "@/components/PlatformBadges";
import { ExpandableText } from "@/components/ExpandableText";
import { EpisodeNotesFooter } from "@/components/EpisodeNotesFooter";
import { CardControls, CardFooter, CardHeader, CardShell } from "@/components/card/Card";
import { useEpisodeReviewStates } from "@/lib/episode-reviews";


import { useDiscovery, type EpisodeEntry } from "@/lib/discovery";
import { isUnrated, ratingLabel } from "@/lib/ratings";
import { prefsActions } from "@/lib/prefs";
import type { EpisodeRating, ListeningStatus, ProductionQuality } from "@/lib/types";

export const Route = createFileRoute("/movies/$slug")({
  head: ({ params }) => {
    const pretty = params.slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return {
      meta: [
        { title: `${pretty} — Movie Afterparty` },
        {
          name: "description",
          content: `Streaming availability, Commentary Score and every commentary podcast episode about ${pretty}.`,
        },
        { property: "og:title", content: `${pretty} — Movie Afterparty` },
        {
          property: "og:description",
          content: `Every commentary podcast episode about ${pretty}, ranked for you.`,
        },
        { property: "og:type", content: "video.movie" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: MovieDetailPage,
});


const minutes = (seconds: number | null) => (seconds ? `${Math.round(seconds / 60)} min` : null);

/** Plain-English freshness so a wrong badge can be told from stale data. */
function checkedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "about a month ago" : `about ${months} months ago`;
}

/** Third-party ratings arrive with ingestion; the slots stay hidden until then. */
type ExternalRatings = { imdb?: number | null; rottenTomatoes?: number | null };

function MovieDetailPage() {
  const { slug } = Route.useParams();
  const { entries, prefs, isLoading } = useDiscovery();
  const entry = entries.find((e) => e.movie.slug === slug);
  const [notesOpen, setNotesOpen] = useState(false);
  const reviewStates = useEpisodeReviewStates(entry?.episodes.map((ep) => ep.episode.id) ?? []);


  if (isLoading) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </main>
      </AppShell>
    );
  }

  if (!entry) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">We don&rsquo;t have that movie yet</h1>
          <Link to="/movies" className="mt-4 inline-block text-sm font-semibold text-coral">
            Back to all movies
          </Link>
        </main>
      </AppShell>
    );
  }

  const { movie, score, genres, services, rentBuyServices, episodes, watched } = entry;
  const external = movie as typeof movie & ExternalRatings;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <BackLink fallbackTo="/movies" fallbackLabel="Movies" />

        {/* Poster left, movie properties right, our own score set apart top-right. */}
        <header className="mt-3 flex items-start gap-4">
          <Artwork
            src={movie.poster_url}
            title={movie.title}
            seed={movie.slug}
            accent={movie.accent}
            className="w-24 text-3xl shadow-poster sm:w-32"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 font-display text-xl font-bold leading-tight sm:text-2xl">
                {movie.title}
                {movie.release_year ? (
                  <span className="font-normal text-muted-foreground"> ({movie.release_year})</span>
                ) : null}
              </h1>
              <span className="shrink-0">
                <ScorePill value={score.score} large />
              </span>
            </div>

            <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
              {movie.runtime_minutes ? (
                <div className="inline-flex items-center gap-1">
                  <Timer className="size-3.5" aria-hidden />
                  <dt className="sr-only">Runtime</dt>
                  <dd>{movie.runtime_minutes} min</dd>
                </div>
              ) : null}
              {movie.release_year ? (
                <div className="inline-flex items-center gap-1">
                  <dt className="sr-only">Year</dt>
                  <dd>{movie.release_year}</dd>
                </div>
              ) : null}
              <div className="inline-flex items-center gap-1">
                <dt className="sr-only">Content rating</dt>
                <dd
                  title={
                    isUnrated(movie.certification)
                      ? "No content rating on file"
                      : `Rated ${movie.certification}`
                  }
                  className="rounded-full border border-border px-1.5 text-[10px] font-bold"
                >
                  {ratingLabel(movie.certification)}
                </dd>
              </div>
              {external.imdb != null ? (
                <div className="inline-flex items-center gap-1 text-gold">
                  <Star className="size-3.5" aria-hidden />
                  <dt className="sr-only">IMDb rating</dt>
                  <dd>{external.imdb.toFixed(1)}</dd>
                </div>
              ) : null}
              {external.rottenTomatoes != null ? (
                <div className="inline-flex items-center gap-1 text-berry">
                  <dt className="sr-only">Rotten Tomatoes</dt>
                  <dd>RT {external.rottenTomatoes}%</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Synopsis, full width */}
        {movie.synopsis ? (
          <p className="mt-4 text-sm leading-relaxed">{movie.synopsis}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">{score.explanation}</p>

        {/* Availability left, actions right */}
        <section className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {services.length > 0 ? (
              services.map((s) => (
                <BrandBadge key={s.id} slug={s.slug} label={s.name} active />
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {rentBuyServices.length > 0
                  ? "Not included with any subscription."
                  : "No streaming availability catalogued."}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-stretch overflow-hidden rounded-full border border-border">
              <button
                type="button"
                onClick={() => {
                  prefsActions.toggleWatched(movie.slug, !watched);
                  toast(watched ? `Marked as not watched: ${movie.title}` : `Mark as watched: ${movie.title}`, {
                    action: {
                      label: "Undo",
                      onClick: () => prefsActions.toggleWatched(movie.slug, watched),
                    },
                  });
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition-colors ${
                  watched
                    ? "bg-teal text-primary-foreground"
                    : "bg-card text-foreground hover:bg-secondary"
                }`}
              >
                <Check className="size-4" aria-hidden />
                {watched ? "Watched" : "Mark watched"}
              </button>
              <button
                type="button"
                aria-label="Add notes and tags"
                aria-expanded={notesOpen}
                onClick={() => setNotesOpen((v) => !v)}
                className="border-l border-border bg-card px-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="size-4" aria-hidden />
              </button>
            </div>
            <AddToListButton movieSlug={movie.slug} movieTitle={movie.title} variant="button" />
          </div>
        </section>

        {rentBuyServices.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold">Rent or buy only:</span>
            {rentBuyServices.map((s) => (
              <span key={s.id} className="rounded-full bg-secondary px-2 py-0.5">
                {s.name}
              </span>
            ))}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {movie.availability_checked_at
            ? `Availability checked ${checkedAgo(movie.availability_checked_at)}.`
            : "Availability has never been checked for this title."}
        </p>

        {notesOpen ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">
              Tags and notes land here soon — things like &ldquo;so bad it&rsquo;s good&rdquo; or
              &ldquo;good girls night&rdquo;.
            </p>
            <input
              disabled
              placeholder="Add a tag (coming soon)"
              className="mt-2 w-full rounded-full border border-border bg-background px-3 py-1.5 text-xs"
            />
          </div>
        ) : null}

        <section className="mt-7">
          <h2 className="font-display text-lg font-bold">
            Podcast Episodes <span className="text-muted-foreground">({episodes.length})</span>
          </h2>
          {episodes.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No podcast has covered this one yet. Great movie night, quiet afterparty.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {episodes.map((ep) => (
                <EpisodeRow
                  key={ep.episode.id}
                  entry={ep}
                  movieId={movie.id}
                  showReview={reviewStates.isAdmin}
                  reviewed={reviewStates.reviews[ep.episode.id]?.reviewed ?? false}
                  retired={reviewStates.reviews[ep.episode.id]?.retired ?? false}
                  rating={prefs.ratings[ep.episode.slug] ?? null}
                  listening={prefs.listening[ep.episode.slug] ?? "not_started"}
                  quality={prefs.quality[ep.episode.slug] ?? null}
                />
              ))}
            </ul>

          )}
        </section>
      </main>
    </AppShell>
  );
}

/**
 * Pass K5 — movie-detail episode card, built on the shared card grammar:
 * circular cover with a "prefer show" heart beneath, small-caps show name over
 * the episode title, flag + mark-listened upper right, date/duration subheader,
 * 2-line description with expand, footer = Listen then platform badges with
 * admin actions trailing, and an expand-collapse rating footer.
 */
function EpisodeRow({
  entry,
  movieId,
  showReview,
  reviewed,
  retired,
  rating,
  listening,
  quality,
}: {
  entry: EpisodeEntry;
  movieId: string;
  showReview: boolean;
  reviewed: boolean;
  retired: boolean;
  rating: EpisodeRating | null;
  listening: ListeningStatus;
  quality: ProductionQuality | null;
}) {
  const { episode, podcast, preferred, listenUrl, sources, alsoCovers } = entry;

  return (
    <CardShell className="p-3">
      <CardControls>
        <FlagMatchButton episodeId={episode.id} movieId={movieId} />
        <MarkListenedButton episodeSlug={episode.slug} listening={listening} />
      </CardControls>

      <div className="flex items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1.5">
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
          <button
            type="button"
            onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
            aria-pressed={preferred}
            aria-label={preferred ? `Unfollow ${podcast.name}` : `Prefer ${podcast.name}`}
            title={preferred ? `Unfollow ${podcast.name}` : `Prefer ${podcast.name}`}
            className={`grid size-7 place-items-center rounded-full border transition-colors ${
              preferred
                ? "border-transparent bg-berry text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <CardHeader
            reserveRight
            eyebrow={
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
            }
            title={episode.title}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {[episode.released_at, minutes(episode.duration_seconds)].filter(Boolean).join(" · ")}
            {alsoCovers.length > 0 ? ` · also covers ${alsoCovers.join(", ")}` : ""}
          </p>
          <ExpandableText text={episode.description} className="mt-1.5 text-xs text-muted-foreground" />
        </div>
      </div>

      <CardFooter
        trailing={
          showReview ? (
            <EpisodeAdminActions episodeId={episode.id} reviewed={reviewed} retired={retired} />
          ) : null
        }
      >
        {listenUrl ? (
          <a
            href={listenUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
          >
            Listen
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        <PlatformBadges sources={sources} exclude={listenUrl} />
      </CardFooter>

      <EpisodeNotesFooter
        episodeSlug={episode.slug}
        rating={rating}
        listening={listening}
        quality={quality}
        listenUrl={listenUrl}
      />
    </CardShell>
  );
}

