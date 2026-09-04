import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accentFor } from "./accents";
import { nullIfBlank } from "./utils";
import type { Database } from "@/integrations/supabase/types";

const IngestPodcastInput = z.object({
  query: z.string().min(1).optional(),
  feedUrl: z.string().url().optional(),
  podcastId: z.string().uuid().optional(),
  maxEpisodes: z.number().int().min(1).max(1000).default(100),
});

const EpisodeMatchInput = z.object({
  episodeId: z.string().uuid(),
  movieId: z.string().uuid(),
});

const EnrichMovieInput = z.object({
  movieId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2030).optional(),
  /** Exact lookup, e.g. tt0110989 (Richie Rich). */
  imdbId: z
    .string()
    .regex(/^tt\d{6,10}$/i, "IMDb ids look like tt0110989")
    .optional(),
});

const RefreshAvailabilityInput = z.object({
  region: z.string().default("US"),
  /**
   * Batch size for one request. Each movie costs 2 TMDB calls, so the ceiling is
   * the worker request budget, not TMDB's rate limit. The UI chains runs to cover
   * hundreds of movies without any single request timing out.
   */
  limit: z.number().int().min(1).max(120).default(80),
  /** Only re-check movies never checked or last checked before this ISO timestamp. */
  staleBefore: z.string().optional(),
});

/** TMDB genre name → our genre slug. Anything unlisted is created on the fly. */
const TMDB_GENRE_SLUG: Record<string, string> = {
  "Science Fiction": "scifi",
  Music: "musical",
};

const BulkInput = z.object({
  limit: z.number().int().min(1).max(60).default(25),
});

const SuggestMatchesInput = z.object({
  podcastId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
  search: z.string().optional(),
  /** Only surface proposals weaker than this (0-100); 80 = the review band. */
  maxConfidence: z.number().min(0).max(100).default(80),
  limit: z.number().int().min(1).max(200).default(40),
  offset: z.number().int().min(0).default(0),
});

async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: row, error } = await context.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Admin check failed: ${error.message}`);
  if (!row) throw new Error("Forbidden: admin required");
}

type MatchActionKind = "approve" | "reject" | "unlink" | "relink" | "confirm" | "not_about_a_movie";

/** Every match decision is logged so a misclick can be undone later. */
async function logMatchAction(
  admin: SupabaseClient<Database>,
  actorId: string,
  entry: {
    action: MatchActionKind;
    episodeId: string;
    movieId?: string | null;
    previousMovieId?: string | null;
    previousMethod?: Database["public"]["Enums"]["match_method"] | string | null;
    previousConfidence?: number | null;
  },
): Promise<void> {
  const { error } = await admin.from("match_actions").insert({
    actor_id: actorId,
    action: entry.action,
    episode_id: entry.episodeId,
    movie_id: entry.movieId ?? null,
    previous_movie_id: entry.previousMovieId ?? null,
    previous_method: (entry.previousMethod ?? null) as Database["public"]["Enums"]["match_method"] | null,
    previous_confidence: entry.previousConfidence ?? null,
  });
  // A missing log entry must never fail the decision itself.
  if (error) console.error("[match_actions] log failed", error.message);
}



async function loadAdminClients() {
  const [
    { supabaseAdmin },
    {
      searchPodcastsByTitle,
      getPodcastByFeedUrl,
      getEpisodesByFeedUrl,
      podcastSlug,
      episodeSlug,
      episodeTitleForStorage,
      bestArtwork,
    },
    { matchEpisodeToMovies },
    { findBestTmdbMatch, getTmdbWatchProviders },
  ] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./providers/podcastindex.server"),
    import("./providers/matching.server"),
    import("./providers/tmdb.server"),
  ]);
  return {
    supabaseAdmin,
    searchPodcastsByTitle,
    getPodcastByFeedUrl,
    getEpisodesByFeedUrl,
    podcastSlug,
    episodeSlug,
    episodeTitleForStorage,
    bestArtwork,
    matchEpisodeToMovies,
    findBestTmdbMatch,
    getTmdbWatchProviders,
  };
}

async function resolveOpenFlags(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  episodeId: string,
  movieId: string,
  resolution: "fixed" | "dismissed" = "fixed",
): Promise<void> {
  const { error } = await admin
    .from("episode_link_flags")
    .update({ resolved_at: new Date().toISOString(), resolution })
    .eq("episode_id", episodeId)
    .eq("movie_id", movieId)
    .is("resolved_at", null);
  if (error) throw error;
}

const TMDB_PROVIDER_TO_SLUG: Record<number, string> = {
  8: "netflix",
  9: "prime-video",
  // 10 is the Amazon Video storefront (rent/buy). Mapped so a rent-only title is
  // stored as a rent offer instead of looking like it streams on Prime.
  10: "prime-video",
  119: "prime-video",
  337: "disney-plus",
  189: "max",
  15: "hulu",
  350: "apple-tv-plus",
  387: "peacock",
  531: "paramount-plus",
  258: "criterion-channel",
  99: "shudder",
  73: "tubi",
  584: "prime-video",
};

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (existing && existing.length > 0) throw new Error("Admin already exists");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw error;
    return { ok: true };
  });

export const ingestPodcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IngestPodcastInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const clients = await loadAdminClients();

    const apiKey = process.env["PODCAST_INDEX_API_KEY"];
    const apiSecret = process.env["PODCAST_INDEX_API_SECRET"];
    if (!apiKey || !apiSecret) throw new Error("Podcast Index credentials not configured");

    let feedUrl = data.feedUrl;
    let titleQuery = data.query;

    if (data.podcastId) {
      const { data: existing } = await clients.supabaseAdmin
        .from("podcasts")
        .select("name, feed_url")
        .eq("id", data.podcastId)
        .single();
      if (existing) {
        titleQuery = existing.name;
        feedUrl = feedUrl || existing.feed_url || undefined;
      }
    }

    let feed: Awaited<ReturnType<typeof clients.getPodcastByFeedUrl>> | Awaited<ReturnType<typeof clients.searchPodcastsByTitle>> = null;
    if (feedUrl) {
      feed = await clients.getPodcastByFeedUrl(apiKey, apiSecret, feedUrl);
    }
    if (!feed && titleQuery) {
      feed = await clients.searchPodcastsByTitle(apiKey, apiSecret, titleQuery);
    }
    if (!feed) throw new Error("Podcast not found in Podcast Index");

    const slug = clients.podcastSlug(feed.title);
    const artwork = clients.bestArtwork(feed);

    const { data: upsertedPodcast, error: podcastError } = await clients.supabaseAdmin
      .from("podcasts")
      .upsert(
        {
          slug,
          name: feed.title,
          description: feed.description || null,
          artwork_url: artwork,
          accent: accentFor(slug),
          episode_count: feed.episodeCount ?? 0,
          latest_episode_at: feed.lastUpdateTime
            ? new Date(feed.lastUpdateTime * 1000).toISOString().slice(0, 10)
            : null,
          activity_status: "active",
          feed_url: feed.url,
          website_url: feed.link || null,
          external_ids: { podcastIndexId: feed.id },
          provider_source: "podcastindex",
        },
        { onConflict: "slug" },
      )
      .select("id, slug, name")
      .single();

    if (podcastError || !upsertedPodcast) throw podcastError || new Error("Failed to upsert podcast");

    const episodes = await clients.getEpisodesByFeedUrl(apiKey, apiSecret, feed.url, data.maxEpisodes);
    const { data: movies } = await clients.supabaseAdmin.from("movies").select("id, title, release_year, collection_id");
    const movieList = movies ?? [];

    /**
     * Guards for the sync-time matcher. Without these, every sync re-matched
     * every episode in the feed: pairs you had rejected came straight back, and
     * each new link fired the review-stale trigger, un-marking episodes you had
     * signed off. Automated matching now only touches episodes that are
     * unlinked, not retired, and not reviewed.
     */
    const { fetchRejectedPairs, fetchReviewedEpisodeIds, pageAll } = await import(
      "./ingestion-helpers.server"
    );
    const rejectedPairs = await fetchRejectedPairs(clients.supabaseAdmin);
    const reviewedEpisodes = await fetchReviewedEpisodeIds(clients.supabaseAdmin);
    const existingLinkEpisodes = new Set(
      (
        await pageAll<{ episode_id: string }>((from, to) =>
          clients.supabaseAdmin
            .from("episode_movies")
            .select("episode_id")
            .order("episode_id")
            .range(from, to),
        )
      ).map((l) => l.episode_id),
    );
    const retiredEpisodes = new Set(
      (
        await pageAll<{ id: string }>((from, to) =>
          clients.supabaseAdmin
            .from("podcast_episodes")
            .select("id")
            .eq("disposition", "not_about_a_movie")
            .order("id")
            .range(from, to),
        )
      ).map((e) => e.id),
    );

    let insertedEpisodes = 0;
    let insertedMatches = 0;
    let pendingMatches = 0;
    let matchesSkippedProtected = 0;
    // Surfaced instead of swallowed: a feed with 900 episodes that only stores 700
    // should say why rather than looking like a coverage mystery.
    const episodeErrors: string[] = [];



    for (const ep of episodes) {
      const storedTitle = clients.episodeTitleForStorage(ep);
      const epSlug = clients.episodeSlug(upsertedPodcast.slug, storedTitle.title);
      const releasedAt = ep.datePublished ? new Date(ep.datePublished * 1000).toISOString().slice(0, 10) : null;
      const { data: upsertedEp, error: epError } = await clients.supabaseAdmin
        .from("podcast_episodes")
        .upsert(
          {
            podcast_id: upsertedPodcast.id,
            slug: epSlug,
            title: storedTitle.title,
            description: ep.description || null,
            released_at: releasedAt,
            duration_seconds: ep.duration ?? null,
            episode_number: ep.episodeNumber ?? null,
            provider_source: "podcastindex",
          },
          { onConflict: "slug" },
        )
        .select("id, slug, title")
        .single();

      if (epError || !upsertedEp) {
        episodeErrors.push(`${storedTitle.title}: ${epError?.message ?? "upsert returned no row"}`);
        continue;
      }
      if (storedTitle.fallback) {
        episodeErrors.push(`${storedTitle.title}: feed did not provide an episode title; stored without matching`);
      }

      insertedEpisodes += 1;

      try {
        await clients.supabaseAdmin.from("episode_sources").upsert(
          {
            episode_id: upsertedEp.id,
            platform: "podcast_index",
            url:
              ep.enclosureUrl ||
              `https://podcasts.apple.com/search?term=${encodeURIComponent(feed.title + " " + storedTitle.title)}`,
            access_tier: "public",
            is_primary: true,
            embeddable: false,
          },
          { onConflict: "episode_id, platform" },
        );
      } catch {
        /* source insert is best-effort */
      }

      if (storedTitle.fallback) continue;

      // Never touch coverage an admin already settled, and never re-link an
      // episode that already has links (its links are review workload, not a
      // sync concern).
      if (
        reviewedEpisodes.has(upsertedEp.id) ||
        retiredEpisodes.has(upsertedEp.id) ||
        existingLinkEpisodes.has(upsertedEp.id)
      ) {
        matchesSkippedProtected += 1;
        continue;
      }

      const candidates = clients.matchEpisodeToMovies(storedTitle.title, movieList, { description: ep.description || null });
      const top = candidates.find((c) => !rejectedPairs.has(`${upsertedEp.id}:${c.movieId}`));
      if (top) {
        if (top.confidence >= 80) {
          await clients.supabaseAdmin
            .from("episode_movies")
            .upsert(
              {
                episode_id: upsertedEp.id,
                movie_id: top.movieId,
                match_method: "deterministic",
                match_confidence: top.confidence / 100,
                is_primary_subject: true,
              },
              { onConflict: "episode_id, movie_id" },
            );
          existingLinkEpisodes.add(upsertedEp.id);
          insertedMatches += 1;
        } else if (top.confidence >= 50) {
          await clients.supabaseAdmin
            .from("episode_movies")
            .upsert(
              {
                episode_id: upsertedEp.id,
                movie_id: top.movieId,
                match_method: "heuristic",
                match_confidence: top.confidence / 100,
                is_primary_subject: true,
              },
              { onConflict: "episode_id, movie_id" },
            );
          existingLinkEpisodes.add(upsertedEp.id);
          pendingMatches += 1;
        }
      }

    }

    /**
     * Pass U8 — a completed sync raises the show's sync generation, so review
     * records made against the previous generation stop counting toward current
     * completeness (they are kept for history, never deleted) and the coverage
     * line's "as of sync D" advances.
     */
    let syncGeneration: number | null = null;
    {
      const { data: current } = await clients.supabaseAdmin
        .from("podcasts")
        .select("sync_generation")
        .eq("id", upsertedPodcast.id)
        .maybeSingle();
      syncGeneration = (current?.sync_generation ?? 1) + 1;
      await clients.supabaseAdmin
        .from("podcasts")
        .update({ sync_generation: syncGeneration, last_synced_at: new Date().toISOString() })
        .eq("id", upsertedPodcast.id);
    }

    return {
      syncGeneration,

      podcast: upsertedPodcast,
      feedTotal: feed.episodeCount ?? 0,
      episodesFetched: episodes.length,
      episodesInserted: insertedEpisodes,
      episodesFailed: episodeErrors.length,
      episodeErrors: episodeErrors.slice(0, 10),
      matchesInserted: insertedMatches,
      pendingMatches,
      matchesSkippedProtected,

    };

  });

