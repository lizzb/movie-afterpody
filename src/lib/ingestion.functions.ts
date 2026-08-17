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
});

const RefreshAvailabilityInput = z.object({
  region: z.string().default("US"),
});

const BulkInput = z.object({
  limit: z.number().int().min(1).max(60).default(25),
});

const SuggestMatchesInput = z.object({
  podcastId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
});

async function requireAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: admin required");
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
    bestArtwork,
    matchEpisodeToMovies,
    findBestTmdbMatch,
    getTmdbWatchProviders,
  };
}

const TMDB_PROVIDER_TO_SLUG: Record<number, string> = {
  8: "netflix",
  9: "prime-video",
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
    const { data: movies } = await clients.supabaseAdmin.from("movies").select("id, title, release_year");
    const movieList = movies ?? [];

    let insertedEpisodes = 0;
    let insertedMatches = 0;
    let pendingMatches = 0;

    for (const ep of episodes) {
      const epSlug = clients.episodeSlug(upsertedPodcast.slug, ep.title);
      const releasedAt = ep.datePublished ? new Date(ep.datePublished * 1000).toISOString().slice(0, 10) : null;
      const { data: upsertedEp, error: epError } = await clients.supabaseAdmin
        .from("podcast_episodes")
        .upsert(
          {
            podcast_id: upsertedPodcast.id,
            slug: epSlug,
            title: ep.title,
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
        console.warn("Episode upsert failed:", epError?.message);
        continue;
      }
      insertedEpisodes += 1;

      try {
        await clients.supabaseAdmin.from("episode_sources").upsert(
          {
            episode_id: upsertedEp.id,
            platform: "podcast_index",
            url:
              ep.enclosureUrl ||
              `https://podcasts.apple.com/search?term=${encodeURIComponent(feed.title + " " + ep.title)}`,
            access_tier: "public",
            is_primary: true,
            embeddable: false,
          },
          { onConflict: "episode_id, platform" },
        );
      } catch {
        /* source insert is best-effort */
      }

      const candidates = clients.matchEpisodeToMovies(ep.title, movieList);
      const top = candidates[0];
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
          pendingMatches += 1;
        }
      }
    }

    return {
      podcast: upsertedPodcast,
      episodesFetched: episodes.length,
      episodesInserted: insertedEpisodes,
      matchesInserted: insertedMatches,
      pendingMatches,
    };
  });

