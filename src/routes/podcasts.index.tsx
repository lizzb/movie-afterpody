import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Mic, Search, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CatalogAddCard } from "@/components/CatalogAddCard";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { ViewToggle } from "@/components/ViewToggle";
import type { PodcastSummary } from "@/lib/podcast-entries";
import { useShowPage } from "@/lib/server-lists";
import { prefsActions, usePrefs, type ViewMode } from "@/lib/prefs";

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
  const prefs = usePrefs();
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [limit, setLimit] = useState(30);
  const view = prefs.viewModes["podcasts"] ?? "rows";

  // Pass L2b — ranked and filtered on the server across every active show,
  // against the live taste profile so services and hearts always apply.
  const { rows: results, total, isLoading } = useShowPage({ term, mode, limit });

  useEffect(() => {
    setLimit(30);
  }, [term, mode]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <div className="mb-3">
          <PageHeader icon={Mic} eyebrow="Shows" title="Browse all podcasts" />
        </div>

        <div className="flex items-center gap-2">
          <label className="relative block flex-1">
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
          <ViewToggle surface="podcasts" value={view} />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Filter podcasts">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                mode === m.value
                  ? "border-transparent bg-coral-soft text-coral neon"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ul className="mt-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : results.length === 0 ? (
          term.trim() ? (
            <CatalogAddCard kind="podcast" term={term.trim()} />
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No shows match. Try &ldquo;All shows&rdquo;, or{" "}
              <Link to="/settings" className="font-semibold text-coral">
                add a streaming service
              </Link>
              .
            </p>
          )
        ) : (
          <>
            <ul
              className={
                view === "tiles"
                  ? "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                  : "mt-4 space-y-2.5"
              }
            >
              {results.map((entry) => (
                <PodcastCard
                  key={entry.podcast.id}
                  entry={entry}
                  view={view}
                  preferred={prefs.preferredPodcastSlugs.includes(entry.podcast.slug)}
                />
              ))}
            </ul>
            {results.length < total ? (
              <button
                type="button"
                onClick={() => setLimit((n) => n + 30)}
                className="mt-4 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground"
              >
                Show 30 more{" "}
                <span className="text-muted-foreground">({total - results.length} remaining)</span>
              </button>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}

function PodcastCard({ entry, view }: { entry: PodcastSummary; view: ViewMode }) {
  const {
    podcast,
    preferred,
    matchScore,
    streamableCount,
    movieCount,
    metric,
    episodeCount,
    links,
  } = entry;

  if (view === "tiles") {
    return (
      <li>
        <Link to="/podcasts/$slug" params={{ slug: podcast.slug }} className="block">
          <Artwork
            src={podcast.artwork_url}
            title={podcast.name}
            seed={podcast.slug}
            accent={podcast.accent}
            shape="cover"
            className="w-full text-3xl shadow-poster"
          />
          <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{podcast.name}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Match {matchScore} · {streamableCount} tonight
          </p>
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg">
      <div className="flex items-start gap-3 p-3">
        <Link
          to="/podcasts/$slug"
          params={{ slug: podcast.slug }}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <Artwork
            src={podcast.artwork_url}
            title={podcast.name}
            seed={podcast.slug}
            accent={podcast.accent}
            shape="cover"
            className="w-14 text-lg"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold leading-snug">{podcast.name}</h2>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full bg-coral-soft px-2 py-1 text-coral">
                Match {matchScore}
              </span>
              <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                {streamableCount} tonight
              </span>
              <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                {movieCount} movie{movieCount === 1 ? "" : "s"} · {episodeCount} ep
              </span>
              {metric?.rating != null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-1 text-gold">
                  <Star className="size-3" aria-hidden />
                  {metric.rating.toFixed(1)}
                </span>
              ) : null}
            </div>

            {podcast.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {podcast.description}
              </p>
            ) : null}

            {links.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {links.map((l) => (
                  <BrandBadge
                    key={`${l.podcast_id}-${l.platform}`}
                    slug={l.platform}
                    label={l.platform}
                    showLabel={false}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Link>

        <button
          type="button"
          onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
          aria-pressed={preferred}
          aria-label={preferred ? `Unfollow ${podcast.name}` : `Prefer ${podcast.name}`}
          className={`-m-1 shrink-0 p-2 transition-colors ${
            preferred ? "text-berry" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="size-5" fill={preferred ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>
    </li>
  );
}