export const suggestEpisodeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SuggestMatchesInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchEpisodeToMovies, computeCommonEpisodeWords } = await import(
      "./providers/matching.server"
    );
    const { hasUsableEpisodeTitle, looksNonMovieEpisode } = await import(
      "./providers/episode-title.server"
    );

    const { fetchAllEpisodes, fetchRejectionCountsByMovie, fetchReviewedEpisodeIds, pageAll } = await import(
      "./ingestion-helpers.server"
    );

    // Paged: a single response is capped at 1000 rows and there are 7k+ episodes,
    // which is why the same handful of episodes used to reappear forever.
    let episodes = await fetchAllEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    if (data.episodeId) episodes = episodes.filter((ep) => ep.id === data.episodeId);

    const movieList = await pageAll<{ id: string; title: string; release_year: number | null; collection_id: number | null }>(
      (from, to) => supabaseAdmin.from("movies").select("id, title, release_year, collection_id").range(from, to),
    );

    const [existingLinks, rejections, rejectionCountByMovie, reviewedEpisodes] = await Promise.all([
      pageAll<{ episode_id: string; movie_id: string; match_method: string }>((from, to) =>
        supabaseAdmin.from("episode_movies").select("episode_id, movie_id, match_method").range(from, to),
      ),
      pageAll<{ episode_id: string; movie_id: string }>((from, to) =>
        supabaseAdmin.from("episode_match_rejections").select("episode_id, movie_id").range(from, to),
      ),
      fetchRejectionCountsByMovie(supabaseAdmin),
      fetchReviewedEpisodeIds(supabaseAdmin),
    ]);

    const rejectedPairs = new Set(rejections.map((r) => `${r.episode_id}:${r.movie_id}`));
    // Confirmed = anything an admin approved or a high-confidence deterministic link.
    const confirmedEpisodes = new Set(
      existingLinks
        .filter(
          (l) =>
            l.match_method === "manual" || l.match_method === "deterministic" || l.match_method === "seed",
        )
        .map((l) => l.episode_id),
    );

    const term = data.search?.trim().toLowerCase();
    // Words common across this catalogue's episode titles carry no signal.
    const commonEpisodeWords = computeCommonEpisodeWords(episodes.map((ep) => ep.title));

    const all = episodes
      .filter((ep) => ep.disposition !== "not_about_a_movie")
      .filter((ep) => hasUsableEpisodeTitle(ep.title))
      .filter((ep) => !looksNonMovieEpisode(ep.title))
      .filter((ep) => !confirmedEpisodes.has(ep.id))
      // A signed-off episode is settled even when it has no confirmed link.
      // Suggestions are automated review work and must respect the same U8
      // protection as sync, Build movies, and recheck.
      .filter((ep) => !reviewedEpisodes.has(ep.id))
      .map((ep) => {
        const candidates = matchEpisodeToMovies(ep.title, movieList, {
          rejectionCountByMovie,
          description: ep.description,
          commonEpisodeWords,
        }).filter((c) => !rejectedPairs.has(`${ep.id}:${c.movieId}`));

        const top = candidates[0];
        return {
          episodeId: ep.id,
          episodeSlug: ep.slug,
          episodeTitle: ep.title,
          releasedAt: ep.released_at,
          durationSeconds: ep.duration_seconds,
          podcastId: ep.podcast_id,
          podcastName: ep.podcasts.name,
          topCandidate: top
            ? {
                movieId: top.movieId,
                title: top.title,
                releaseYear: top.releaseYear,
                confidence: top.confidence,
                reason: top.reason,
                rejectedBefore: top.signals.rejectedBefore,
              }
            : null,
          candidates: candidates.slice(0, 5).map((c) => ({
            movieId: c.movieId,
            title: c.title,
            releaseYear: c.releaseYear,
            confidence: c.confidence,
            reason: c.reason,
          })),
        };
      })
      .filter((s) => s.topCandidate !== null && s.topCandidate.confidence < data.maxConfidence);

    // The search box narrows the visible rows; the queue size stays the same so
    // the tab badge does not jump around while typing.
    const filtered = term
      ? all.filter(
          (s) =>
            s.episodeTitle.toLowerCase().includes(term) ||
            s.podcastName.toLowerCase().includes(term) ||
            (s.topCandidate?.title.toLowerCase().includes(term) ?? false),
        )
      : all;

    return {
      total: filtered.length,
      unfilteredTotal: all.length,
      suggestions: filtered.slice(data.offset, data.offset + data.limit),
    };
  });



export const approveEpisodeMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EpisodeMatchInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("episode_movies")
      .select("match_method, match_confidence")
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.movieId)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("episode_movies").upsert(
      {
        episode_id: data.episodeId,
        movie_id: data.movieId,
        match_method: "manual",
        match_confidence: 0.95,
        is_primary_subject: true,
        review_state: "confirmed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      },
      { onConflict: "episode_id, movie_id" },
    );
    if (error) throw error;
    // An approval undoes any earlier rejection of the same pair.
    await supabaseAdmin
      .from("episode_match_rejections")
      .delete()
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.movieId);
    await supabaseAdmin
      .from("podcast_episodes")
      .update({ disposition: "movie_matched" })
      .eq("id", data.episodeId);
    await resolveOpenFlags(supabaseAdmin, data.episodeId, data.movieId, "dismissed");
    await logMatchAction(supabaseAdmin, context.userId, {
      action: "approve",
      episodeId: data.episodeId,
      movieId: data.movieId,
      previousMethod: existing?.match_method ?? null,
      previousConfidence: existing ? Number(existing.match_confidence) : null,
    });
    return { ok: true };
  });

export const rejectEpisodeMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EpisodeMatchInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("episode_movies")
      .select("match_method, match_confidence")
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.movieId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("episode_movies")
      .delete()
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.movieId);
    if (error) throw error;
    const { error: rejectError } = await supabaseAdmin.from("episode_match_rejections").upsert(
      {
        episode_id: data.episodeId,
        movie_id: data.movieId,
        rejected_by: context.userId,
      },
      { onConflict: "episode_id, movie_id" },
    );
    if (rejectError) throw rejectError;
    await resolveOpenFlags(supabaseAdmin, data.episodeId, data.movieId, "fixed");
    await logMatchAction(supabaseAdmin, context.userId, {
      action: "reject",
      episodeId: data.episodeId,
      movieId: data.movieId,
      previousMethod: existing?.match_method ?? null,
      previousConfidence: existing ? Number(existing.match_confidence) : null,
    });
    return { ok: true };
  });

