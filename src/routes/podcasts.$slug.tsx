import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Heart, Search, Star } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { AppShell } from "@/components/AppShell";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { ViewToggle } from "@/components/ViewToggle";
import { FlagMatchButton } from "@/components/FlagMatchButton";
import { ConfirmMatchButton } from "@/components/ConfirmMatchButton";
import { EpisodeAdminActions } from "@/components/EpisodeAdminActions";
import { MarkListenedButton } from "@/components/MarkListenedButton";
import { PlatformBadges } from "@/components/PlatformBadges";
import { EpisodeNotesFooter } from "@/components/EpisodeNotesFooter";
import { ExpandableText } from "@/components/ExpandableText";
import {
  CardBody,
  CardBodyRow,
  CardControls,
  CardFooter,
  CardHeader,
  CardShell,
} from "@/components/card/Card";
import { useEpisodeReviewStates } from "@/lib/episode-reviews";
import { useEpisodeDetails, EMPTY_EPISODE_DETAIL, type EpisodeDetail } from "@/lib/details";

import type { PodcastEpisodeRow, PodcastMovie } from "@/lib/podcast-entries";
import { useShowDetail } from "@/lib/server-lists";
import { prefsActions, usePrefs, type ViewMode } from "@/lib/prefs";


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

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

/**
 * Consumer-facing recency line, from the episodes already on this page.
 * Recent shows a day ("August 24"); older shows a month ("February 2026").
 */
function lastEpisodeText(rows: PodcastEpisodeRow[]): string | null {
  let newest: number | null = null;
  for (const row of rows) {
    const at = row.episode.released_at ? Date.parse(row.episode.released_at) : NaN;
    if (!Number.isNaN(at) && (newest === null || at > newest)) newest = at;
  }
  if (newest === null) return null;
  const recent = Date.now() - newest < SIX_MONTHS_MS;
  const date = new Date(newest).toLocaleDateString("en-US",
    recent ? { month: "long", day: "numeric" } : { month: "long", year: "numeric" },
  );
  return `Last episode: ${date}`;
}


function PodcastDetailPage() {
  const { slug } = Route.useParams();
  const prefs = usePrefs();
  // Pass L2b — this show's page is assembled on the server; only this show's
  // episodes and covered movies are transferred.
  const { detail, isLoading } = useShowDetail(slug);
  const view = prefs.viewModes["podcast-detail"] ?? "rows";
  const reviewStates = useEpisodeReviewStates(
    detail?.allEpisodes.map((row) => row.episode.id) ?? [],
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

  if (!detail) {
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
    movieCount,
    streamable: streamableUnwatched,
    streamableTotal,
    rest,
    restTotal,
    metric,
    episodeCount,
    allEpisodes,
    reasons,
    links,
  } = detail;

  const lastEpisodeLabel = lastEpisodeText(allEpisodes);

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
                {movieCount} movie{movieCount === 1 ? "" : "s"}
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
              {lastEpisodeLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{lastEpisodeLabel}</span>
                </>
              ) : null}
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
              Watchable tonight <span className="text-muted-foreground">({streamableTotal})</span>
            </h2>
            <ViewToggle surface="podcast-detail" value={view} />
          </div>
          {streamableTotal === 0 ? (
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

        {restTotal > 0 ? (
          <section className="mt-7">
            <h2 className="font-display text-lg font-bold">
              Also covered <span className="text-muted-foreground">({restTotal})</span>
            </h2>
            <CoveredList items={rest} view={view} />
          </section>
        ) : null}

        <EpisodeFeed
          rows={allEpisodes}
          reviewStates={reviewStates}
          fallbackListenUrl={podcast.website_url ?? null}
        />

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
  fallbackListenUrl,
}: {
  rows: PodcastEpisodeRow[];
  reviewStates: ReturnType<typeof useEpisodeReviewStates>;
  fallbackListenUrl: string | null;
}) {
  const [search, setSearch] = useState("");
  const [match, setMatch] = useState<MatchFilter>("all");
  const [review, setReview] = useState<ReviewFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [limit, setLimit] = useState(150);

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

  // Pass L2a — descriptions and listen links load for the rows on screen only.
  const onScreen = visible.slice(0, limit);
  const { details } = useEpisodeDetails(onScreen.map((r) => r.episode.id));

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
        <ol className="mt-3 space-y-2.5">
          {onScreen.map((row) => (
            <PodcastEpisodeCard
              key={row.episode.id}
              row={row}
              detail={details[row.episode.id] ?? EMPTY_EPISODE_DETAIL}
              fallbackListenUrl={fallbackListenUrl}
              showReview={reviewStates.isAdmin}
              reviewed={reviewStates.reviews[row.episode.id]?.reviewed ?? false}
              retired={reviewStates.reviews[row.episode.id]?.retired ?? false}
            />
          ))}
        </ol>
      )}
      {limit < visible.length ? (
        <button type="button" onClick={() => setLimit((n) => n + 150)} className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground">
          Show 150 more <span className="text-muted-foreground">({visible.length - limit} remaining)</span>
        </button>
      ) : null}
    </section>
  );
}

