import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MatchHistoryCard } from "@/components/admin/MatchHistoryCard";
import { MatchReviewCard } from "@/components/admin/MatchReviewCard";
import { CollapsibleCard } from "@/components/admin/CollapsibleCard";
import { useAuth } from "@/hooks/useAuth";

import {
  availabilityFreshness,
  backfillPodcastArtwork,
  bootstrapAdmin,
  enrichAllMovies,
  enrichMovie,
  ingestPodcast,
  listIngestionStats,
  listPodcastCoverage,
  listUnmatchedEpisodes,
  refreshAvailability,
  rescanEpisodeMatches,
  resolveEpisodesToMovies,
  setPodcastCuration,
} from "@/lib/ingestion.functions";

import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/admin/ingest")({
  head: () => ({
    meta: [
      { title: "Ingest — Movie Afterparty" },
      { name: "description", content: "Admin tools for importing real movie and podcast data." },
      { property: "og:title", content: "Ingest — Movie Afterparty" },
      { property: "og:description", content: "Admin tools for importing real movie and podcast data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IngestPage,
});

function useAdminStatus(enabled: boolean) {
  const fetchStats = useServerFn(listIngestionStats);
  return useQuery({
    queryKey: ["ingestion-stats"],
    queryFn: () => fetchStats({}),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

function IngestPage() {
  const { user, userId, loading: authLoading } = useAuth();
  const stats = useAdminStatus(Boolean(userId));
  const bootstrap = useServerFn(bootstrapAdmin);
  const bootstrapMutation = useMutation({
    mutationFn: bootstrap,
    onSuccess: () => stats.refetch(),
  });

  if (authLoading) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </main>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
          <h1 className="font-display text-3xl">Data ingestion</h1>
          <p className="mt-2 text-muted-foreground">Admin tools for pulling real movie and podcast data.</p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You are not signed in. Ingestion tools need an admin account.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground neon"
            >
              Sign in
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const isForbidden = stats.error && (stats.error as Error).message.toLowerCase().includes("forbidden");
  if (isForbidden) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
          <h1 className="font-display text-3xl">Data ingestion</h1>
          <p className="mt-2 text-muted-foreground">Admin tools for pulling real movie and podcast data.</p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">You are not an admin yet.</p>
            <button
              type="button"
              onClick={() => bootstrapMutation.mutate({})}
              disabled={bootstrapMutation.isPending}
              className="mt-4 inline-flex items-center rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {bootstrapMutation.isPending ? "Bootstrapping…" : "Make me the first admin"}
            </button>
            {bootstrapMutation.isError ? (
              <p className="mt-3 text-xs text-destructive">{(bootstrapMutation.error as Error).message}</p>
            ) : null}
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main id="admin-top" className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl">Data ingestion</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pull real metadata and episode links from TMDB and Podcast Index.
            </p>
          </div>
          <Link to="/settings" className="text-sm font-semibold text-coral">
            Back to setup
          </Link>
        </div>

        {stats.isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
        ) : stats.data ? (
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Movies"
              value={stats.data.movies}
              sub={`${stats.data.tmdbLinked} with TMDB data`}
              href="#add-movie"
            />
            <Stat label="Active shows" value={stats.data.podcasts} href="#coverage" />
            <Stat label="Parked shows" value={stats.data.parkedPodcasts} href="#coverage" />
            <Stat label="Episodes" value={stats.data.episodes} href="#coverage" />
            <Stat label="Flagged as wrong" value={stats.data.flagged} href="#match-review" />
            <Stat label="Links to review" value={stats.data.linksToReview} href="#match-review" />
            <Stat label="Episode → movie links" value={stats.data.links} href="#match-review" />
            <Stat
              label="Unmatched episodes"
              value={stats.data.unmatchedEpisodes}
              sub={`${stats.data.unmatchedEpisodesAll} incl. parked shows`}
              href="#unmatched-episodes"
            />
            <Stat
              label="Not about a movie"
              value={stats.data.retiredEpisodes}
              href="#unmatched-episodes"
            />
          </section>
        ) : null}

        <section className="mt-10 space-y-4">
          <MatchReviewCard onSuccess={() => stats.refetch()} />

          <CollapsibleCard
            id="match-history"
            title="Recent match decisions"
            description="Every approve, reject, unlink and confirm, with undo."
            storageKey="history"
          >
            <MatchHistoryCard onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard
            id="build-movies"
            title="Build movies from episodes"
            description="Extract movie titles from unmatched episodes and create them from TMDB."
            storageKey="resolve"
          >
            <ResolveEpisodesCard onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard
            id="unmatched-episodes"
            title="Unmatched episodes"
            description="Episodes with no movie attached, plus a recheck against existing movies."
            badge={
              stats.data
                ? `${stats.data.unmatchedEpisodes} active / ${stats.data.unmatchedEpisodesAll} all`
                : undefined
            }
            storageKey="unmatched"
          >
            <UnmatchedEpisodesCard />
          </CollapsibleCard>

          <CollapsibleCard
            id="coverage"
            title="Episode coverage & show curation"
            description="Coverage and progress per show; park shows you're not reviewing yet."
            storageKey="coverage"
          >
            <PodcastCoverageCard onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard id="enrich-movies" title="Enrich movies from TMDB" storageKey="enrich-all">
            <BulkEnrichCard onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard id="artwork" title="Backfill podcast cover art" storageKey="artwork">
            <BackfillArtworkCard onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard id="ingest-podcast" title="Ingest podcast" storageKey="ingest-podcast">
            <IngestPodcastForm onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard id="add-movie" title="Add movie from TMDB" storageKey="enrich-movie">
            <EnrichMovieForm onSuccess={() => stats.refetch()} />
          </CollapsibleCard>

          <CollapsibleCard id="availability" title="Streaming availability + genres" storageKey="availability">
            <RefreshAvailabilityForm onSuccess={() => stats.refetch()} />
          </CollapsibleCard>
        </section>



      </main>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{sub}</p> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        className="block rounded-2xl border border-border bg-card p-4 text-center transition-colors hover:border-primary"
      >
        {body}
      </a>
    );
  }
  return <div className="rounded-2xl border border-border bg-card p-4 text-center">{body}</div>;
}

function BulkEnrichCard({ onSuccess }: { onSuccess: () => void }) {
  const fn = useServerFn(enrichAllMovies);
  const mutation = useMutation({ mutationFn: fn, onSuccess });

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Runs TMDB lookups for every movie still missing a poster or TMDB id, up to 25 per run. Press
        again to continue where it left off.
      </p>
      <button
        type="button"
        onClick={() => mutation.mutate({ data: { limit: 25 } })}
        disabled={mutation.isPending}
        className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Enriching…" : "Enrich next 25 movies"}
      </button>
      {mutation.isSuccess ? (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-teal">
            Updated {mutation.data.updated} of {mutation.data.attempted} attempted.{" "}
            {mutation.data.remaining} still pending.
          </p>
          {mutation.data.lowConfidence.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Needs a manual check: {mutation.data.lowConfidence.join("; ")}
            </p>
          ) : null}
          {mutation.data.failed.length > 0 ? (
            <p className="text-xs text-destructive">{mutation.data.failed.join("; ")}</p>
          ) : null}
        </div>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function BackfillArtworkCard({ onSuccess }: { onSuccess: () => void }) {
  const fn = useServerFn(backfillPodcastArtwork);
  const mutation = useMutation({ mutationFn: fn, onSuccess });

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Looks up each show without artwork on Podcast Index and fills cover art, feed URL, site and
        episode counts.
      </p>
      <button
        type="button"
        onClick={() => mutation.mutate({ data: { limit: 25 } })}
        disabled={mutation.isPending}
        className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Fetching…" : "Backfill next 25 shows"}
      </button>
      {mutation.isSuccess ? (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-teal">
            Updated {mutation.data.updated} of {mutation.data.attempted} attempted.{" "}
            {mutation.data.remaining} still pending.
          </p>
          {mutation.data.failed.length > 0 ? (
            <p className="text-xs text-destructive">{mutation.data.failed.join("; ")}</p>
          ) : null}
        </div>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function IngestPodcastForm({ onSuccess }: { onSuccess: () => void }) {
  const fn = useServerFn(ingestPodcast);
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess,
  });
  const [query, setQuery] = useState("");
  const [feedUrl, setFeedUrl] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ data: { query: query || undefined, feedUrl: feedUrl || undefined } });
  };

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Search Podcast Index by name or feed URL. Episodes are matched to your movie catalog automatically.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Podcast name"
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="url"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://example.com/feed.xml (optional)"
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={mutation.isPending || (!query && !feedUrl)}
          className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Ingesting…" : "Ingest podcast"}
        </button>
      </form>
      {mutation.isSuccess ? (
        <p className="mt-3 text-sm text-teal">
          Fetched {mutation.data.episodesFetched} episodes, inserted {mutation.data.episodesInserted} new,{" "}
          {mutation.data.matchesInserted} auto-matched, {mutation.data.pendingMatches} pending review.
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function EnrichMovieForm({ onSuccess }: { onSuccess: () => void }) {
  const fn = useServerFn(enrichMovie);
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess,
  });
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      data: {
        title: title || undefined,
        year: year ? Number(year) : undefined,
      },
    });
  };

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Look up a movie on TMDB to fill runtime, synopsis, poster, and TMDB ID. Availability refresh uses the TMDB ID.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Movie title"
          required
          className="min-w-[12rem] flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Year"
          className="w-28 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !title}
          className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Looking up…" : "Enrich"}
        </button>
      </form>
      {mutation.isSuccess ? (
        <p className="mt-3 text-sm text-teal">
          Matched <strong>{mutation.data.match.title}</strong> ({mutation.data.match.releaseYear}) with confidence{" "}
          {mutation.data.match.confidence}%.
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const AVAILABILITY_BATCH = 80;

function RefreshAvailabilityForm({ onSuccess }: { onSuccess: () => void }) {
  const fn = useServerFn(refreshAvailability);
  const fetchFreshness = useServerFn(availabilityFreshness);
  const queryClient = useQueryClient();
  const freshness = useQuery({
    queryKey: ["availability-freshness"],
    queryFn: () => fetchFreshness({}),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    checked: number;
    offers: number;
    genres: number;
    failed: number;
    done: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  // Chained runs: each request stays small enough to finish, but pressing once
  // works through hundreds of movies, always starting with the stalest.
  const run = async (maxMovies: number, staleOnly: boolean) => {
    cancelRef.current = false;
    setRunning(true);
    setError(null);
    let checked = 0;
    let offers = 0;
    let genres = 0;
    let failed = 0;
    let done = false;
    try {
      while (checked < maxMovies && !cancelRef.current) {
        const limit = Math.min(AVAILABILITY_BATCH, maxMovies - checked);
        const result = await fn({
          data: {
            region: "US",
            limit,
            ...(staleOnly && freshness.data?.staleBefore
              ? { staleBefore: freshness.data.staleBefore }
              : {}),
          },
        });
        checked += result.updated;
        offers += result.offersWritten;
        genres += result.genreLinks;
        failed += result.failed.length;
        setProgress({ checked, offers, genres, failed, done: result.done });
        if (result.done) {
          done = true;
          break;
        }
      }
      setProgress({ checked, offers, genres, failed, done });
      await queryClient.invalidateQueries({ queryKey: ["availability-freshness"] });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const f = freshness.data;

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pulls TMDB watch providers (US) and genres. Movies are processed oldest-checked first, in
        batches of {AVAILABILITY_BATCH}, chained automatically — so one press covers hundreds. Only
        subscription and free-with-ads offers count as "available" in the app; rent/buy offers are
        stored but never shown as streaming.
      </p>

      {f ? (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">Never checked</dt>
            <dd className="font-display text-lg">
              {f.neverChecked}
              <span className="text-xs text-muted-foreground"> / {f.total}</span>
            </dd>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">Older than 7 days</dt>
            <dd className="font-display text-lg">{f.staleOverAWeek}</dd>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">Oldest check</dt>
            <dd className="font-display text-lg">{relativeTime(f.oldestCheck)}</dd>
          </div>
          <div className="rounded-xl border border-border/60 px-3 py-2">
            <dt className="text-muted-foreground">Last run</dt>
            <dd className="font-display text-lg">{relativeTime(f.newestCheck)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run(400, true)}
          disabled={running}
          className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {running ? "Syncing…" : "Sync up to 400 stale movies"}
        </button>
        <button
          type="button"
          onClick={() => run(AVAILABILITY_BATCH, true)}
          disabled={running}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Just {AVAILABILITY_BATCH}
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => {
              cancelRef.current = true;
            }}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Stop after this batch
          </button>
        ) : null}
      </div>

      {progress ? (
        <p className="mt-3 text-sm text-teal">
          Checked {progress.checked} movies · {progress.offers} offers · {progress.genres} genre
          links.
          {progress.done ? " Everything in scope is up to date." : ""}
          {progress.failed > 0 ? ` ${progress.failed} failed.` : ""}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}


function ResolveEpisodesCard({ onSuccess }: { onSuccess: () => void }) {
  const resolveFn = useServerFn(resolveEpisodesToMovies);
  const client = useQueryClient();
  const refresh = () => {
    onSuccess();
    void client.invalidateQueries({ queryKey: ["unmatched-episodes"] });
    void client.invalidateQueries({ queryKey: ["match-suggestions"] });
  };
  const resolve = useMutation({ mutationFn: resolveFn, onSuccess: refresh });

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Reads unmatched episode titles, extracts the movie name, looks it up on TMDB, creates the
        movie with full metadata and links the episode. Runs 100 episodes at a time.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => resolve.mutate({ data: { limit: 100 } })}
          disabled={resolve.isPending}
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {resolve.isPending ? "Resolving…" : "Resolve next 100 episodes"}
        </button>
      </div>


      {resolve.isSuccess ? (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-teal">
            Linked {resolve.data.linked} of {resolve.data.attempted} episodes ·{" "}
            {resolve.data.moviesCreated} movies created · {resolve.data.remaining} still unmatched.
          </p>
          {resolve.data.skipped.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Skipped (not about a movie): {resolve.data.skipped.join("; ")}
            </p>
          ) : null}
          {resolve.data.unresolved.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Needs a manual link: {resolve.data.unresolved.join("; ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {resolve.isError ? (
        <p className="mt-3 text-sm text-destructive">{(resolve.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function UnmatchedEpisodesCard() {
  const fn = useServerFn(listUnmatchedEpisodes);
  const rescanFn = useServerFn(rescanEpisodeMatches);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["unmatched-episodes"],
    queryFn: () => fn({ data: { limit: 40 } }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const rescan = useMutation({
    mutationFn: rescanFn,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["unmatched-episodes"] });
      await client.invalidateQueries({ queryKey: ["match-suggestions"] });
    },
  });

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every episode with no movie attached — including ones whose suggested match you rejected.
        Nothing here is visible in the app yet.
      </p>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => rescan.mutate({ data: { limit: 100 } })}
          disabled={rescan.isPending}
          className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {rescan.isPending ? "Rescanning…" : "Recheck every episode against existing movies"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Rescores every episode in your active shows against the movies already in the catalogue:
          links unmatched ones, replaces a weak match when a newly added movie clearly beats it, and
          attaches extra films to episodes that cover more than one (trilogies, double features).
          Matches you confirmed by hand are never touched, rejected pairs are always skipped, and no
          TMDB calls are made. Run it after adding movies by hand.
        </p>
        {rescan.isSuccess ? (
          <p className="mt-2 text-sm text-teal">
            Rescanned {rescan.data.scanned} · newly linked {rescan.data.linked} · improved{" "}
            {rescan.data.improved} · extra films added {rescan.data.extraAdded} ·{" "}
            {rescan.data.stillUnlinked} still unmatched.
          </p>
        ) : null}
        {rescan.isError ? (
          <p className="mt-2 text-sm text-destructive">{(rescan.error as Error).message}</p>
        ) : null}
      </div>
      {query.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />
      ) : query.isError ? (
        <p className="mt-3 text-sm text-destructive">{(query.error as Error).message}</p>
      ) : (query.data?.total ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-teal">
          Every episode in an active show is linked to at least one movie.
          {(query.data?.totalIncludingParked ?? 0) > 0
            ? ` ${query.data?.totalIncludingParked} unmatched episodes remain in parked shows.`
            : ""}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold">
            {query.data?.total} unmatched in active shows
            <span className="ml-1 font-normal text-muted-foreground">
              · {query.data?.totalIncludingParked} including parked shows
            </span>
          </p>
          <ul className="mt-3 space-y-2">
            {query.data?.episodes.map((ep) => (
              <li key={ep.episodeId} className="rounded-xl border border-border/60 px-3 py-2 text-sm">
                <p className="font-medium">{ep.episodeTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {ep.podcastName}
                  {ep.releasedAt ? ` · ${ep.releasedAt}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PodcastCoverageCard({ onSuccess }: { onSuccess: () => void }) {
  const fetchCoverage = useServerFn(listPodcastCoverage);
  const sync = useServerFn(ingestPodcast);
  const setCuration = useServerFn(setPodcastCuration);
  const queryClient = useQueryClient();
  const coverage = useQuery({
    queryKey: ["podcast-coverage"],
    queryFn: () => fetchCoverage({}),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showParked, setShowParked] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["podcast-coverage"] });
    onSuccess();
  };

  const syncPodcast = async (podcastId: string) => {
    setBusyId(podcastId);
    setError(null);
    try {
      await sync({ data: { podcastId, maxEpisodes: 1000 } });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleCuration = async (podcastId: string, status: "active" | "parked") => {
    setBusyId(podcastId);
    setError(null);
    try {
      await setCuration({ data: { podcastId, status } });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const all = coverage.data?.podcasts ?? [];
  const active = all.filter((p) => p.curationStatus === "active");
  const parked = all.filter((p) => p.curationStatus === "parked");
  const visible = showParked ? parked : active;

  const row = (p: (typeof all)[number]) => {
    const complete = p.feedTotal > 0 && p.stored >= p.feedTotal;
    const isParked = p.curationStatus === "parked";
    return (
      <li
        key={p.podcastId}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{p.name}</p>
          <p className={`text-xs ${complete ? "text-teal" : "text-muted-foreground"}`}>
            {p.stored} stored{p.feedTotal ? ` / ${p.feedTotal} in feed` : ""}
            {complete ? " · complete" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {p.linked} linked · {p.unmatched} unmatched · {p.retired} not about a movie
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => toggleCuration(p.podcastId, isParked ? "active" : "parked")}
            disabled={busyId === p.podcastId}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              isParked
                ? "bg-teal text-primary-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {isParked ? "Re-activate" : "Park"}
          </button>
          <button
            type="button"
            onClick={() => syncPodcast(p.podcastId)}
            disabled={busyId === p.podcastId || isParked}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busyId === p.podcastId ? "Working…" : "Sync episodes"}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Stored episodes vs. what the feed reports, plus progress per show. Parking a show keeps every
        episode and link but removes it from the review queues and from the app — re-activate any
        time with nothing to re-ingest.
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setShowParked(false)}
          className={`rounded-full px-3 py-1.5 ${!showParked ? "bg-secondary" : "border border-border"}`}
        >
          Active ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setShowParked(true)}
          className={`rounded-full px-3 py-1.5 ${showParked ? "bg-secondary" : "border border-border"}`}
        >
          Parked ({parked.length})
        </button>
      </div>

      {coverage.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {showParked ? "No shows are parked." : "No active podcasts."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">{visible.map(row)}</ul>
      )}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