export const enrichMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EnrichMovieInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findBestTmdbMatch, findTmdbByImdbId, isImdbId } = await import("./providers/tmdb.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    let title = data.title;
    let year = data.year;
    const movieId = data.movieId;

    // An IMDb id in either field is an exact lookup — no fuzzy title matching.
    const imdbId =
      data.imdbId ?? (data.title && isImdbId(data.title) ? data.title.trim() : undefined);

    if (movieId && !title) {
      const { data: movie } = await supabaseAdmin
        .from("movies")
        .select("title, release_year")
        .eq("id", movieId)
        .single();
      if (movie) {
        title = movie.title;
        year = year ?? movie.release_year ?? undefined;
      }
    }

    if (!title && !imdbId) throw new Error("Movie title or IMDb id required");

    const match = imdbId
      ? await findTmdbByImdbId(apiKey, imdbId)
      : await findBestTmdbMatch(apiKey, title!, year);
    if (!match) throw new Error(`No TMDB match found for "${imdbId ?? title}"`);

    // Content rating comes from the same detail call path (Pass Y).
    const { getTmdbMovieCertification } = await import("./providers/tmdb.server");
    const cert = await getTmdbMovieCertification(apiKey, match.tmdbId).catch(() => ({
      certification: null,
      system: null,
    }));

    const baseUpdate = {
      title: match.title,
      release_year: match.releaseYear,
      release_date: nullIfBlank(match.releaseDate),
      runtime_minutes: match.runtime,
      synopsis: match.overview,
      tagline: match.tagline,
      poster_url: match.posterUrl,
      backdrop_url: match.backdropUrl,
      imdb_id: match.imdbId,
      tmdb_id: match.tmdbId,
      collection_id: match.collectionId,
      certification: cert.certification,
      certification_system: cert.system,
      certification_checked_at: new Date().toISOString(),
    };

    if (movieId) {
      const { error } = await supabaseAdmin.from("movies").update(baseUpdate).eq("id", movieId);
      if (error) throw error;
      return { movieId, match };
    }

    const slug = match.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Another row may already own this TMDB id — update it instead of inserting a duplicate.
    if (match.tmdbId) {
      const { data: byTmdb } = await supabaseAdmin
        .from("movies")
        .select("id, slug, title")
        .eq("tmdb_id", match.tmdbId)
        .maybeSingle();
      if (byTmdb) {
        const { error: updateError } = await supabaseAdmin
          .from("movies")
          .update(baseUpdate)
          .eq("id", byTmdb.id);
        if (updateError) throw updateError;
        return { movie: byTmdb, match };
      }
    }

    const { data: upsertedMovie, error } = await supabaseAdmin
      .from("movies")
      .upsert({ slug, accent: accentFor(slug), ...baseUpdate }, { onConflict: "slug" })
      .select("id, slug, title")
      .single();
    if (error || !upsertedMovie) throw error || new Error("Failed to insert movie");

    return { movie: upsertedMovie, match };
  });

