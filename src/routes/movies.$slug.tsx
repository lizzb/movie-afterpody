import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink, Heart, Popcorn, Timer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { accentFor, accentSoft, accentSolid, toAccent } from "@/lib/accents";
import { useDiscovery, type EpisodeEntry } from "@/lib/discovery";
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

const RATINGS: { value: EpisodeRating; emoji: string; label: string }[] = [
  { value: "disliked", emoji: "😞", label: "Didn't like it" },
  { value: "meh", emoji: "😐", label: "It was fine" },
  { value: "loved", emoji: "😊", label: "Loved it" },
];

const LISTENING: { value: ListeningStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "started", label: "Started" },
  { value: "finished", label: "Finished" },
];

const QUALITY: { value: ProductionQuality; label: string }[] = [
  { value: "poor", label: "Rough audio" },
  { value: "okay", label: "Okay audio" },
  { value: "good", label: "Great audio" },
];

const minutes = (seconds: number | null) => (seconds ? `${Math.round(seconds / 60)} min` : null);

function MovieDetailPage() {
  const { slug } = Route.useParams();
  const { entries, prefs, isLoading } = useDiscovery();
  const entry = entries.find((e) => e.movie.slug === slug);

  if (isLoading) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </main>
      </AppShell>
    );
  }

  if (!entry) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
          <h1 className="font-display text-2xl">We don&rsquo;t have that movie yet</h1>
          <Link to="/movies" className="mt-4 inline-block text-sm font-semibold text-coral">
            Back to all movies
          </Link>
        </main>
      </AppShell>
    );
  }

  const { movie, score, genres, services, episodes, watched } = entry;
  const accent = toAccent(movie.accent ?? accentFor(movie.slug));

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Tonight
        </Link>

        <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className={`flex h-36 w-24 shrink-0 items-center justify-center rounded-2xl font-display text-4xl ${accentSolid(accent)}`}
            aria-hidden
          >
            {movie.title.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl leading-tight">
              {movie.title}
              {movie.release_year ? (
                <span className="text-muted-foreground"> ({movie.release_year})</span>
              ) : null}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
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
              {genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground"
                >
                  {g.name}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{score.explanation}</p>
          </div>
        </header>

        {movie.synopsis ? <p className="mt-5 leading-relaxed">{movie.synopsis}</p> : null}

        <section className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {services.length > 0 ? (
              services.map((s) => (
                <span key={s.id} className="rounded-full bg-navy-soft px-2.5 py-1 text-navy">
                  {s.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">No streaming availability catalogued.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => prefsActions.toggleWatched(movie.slug, !watched)}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              watched
                ? "bg-teal text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <Check className="size-4" aria-hidden />
            {watched ? "Watched" : "Mark watched"}
          </button>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl">
            Commentary episodes{" "}
            <span className="text-muted-foreground">({episodes.length})</span>
          </h2>
          {episodes.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No podcast has covered this one yet. Great movie night, quiet afterparty.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {episodes.map((ep) => (
                <EpisodeRow
                  key={ep.episode.id}
                  entry={ep}
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

function EpisodeRow({
  entry,
  rating,
  listening,
  quality,
}: {
  entry: EpisodeEntry;
  rating: EpisodeRating | null;
  listening: ListeningStatus;
  quality: ProductionQuality | null;
}) {
  const { episode, podcast, preferred, listenUrl, alsoCovers } = entry;
  const accent = toAccent(podcast.accent ?? accentFor(podcast.slug));

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-xl font-display text-lg ${accentSolid(accent)}`}
          aria-hidden
        >
          {podcast.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {podcast.name}
            {preferred ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] normal-case ${accentSoft(accent)}`}>
                Preferred
              </span>
            ) : null}
          </p>
          <h3 className="mt-1 font-semibold leading-snug">{episode.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {[episode.released_at, minutes(episode.duration_seconds)].filter(Boolean).join(" · ")}
            {alsoCovers.length > 0 ? ` · also covers ${alsoCovers.join(", ")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
          aria-pressed={preferred}
          aria-label={preferred ? `Unfollow ${podcast.name}` : `Prefer ${podcast.name}`}
          className={`rounded-full border p-2 transition-colors ${
            preferred ? "border-transparent bg-berry text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Rate this episode">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              title={r.label}
              aria-label={r.label}
              aria-pressed={rating === r.value}
              onClick={() => prefsActions.rateEpisode(episode.slug, rating === r.value ? null : r.value)}
              className={`rounded-full border px-2.5 py-1 text-base transition-all ${
                rating === r.value
                  ? "border-transparent bg-secondary scale-105"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>

        <select
          value={listening}
          onChange={(e) => prefsActions.setListening(episode.slug, e.target.value as ListeningStatus)}
          aria-label="Listening status"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        >
          {LISTENING.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          value={quality ?? ""}
          onChange={(e) =>
            prefsActions.setQuality(
              episode.slug,
              e.target.value === "" ? null : (e.target.value as ProductionQuality),
            )
          }
          aria-label="Production quality"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">Audio quality</option>
          {QUALITY.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>

        {listenUrl ? (
          <a
            href={listenUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Listen
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </li>
  );
}
