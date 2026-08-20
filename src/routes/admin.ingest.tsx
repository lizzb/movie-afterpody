import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MatchHistoryCard } from "@/components/admin/MatchHistoryCard";
import { MatchReviewCard } from "@/components/admin/MatchReviewCard";
import { useAuth } from "@/hooks/useAuth";

import {
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
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
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
            <Stat label="Movies" value={stats.data.movies} />
            <Stat label="Podcasts" value={stats.data.podcasts} />
            <Stat label="Episodes" value={stats.data.episodes} />
            <Stat label="Matched episodes" value={stats.data.matchedEpisodes} href="#match-review" />
            <Stat label="Weak links to review" value={stats.data.pendingMatches} href="#match-review" />
            <Stat label="TMDB linked" value={stats.data.tmdbLinked} />
            <Stat
              label="Unmatched episodes"
              value={stats.data.unmatchedEpisodes}
              href="#unmatched-episodes"
            />
          </section>
        ) : null}

        <section className="mt-10 space-y-8">
          <MatchReviewCard onSuccess={() => stats.refetch()} />
          <MatchHistoryCard onSuccess={() => stats.refetch()} />
          <ResolveEpisodesCard onSuccess={() => stats.refetch()} />
          <UnmatchedEpisodesCard />
          <PodcastCoverageCard onSuccess={() => stats.refetch()} />

          <BulkEnrichCard onSuccess={() => stats.refetch()} />
          <BackfillArtworkCard onSuccess={() => stats.refetch()} />
          <IngestPodcastForm onSuccess={() => stats.refetch()} />
          <EnrichMovieForm onSuccess={() => stats.refetch()} />
          <RefreshAvailabilityForm onSuccess={() => stats.refetch()} />
        </section>


      </main>
    </AppShell>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Enrich all movies (posters + metadata)</h2>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Backfill podcast cover art</h2>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Ingest podcast</h2>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Enrich movie from TMDB</h2>
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

function RefreshAvailabilityForm({ onSuccess }: { onSuccess: () => void }) {
  const fn = useServerFn(refreshAvailability);
  const [offset, setOffset] = useState(0);
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      setOffset(result.nextOffset);
      onSuccess();
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Streaming availability + genres</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pulls TMDB watch providers (US) and genres, 40 movies per run so the request never times
        out. Press again to continue from movie {offset + 1}.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => mutation.mutate({ data: { region: "US", limit: 40, offset } })}
          disabled={mutation.isPending}
          className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Syncing…" : `Sync next 40 (from #${offset + 1})`}
        </button>
        {offset > 0 ? (
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Start over
          </button>
        ) : null}
      </div>
      {mutation.isSuccess ? (
        <p className="mt-3 text-sm text-teal">
          Checked {mutation.data.updated} movies · {mutation.data.offersWritten} streaming offers ·{" "}
          {mutation.data.genreLinks} genre links. {mutation.data.total} movies have a TMDB id.
          {mutation.data.done ? " All movies processed." : ""}
          {mutation.data.failed.length > 0 ? ` ${mutation.data.failed.length} failed.` : ""}
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Build movies from episodes</h2>
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
    <div id="unmatched-episodes" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Unmatched episodes</h2>
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
          {rescan.isPending ? "Rescanning…" : "Recheck these against existing movies"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Compares unmatched episode titles against movies already in the catalogue and links the
          confident ones. No TMDB calls, no new movies created, rejected pairs skipped. Use it after
          you add a movie by hand.
        </p>
        {rescan.isSuccess ? (
          <p className="mt-2 text-sm text-teal">
            Rescanned {rescan.data.scanned} · linked {rescan.data.linked} ·{" "}
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
        <p className="mt-4 text-sm text-teal">Every episode is linked to at least one movie.</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold">{query.data?.total} unmatched</p>
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
  const queryClient = useQueryClient();
  const coverage = useQuery({
    queryKey: ["podcast-coverage"],
    queryFn: () => fetchCoverage({}),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncPodcast = async (podcastId: string) => {
    setBusyId(podcastId);
    setError(null);
    try {
      await sync({ data: { podcastId, maxEpisodes: 1000 } });
      await queryClient.invalidateQueries({ queryKey: ["podcast-coverage"] });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Episode coverage</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Stored episodes vs. what the feed reports. "Sync episodes" pulls up to 1000 in one pass —
        press again if the stored count is still short.
      </p>
      {coverage.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
      ) : (coverage.data?.podcasts.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No podcasts ingested yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {coverage.data?.podcasts.map((p) => {
            const complete = p.feedTotal > 0 && p.stored >= p.feedTotal;
            return (
              <li
                key={p.podcastId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className={`text-xs ${complete ? "text-teal" : "text-muted-foreground"}`}>
                    {p.stored} stored{p.feedTotal ? ` / ${p.feedTotal} in feed` : ""}
                    {complete ? " · complete" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => syncPodcast(p.podcastId)}
                  disabled={busyId === p.podcastId}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {busyId === p.podcastId ? "Syncing…" : "Sync episodes"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