export const refreshAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RefreshAvailabilityInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTmdbWatchProviders, getTmdbMovieDetails } = await import("./providers/tmdb.server");
    const { slugify } = await import("./providers/shared.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    const { count: total } = await supabaseAdmin
      .from("movies")
      .select("*", { count: "exact", head: true })
      .not("tmdb_id", "is", null);

    // Staleness-first queue: never-checked movies, then the oldest checks.
    // No offset cursor is needed — every run consumes from the stale end, so
    // repeated runs always make progress and never re-do fresh movies.
    let query = supabaseAdmin
      .from("movies")
      .select("id, tmdb_id, title, availability_checked_at")
      .not("tmdb_id", "is", null)
      .order("availability_checked_at", { ascending: true, nullsFirst: true })
      .order("title", { ascending: true })
      .limit(data.limit);
    if (data.staleBefore) {
      query = query.or(`availability_checked_at.is.null,availability_checked_at.lt.${data.staleBefore}`);
    }
    const { data: movies, error: listError } = await query;
    if (listError) throw listError;

    const [{ data: services }, { data: genres }] = await Promise.all([
      supabaseAdmin.from("streaming_services").select("id, slug"),
      supabaseAdmin.from("genres").select("id, slug"),
    ]);
    const serviceBySlug = new Map((services ?? []).map((s) => [s.slug, s.id]));
    const genreBySlug = new Map((genres ?? []).map((g) => [g.slug, g.id]));

    let updated = 0;
    let offersWritten = 0;
    let genreLinks = 0;
    const failed: string[] = [];

    for (const movie of movies ?? []) {
      if (!movie.tmdb_id) continue;
      try {
        const [providers, details] = await Promise.all([
          getTmdbWatchProviders(apiKey, movie.tmdb_id),
          getTmdbMovieDetails(apiKey, movie.tmdb_id),
        ]);

        const region = providers.results?.[data.region];
        const offers = [
          ...(region?.flatrate ?? []).map((p) => ({ ...p, offer_type: "subscription" as const })),
          ...(region?.ads ?? []).map((p) => ({ ...p, offer_type: "free_ads" as const })),
          ...(region?.rent ?? []).map((p) => ({ ...p, offer_type: "rent" as const })),
          ...(region?.buy ?? []).map((p) => ({ ...p, offer_type: "buy" as const })),
        ];

        const checkedAt = new Date().toISOString();
        const rows = new Map<string, {
          movie_id: string;
          service_id: string;
          offer_type: "subscription" | "free_ads" | "rent" | "buy";
          region: string;
          deep_link: string | null;
          provider_source: string;
          last_checked_at: string;
        }>();
        for (const offer of offers) {
          const slug = TMDB_PROVIDER_TO_SLUG[offer.provider_id];
          if (!slug) continue;
          const serviceId = serviceBySlug.get(slug);
          if (!serviceId) continue;
          rows.set(`${serviceId}|${offer.offer_type}`, {
            movie_id: movie.id,
            service_id: serviceId,
            offer_type: offer.offer_type,
            region: data.region,
            deep_link: region?.link || null,
            provider_source: "tmdb",
            last_checked_at: checkedAt,
          });
        }

        // Offers expire. Replacing this movie's region rows wholesale is the only
        // way stale "streaming on X" claims ever disappear — upsert alone kept them forever.
        const { error: deleteError } = await supabaseAdmin
          .from("movie_availability")
          .delete()
          .eq("movie_id", movie.id)
          .eq("region", data.region);
        if (deleteError) throw deleteError;

        if (rows.size > 0) {
          const { error } = await supabaseAdmin
            .from("movie_availability")
            .insert([...rows.values()]);
          if (error) throw error;
          offersWritten += rows.size;
        }

        // Genres come from the same pass so filters actually have data to work with.
        for (const genre of details?.genres ?? []) {
          const slug = TMDB_GENRE_SLUG[genre.name] ?? slugify(genre.name);
          let genreId = genreBySlug.get(slug);
          if (!genreId) {
            const { data: created } = await supabaseAdmin
              .from("genres")
              .upsert({ slug, name: genre.name }, { onConflict: "slug" })
              .select("id, slug")
              .single();
            if (created) {
              genreId = created.id;
              genreBySlug.set(created.slug, created.id);
            }
          }
          if (!genreId) continue;
          const { error } = await supabaseAdmin
            .from("movie_genres")
            .upsert({ movie_id: movie.id, genre_id: genreId }, { onConflict: "movie_id,genre_id" });
          if (!error) genreLinks += 1;
        }

        // Stamped even when nothing is streaming, so "checked, nothing available"
        // is distinguishable from "never checked". The franchise id rides along
        // free — the detail call is already made above.
        const collectionId = details?.belongs_to_collection?.id ?? null;
        await supabaseAdmin
          .from("movies")
          .update(
            collectionId
              ? { availability_checked_at: checkedAt, collection_id: collectionId }
              : { availability_checked_at: checkedAt },
          )
          .eq("id", movie.id);


        updated += 1;
      } catch (err) {
        failed.push(`${movie.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const fetched = movies?.length ?? 0;
    return {
      updated,
      offersWritten,
      genreLinks,
      failed: failed.slice(0, 20),
      total: total ?? 0,
      /** No stale movies left in scope — the client stops chaining. */
      done: fetched < data.limit,
    };
  });

/** Freshness picture for the availability card: how much of the catalogue is current. */
export const availabilityFreshness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: total }, { count: neverChecked }, { count: staleWeek }, { data: oldest }, { data: newest }] =
      await Promise.all([
        supabaseAdmin.from("movies").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null),
        supabaseAdmin
          .from("movies")
          .select("*", { count: "exact", head: true })
          .not("tmdb_id", "is", null)
          .is("availability_checked_at", null),
        supabaseAdmin
          .from("movies")
          .select("*", { count: "exact", head: true })
          .not("tmdb_id", "is", null)
          .lt("availability_checked_at", weekAgo),
        supabaseAdmin
          .from("movies")
          .select("availability_checked_at")
          .not("availability_checked_at", "is", null)
          .order("availability_checked_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("movies")
          .select("availability_checked_at")
          .not("availability_checked_at", "is", null)
          .order("availability_checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    return {
      total: total ?? 0,
      neverChecked: neverChecked ?? 0,
      staleOverAWeek: staleWeek ?? 0,
      oldestCheck: oldest?.availability_checked_at ?? null,
      newestCheck: newest?.availability_checked_at ?? null,
      staleBefore: weekAgo,
    };
  });

/**
 * Park or re-activate a show. Parked shows keep every episode and link but drop
 * out of the review queues and out of the user-facing app.
 */
export const setPodcastCuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ podcastId: z.string().uuid(), status: z.enum(["active", "parked"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("podcasts")
      .update({ curation_status: data.status })
      .eq("id", data.podcastId);
    if (error) throw error;
    return { ok: true, status: data.status };
  });

export const listIngestionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchUnlinkedEpisodes } = await import("./ingestion-helpers.server");

    const awaitingByStatus = (status: "active" | "parked") =>
      supabaseAdmin
        .from("episode_movies")
        .select("episode_id, podcast_episodes!inner(podcasts!inner(curation_status))", {
          count: "exact",
          head: true,
        })
        .neq("review_state", "confirmed")
        .eq("podcast_episodes.podcasts.curation_status", status);

    const [
      { count: movieCount },
      { count: podcastCount },
      { count: parkedCount },
      { count: episodeCount },
      { count: linkCount },
      { count: reviewLinkCount },
      { count: confirmedLinkCount },
      { count: awaitingActiveCount },
      { count: awaitingParkedCount },
      { count: flaggedCount },
      { count: retiredCount },
      { count: tmdbLinkedCount },
      unlinked,
      unlinkedAll,
    ] = await Promise.all([
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("podcasts")
        .select("*", { count: "exact", head: true })
        .eq("curation_status", "active"),
      supabaseAdmin
        .from("podcasts")
        .select("*", { count: "exact", head: true })
        .eq("curation_status", "parked"),
      supabaseAdmin.from("podcast_episodes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("episode_movies").select("*", { count: "exact", head: true }),
      // Explicit state, not an inferred confidence band: anything not confirmed
      // is still review work.
      supabaseAdmin
        .from("episode_movies")
        .select("*", { count: "exact", head: true })
        .neq("review_state", "confirmed"),
      // Progress you can watch grow, not just a shrinking backlog.
      supabaseAdmin
        .from("episode_movies")
        .select("*", { count: "exact", head: true })
        .eq("review_state", "confirmed"),
      awaitingByStatus("active"),
      awaitingByStatus("parked"),
      supabaseAdmin
        .from("episode_link_flags")
        .select("*", { count: "exact", head: true })
        .is("resolved_at", null),
      supabaseAdmin
        .from("podcast_episodes")
        .select("*", { count: "exact", head: true })
        .eq("disposition", "not_about_a_movie"),
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null),
      // Counted exactly the way the Unmatched episodes card counts (active shows
      // only), so the tile and the section can never disagree.
      fetchUnlinkedEpisodes(supabaseAdmin),
      // Same count with parked shows included, so nothing is silently invisible.
      fetchUnlinkedEpisodes(supabaseAdmin, { activeOnly: false }),
    ]);


    return {
      movies: movieCount ?? 0,
      podcasts: podcastCount ?? 0,
      parkedPodcasts: parkedCount ?? 0,
      episodes: episodeCount ?? 0,
      links: linkCount ?? 0,
      linksToReview: reviewLinkCount ?? 0,
      linksConfirmed: confirmedLinkCount ?? 0,
      linksToReviewActive: awaitingActiveCount ?? 0,
      linksToReviewParked: awaitingParkedCount ?? 0,
      flagged: flaggedCount ?? 0,
      retiredEpisodes: retiredCount ?? 0,
      tmdbLinked: tmdbLinkedCount ?? 0,
      unmatchedEpisodes: unlinked.length,
      unmatchedEpisodesAll: unlinkedAll.length,
    };

  });


export const enrichAllMovies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => BulkInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findBestTmdbMatch } = await import("./providers/tmdb.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const { data: movies, error: listError } = await supabaseAdmin
      .from("movies")
      .select("id, title, release_year, tmdb_id, poster_url")
      .order("title", { ascending: true });
    if (listError) throw listError;

    const todo = (movies ?? []).filter((m) => !m.tmdb_id || !m.poster_url).slice(0, data.limit);

    let updated = 0;
    const lowConfidence: string[] = [];
    const failed: string[] = [];

    for (const movie of todo) {
      try {
        const match = await findBestTmdbMatch(apiKey, movie.title, movie.release_year ?? undefined);
        if (!match) {
          failed.push(`${movie.title}: no TMDB match`);
        } else if (match.confidence < 60) {
          lowConfidence.push(`${movie.title} → ${match.title} (${match.confidence}%)`);
        } else {
          const { error } = await supabaseAdmin
            .from("movies")
            .update({
              title: match.title,
              release_year: match.releaseYear,
              release_date: nullIfBlank(match.releaseDate),
              runtime_minutes: match.runtime,
              synopsis: match.overview,
              tagline: match.tagline,
              poster_url: match.posterUrl,
              backdrop_url: match.backdropUrl,
              imdb_id: match.imdbId,
              tmdb_id: match.tmdbId,
              collection_id: match.collectionId,
            })
            .eq("id", movie.id);
          if (error) failed.push(`${movie.title}: ${error.message}`);
          else updated += 1;
        }
      } catch (err) {
        failed.push(`${movie.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(120);
    }

    const remaining = Math.max(
      0,
      (movies ?? []).filter((m) => !m.tmdb_id || !m.poster_url).length - todo.length,
    );

    return {
      attempted: todo.length,
      updated,
      remaining,
      lowConfidence: lowConfidence.slice(0, 20),
      failed: failed.slice(0, 20),
    };
  });

export const backfillPodcastArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => BulkInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchPodcastsByTitle, getPodcastByFeedUrl, bestArtwork } = await import(
      "./providers/podcastindex.server"
    );

    const apiKey = process.env["PODCAST_INDEX_API_KEY"];
    const apiSecret = process.env["PODCAST_INDEX_API_SECRET"];
    if (!apiKey || !apiSecret) throw new Error("Podcast Index credentials not configured");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const { data: podcasts, error: listError } = await supabaseAdmin
      .from("podcasts")
      .select("id, name, feed_url, artwork_url")
      .order("name", { ascending: true });
    if (listError) throw listError;

    const pending = (podcasts ?? []).filter((p) => !p.artwork_url);
    const todo = pending.slice(0, data.limit);

    let updated = 0;
    const failed: string[] = [];

    for (const podcast of todo) {
      try {
        let feed = podcast.feed_url
          ? await getPodcastByFeedUrl(apiKey, apiSecret, podcast.feed_url)
          : null;
        if (!feed) feed = await searchPodcastsByTitle(apiKey, apiSecret, podcast.name);
        if (!feed) {
          failed.push(`${podcast.name}: not found on Podcast Index`);
        } else {
          const { error } = await supabaseAdmin
            .from("podcasts")
            .update({
              artwork_url: bestArtwork(feed),
              description: feed.description || null,
              feed_url: feed.url,
              website_url: feed.link || null,
              episode_count: feed.episodeCount ?? 0,
              latest_episode_at: feed.lastUpdateTime
                ? new Date(feed.lastUpdateTime * 1000).toISOString().slice(0, 10)
                : null,
              external_ids: { podcastIndexId: feed.id },
              provider_source: "podcastindex",
            })
            .eq("id", podcast.id);
          if (error) failed.push(`${podcast.name}: ${error.message}`);
          else updated += 1;
        }
      } catch (err) {
        failed.push(`${podcast.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(150);
    }

    return {
      attempted: todo.length,
      updated,
      remaining: Math.max(0, pending.length - todo.length),
      failed: failed.slice(0, 20),
    };
  });

const ResolveInput = z.object({
  podcastId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(150).default(100),
});


/**
 * Podcast-first pipeline: unmatched episode title -> extracted movie title ->
 * TMDB lookup -> create/refresh movie -> link episode to it.
 */
export const resolveEpisodesToMovies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ResolveInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchUnlinkedEpisodes, fetchRejectedPairs, fetchReviewedEpisodeIds, upsertMovieFromTmdb } =
      await import("./ingestion-helpers.server");
    const { extractMovieTitleCandidates, looksNonMovieEpisode } = await import(
      "./providers/episode-title.server"
    );
    const { findBestTmdbMatch } = await import("./providers/tmdb.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const allUnlinked = await fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    const rejected = await fetchRejectedPairs(supabaseAdmin);
    // An episode signed off by an admin stays settled: an intentionally empty
    // set of links is a review decision, not a gap to fill in again.
    const reviewedEpisodes = await fetchReviewedEpisodeIds(supabaseAdmin);
    const todo = allUnlinked.filter((ep) => !reviewedEpisodes.has(ep.id)).slice(0, data.limit);


    let linked = 0;
    let moviesCreated = 0;

    // Honest accounting: every attempted episode ends in exactly one bucket, so
    // "linked 30 of 100" is always explained rather than silently short.
    type SkipReason =
      | "not_about_a_movie"
      | "no_title_extracted"
      | "no_tmdb_match"
      | "already_rejected"
      | "error";
    const REASON_LABEL: Record<SkipReason, string> = {
      not_about_a_movie: "Title looks like it isn't about a movie",
      no_title_extracted: "No movie title could be extracted from the episode title",
      no_tmdb_match: "TMDB had no confident match for the extracted title",
      already_rejected: "The only TMDB match is a pair you already rejected",
      error: "Errored during lookup",
    };
    const buckets = new Map<SkipReason, string[]>();
    const note = (reason: SkipReason, detail: string) => {
      const list = buckets.get(reason) ?? [];
      list.push(detail);
      buckets.set(reason, list);
    };

    for (const ep of todo) {
      if (looksNonMovieEpisode(ep.title)) {
        note("not_about_a_movie", ep.title);
        continue;
      }
      const candidates = extractMovieTitleCandidates(ep.title);
      if (candidates.length === 0) {
        note("no_title_extracted", ep.title);
        continue;
      }

      let outcome: "linked" | SkipReason = "no_tmdb_match";

      for (const candidate of candidates) {
        try {
          const match = await findBestTmdbMatch(apiKey, candidate.title, candidate.year ?? undefined);
          await sleep(120);
          if (!match) continue;

          const movie = await upsertMovieFromTmdb(supabaseAdmin, match, accentFor(match.title));
          if (movie.created) moviesCreated += 1;
          if (rejected.has(`${ep.id}:${movie.id}`)) {
            outcome = "already_rejected";
            continue;
          }

          const { error } = await supabaseAdmin.from("episode_movies").upsert(
            {
              episode_id: ep.id,
              movie_id: movie.id,
              match_method: match.confidence >= 85 ? "deterministic" : "heuristic",
              match_confidence: Math.min(1, match.confidence / 100),
              is_primary_subject: true,
              review_state: match.confidence >= 85 ? "auto_linked" : "proposed",
            },
            { onConflict: "episode_id, movie_id" },
          );
          if (error) throw error;
          linked += 1;
          outcome = "linked";
          break;
        } catch (err) {
          note("error", `${ep.title}: ${err instanceof Error ? err.message : String(err)}`);
          outcome = "linked"; // already accounted for in the error bucket
          break;
        }
      }

      if (outcome !== "linked") note(outcome, ep.title);
    }

    const skipReasons = [...buckets.entries()].map(([reason, titles]) => ({
      reason,
      label: REASON_LABEL[reason],
      count: titles.length,
      examples: titles.slice(0, 5),
    }));
    skipReasons.sort((a, b) => b.count - a.count);

    return {
      pool: allUnlinked.length,
      requested: data.limit,
      attempted: todo.length,
      linked,
      moviesCreated,
      skipped: todo.length - linked,
      skipReasons,
      remaining: Math.max(0, allUnlinked.length - todo.length),
    };
  });


/** Cheap backfill: re-match still-unlinked episodes against movies already in the catalogue. */
const RescanInput = ResolveInput.extend({
  /** Replace a weak existing link when a clearly better candidate now exists. */
  rescoreWeakLinks: z.boolean().default(true),
  /** Attach extra strong candidates (trilogies, double features) alongside the primary. */
  addExtraLinks: z.boolean().default(true),
});

/** A newly added movie can beat a weak link only by this margin (percentage points). */
const IMPROVE_MARGIN = 8;
/** Extra (non-primary) links need a higher bar than the primary link. */
const EXTRA_LINK_MIN = 70;
const MAX_EXTRA_LINKS = 2;

/**
 * Rechecks episodes against the movies already in the catalogue. Unlike the
 * first version this is not limited to episodes with zero links: weak
 * (non-manual, sub-80%) links get re-scored so a movie you just added can take
 * over, and strong runners-up are attached as extra links so an episode about a
 * trilogy can point at every film once they all exist. Manual/confirmed links
 * are never replaced, and rejected pairs are always skipped.
 */
export const rescanEpisodeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RescanInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      fetchAllEpisodes,
      fetchRejectedPairs,
      fetchRejectionCountsByMovie,
      fetchReviewedEpisodeIds,
      pageAll,
    } = await import("./ingestion-helpers.server");
    const { matchEpisodeToMovies, computeCommonEpisodeWords } = await import(
      "./providers/matching.server"
    );
    const { hasUsableEpisodeTitle, looksNonMovieEpisode } = await import(
      "./providers/episode-title.server"
    );

    // Reviewed episodes are out of scope for the rescan: their coverage only
    // changes through an explicit reopen or a manual edit.
    const reviewedEpisodes = await fetchReviewedEpisodeIds(supabaseAdmin);
    const episodes = (
      await fetchAllEpisodes(supabaseAdmin, { podcastId: data.podcastId })
    ).filter(
      (ep) =>
        ep.disposition !== "not_about_a_movie" &&
        !reviewedEpisodes.has(ep.id) &&
        hasUsableEpisodeTitle(ep.title) &&
        !looksNonMovieEpisode(ep.title),

    );
    const rejected = await fetchRejectedPairs(supabaseAdmin);
    const rejectionCountByMovie = await fetchRejectionCountsByMovie(supabaseAdmin);
    const movieList = await pageAll<{ id: string; title: string; release_year: number | null; collection_id: number | null }>(
      (from, to) => supabaseAdmin.from("movies").select("id, title, release_year, collection_id").range(from, to),
    );

    type LinkRow = {
      episode_id: string;
      movie_id: string;
      match_method: string;
      match_confidence: number;
      is_primary_subject: boolean;
    };
    const linkRows = await pageAll<LinkRow>((from, to) =>
      supabaseAdmin
        .from("episode_movies")
        .select("episode_id, movie_id, match_method, match_confidence, is_primary_subject")
        .range(from, to)
        .returns<LinkRow[]>(),
    );
    const linksByEpisode = new Map<string, LinkRow[]>();
    for (const row of linkRows) {
      const list = linksByEpisode.get(row.episode_id);
      if (list) list.push(row);
      else linksByEpisode.set(row.episode_id, [row]);
    }

    const commonEpisodeWords = computeCommonEpisodeWords(episodes.map((ep) => ep.title));

    let linked = 0;

    let improved = 0;
    let extraAdded = 0;
    let stillUnlinked = 0;

    const writeLink = async (
      episodeId: string,
      candidate: { movieId: string; confidence: number; signals: object },
      isPrimary: boolean,
    ) => {
      // Final guard: a rejected pair must never be written back, whatever the
      // caller thought.
      if (rejected.has(`${episodeId}:${candidate.movieId}`)) return false;
      const { error } = await supabaseAdmin.from("episode_movies").upsert(

        {
          episode_id: episodeId,
          movie_id: candidate.movieId,
          match_method: candidate.confidence >= 80 ? "deterministic" : "heuristic",
          match_confidence: candidate.confidence / 100,
          is_primary_subject: isPrimary,
          review_state: candidate.confidence >= 80 ? "auto_linked" : "proposed",
          signals: { ...candidate.signals } as Database["public"]["Tables"]["episode_movies"]["Row"]["signals"],
        },
        { onConflict: "episode_id, movie_id" },
      );
      return !error;
    };

    for (const ep of episodes) {
      const existing = linksByEpisode.get(ep.id) ?? [];
      const linkedMovieIds = new Set(existing.map((l) => l.movie_id));
      const candidates = matchEpisodeToMovies(ep.title, movieList, {
        rejectionCountByMovie,
        description: ep.description,
        commonEpisodeWords,
      }).filter((c) => !rejected.has(`${ep.id}:${c.movieId}`));


      // 1. No links at all — the original behaviour.
      if (existing.length === 0) {
        const top = candidates[0];
        if (!top || top.confidence < 50) {
          stillUnlinked += 1;
          continue;
        }
        if (await writeLink(ep.id, top, true)) linked += 1;
        else stillUnlinked += 1;
        linkedMovieIds.add(top.movieId);
      } else if (data.rescoreWeakLinks) {
        // 2. Re-score weak links: a link you confirmed by hand is untouchable,
        //    anything else can be beaten by a clearly better candidate.
        const weak = existing.filter(
          (l) => l.match_method !== "manual" && l.match_method !== "seed" && l.match_confidence < 0.8,
        );
        const best = candidates.find((c) => !linkedMovieIds.has(c.movieId));
        const weakest = weak.sort((a, b) => a.match_confidence - b.match_confidence)[0];
        if (
          best &&
          weakest &&
          best.confidence >= 50 &&
          best.confidence - Math.round(weakest.match_confidence * 100) >= IMPROVE_MARGIN
        ) {
          if (await writeLink(ep.id, best, weakest.is_primary_subject)) {
            await supabaseAdmin
              .from("episode_movies")
              .delete()
              .eq("episode_id", ep.id)
              .eq("movie_id", weakest.movie_id);
            await logMatchAction(supabaseAdmin, context.userId, {
              action: "relink",
              episodeId: ep.id,
              movieId: best.movieId,
              previousMovieId: weakest.movie_id,
              previousMethod: weakest.match_method,
              previousConfidence: weakest.match_confidence,
            });
            improved += 1;
            linkedMovieIds.add(best.movieId);
            linkedMovieIds.delete(weakest.movie_id);
          }
        }
      }

      // 3. Extra links for episodes that cover more than one film.
      if (data.addExtraLinks) {
        const extras = candidates
          .filter((c) => !linkedMovieIds.has(c.movieId) && c.confidence >= EXTRA_LINK_MIN)
          .slice(0, MAX_EXTRA_LINKS);
        for (const extra of extras) {
          if (await writeLink(ep.id, extra, false)) {
            extraAdded += 1;
            linkedMovieIds.add(extra.movieId);
          }
        }
      }
    }

    return { scanned: episodes.length, linked, improved, extraAdded, stillUnlinked };
  });

/** Safety net: nothing should be invisible, so expose every episode with no movie link. */
export const listUnmatchedEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ResolveInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchUnlinkedEpisodes } = await import("./ingestion-helpers.server");
    const [all, everything] = await Promise.all([
      fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId }),
      fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId, activeOnly: false }),
    ]);
    return {
      total: all.length,
      totalIncludingParked: everything.length,
      episodes: all.slice(0, data.limit).map((ep) => ({
        episodeId: ep.id,
        episodeTitle: ep.title,
        podcastName: ep.podcastName,
        releasedAt: ep.releasedAt,
      })),
    };
  });

// Lightweight episode-coverage report: stored episodes vs the feed's reported total.
export const listPodcastCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAll } = await import("./ingestion-helpers.server");

    const { data: podcasts, error } = await supabaseAdmin
      .from("podcasts")
      .select("id, name, episode_count, curation_status, sync_generation, last_synced_at")
      .order("name");
    if (error) throw error;

    // One paged read of every episode + link, then counted per show — far cheaper
    // than three count queries per podcast.
    const episodes = await pageAll<{ id: string; podcast_id: string; disposition: string }>(
      (from, to) =>
        supabaseAdmin.from("podcast_episodes").select("id, podcast_id, disposition").range(from, to),
    );
    // Pass U8 — per-episode review records. Only records made against the show's
    // current sync generation, and never reopened, count as current.
    const reviewRows = await pageAll<{
      episode_id: string;
      sync_generation: number;
      reopened_at: string | null;
    }>((from, to) =>
      supabaseAdmin
        .from("episode_reviews")
        .select("episode_id, sync_generation, reopened_at")
        .range(from, to),
    );
    const reviewByEpisode = new Map(reviewRows.map((r) => [r.episode_id, r]));

    const linkRows = await pageAll<{ episode_id: string; review_state: string }>((from, to) =>
      supabaseAdmin.from("episode_movies").select("episode_id, review_state").range(from, to),
    );
    const linked = new Set(linkRows.map((l) => l.episode_id));
    /**
     * Retired episodes ("not about a movie") are settled and are excluded from
     * every match review queue, so a stale unconfirmed link on one of them must
     * never be counted as outstanding work — otherwise the coverage line
     * advertises review work the UI is designed never to show.
     */
    const retiredEpisodeIds = new Set(
      episodes.filter((e) => e.disposition === "not_about_a_movie").map((e) => e.id),
    );
    // An episode counts as reviewed once every one of its links is confirmed.
    const openByEpisode = new Set(
      linkRows
        .filter((l) => l.review_state !== "confirmed" && !retiredEpisodeIds.has(l.episode_id))
        .map((l) => l.episode_id),
    );

    const rows = (podcasts ?? []).map((p) => {
      const generation = p.sync_generation ?? 1;
      const own = episodes.filter((e) => e.podcast_id === p.id);
      // Retired episodes count as retired even if a stale link still hangs off them.
      const retired = own.filter((e) => retiredEpisodeIds.has(e.id)).length;
      const linkedCount = own.filter((e) => linked.has(e.id) && !retiredEpisodeIds.has(e.id)).length;
      const awaitingReview = own.filter((e) => openByEpisode.has(e.id)).length;
      const reviewed = own.filter(
        (e) => (linked.has(e.id) && !openByEpisode.has(e.id)) || e.disposition === "not_about_a_movie",
      ).length;
      /**
       * Pass U8 — episode-level review completeness. An episode is reviewed when
       * it carries a review record that has not been reopened, or when it is
       * retired ("not about a movie", already settled and excluded from every
       * queue). A later feed sync is NOT a review reason on its own — only an
       * actual coverage change (link added/removed/flagged) reopens a review —
       * so `stored - episodesReviewed` equals the show's unreviewed queue size
       * without a sync silently wiping the whole show's sign-off.
       */
      const episodesReviewed = own.filter((e) => {
        if (retiredEpisodeIds.has(e.id)) return true;
        const rec = reviewByEpisode.get(e.id);
        return Boolean(rec && !rec.reopened_at);
      }).length;

      return {
        podcastId: p.id,
        name: p.name,
        stored: own.length,
        feedTotal: p.episode_count ?? 0,
        curationStatus: (p.curation_status ?? "active") as "active" | "parked",
        linked: linkedCount,
        retired,
        unmatched: own.length - linkedCount - retired,
        /** Links still proposed or auto-linked — the show is not fully reviewed. */
        awaitingReview,
        reviewed,
        episodesReviewed,
        episodesUnreviewed: own.length - episodesReviewed,
        syncGeneration: generation,
        lastSyncedAt: p.last_synced_at ?? null,
        fullyReviewed: own.length > 0 && awaitingReview === 0 && own.length - linkedCount - retired === 0,
        /** Feed reports more episodes than we stored — a sync would fetch more. */
        incomplete: (p.episode_count ?? 0) > own.length,
        missing: Math.max(0, (p.episode_count ?? 0) - own.length),

      };
    });


    return { podcasts: rows };
  });

/** Admin movie search used by the "wrong movie?" relink picker. */
export const searchMoviesByTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        term: z.string().min(1),
        year: z.number().int().min(1900).max(2030).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("movies")
      .select("id, title, release_year, slug")
      .ilike("title", `%${data.term}%`)
      .order("title")
      .limit(data.limit);
    if (data.year) query = query.eq("release_year", data.year);
    const { data: rows, error } = await query;
    if (error) throw error;
    return { movies: rows ?? [] };
  });

/**
 * Fix a wrong link: drop the bad pair (remembering the rejection so it is not
 * suggested again) and, when a replacement is given, link it as a manual match.
 */
export const relinkEpisodeMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        episodeId: z.string().uuid(),
        fromMovieId: z.string().uuid(),
        toMovieId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("episode_movies")
      .select("match_method, match_confidence")
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.fromMovieId)
      .maybeSingle();

    const { error: delError } = await supabaseAdmin
      .from("episode_movies")
      .delete()
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.fromMovieId);
    if (delError) throw delError;

    const { error: rejError } = await supabaseAdmin.from("episode_match_rejections").upsert(
      { episode_id: data.episodeId, movie_id: data.fromMovieId, rejected_by: context.userId },
      { onConflict: "episode_id, movie_id" },
    );
    if (rejError) throw rejError;

    if (data.toMovieId) {
      const { error: insError } = await supabaseAdmin.from("episode_movies").upsert(
        {
          episode_id: data.episodeId,
          movie_id: data.toMovieId,
          match_method: "manual",
          match_confidence: 1.0,
          is_primary_subject: true,
          review_state: "confirmed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: context.userId,
        },
        { onConflict: "episode_id, movie_id" },
      );
      if (insError) throw insError;
      await supabaseAdmin
        .from("episode_match_rejections")
        .delete()
        .eq("episode_id", data.episodeId)
        .eq("movie_id", data.toMovieId);
      await supabaseAdmin
        .from("podcast_episodes")
        .update({ disposition: "movie_matched" })
        .eq("id", data.episodeId);
    }
    await resolveOpenFlags(supabaseAdmin, data.episodeId, data.fromMovieId, "fixed");

    await logMatchAction(supabaseAdmin, context.userId, {
      action: data.toMovieId ? "relink" : "unlink",
      episodeId: data.episodeId,
      movieId: data.toMovieId ?? data.fromMovieId,
      previousMovieId: data.fromMovieId,
      previousMethod: existing?.match_method ?? null,
      previousConfidence: existing ? Number(existing.match_confidence) : null,
    });

    return { ok: true, relinked: Boolean(data.toMovieId) };
  });

/**
 * Pass U24 — episode description for match review, fetched lazily when a row is
 * expanded so the queue payload stays light. Also returns the best external
 * source so the reviewer can open the episode if the description isn't enough.
 */
export const getEpisodeDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ episodeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: ep }, { data: sources }] = await Promise.all([
      supabaseAdmin
        .from("podcast_episodes")
        .select("description")
        .eq("id", data.episodeId)
        .maybeSingle(),
      supabaseAdmin
        .from("episode_sources")
        .select("url, platform, is_primary")
        .eq("episode_id", data.episodeId),
    ]);

    const list = sources ?? [];
    const best = list.find((s) => s.is_primary) ?? list[0] ?? null;

    return {
      description: ep?.description?.trim() || null,
      sourceUrl: best?.url ?? null,
      sourcePlatform: best?.platform ?? null,
    };
  });


/** Worklist of existing links, searchable by podcast, episode or movie title. */
export const listEpisodeLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        podcastId: z.string().uuid().optional(),
        search: z.string().optional(),
        maxConfidence: z.number().min(0).max(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        /** Parked shows are out of scope by default, matching the Proposed tab. */
        includeParked: z.boolean().default(false),
        /**
         * Which review states to show. Default keeps the historical behaviour
         * (everything still awaiting a decision), but confirmed work is now
         * inspectable instead of invisible.
         */
        reviewState: z
          .enum(["unconfirmed", "proposed", "auto_linked", "confirmed", "all"])
          .default("unconfirmed"),

      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAll } = await import("./ingestion-helpers.server");

    type LinkRow = {
      episode_id: string;
      movie_id: string;
      match_method: string;
      match_confidence: number;
      review_state: "proposed" | "auto_linked" | "confirmed";
      podcast_episodes: {
        title: string;
        released_at: string | null;
        duration_seconds: number | null;
        podcast_id: string;
        disposition: string;
        podcasts: { id: string; name: string; curation_status: string };
      };
      movies: { id: string; title: string; release_year: number | null; slug: string };
    };

    const term = data.search?.trim();

    // Server-side filtering. Never push episode ids into the URL — that is what
    // returned a bare "Bad Request" for short terms like "us". PostgREST can't
    // OR across three embedded tables in one clause, so run one ilike query per
    // searchable column (episode title, show name, movie title) and merge.
    const baseQuery = (from: number, to: number) => {
      let q = supabaseAdmin
        .from("episode_movies")
        .select(
          "episode_id, movie_id, match_method, match_confidence, review_state, podcast_episodes!inner(title, released_at, duration_seconds, podcast_id, disposition, podcasts!inner(id, name, curation_status)), movies!inner(id, title, release_year, slug)",
        )
        .lte("match_confidence", data.maxConfidence)
        // Retired episodes are settled — they must not reappear as review work.
        .neq("podcast_episodes.disposition", "not_about_a_movie")
        .order("match_confidence", { ascending: true })
        .order("episode_id", { ascending: true })
        .range(from, to);
      if (data.reviewState === "unconfirmed") q = q.neq("review_state", "confirmed");
      else if (data.reviewState !== "all") q = q.eq("review_state", data.reviewState);
      if (data.podcastId) q = q.eq("podcast_episodes.podcast_id", data.podcastId);
      if (!data.includeParked) q = q.eq("podcast_episodes.podcasts.curation_status", "active");
      return q;
    };

    // Unfiltered queue size for the same band/podcast/parked filters, so the tab
    // badge stays stable while the search box narrows the visible rows.
    const countUnfiltered = async () => {
      let q = supabaseAdmin
        .from("episode_movies")
        .select(
          "episode_id, podcast_episodes!inner(disposition, podcast_id, podcasts!inner(curation_status))",
          { count: "exact", head: true },
        )
        .lte("match_confidence", data.maxConfidence)
        .neq("podcast_episodes.disposition", "not_about_a_movie");
      if (data.reviewState === "unconfirmed") q = q.neq("review_state", "confirmed");
      else if (data.reviewState !== "all") q = q.eq("review_state", data.reviewState);
      if (data.podcastId) q = q.eq("podcast_episodes.podcast_id", data.podcastId);
      if (!data.includeParked) q = q.eq("podcast_episodes.podcasts.curation_status", "active");

      const { count } = await q;
      return count ?? 0;
    };

    const pattern = term ? `%${term}%` : null;
    const rows: LinkRow[] = pattern
      ? (
          await Promise.all([
            pageAll<LinkRow>((f, t) =>
              baseQuery(f, t).ilike("podcast_episodes.title", pattern).returns<LinkRow[]>(),
            ),
            pageAll<LinkRow>((f, t) =>
              baseQuery(f, t).ilike("podcast_episodes.podcasts.name", pattern).returns<LinkRow[]>(),
            ),
            pageAll<LinkRow>((f, t) =>
              baseQuery(f, t).ilike("movies.title", pattern).returns<LinkRow[]>(),
            ),
          ])
        ).flat()
      : await pageAll<LinkRow>((f, t) => baseQuery(f, t).returns<LinkRow[]>());


    // Dedupe: a term can match episode, show and movie titles at once.
    const seen = new Set<string>();
    const filtered = rows
      .filter((r) => {
        const key = `${r.episode_id}:${r.movie_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          Number(a.match_confidence) - Number(b.match_confidence) ||
          a.episode_id.localeCompare(b.episode_id),
      );

    return {
      // Same query that produced the rows, so the count can never disagree.
      total: filtered.length,
      unfilteredTotal: pattern ? await countUnfiltered() : filtered.length,
      offset: data.offset,

      links: filtered.slice(data.offset, data.offset + data.limit).map((r) => ({
        episodeId: r.episode_id,
        movieId: r.movie_id,
        episodeTitle: r.podcast_episodes.title,
        releasedAt: r.podcast_episodes.released_at,
        durationSeconds: r.podcast_episodes.duration_seconds,
        podcastId: r.podcast_episodes.podcast_id,
        podcastName: r.podcast_episodes.podcasts.name,
        parked: r.podcast_episodes.podcasts.curation_status === "parked",
        movieTitle: r.movies.title,
        movieYear: r.movies.release_year,
        movieSlug: r.movies.slug,
        method: r.match_method,
        reviewState: r.review_state,
        confidence: Number(r.match_confidence),
      })),
    };
  });


/** Marks an existing link as correct so it drops out of the review queue for good. */
export const confirmEpisodeMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EpisodeMatchInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("episode_movies")
      .select("match_method, match_confidence")
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.movieId)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("episode_movies").upsert(
      {
        episode_id: data.episodeId,
        movie_id: data.movieId,
        match_method: "manual",
        match_confidence: 1.0,
        is_primary_subject: true,
        review_state: "confirmed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      },
      { onConflict: "episode_id, movie_id" },
    );
    if (error) throw error;
    await supabaseAdmin
      .from("podcast_episodes")
      .update({ disposition: "movie_matched" })
      .eq("id", data.episodeId);
    await resolveOpenFlags(supabaseAdmin, data.episodeId, data.movieId, "dismissed");
    await logMatchAction(supabaseAdmin, context.userId, {
      action: "confirm",
      episodeId: data.episodeId,
      movieId: data.movieId,
      previousMethod: existing?.match_method ?? null,
      previousConfidence: existing ? Number(existing.match_confidence) : null,
    });
    return { ok: true };
  });

