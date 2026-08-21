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
  /** Batch size — the worker cannot fetch hundreds of TMDB pages in one request. */
  limit: z.number().int().min(1).max(60).default(40),
  /** Resume cursor (movies ordered by title). */
  offset: z.number().int().min(0).default(0),
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
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(`Admin check failed: ${error.message}`);
  if (!isAdmin) {
    // Fallback: read the role row directly in case the RPC is unavailable.
    const { data: row } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!row) throw new Error("Forbidden: admin required");
  }
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
    const { fetchAllEpisodes, fetchRejectionCountsByMovie, pageAll } = await import(
      "./ingestion-helpers.server"
    );

    // Paged: a single response is capped at 1000 rows and there are 7k+ episodes,
    // which is why the same handful of episodes used to reappear forever.
    let episodes = await fetchAllEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    if (data.episodeId) episodes = episodes.filter((ep) => ep.id === data.episodeId);

    const movieList = await pageAll<{ id: string; title: string; release_year: number | null }>(
      (from, to) => supabaseAdmin.from("movies").select("id, title, release_year").range(from, to),
    );

    const [existingLinks, rejections, rejectionCountByMovie] = await Promise.all([
      pageAll<{ episode_id: string; movie_id: string; match_method: string }>((from, to) =>
        supabaseAdmin.from("episode_movies").select("episode_id, movie_id, match_method").range(from, to),
      ),
      pageAll<{ episode_id: string; movie_id: string }>((from, to) =>
        supabaseAdmin.from("episode_match_rejections").select("episode_id, movie_id").range(from, to),
      ),
      fetchRejectionCountsByMovie(supabaseAdmin),
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

    const all = episodes
      .filter((ep) => ep.disposition !== "not_about_a_movie")
      .filter((ep) => !ep.title.toLowerCase().includes("trailer"))
      .filter((ep) => !confirmedEpisodes.has(ep.id))
      .filter(
        (ep) =>
          !term ||
          ep.title.toLowerCase().includes(term) ||
          ep.podcasts.name.toLowerCase().includes(term),
      )
      .map((ep) => {
        const candidates = matchEpisodeToMovies(ep.title, movieList, { rejectionCountByMovie }).filter(
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

    return {
      total: all.length,
      suggestions: all.slice(data.offset, data.offset + data.limit),
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
        // is distinguishable from "never checked".
        await supabaseAdmin
          .from("movies")
          .update({ availability_checked_at: checkedAt })
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

    const [
      { count: movieCount },
      { count: podcastCount },
      { count: episodeCount },
      { count: linkCount },
      { count: reviewLinkCount },
      { count: flaggedCount },
      { count: retiredCount },
      { count: tmdbLinkedCount },
      unlinked,
    ] = await Promise.all([
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("podcasts").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("podcast_episodes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("episode_movies").select("*", { count: "exact", head: true }),
      // Same band the "Existing links" review tab defaults to.
      supabaseAdmin
        .from("episode_movies")
        .select("*", { count: "exact", head: true })
        .neq("match_method", "manual")
        .lte("match_confidence", 0.95),
      supabaseAdmin
        .from("episode_link_flags")
        .select("*", { count: "exact", head: true })
        .is("resolved_at", null),
      supabaseAdmin
        .from("podcast_episodes")
        .select("*", { count: "exact", head: true })
        .eq("disposition", "not_about_a_movie"),
      supabaseAdmin.from("movies").select("*", { count: "exact", head: true }).not("tmdb_id", "is", null),
      // Counted exactly the way the Unmatched episodes card counts, so the tile
      // and the section can never disagree.
      fetchUnlinkedEpisodes(supabaseAdmin),
    ]);

    return {
      movies: movieCount ?? 0,
      podcasts: podcastCount ?? 0,
      episodes: episodeCount ?? 0,
      links: linkCount ?? 0,
      linksToReview: reviewLinkCount ?? 0,
      flagged: flaggedCount ?? 0,
      retiredEpisodes: retiredCount ?? 0,
      tmdbLinked: tmdbLinkedCount ?? 0,
      unmatchedEpisodes: unlinked.length,
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
    const { fetchUnlinkedEpisodes, fetchRejectedPairs, fetchRejectionCountsByMovie, pageAll } =
      await import("./ingestion-helpers.server");
    const { matchEpisodeToMovies } = await import("./providers/matching.server");

    const unlinked = await fetchUnlinkedEpisodes(supabaseAdmin, { podcastId: data.podcastId });
    const rejected = await fetchRejectedPairs(supabaseAdmin);
    const rejectionCountByMovie = await fetchRejectionCountsByMovie(supabaseAdmin);
    const movieList = await pageAll<{ id: string; title: string; release_year: number | null }>(
      (from, to) => supabaseAdmin.from("movies").select("id, title, release_year").range(from, to),
    );

    let linked = 0;
    let stillUnlinked = 0;

    for (const ep of unlinked) {
      const top = matchEpisodeToMovies(ep.title, movieList, { rejectionCountByMovie }).filter(
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
          signals: { ...top.signals },
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

/** Admin movie search used by the "wrong movie?" relink picker. */
export const searchMoviesByTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ term: z.string().min(1), limit: z.number().int().min(1).max(50).default(20) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("movies")
      .select("id, title, release_year, slug")
      .ilike("title", `%${data.term}%`)
      .order("title")
      .limit(data.limit);
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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("episode_movies")
      .select(
        "episode_id, movie_id, match_method, match_confidence, podcast_episodes!inner(id, title, released_at, podcast_id, podcasts!inner(id, name)), movies!inner(id, title, release_year, slug)",
        { count: "exact" },
      )
      .lte("match_confidence", data.maxConfidence)
      .order("match_confidence", { ascending: true })
      .limit(data.limit);

    if (data.podcastId) query = query.eq("podcast_episodes.podcast_id", data.podcastId);
    const term = data.search?.trim();
    if (term) {
      // The placeholder promises episode, show and movie titles — so all three
      // are resolved to ids here, including show names (previously missing).
      const [{ data: movieHits }, { data: showHits }] = await Promise.all([
        supabaseAdmin.from("movies").select("id").ilike("title", `%${term}%`).limit(200),
        supabaseAdmin.from("podcasts").select("id").ilike("name", `%${term}%`).limit(50),
      ]);
      const showIds = (showHits ?? []).map((p) => p.id);
      const epByTitle = await supabaseAdmin
        .from("podcast_episodes")
        .select("id")
        .ilike("title", `%${term}%`)
        .limit(1000);
      const epByShow = showIds.length
        ? await supabaseAdmin.from("podcast_episodes").select("id").in("podcast_id", showIds).limit(1000)
        : { data: [] as { id: string }[] };

      const movieIds = (movieHits ?? []).map((m) => m.id);
      const epIds = [
        ...new Set([...(epByTitle.data ?? []).map((e) => e.id), ...(epByShow.data ?? []).map((e) => e.id)]),
      ];
      const clauses = [
        movieIds.length ? `movie_id.in.(${movieIds.join(",")})` : null,
        epIds.length ? `episode_id.in.(${epIds.join(",")})` : null,
      ].filter(Boolean);
      query = clauses.length
        ? query.or(clauses.join(","))
        : query.eq("episode_id", "00000000-0000-0000-0000-000000000000");
    }


    const { data: rows, error, count } = await query.returns<
      {
        episode_id: string;
        movie_id: string;
        match_method: string;
        match_confidence: number;
        podcast_episodes: {
          title: string;
          released_at: string | null;
          podcast_id: string;
          podcasts: { id: string; name: string };
        };
        movies: { id: string; title: string; release_year: number | null; slug: string };
      }[]
    >();
    if (error) throw error;

    const filtered = term
      ? (rows ?? []).filter(
          (r) =>
            r.movies.title.toLowerCase().includes(term.toLowerCase()) ||
            r.podcast_episodes.title.toLowerCase().includes(term.toLowerCase()) ||
            r.podcast_episodes.podcasts.name.toLowerCase().includes(term.toLowerCase()),
        )
      : (rows ?? []);

    return {
      total: count ?? filtered.length,
      links: filtered.map((r) => ({
        episodeId: r.episode_id,
        movieId: r.movie_id,
        episodeTitle: r.podcast_episodes.title,
        releasedAt: r.podcast_episodes.released_at,
        podcastId: r.podcast_episodes.podcast_id,
        podcastName: r.podcast_episodes.podcasts.name,
        movieTitle: r.movies.title,
        movieYear: r.movies.release_year,
        movieSlug: r.movies.slug,
        method: r.match_method,
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
      },
      { onConflict: "episode_id, movie_id" },
    );
    if (error) throw error;
    await supabaseAdmin
      .from("podcast_episodes")
      .update({ disposition: "movie_matched" })
      .eq("id", data.episodeId);
    await logMatchAction(supabaseAdmin, context.userId, {
      action: "confirm",
      episodeId: data.episodeId,
      movieId: data.movieId,
      previousMethod: existing?.match_method ?? null,
      previousConfidence: existing ? Number(existing.match_confidence) : null,
    });
    return { ok: true };
  });

/** Retires an episode from every review queue — it is not about a movie. */
export const markEpisodeNotAboutMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ episodeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("podcast_episodes")
      .update({ disposition: "not_about_a_movie" })
      .eq("id", data.episodeId);
    if (error) throw error;
    await logMatchAction(supabaseAdmin, context.userId, {
      action: "not_about_a_movie",
      episodeId: data.episodeId,
    });
    return { ok: true };
  });

const BulkDecisionInput = z.object({
  action: z.enum(["approve", "reject", "confirm", "unlink"]),
  pairs: z
    .array(z.object({ episodeId: z.string().uuid(), movieId: z.string().uuid() }))
    .min(1)
    .max(200),
});

/** One request, many decisions — a failure on one row never aborts the batch. */
export const bulkMatchDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => BulkDecisionInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let succeeded = 0;
    const failed: string[] = [];

    for (const pair of data.pairs) {
      try {
        const { data: existing } = await supabaseAdmin
          .from("episode_movies")
          .select("match_method, match_confidence")
          .eq("episode_id", pair.episodeId)
          .eq("movie_id", pair.movieId)
          .maybeSingle();

        if (data.action === "approve" || data.action === "confirm") {
          const { error } = await supabaseAdmin.from("episode_movies").upsert(
            {
              episode_id: pair.episodeId,
              movie_id: pair.movieId,
              match_method: "manual",
              match_confidence: data.action === "confirm" ? 1.0 : 0.95,
              is_primary_subject: true,
            },
            { onConflict: "episode_id, movie_id" },
          );
          if (error) throw error;
          await supabaseAdmin
            .from("episode_match_rejections")
            .delete()
            .eq("episode_id", pair.episodeId)
            .eq("movie_id", pair.movieId);
          await supabaseAdmin
            .from("podcast_episodes")
            .update({ disposition: "movie_matched" })
            .eq("id", pair.episodeId);
        } else {
          const { error } = await supabaseAdmin
            .from("episode_movies")
            .delete()
            .eq("episode_id", pair.episodeId)
            .eq("movie_id", pair.movieId);
          if (error) throw error;
          const { error: rejError } = await supabaseAdmin.from("episode_match_rejections").upsert(
            { episode_id: pair.episodeId, movie_id: pair.movieId, rejected_by: context.userId },
            { onConflict: "episode_id, movie_id" },
          );
          if (rejError) throw rejError;
        }

        await logMatchAction(supabaseAdmin, context.userId, {
          action: data.action === "unlink" ? "unlink" : data.action,
          episodeId: pair.episodeId,
          movieId: pair.movieId,
          previousMethod: existing?.match_method ?? null,
          previousConfidence: existing ? Number(existing.match_confidence) : null,
        });
        succeeded += 1;
      } catch (e) {
        failed.push(e instanceof Error ? e.message : "unknown error");
      }
    }

    return { attempted: data.pairs.length, succeeded, failed: failed.slice(0, 10) };
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
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error, count } = await supabaseAdmin
      .from("episode_link_flags")
      .select(
        "id, episode_id, movie_id, note, created_at, podcast_episodes!inner(title, podcasts!inner(name)), movies!inner(title, release_year)",
        { count: "exact" },
      )
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit)
      .returns<
        {
          id: string;
          episode_id: string;
          movie_id: string;
          note: string | null;
          created_at: string;
          podcast_episodes: { title: string; podcasts: { name: string } };
          movies: { title: string; release_year: number | null };
        }[]
      >();
    if (error) throw error;

    return {
      total: count ?? (rows ?? []).length,
      flags: (rows ?? []).map((r) => ({
        flagId: r.id,
        episodeId: r.episode_id,
        movieId: r.movie_id,
        episodeTitle: r.podcast_episodes.title,
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
    const { error } = await supabaseAdmin
      .from("episode_link_flags")
      .update({ resolved_at: new Date().toISOString(), resolution: data.resolution })
      .eq("episode_id", data.episodeId)
      .eq("movie_id", data.movieId)
      .is("resolved_at", null);
    if (error) throw error;
    return { ok: true };
  });