/**
 * Pass K6 — podcast-page episode card: small-caps date over the episode title,
 * mark-listened upper right, duration subheader, one body row per linked movie
 * with the shared circular flag control, Listen + platform badges in the footer
 * with admin actions trailing, and the same rating footer as the movie page.
 */
function PodcastEpisodeCard({
  row,
  detail,
  fallbackListenUrl,
  showReview,
  reviewed,
  retired,
}: {
  row: PodcastEpisodeRow;
  detail: EpisodeDetail;
  fallbackListenUrl: string | null;
  showReview: boolean;
  reviewed: boolean;
  retired: boolean;
}) {
  const prefs = usePrefs();
  const { episode, movies: linked } = row;
  const listenUrl = detail.listenUrl ?? fallbackListenUrl;
  const sources = detail.sources;
  const listening = prefs.listening[episode.slug] ?? "not_started";

  const meta: string[] = [];
  if (episode.episode_number != null) meta.push(`Episode ${episode.episode_number}`);
  meta.push(episode.released_at ?? "Date unknown");
  if (episode.duration_seconds) meta.push(`${Math.round(episode.duration_seconds / 60)} min`);

  return (
    <CardShell className="p-3">
      <CardControls>
        <MarkListenedButton episodeSlug={episode.slug} listening={listening} />
      </CardControls>

      <CardHeader
        reserveRight
        eyebrow={
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
        }
        title={episode.title}
      />

      <ExpandableText text={detail.description} className="mt-2 text-xs text-muted-foreground" />

      <CardBody>
        {linked.length > 0 ? (
          linked.map((m) => (
            <CardBodyRow
              key={m.id}
              control={
                <span className="flex items-center gap-1.5">
                  <ConfirmMatchButton episodeId={episode.id} movieId={m.id} />
                  <FlagMatchButton episodeId={episode.id} movieId={m.id} />
                </span>
              }
            >
              <Link
                to="/movies/$slug"
                params={{ slug: m.slug }}
                className="flex min-w-0 items-center gap-2 font-semibold text-foreground hover:text-coral"
              >
                <Artwork
                  src={m.poster_url}
                  title={m.title}
                  seed={m.slug}
                  accent={m.accent}
                  className="w-8 shrink-0 text-[10px]"
                />
                <span className="line-clamp-1 min-w-0">
                  {m.title}
                  {m.release_year ? (
                    <span className="font-normal text-muted-foreground"> ({m.release_year})</span>
                  ) : null}
                </span>
              </Link>
            </CardBodyRow>
          ))
        ) : (
          <p>No movie linked yet</p>
        )}
      </CardBody>


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
        rating={prefs.ratings[episode.slug] ?? null}
        listening={listening}
        quality={prefs.quality[episode.slug] ?? null}
        listenUrl={listenUrl}
      />
    </CardShell>
  );
}



function CoveredList({ items, view }: { items: PodcastMovie[]; view: ViewMode }) {
  const [limit, setLimit] = useState(70);
  const visible = items.slice(0, limit);
  return (
    <>
      <ul className={view === "tiles" ? "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "mt-3 space-y-2.5"}>
        {visible.map((m) => <CoveredMovie key={m.entry.movie.id} item={m} view={view} />)}
      </ul>
      {visible.length < items.length ? (
        <button type="button" onClick={() => setLimit((n) => n + 70)} className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground">
          Show 70 more <span className="text-muted-foreground">({items.length - visible.length} remaining)</span>
        </button>
      ) : null}
    </>
  );
}

/** Pass K4 — podcast-page movie card built on the shared K2 primitives. */
function CoveredMovie({ item, view }: { item: PodcastMovie; view: ViewMode }) {
  const { movie, services, watched, onMyServices, genres } = item.entry;

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
    <CardShell className="p-3">
      <div className="flex items-start gap-3">
        <Link to="/movies/$slug" params={{ slug: movie.slug }} className="shrink-0">
          <Artwork
            src={movie.poster_url}
            title={movie.title}
            seed={movie.slug}
            accent={movie.accent}
            className="w-14 text-base"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to="/movies/$slug" params={{ slug: movie.slug }} className="block">
            <CardHeader title={movie.title} h2={movie.release_year ?? undefined} />
          </Link>

          <CardBody>
            {item.episodes.map((ep) => (
              <CardBodyRow
                key={ep.id}
                control={
                  <span className="flex items-center gap-1.5">
                    <ConfirmMatchButton episodeId={ep.id} movieId={movie.id} />
                    <FlagMatchButton episodeId={ep.id} movieId={movie.id} />
                  </span>
                }
              >
                <span className="line-clamp-2">
                  {ep.released_at ? `${ep.released_at}: ` : ""}
                  {ep.title}
                  {ep.duration_seconds ? ` (${formatDuration(ep.duration_seconds)})` : ""}
                </span>
              </CardBodyRow>
            ))}
          </CardBody>

          <CardFooter>
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
            <span className="text-[11px] text-muted-foreground">
              {genres.map((g) => g.name).join(" · ") || "Uncategorised"}
            </span>
            {watched ? <span className="text-[11px] font-semibold text-teal">Watched</span> : null}
          </CardFooter>
        </div>
      </div>
    </CardShell>
  );
}

/** "1h 42m" / "42m" for episode durations. */
export function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