/**
 * Retires an episode from every review queue — it is not about a movie.
 * Its existing links are removed and recorded as rejections, otherwise the
 * episode kept reappearing forever under "Existing links".
 */
async function retireEpisode(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  userId: string,
  episodeId: string,
): Promise<number> {

  const { data: links } = await admin
    .from("episode_movies")
    .select("movie_id, match_method, match_confidence")
    .eq("episode_id", episodeId);

  for (const link of links ?? []) {
    await admin.from("episode_movies").delete().eq("episode_id", episodeId).eq("movie_id", link.movie_id);
    await resolveOpenFlags(admin, episodeId, link.movie_id, "fixed");
    await admin
      .from("episode_match_rejections")
      .upsert(
        { episode_id: episodeId, movie_id: link.movie_id, rejected_by: userId },
        { onConflict: "episode_id, movie_id" },
      );
    await logMatchAction(admin, userId, {
      action: "unlink",
      episodeId,
      movieId: link.movie_id,
      previousMethod: link.match_method,
      previousConfidence: link.match_confidence === null ? null : Number(link.match_confidence),
    });
  }

  const { error } = await admin
    .from("podcast_episodes")
    .update({ disposition: "not_about_a_movie" })
    .eq("id", episodeId);
  if (error) throw error;
  await logMatchAction(admin, userId, { action: "not_about_a_movie", episodeId });
  return (links ?? []).length;
}

