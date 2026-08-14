import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Heart, Mic, Search, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { accentFor, accentSoft, accentSolid, toAccent } from "@/lib/accents";
import { usePodcasts, type PodcastEntry } from "@/lib/podcasts";
import { prefsActions } from "@/lib/prefs";

export const Route = createFileRoute("/podcasts/")({
  head: () => ({
    meta: [
      { title: "Discover commentary podcasts — Movie Afterparty" },
      {
        name: "description",
        content:
          "Commentary podcasts ranked by how many of the movies they cover you can actually stream tonight.",
      },
      { property: "og:title", content: "Discover commentary podcasts — Movie Afterparty" },
      {
        property: "og:description",
        content: "Ranked podcast discovery based on your streaming services and taste.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PodcastsPage,
});

type Mode = "all" | "streamable" | "preferred";

const MODES: { value: Mode; label: string }[] = [
  { value: "all", label: "All shows" },
  { value: "streamable", label: "Watchable tonight" },
  { value: "preferred", label: "My shows" },
];

function PodcastsPage() {
  const { podcastEntries, isLoading } = usePodcasts();
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<Mode>("all");

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return podcastEntries.filter((e) => {
      if (needle && !e.podcast.name.toLowerCase().includes(needle)) return false;
      if (mode === "streamable" && e.streamableUnwatched.length === 0) return false;
      if (mode === "preferred" && !e.preferred) return false;
      return true;
    });
  }, [podcastEntries, term, mode]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <header className="mb-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Mic className="size-3.5" aria-hidden />
            Discover
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight">Shows worth subscribing to.</h1>
          <p className="mt-3 text-muted-foreground">
            Ranked by how many movies each show covers that are on your services and still unwatched.
          </p>
        </header>

        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search podcasts"
            aria-label="Search podcasts"
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm shadow-card"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter podcasts">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === m.value
                  ? "bg-navy text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : results.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No shows match. Try &ldquo;All shows&rdquo;, or{" "}
            <Link to="/settings" className="font-semibold text-coral">
              add a streaming service
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {results.map((entry) => (
              <PodcastCard key={entry.podcast.id} entry={entry} />
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

function PodcastCard({ entry }: { entry: PodcastEntry }) {
  const { podcast, preferred, matchScore, streamableUnwatched, movies, metric, episodeCount } = entry;
  const accent = toAccent(podcast.accent ?? accentFor(podcast.slug));

  return (
    <li className="rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg">
      <div className="flex items-start gap-4 p-4">
        <Link
          to="/podcasts/$slug"
          params={{ slug: podcast.slug }}
          className="flex min-w-0 flex-1 items-start gap-4"
        >
          <div
            className={`flex size-16 shrink-0 items-center justify-center rounded-xl font-display text-2xl ${accentSolid(accent)}`}
            aria-hidden
          >
            {podcast.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-snug">{podcast.name}</h2>
            {podcast.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{podcast.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${accentSoft(accent)}`}>
                Match {matchScore}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                {streamableUnwatched.length} to watch tonight
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                {movies.length} movie{movies.length === 1 ? "" : "s"} · {episodeCount} episode
                {episodeCount === 1 ? "" : "s"}
              </span>
              {metric?.rating != null ? (
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-navy">
                  <Star className="mr-1 inline size-3" aria-hidden />
                  {metric.rating.toFixed(1)}
                </span>
              ) : null}
            </div>

            {streamableUnwatched.length > 0 ? (
              <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                {streamableUnwatched
                  .slice(0, 3)
                  .map((m) => m.entry.movie.title)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </Link>

        <button
          type="button"
          onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
          aria-pressed={preferred}
          aria-label={preferred ? `Unfollow ${podcast.name}` : `Prefer ${podcast.name}`}
          className={`shrink-0 rounded-full border p-2 transition-colors ${
            preferred
              ? "border-transparent bg-berry text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