export const suggestEpisodeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SuggestMatchesInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchEpisodeToMovies } = await import("./providers/matching.server");

    let episodeQuery = supabaseAdmin
      .from("podcast_episodes")
      .select("id, slug, title, podcast_id, podcasts!inner(id, slug, name)")
      .order("released_at", { ascending: false });

    if (data.episodeId) {
      episodeQuery = episodeQuery.eq("id", data.episodeId);
    } else if (data.podcastId) {
      episodeQuery = episodeQuery.eq("podcast_id", data.podcastId);
    }

    const { data: episodes, error } = await episodeQuery.returns<
      {
        id: string;
        slug: string;
        title: string;
        podcast_id: string;
        podcasts: { id: string; slug: string; name: string };
      }[]
    >();
    if (error) throw error;

    const { data: movies } = await supabaseAdmin.from("movies").select("id, title, release_year");
    const movieList = movies ?? [];

    const episodeIds = (episodes ?? []).map((ep) => ep.id);

    // Already-decided pairs: confirmed links and admin rejections.
    const [{ data: existingLinks }, { data: rejections }] = await Promise.all([
      supabaseAdmin
        .from("episode_movies")
        .select("episode_id, movie_id, match_method")
        .in("episode_id", episodeIds.length ? episodeIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("episode_match_rejections")
        .select("episode_id, movie_id")
        .in("episode_id", episodeIds.length ? episodeIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const rejectedPairs = new Set((rejections ?? []).map((r) => `${r.episode_id}:${r.movie_id}`));
    // Confirmed = anything an admin approved or a high-confidence deterministic link.
    const confirmedEpisodes = new Set(
      (existingLinks ?? [])
        .filter((l) => l.match_method === "manual" || l.match_method === "deterministic" || l.match_method === "seed")
        .map((l) => l.episode_id),
    );

    const suggestions = (episodes ?? [])
      .filter((ep) => !ep.title.toLowerCase().includes("trailer"))
      .filter((ep) => !confirmedEpisodes.has(ep.id))
      .map((ep) => {
        const candidates = matchEpisodeToMovies(ep.title, movieList).filter(
          (c) => !rejectedPairs.has(`${ep.id}:${c.movieId}`),
        );
        const top = candidates[0];
        return {
          episodeId: ep.id,
          episodeSlug: ep.slug,
          episodeTitle: ep.title,
          podcastId: ep.podcast_id,
          podcastName: ep.podcasts.name,
          topCandidate: top
            ? {
                movieId: top.movieId,
                title: top.title,
                releaseYear: top.releaseYear,
                confidence: top.confidence,
                reason: top.reason,
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
      .filter((s) => s.topCandidate !== null);

    return { suggestions };
  });


export const approveEpisodeMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EpisodeMatchInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("episode_movies").upsert(
      {
        episode_id: data.episodeId,
        movie_id: data.movieId,
        match_method: "manual",
        match_confidence: 0.95,
        is_primary_subject: true,
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
    return { ok: true };
  });

export const rejectEpisodeMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EpisodeMatchInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    return { ok: true };

  });

export const enrichMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EnrichMovieInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findBestTmdbMatch } = await import("./providers/tmdb.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    let title = data.title;
    let year = data.year;
    const movieId = data.movieId;

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

    if (!title) throw new Error("Movie title required");

    const match = await findBestTmdbMatch(apiKey, title, year);
    if (!match) throw new Error(`No TMDB match found for "${title}"`);

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
    const { getTmdbWatchProviders } = await import("./providers/tmdb.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    const { data: movies } = await supabaseAdmin
      .from("movies")
      .select("id, tmdb_id, title")
      .not("tmdb_id", "is", null);
    const { data: services } = await supabaseAdmin.from("streaming_services").select("id, slug");
    const serviceBySlug = new Map((services ?? []).map((s) => [s.slug, s.id]));

    let updated = 0;
    const failed: string[] = [];

    for (const movie of movies ?? []) {
      if (!movie.tmdb_id) continue;
      try {
        const providers = await getTmdbWatchProviders(apiKey, movie.tmdb_id);
        const region = providers.results?.[data.region];
        const offers = [
          ...(region?.flatrate ?? []).map((p) => ({ ...p, offer_type: "subscription" as const })),
          ...(region?.ads ?? []).map((p) => ({ ...p, offer_type: "free_ads" as const })),
          ...(region?.rent ?? []).map((p) => ({ ...p, offer_type: "rent" as const })),
          ...(region?.buy ?? []).map((p) => ({ ...p, offer_type: "buy" as const })),
        ];

        for (const offer of offers) {
          const slug = TMDB_PROVIDER_TO_SLUG[offer.provider_id];
          if (!slug) continue;
          const serviceId = serviceBySlug.get(slug);
          if (!serviceId) continue;

          await supabaseAdmin.from("movie_availability").upsert(
            {
              movie_id: movie.id,
              service_id: serviceId,
              offer_type: offer.offer_type,
              region: data.region,
              deep_link: region?.link || null,
              provider_source: "tmdb",
              last_checked_at: new Date().toISOString(),
            },
            { onConflict: "movie_id, service_id, offer_type, region" },
          );
        }
        updated += 1;
      } catch (err) {
        failed.push(`${movie.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { updated, failed: failed.slice(0, 20), total: movies?.length ?? 0 };
  });

export const listIngestionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { count: movieCount },
      { count: podcastCount },
      { count: episodeCount },
      { count: matchedEpisodeCount },
      { count: pendingMatchCount },
      { count: tmdbLinkedCount },
      { data: links },
    ] = await Promise.all([
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("podcasts").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("podcast_episodes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("episode_movies").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("episode_movies").select("*", { count: "exact", head: true }).eq("match_method", "heuristic"),
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null),
      supabaseAdmin.from("episode_movies").select("episode_id"),
    ]);

    const linkedEpisodes = new Set((links ?? []).map((l) => l.episode_id)).size;

    return {
      movies: movieCount ?? 0,
      podcasts: podcastCount ?? 0,
      episodes: episodeCount ?? 0,
      matchedEpisodes: matchedEpisodeCount ?? 0,
      pendingMatches: pendingMatchCount ?? 0,
      tmdbLinked: tmdbLinkedCount ?? 0,
      unmatchedEpisodes: Math.max(0, (episodeCount ?? 0) - linkedEpisodes),
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
  limit: z.number().int().min(1).max(40).default(15),
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
    const { fetchUnlinkedEpisodes, fetchRejectedPairs, upsertMovieFromTmdb } = await import(
      "./ingestion-helpers.server"
    );
    const { extractMovieTitleCandidates, looksNonMovieEpisode } = await import(
      "./providers/episode-title.server"
    );
    const { findBestTmdbMatch } = await import("./providers/tmdb.server");

    const apiKey = process.env["TMDB_API_KEY"];
    if (!apiKey) throw new Error("TMDB API key not configured");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const allUnlinked = await fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    const rejected = await fetchRejectedPairs(supabaseAdmin);
    const todo = allUnlinked.slice(0, data.limit);

    let linked = 0;
    let moviesCreated = 0;
    const skipped: string[] = [];
    const unresolved: string[] = [];

    for (const ep of todo) {
      if (looksNonMovieEpisode(ep.title)) {
        skipped.push(ep.title);
        continue;
      }
      const candidates = extractMovieTitleCandidates(ep.title);
      let done = false;

      for (const candidate of candidates) {
        try {
          const match = await findBestTmdbMatch(apiKey, candidate.title, candidate.year ?? undefined);
          await sleep(120);
          if (!match) continue;

          const movie = await upsertMovieFromTmdb(supabaseAdmin, match, accentFor(match.title));
          if (movie.created) moviesCreated += 1;
          if (rejected.has(`${ep.id}:${movie.id}`)) continue;

          const { error } = await supabaseAdmin.from("episode_movies").upsert(
            {
              episode_id: ep.id,
              movie_id: movie.id,
              match_method: match.confidence >= 85 ? "deterministic" : "heuristic",
              match_confidence: Math.min(1, match.confidence / 100),
              is_primary_subject: true,
            },
            { onConflict: "episode_id, movie_id" },
          );
          if (error) throw error;
          linked += 1;
          done = true;
          break;
        } catch (err) {
          unresolved.push(`${ep.title}: ${err instanceof Error ? err.message : String(err)}`);
          done = true;
          break;
        }
      }

      if (!done) unresolved.push(`${ep.title}: no TMDB match`);
    }

    return {
      attempted: todo.length,
      linked,
      moviesCreated,
      skipped: skipped.slice(0, 20),
      unresolved: unresolved.slice(0, 20),
      remaining: Math.max(0, allUnlinked.length - todo.length),
    };
  });

/** Cheap backfill: re-match still-unlinked episodes against movies already in the catalogue. */
export const rescanEpisodeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ResolveInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchUnlinkedEpisodes, fetchRejectedPairs } = await import("./ingestion-helpers.server");
    const { matchEpisodeToMovies } = await import("./providers/matching.server");

    const unlinked = await fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    const rejected = await fetchRejectedPairs(supabaseAdmin);
    const { data: movies } = await supabaseAdmin.from("movies").select("id, title, release_year");
    const movieList = movies ?? [];

    let linked = 0;
    let stillUnlinked = 0;

    for (const ep of unlinked) {
      const top = matchEpisodeToMovies(ep.title, movieList).filter(
        (c) => !rejected.has(`${ep.id}:${c.movieId}`),
      )[0];
      if (!top || top.confidence < 50) {
        stillUnlinked += 1;
        continue;
      }
      const { error } = await supabaseAdmin.from("episode_movies").upsert(
        {
          episode_id: ep.id,
          movie_id: top.movieId,
          match_method: top.confidence >= 80 ? "deterministic" : "heuristic",
          match_confidence: top.confidence / 100,
          is_primary_subject: true,
        },
        { onConflict: "episode_id, movie_id" },
      );
      if (error) stillUnlinked += 1;
      else linked += 1;
    }

    return { scanned: unlinked.length, linked, stillUnlinked };
  });

/** Safety net: nothing should be invisible, so expose every episode with no movie link. */
export const listUnmatchedEpisodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ResolveInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchUnlinkedEpisodes } = await import("./ingestion-helpers.server");
    const all = await fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    return {
      total: all.length,
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
    const { data: podcasts, error } = await supabaseAdmin
      .from("podcasts")
      .select("id, name, episode_count")
      .order("name");
    if (error) throw error;

    const rows = await Promise.all(
      (podcasts ?? []).map(async (p) => {
        const { count } = await supabaseAdmin
          .from("podcast_episodes")
          .select("id", { count: "exact", head: true })
          .eq("podcast_id", p.id);
        return {
          podcastId: p.id,
          name: p.name,
          stored: count ?? 0,
          feedTotal: p.episode_count ?? 0,
        };
      }),
    );

    return { podcasts: rows };
  });