export const markEpisodeNotAboutMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ episodeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const removed = await retireEpisode(supabaseAdmin, context.userId, data.episodeId);
    return { ok: true, linksRemoved: removed };
  });

const BulkDecisionInput = z.object({
  action: z.enum(["approve", "reject", "confirm", "unlink", "retire"]),
  pairs: z
    .array(z.object({ episodeId: z.string().uuid(), movieId: z.string().uuid() }))
    .min(1)
    .max(200),
});


/**
 * One request, many decisions — a failure on one row never aborts the batch.
 *
 * Pass U12: every pair reports its own outcome, and each outcome is *verified*
 * against the database afterwards (link actually gone for unlink/reject, link
 * actually confirmed for approve/confirm). The client only hides rows the
 * server says really changed, so nothing can "vanish then come back".
 */
export const bulkMatchDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => BulkDecisionInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: {
      episodeId: string;
      movieId: string;
      ok: boolean;
      /** Set when ok is false — shown to the admin instead of a silent no-op. */
      error?: string;
    }[] = [];

    for (const pair of data.pairs) {
      try {
        const { data: existing } = await supabaseAdmin
          .from("episode_movies")
          .select("match_method, match_confidence")
          .eq("episode_id", pair.episodeId)
          .eq("movie_id", pair.movieId)
          .maybeSingle();

        if (data.action === "retire") {
          // Retiring covers the whole episode: links removed, rejections recorded.
          await retireEpisode(supabaseAdmin, context.userId, pair.episodeId);
          const { data: stillLinked } = await supabaseAdmin
            .from("episode_movies")
            .select("movie_id")
            .eq("episode_id", pair.episodeId)
            .limit(1);
          if ((stillLinked ?? []).length > 0) throw new Error("links remained after retire");
          results.push({ ...pair, ok: true });
          continue;
        }

        if (data.action === "approve" || data.action === "confirm") {
          const { error } = await supabaseAdmin.from("episode_movies").upsert(
            {
              episode_id: pair.episodeId,
              movie_id: pair.movieId,
              match_method: "manual",
              match_confidence: data.action === "confirm" ? 1.0 : 0.95,
              is_primary_subject: true,
              // Without this the link stayed "auto_linked" and reappeared in the
              // unconfirmed queue on the next refresh.
              review_state: "confirmed",
              reviewed_at: new Date().toISOString(),
              reviewed_by: context.userId,
            },
            { onConflict: "episode_id, movie_id" },
          );
          if (error) throw error;
          const { data: check } = await supabaseAdmin
            .from("episode_movies")
            .select("review_state")
            .eq("episode_id", pair.episodeId)
            .eq("movie_id", pair.movieId)
            .maybeSingle();
          if (check?.review_state !== "confirmed") throw new Error("link did not persist as confirmed");
          await supabaseAdmin
            .from("episode_match_rejections")
            .delete()
            .eq("episode_id", pair.episodeId)
            .eq("movie_id", pair.movieId);
          await supabaseAdmin
            .from("podcast_episodes")
            .update({ disposition: "movie_matched" })
            .eq("id", pair.episodeId);
          await resolveOpenFlags(supabaseAdmin, pair.episodeId, pair.movieId, "dismissed");
        } else {
          // `.select()` makes the delete report the rows it actually removed —
          // a bare delete returns no error even when it matched nothing.
          const { data: removed, error } = await supabaseAdmin
            .from("episode_movies")
            .delete()
            .eq("episode_id", pair.episodeId)
            .eq("movie_id", pair.movieId)
            .select("episode_id");
          if (error) throw error;
          if ((removed ?? []).length === 0) {
            // Nothing deleted: only acceptable if the link is genuinely absent
            // (someone else already removed it). Otherwise it is a real failure.
            const { data: stillThere } = await supabaseAdmin
              .from("episode_movies")
              .select("episode_id")
              .eq("episode_id", pair.episodeId)
              .eq("movie_id", pair.movieId)
              .maybeSingle();
            if (stillThere) throw new Error("link could not be removed");
          }
          const { error: rejError } = await supabaseAdmin.from("episode_match_rejections").upsert(
            { episode_id: pair.episodeId, movie_id: pair.movieId, rejected_by: context.userId },
            { onConflict: "episode_id, movie_id" },
          );
          if (rejError) throw rejError;
          await resolveOpenFlags(supabaseAdmin, pair.episodeId, pair.movieId, "fixed");
        }

        await logMatchAction(supabaseAdmin, context.userId, {
          action: data.action,
          episodeId: pair.episodeId,
          movieId: pair.movieId,
          previousMethod: existing?.match_method ?? null,
          previousConfidence: existing ? Number(existing.match_confidence) : null,
        });
        results.push({ ...pair, ok: true });
      } catch (e) {
        results.push({ ...pair, ok: false, error: e instanceof Error ? e.message : "unknown error" });
      }
    }

    const failures = results.filter((r) => !r.ok);
    return {
      attempted: data.pairs.length,
      succeeded: results.length - failures.length,
      /** Per-pair truth: the client hides only the pairs marked ok. */
      results,
      failed: failures.slice(0, 10).map((r) => r.error ?? "unknown error"),
    };
  });

