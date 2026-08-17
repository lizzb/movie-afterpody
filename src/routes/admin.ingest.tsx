import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  approveEpisodeMatch,
  backfillPodcastArtwork,
  bootstrapAdmin,
  enrichAllMovies,
  enrichMovie,
  ingestPodcast,
  listIngestionStats,
  refreshAvailability,
  rejectEpisodeMatch,
  suggestEpisodeMatches,
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
            <p className="text-sm text-muted-foreground">Sign in to access ingestion tools.</p>
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
            <Stat label="Matched episodes" value={stats.data.matchedEpisodes} />
            <Stat label="Pending review" value={stats.data.pendingMatches} />
            <Stat label="TMDB linked" value={stats.data.tmdbLinked} />
          </section>
        ) : null}

        <section className="mt-10 space-y-8">
          <BulkEnrichCard onSuccess={() => stats.refetch()} />
          <BackfillArtworkCard onSuccess={() => stats.refetch()} />
          <IngestPodcastForm onSuccess={() => stats.refetch()} />
          <EnrichMovieForm onSuccess={() => stats.refetch()} />
          <RefreshAvailabilityForm onSuccess={() => stats.refetch()} />
          <ReviewMatches onSuccess={() => stats.refetch()} />
        </section>
      </main>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
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
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Refresh streaming availability</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Query TMDB watch providers for every movie with a TMDB ID and update US availability.
      </p>
      <button
        type="button"
        onClick={() => mutation.mutate({ data: { region: "US" } })}
        disabled={mutation.isPending}
        className="mt-4 inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Refreshing…" : "Refresh US availability"}
      </button>
      {mutation.isSuccess ? (
        <p className="mt-3 text-sm text-teal">
          Updated {mutation.data.updated} of {mutation.data.total} movies.
          {mutation.data.failed.length > 0 ? ` ${mutation.data.failed.length} failed.` : ""}
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function ReviewMatches({ onSuccess }: { onSuccess: () => void }) {
  const client = useQueryClient();
  const suggestFn = useServerFn(suggestEpisodeMatches);
  const approveFn = useServerFn(approveEpisodeMatch);
  const rejectFn = useServerFn(rejectEpisodeMatch);
  const [podcastId, setPodcastId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});
  const [error, setError] = useState<string | null>(null);

  const suggestions = useQuery({
    queryKey: ["match-suggestions", podcastId || "all"],
    queryFn: () => suggestFn({ data: podcastId ? { podcastId } : {} }),
    enabled: true,
  });

  const decide = async (episodeId: string, movieId: string, action: "approved" | "rejected") => {
    setError(null);
    setBusy(episodeId);
    try {
      if (action === "approved") await approveFn({ data: { episodeId, movieId } });
      else await rejectFn({ data: { episodeId, movieId } });
      setDecided((prev) => ({ ...prev, [episodeId]: action }));
      await client.invalidateQueries({ queryKey: ["match-suggestions"] });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that decision.");
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = (episodeId: string, movieId: string) => void decide(episodeId, movieId, "approved");
  const handleReject = (episodeId: string, movieId: string) => void decide(episodeId, movieId, "rejected");

  const items = (suggestions.data?.suggestions ?? []).filter(
    (s) => s.topCandidate && s.topCandidate.confidence < 80 && !decided[s.episodeId],
  );


  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Review episode matches</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Approve or reject low-confidence episode-to-movie links.
      </p>
      <input
        type="text"
        value={podcastId}
        onChange={(e) => setPodcastId(e.target.value)}
        placeholder="Filter by podcast UUID (optional)"
        className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {Object.keys(decided).length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {Object.values(decided).filter((d) => d === "approved").length} approved ·{" "}
          {Object.values(decided).filter((d) => d === "rejected").length} rejected this session
        </p>
      ) : null}

      {suggestions.isLoading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" />
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No low-confidence matches to review right now.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.episodeId} className="rounded-xl border border-border bg-background p-4">
              <p className="font-semibold">{item.episodeTitle}</p>
              <p className="text-xs text-muted-foreground">{item.podcastName}</p>
              {item.topCandidate ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      Suggested: <strong>{item.topCandidate.title}</strong> ({item.topCandidate.releaseYear})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.topCandidate.confidence}% — {item.topCandidate.reason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === item.episodeId}
                      onClick={() => handleApprove(item.episodeId, item.topCandidate!.movieId)}
                      className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {busy === item.episodeId ? "Saving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.episodeId}
                      onClick={() => handleReject(item.episodeId, item.topCandidate!.movieId)}
                      className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
