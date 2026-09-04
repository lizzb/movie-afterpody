import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Heart, Search, Star } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { AppShell } from "@/components/AppShell";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { ViewToggle } from "@/components/ViewToggle";
import { FlagMatchButton } from "@/components/FlagMatchButton";
import { EpisodeAdminActions } from "@/components/EpisodeAdminActions";
import { useEpisodeReviewStates } from "@/lib/episode-reviews";

import { usePodcasts, type PodcastEpisodeRow, type PodcastMovie } from "@/lib/podcasts";
import { prefsActions, type ViewMode } from "@/lib/prefs";

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

const prettyPlatform = (slug: string) =>
  slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

function PodcastDetailPage() {
  const { slug } = Route.useParams();
  const { podcastEntries, prefs, isLoading } = usePodcasts();
  const entry = podcastEntries.find((e) => e.podcast.slug === slug);
  const view = prefs.viewModes["podcast-detail"] ?? "rows";
  const reviewStates = useEpisodeReviewStates(
    entry?.allEpisodes.map((row) => row.episode.id) ?? [],
  );


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
          <h1 className="font-display text-2xl font-bold">We don&rsquo;t have that podcast yet</h1>
          <Link to="/podcasts" className="mt-4 inline-block text-sm font-semibold text-coral">
            Back to discover
          </Link>
        </main>
      </AppShell>
    );
  }

  const {
    podcast,
    preferred,
    matchScore,
    movies,
    streamableUnwatched,
    metric,
    episodeCount,
    allEpisodes,
    reasons,
    links,
  } = entry;
  const rest = movies.filter((m) => !streamableUnwatched.includes(m));

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <BackLink fallbackTo="/podcasts" fallbackLabel="Shows" />


        <header className="mt-3 flex items-start gap-4">
          <Artwork
            src={podcast.artwork_url}
            title={podcast.name}
            seed={podcast.slug}
            accent={podcast.accent}
            shape="cover"
            className="w-24 text-3xl shadow-poster sm:w-32"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 font-display text-xl font-bold leading-tight sm:text-2xl">
                {podcast.name}
              </h1>
              <span className="shrink-0 rounded-xl bg-primary px-2.5 py-1.5 text-center text-primary-foreground neon">
                <span className="block font-display text-lg font-bold leading-none">
                  {matchScore}
                </span>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.14em]">
                  Match
                </span>
              </span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {episodeCount} episode{episodeCount === 1 ? "" : "s"}
              </span>
              <span aria-hidden>·</span>
              <span>
                {movies.length} movie{movies.length === 1 ? "" : "s"}
              </span>
              {metric?.rating != null ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-gold">
                    <Star className="size-3" aria-hidden />
                    {metric.rating.toFixed(1)}
                    {metric.rating_count ? ` (${metric.rating_count.toLocaleString()})` : ""}
                  </span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="capitalize">{podcast.activity_status}</span>
            </p>
            {reasons.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{reasons.slice(0, 2).join(" · ")}</p>
            ) : null}
          </div>
        </header>

        {podcast.description ? (
          <p className="mt-4 text-sm leading-relaxed">{podcast.description}</p>
        ) : null}

        <section className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Listen on
            </span>
            {links.length > 0 ? (
              links.map((l) => (
                <BrandBadge
                  key={`${l.podcast_id}-${l.platform}`}
                  slug={l.platform}
                  label={prettyPlatform(l.platform)}
                  href={l.external_url}
                />
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">No listings catalogued</span>
            )}
            {podcast.website_url ? (
              <a
                href={podcast.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground hover:text-foreground"
              >
                <ExternalLink className="size-3" aria-hidden />
                Website
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
            aria-pressed={preferred}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              preferred
                ? "bg-berry text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <Heart className="size-4" aria-hidden />
            {preferred ? "Preferred show" : "Prefer this show"}
          </button>
        </section>

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">
              Watchable tonight{" "}
              <span className="text-muted-foreground">({streamableUnwatched.length})</span>
            </h2>
            <ViewToggle surface="podcast-detail" value={view} />
          </div>
          {streamableUnwatched.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing this show covers is unwatched on your services.{" "}
              <Link to="/settings" className="font-semibold text-coral">
                Adjust your services
              </Link>
              .
            </p>
          ) : (
            <CoveredList items={streamableUnwatched} view={view} />
          )}
        </section>

        {rest.length > 0 ? (
          <section className="mt-7">
            <h2 className="font-display text-lg font-bold">
              Also covered <span className="text-muted-foreground">({rest.length})</span>
            </h2>
            <CoveredList items={rest} view={view} />
          </section>
        ) : null}

        <EpisodeFeed rows={allEpisodes} reviewStates={reviewStates} />

      </main>
    </AppShell>
  );
}

type SortKey =
  | "newest"
  | "oldest"
  | "links-desc"
  | "links-asc"
  | "duration-desc"
  | "duration-asc"
  | "title-asc"
  | "title-desc";

const SORT_LABELS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "links-desc", label: "Most linked movies" },
  { value: "links-asc", label: "Fewest linked movies" },
  { value: "duration-desc", label: "Longest first" },
  { value: "duration-asc", label: "Shortest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

type MatchFilter = "all" | "matched" | "unmatched";
type ReviewFilter = "all" | "reviewed" | "unreviewed";

/** J3: the full episode feed with search, filter and sort controls. */
function EpisodeFeed({
  rows,
  reviewStates,
}: {
  rows: PodcastEpisodeRow[];
  reviewStates: ReturnType<typeof useEpisodeReviewStates>;
}) {
  const [search, setSearch] = useState("");
  const [match, setMatch] = useState<MatchFilter>("all");
  const [review, setReview] = useState<ReviewFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (q && !row.episode.title.toLowerCase().includes(q)) return false;
      if (match === "matched" && row.movies.length === 0) return false;
      if (match === "unmatched" && row.movies.length > 0) return false;
      if (review !== "all") {
        const reviewed = reviewStates.reviews[row.episode.id]?.reviewed ?? false;
        if (review === "reviewed" && !reviewed) return false;
        if (review === "unreviewed" && reviewed) return false;
      }
      return true;
    });

    const date = (r: PodcastEpisodeRow) => r.episode.released_at ?? "";
    const dur = (r: PodcastEpisodeRow) => r.episode.duration_seconds ?? 0;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return date(a).localeCompare(date(b));
        case "links-desc":
          return b.movies.length - a.movies.length || date(b).localeCompare(date(a));
        case "links-asc":
          return a.movies.length - b.movies.length || date(b).localeCompare(date(a));
        case "duration-desc":
          return dur(b) - dur(a);
        case "duration-asc":
          return dur(a) - dur(b);
        case "title-asc":
          return a.episode.title.localeCompare(b.episode.title);
        case "title-desc":
          return b.episode.title.localeCompare(a.episode.title);
        default:
          return date(b).localeCompare(date(a));
      }
    });
    return sorted;
  }, [rows, search, match, review, sort, reviewStates.reviews]);

  const chip = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-card text-muted-foreground hover:text-foreground"
    }`;

  return (
    <section className="mt-7">
      <h2 className="font-display text-lg font-bold">
        All episodes <span className="text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every episode we store, whether a movie is linked to it or not.
      </p>

      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search episode titles"
            aria-label="Search episode titles"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "All episodes"],
              ["matched", "Matched"],
              ["unmatched", "Unmatched"],
            ] as [MatchFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMatch(value)}
              aria-pressed={match === value}
              className={chip(match === value)}
            >
              {label}
            </button>
          ))}
        </div>

        {reviewStates.isAdmin ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "Any review state"],
                ["reviewed", "Reviewed"],
                ["unreviewed", "Unreviewed"],
              ] as [ReviewFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setReview(value)}
                aria-pressed={review === value}
                className={chip(review === value)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-foreground"
            >
              {SORT_LABELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
            {visible.length} of {rows.length} episode{rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No episodes stored for this show yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No episodes match these filters.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {visible.map(({ episode, movies: linked }) => (
            <li key={episode.id} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold leading-snug">{episode.title}</h3>
                {episode.released_at ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {episode.released_at}
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {linked.length > 0 ? (
                  linked.map((m) => (
                    <Link
                      key={m.id}
                      to="/movies/$slug"
                      params={{ slug: m.slug }}
                      className="rounded-full border border-border bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground hover:text-foreground"
                    >
                      {m.title}
                      {m.release_year ? ` (${m.release_year})` : ""}
                    </Link>
                  ))
                ) : (
                  <span className="text-muted-foreground">No movie linked yet</span>
                )}
                {reviewStates.isAdmin ? (
                  <EpisodeAdminActions
                    episodeId={episode.id}
                    reviewed={reviewStates.reviews[episode.id]?.reviewed ?? false}
                    retired={reviewStates.reviews[episode.id]?.retired ?? false}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}


function CoveredList({ items, view }: { items: PodcastMovie[]; view: ViewMode }) {
  return (
    <ul
      className={
        view === "tiles"
          ? "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          : "mt-3 space-y-2.5"
      }
    >
      {items.map((m) => (
        <CoveredMovie key={m.entry.movie.id} item={m} view={view} />
      ))}
    </ul>
  );
}

function CoveredMovie({ item, view }: { item: PodcastMovie; view: ViewMode }) {
  const { movie, services, watched, onMyServices } = item.entry;

  if (view === "tiles") {
    return (
      <li>
        <Link to="/movies/$slug" params={{ slug: movie.slug }} className="block">
          <Artwork
            src={movie.poster_url}
            title={movie.title}
            seed={movie.slug}
            accent={movie.accent}
            className="w-full text-3xl shadow-poster"
          />
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{movie.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {services.map((s) => (
              <BrandBadge
                key={s.id}
                slug={s.slug}
                label={s.short_name}
                active={onMyServices}
                showLabel={false}
              />
            ))}
          </div>
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-border bg-card shadow-card">
      <Link to="/movies/$slug" params={{ slug: movie.slug }} className="flex items-start gap-3 p-3">
        <Artwork
          src={movie.poster_url}
          title={movie.title}
          seed={movie.slug}
          accent={movie.accent}
          className="w-14 text-base"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold leading-snug">
            {movie.title}
            {movie.release_year ? (
              <span className="font-normal text-muted-foreground"> {movie.release_year}</span>
            ) : null}
          </h3>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {item.episodes.map((ep) => (
              <li key={ep.id} className="flex items-center gap-1">
                <span className="line-clamp-1 min-w-0 flex-1">{ep.title}</span>
                <FlagMatchButton episodeId={ep.id} movieId={movie.id} />

              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {services.length > 0 ? (
              services.map((s) => (
                <BrandBadge
                  key={s.id}
                  slug={s.slug}
                  label={s.short_name}
                  active={onMyServices}
                  showLabel={false}
                />
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">No streaming availability</span>
            )}
            {watched ? (
              <span className="text-[11px] font-semibold text-teal">Watched</span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