/** Recent match decisions, newest first, so a misclick can be undone. */
export const listMatchActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("match_actions")
      .select(
        // Two FKs point at movies, so the embed must name the constraint.
        "id, action, episode_id, movie_id, previous_method, previous_confidence, undone_at, created_at, podcast_episodes!inner(title, podcasts!inner(name)), movies!match_actions_movie_id_fkey(title, release_year)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit)
      .returns<
        {
          id: string;
          action: string;
          episode_id: string;
          movie_id: string | null;
          previous_method: string | null;
          previous_confidence: number | null;
          undone_at: string | null;
          created_at: string;
          podcast_episodes: { title: string; podcasts: { name: string } };
          movies: { title: string; release_year: number | null } | null;
        }[]
      >();
    if (error) throw error;

    return {
      actions: (rows ?? []).map((r) => ({
        id: r.id,
        action: r.action,
        episodeId: r.episode_id,
        movieId: r.movie_id,
        episodeTitle: r.podcast_episodes.title,
        podcastName: r.podcast_episodes.podcasts.name,
        movieTitle: r.movies?.title ?? null,
        movieYear: r.movies?.release_year ?? null,
        undone: Boolean(r.undone_at),
        createdAt: r.created_at,
      })),
    };
  });

/** Reverses a single logged decision and restores the prior link state. */
export const undoMatchAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ actionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: action, error } = await supabaseAdmin
      .from("match_actions")
      .select("*")
      .eq("id", data.actionId)
      .maybeSingle();
    if (error) throw error;
    if (!action) throw new Error("That action no longer exists.");
    if (action.undone_at) throw new Error("That action was already undone.");

    const episodeId = action.episode_id;
    const movieId = action.movie_id;

    if (action.action === "not_about_a_movie") {
      await supabaseAdmin
        .from("podcast_episodes")
        .update({ disposition: "needs_review" })
        .eq("id", episodeId);
    } else if (action.action === "approve" || action.action === "confirm") {
      // Undo a link that this action created or re-stamped.
      if (movieId) {
        if (action.previous_method) {
          await supabaseAdmin
            .from("episode_movies")
            .update({
              match_method: action.previous_method,
              match_confidence: action.previous_confidence ?? 0.5,
            })
            .eq("episode_id", episodeId)
            .eq("movie_id", movieId);
        } else {
          await supabaseAdmin
            .from("episode_movies")
            .delete()
            .eq("episode_id", episodeId)
            .eq("movie_id", movieId);
        }
      }
    } else if (action.action === "reject" || action.action === "unlink") {
      // Restore the link that was removed and forget the rejection.
      if (movieId) {
        await supabaseAdmin.from("episode_movies").upsert(
          {
            episode_id: episodeId,
            movie_id: movieId,
            match_method: action.previous_method ?? "heuristic",
            match_confidence: action.previous_confidence ?? 0.5,
            is_primary_subject: true,
          },
          { onConflict: "episode_id, movie_id" },
        );
        await supabaseAdmin
          .from("episode_match_rejections")
          .delete()
          .eq("episode_id", episodeId)
          .eq("movie_id", movieId);
      }
    } else if (action.action === "relink") {
      // Drop the new link, restore the old one, forget its rejection.
      if (movieId) {
        await supabaseAdmin
          .from("episode_movies")
          .delete()
          .eq("episode_id", episodeId)
          .eq("movie_id", movieId);
      }
      if (action.previous_movie_id) {
        await supabaseAdmin.from("episode_movies").upsert(
          {
            episode_id: episodeId,
            movie_id: action.previous_movie_id,
            match_method: action.previous_method ?? "heuristic",
            match_confidence: action.previous_confidence ?? 0.5,
            is_primary_subject: true,
          },
          { onConflict: "episode_id, movie_id" },
        );
        await supabaseAdmin
          .from("episode_match_rejections")
          .delete()
          .eq("episode_id", episodeId)
          .eq("movie_id", action.previous_movie_id);
      }
    }

    await supabaseAdmin
      .from("match_actions")
      .update({ undone_at: new Date().toISOString() })
      .eq("id", data.actionId);

    return { ok: true };
  });

