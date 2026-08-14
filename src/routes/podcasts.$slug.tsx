import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Heart, Popcorn, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { accentFor, accentSoft, accentSolid, toAccent } from "@/lib/accents";
import { usePodcasts, type PodcastMovie } from "@/lib/podcasts";
import { prefsActions } from "@/lib/prefs";

export const Route = createFileRoute("/podcasts/$slug")({
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
          content: `Every movie ${pretty} has covered, which ones you can stream tonight, and the episodes to play after.`,
        },
        { property: "og:title", content: `${pretty} — Movie Afterparty` },
        {
          property: "og:description",
          content: `Movies covered by ${pretty} that are on your streaming services.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: PodcastDetailPage,
});

function PodcastDetailPage() {
  const { slug } = Route.useParams();
  const { podcastEntries, isLoading } = usePodcasts();
  const entry = podcastEntries.find((e) => e.podcast.slug === slug);

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
          <h1 className="font-display text-2xl">We don&rsquo;t have that podcast yet</h1>
          <Link to="/podcasts" className="mt-4 inline-block text-sm font-semibold text-coral">
            Back to discover
          </Link>
        </main>
      </AppShell>
    );
  }

  const { podcast, preferred, matchScore, movies, streamableUnwatched, metric, episodeCount, reasons } =
    entry;
  const accent = toAccent(podcast.accent ?? accentFor(podcast.slug));
  const rest = movies.filter((m) => !streamableUnwatched.includes(m));

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6">
        <Link
          to="/podcasts"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Discover
        </Link>

        <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className={`flex size-24 shrink-0 items-center justify-center rounded-2xl font-display text-4xl ${accentSolid(accent)}`}
            aria-hidden
          >
            {podcast.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl leading-tight">{podcast.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${accentSoft(accent)}`}>
                <Popcorn className="mr-1 inline size-3" aria-hidden />
                Match {matchScore}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                {episodeCount} episode{episodeCount === 1 ? "" : "s"} · {movies.length} movie
                {movies.length === 1 ? "" : "s"}
              </span>
              {metric?.rating != null ? (
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-navy">
                  <Star className="mr-1 inline size-3" aria-hidden />
                  {metric.rating.toFixed(1)}
                  {metric.rating_count ? ` (${metric.rating_count.toLocaleString()})` : ""}
                </span>
              ) : null}
            </div>
            {reasons.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{reasons.join(" · ")}</p>
            ) : null}
          </div>
        </header>

        {podcast.description ? <p className="mt-5 leading-relaxed">{podcast.description}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
            aria-pressed={preferred}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              preferred
                ? "bg-berry text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <Heart className="size-4" aria-hidden />
            {preferred ? "Preferred show" : "Prefer this show"}
          </button>
          {podcast.website_url ? (
            <a
              href={podcast.website_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-sm font-semibold text-primary-foreground"
            >
              <ExternalLink className="size-4" aria-hidden />
              Website
            </a>
          ) : null}
        </div>

        <section className="mt-8">
          <h2 className="font-display text-2xl">
            Watchable tonight <span className="text-muted-foreground">({streamableUnwatched.length})</span>
          </h2>
          {streamableUnwatched.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing this show covers is unwatched on your services.{" "}
              <Link to="/settings" className="font-semibold text-coral">
                Adjust your services
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {streamableUnwatched.map((m) => (
                <CoveredMovie key={m.entry.movie.id} item={m} />
              ))}
            </ul>
          )}
        </section>

        {rest.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-2xl">
              Also covered <span className="text-muted-foreground">({rest.length})</span>
            </h2>
            <ul className="mt-4 space-y-3">
              {rest.map((m) => (
                <CoveredMovie key={m.entry.movie.id} item={m} />
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function CoveredMovie({ item }: { item: PodcastMovie }) {
  const { movie, services, watched, onMyServices } = item.entry;
  const accent = toAccent(movie.accent ?? accentFor(movie.slug));

  return (
    <li className="rounded-2xl border border-border bg-card shadow-card">
      <Link
        to="/movies/$slug"
        params={{ slug: movie.slug }}
        className="flex items-start gap-4 p-4"
      >
        <div
          className={`flex size-14 shrink-0 items-center justify-center rounded-xl font-display text-xl ${accentSolid(accent)}`}
          aria-hidden
        >
          {movie.title.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-snug">
            {movie.title}
            {movie.release_year ? (
              <span className="text-muted-foreground"> ({movie.release_year})</span>
            ) : null}
          </h3>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {item.episodes.map((ep) => (
              <li key={ep.id} className="line-clamp-1">
                {ep.title}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
            {services.length > 0 ? (
              <span className={onMyServices ? "text-teal" : "text-muted-foreground"}>
                {services.map((s) => s.short_name).join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground">No streaming availability</span>
            )}
            {watched ? <span className="text-muted-foreground">· Watched</span> : null}
          </p>
        </div>
      </Link>
    </li>
  );
}