/** Open "wrong movie?" flags raised from the app — the highest-signal review queue. */
export const listFlaggedLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { pageAll } = await import("./ingestion-helpers.server");

    const [rows, liveLinks] = await Promise.all([
      pageAll<{
        id: string;
        episode_id: string;
        movie_id: string;
        note: string | null;
        created_at: string;
        podcast_episodes: { title: string; released_at: string | null; duration_seconds: number | null; podcasts: { name: string; curation_status: string } };
        movies: { title: string; release_year: number | null };
      }>((from, to) =>
        supabaseAdmin
          .from("episode_link_flags")
          .select(
            "id, episode_id, movie_id, note, created_at, podcast_episodes!inner(title, released_at, duration_seconds, podcasts!inner(name, curation_status)), movies!inner(title, release_year)",
          )
          .is("resolved_at", null)
          .order("created_at", { ascending: false })
          .range(from, to)
          .returns<
            {
              id: string;
              episode_id: string;
              movie_id: string;
              note: string | null;
              created_at: string;
              podcast_episodes: { title: string; released_at: string | null; duration_seconds: number | null; podcasts: { name: string; curation_status: string } };
              movies: { title: string; release_year: number | null };
            }[]
          >(),
      ),
      pageAll<{ episode_id: string; movie_id: string }>((from, to) =>
        supabaseAdmin.from("episode_movies").select("episode_id, movie_id").range(from, to),
      ),
    ]);
    const live = new Set(liveLinks.map((l) => `${l.episode_id}:${l.movie_id}`));
    const activeRows = rows.filter(
      (r) => live.has(`${r.episode_id}:${r.movie_id}`) && r.podcast_episodes.podcasts.curation_status === "active",
    );
    const term = data.search?.trim().toLowerCase();
    const filtered = term
      ? activeRows.filter(
          (r) =>
            r.podcast_episodes.title.toLowerCase().includes(term) ||
            r.podcast_episodes.podcasts.name.toLowerCase().includes(term) ||
            r.movies.title.toLowerCase().includes(term),
        )
      : activeRows;

    return {
      total: filtered.length,
      unfilteredTotal: activeRows.length,
      offset: data.offset,
      flags: filtered.slice(data.offset, data.offset + data.limit).map((r) => ({
        flagId: r.id,
        episodeId: r.episode_id,
        movieId: r.movie_id,
        episodeTitle: r.podcast_episodes.title.trim() || "Untitled episode",
        releasedAt: r.podcast_episodes.released_at,
        durationSeconds: r.podcast_episodes.duration_seconds,
        podcastName: r.podcast_episodes.podcasts.name,
        movieTitle: r.movies.title,
        movieYear: r.movies.release_year,
        note: r.note,
        createdAt: r.created_at,
      })),
    };
  });

/** Marks every open flag on a pair as handled, without changing the link itself. */
export const resolveEpisodeFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        episodeId: z.string().uuid(),
        movieId: z.string().uuid(),
        resolution: z.enum(["fixed", "dismissed"]).default("fixed"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await resolveOpenFlags(supabaseAdmin, data.episodeId, data.movieId, data.resolution);
    return { ok: true };
  });

/**
 * Pass R3 — replays the current scoring rules over every approve/reject label
 * and reports precision, recall and where the mistakes cluster. Database only.
 */
export const scoreMatcher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { evaluateMatcher } = await import("./matcher-eval.server");
    return evaluateMatcher(supabaseAdmin);
  });

/**
 * Pass Y — content ratings backfill. Chunked and resumable: unchecked movies
 * first, then the stalest, so repeated runs always make progress.
 */
export const backfillContentRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ limit: z.number().int().min(1).max(200).default(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTmdbMovieCertification, getTmdbTvCertification } = await import(
      "./providers/tmdb.server"
    );
    const { pageAll } = await import("./ingestion-helpers.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const rows = await pageAll<{
      id: string;
      title: string;
      tmdb_id: number | null;
      media_type: string;
      certification_checked_at: string | null;
    }>((from, to) =>
      supabaseAdmin
        .from("movies")
        .select("id, title, tmdb_id, media_type, certification_checked_at")
        .order("title")
        .range(from, to),
    );

    const withTmdb = rows.filter((m) => m.tmdb_id);
    const queue = withTmdb
      .slice()
      .sort((a, b) =>
        (a.certification_checked_at ?? "").localeCompare(b.certification_checked_at ?? ""),
      );
    const todo = queue.slice(0, data.limit);

    let updated = 0;
    let rated = 0;
    const failed: string[] = [];

    for (const movie of todo) {
      try {
        const result =
          movie.media_type === "tv"
            ? await getTmdbTvCertification(apiKey, movie.tmdb_id!)
            : await getTmdbMovieCertification(apiKey, movie.tmdb_id!);
        const { error } = await supabaseAdmin
          .from("movies")
          .update({
            certification: result.certification,
            certification_system: result.system,
            certification_checked_at: new Date().toISOString(),
          })
          .eq("id", movie.id);
        if (error) failed.push(`${movie.title}: ${error.message}`);
        else {
          updated += 1;
          if (result.certification) rated += 1;
        }
      } catch (err) {
        failed.push(`${movie.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(110);
    }

    const unchecked = withTmdb.filter((m) => !m.certification_checked_at).length;
    return {
      attempted: todo.length,
      updated,
      rated,
      /** Movies still never checked after this run. */
      remaining: Math.max(0, unchecked - todo.length),
      totalWithTmdb: withTmdb.length,
      missingTmdb: rows.length - withTmdb.length,
      failed: failed.slice(0, 20),
    };
  });

/**
 * Pass U8 — episode-level "review complete".
 *
 * Review completeness is per episode and independent of link `review_state`: an
 * episode with no links at all can be marked reviewed, and an episode with a
 * confirmed link is not reviewed until someone says so. A record remains
 * current until it is explicitly reopened; feed syncs alone do not invalidate it.
 */
const EpisodeReviewInput = z.object({
  episodeIds: z.array(z.string().uuid()).min(1).max(200),
  reviewed: z.boolean(),
});

type EpisodeGenerationRow = {
  id: string;
  podcast_id: string;
  disposition: string;
  podcasts: { sync_generation: number | null };
};

/** Supabase `.in()` filters travel in the URL, so batch ids to keep it short. */
const EPISODE_ID_CHUNK = 50;

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += EPISODE_ID_CHUNK) out.push(ids.slice(i, i + EPISODE_ID_CHUNK));
  return out;
}

async function loadEpisodeGenerations(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  episodeIds: string[],
): Promise<Map<string, EpisodeGenerationRow>> {
  const map = new Map<string, EpisodeGenerationRow>();
  for (const chunk of chunkIds(episodeIds)) {
    const { data, error } = await admin
      .from("podcast_episodes")
      .select("id, podcast_id, disposition, podcasts!inner(sync_generation)")
      .in("id", chunk)
      .returns<EpisodeGenerationRow[]>();
    if (error) throw error;
    for (const row of data ?? []) map.set(row.id, row);
  }
  return map;
}


/** Mark reviewed / Reopen, one episode or a bulk selection, verified per episode. */
export const setEpisodeReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EpisodeReviewInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const generations = await loadEpisodeGenerations(supabaseAdmin, data.episodeIds);

    const results: { episodeId: string; ok: boolean; error?: string }[] = [];

    for (const episodeId of data.episodeIds) {
      try {
        if (data.reviewed) {
          const meta = generations.get(episodeId);
          if (!meta) throw new Error("episode not found");
          const generation = meta.podcasts?.sync_generation ?? 1;
          // One row per episode: re-marking updates in place, never duplicates.
          const { error } = await supabaseAdmin.from("episode_reviews").upsert(
            {
              episode_id: episodeId,
              reviewed_at: new Date().toISOString(),
              reviewed_by: context.userId,
              sync_generation: generation,
              reopened_at: null,
              reopen_reason: null,
            },
            { onConflict: "episode_id" },
          );
          if (error) throw error;
          const { data: check } = await supabaseAdmin
            .from("episode_reviews")
            .select("sync_generation, reopened_at")
            .eq("episode_id", episodeId)
            .maybeSingle();
          if (!check || check.reopened_at || check.sync_generation !== generation) {
            throw new Error("review did not persist");
          }
        } else {
          // Reopen keeps the record (history) but stops it counting as current.
          const { error } = await supabaseAdmin
            .from("episode_reviews")
            .update({ reopened_at: new Date().toISOString(), reopen_reason: "manual_reopen" })
            .eq("episode_id", episodeId);
          if (error) throw error;
          const { data: check } = await supabaseAdmin
            .from("episode_reviews")
            .select("reopened_at")
            .eq("episode_id", episodeId)
            .maybeSingle();
          if (check && !check.reopened_at) throw new Error("reopen did not persist");
        }
        results.push({ episodeId, ok: true });
      } catch (e) {
        results.push({ episodeId, ok: false, error: e instanceof Error ? e.message : "unknown error" });
      }
    }

    const failures = results.filter((r) => !r.ok);
    return {
      attempted: data.episodeIds.length,
      succeeded: results.length - failures.length,
      results,
      failed: failures.slice(0, 10).map((r) => r.error ?? "unknown error"),
    };
  });

/**
 * Current review state for the episodes on screen. Queryable by episode, and —
 * via `episode_movies` — by show or linked movie, which is what Pass U27's
 * goal-directed review needs without another migration.
 */
export const listEpisodeReviewStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ episodeIds: z.array(z.string().uuid()).max(1200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.episodeIds.length === 0) return { reviews: {} as Record<string, EpisodeReviewState> };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const generations = await loadEpisodeGenerations(supabaseAdmin, data.episodeIds);
    const recs = new Map<
      string,
      { episode_id: string; reviewed_at: string | null; sync_generation: number; reopened_at: string | null }
    >();
    for (const chunk of chunkIds(data.episodeIds)) {
      const { data: rows, error } = await supabaseAdmin
        .from("episode_reviews")
        .select("episode_id, reviewed_at, sync_generation, reopened_at")
        .in("episode_id", chunk);
      if (error) throw error;
      for (const row of rows ?? []) recs.set(row.episode_id, row);
    }


    const reviews: Record<string, EpisodeReviewState> = {};
    for (const episodeId of data.episodeIds) {
      const rec = recs.get(episodeId);
      // Currency is decided by explicit invalidation only, never by a newer
      // feed sync (see listPodcastCoverage).
      const current = Boolean(rec && !rec.reopened_at);
      reviews[episodeId] = {
        reviewed: current,
        reviewedAt: rec?.reviewed_at ?? null,
        /** A record exists but no longer counts (explicitly reopened). */
        hasStaleRecord: Boolean(rec) && !current,
      };
    }

    return { reviews };
  });

export interface EpisodeReviewState {
  reviewed: boolean;
  reviewedAt: string | null;
  hasStaleRecord: boolean;
}
