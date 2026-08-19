import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  EMPTY_USER_DATA,
  type Catalog,
  type Episode,
  type EpisodeMovie,
  type EpisodeRating,
  type EpisodeSource,
  type Genre,
  type ListeningStatus,
  type Movie,
  type MovieAvailability,
  type MovieGenre,
  type MovieWatch,
  type Podcast,
  type PodcastMetric,
  type PodcastPreference,
  type ProductionQuality,
  type StreamingService,
  type UserData,
  type Watchlist,
  type WatchlistMovie,
} from "./types";

const sel = (s: string): string => s;

/** PostgREST caps a single response at 1000 rows, so page through everything. */
const PAGE = 1000;

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function fetchCatalog(): Promise<Catalog> {
  const [genres, services, movies, movieGenres, availability, podcasts, metrics, episodes, sources, links] =
    await Promise.all([
      fetchAllRows<Genre>((from, to) =>
        supabase.from("genres").select(sel("id, slug, name")).order("name").range(from, to).returns<Genre[]>(),
      ),
      fetchAllRows<StreamingService>((from, to) =>
        supabase
          .from("streaming_services")
          .select(sel("id, slug, name, short_name, accent, sort_order"))
          .order("sort_order")
          .range(from, to)
          .returns<StreamingService[]>(),
      ),
      fetchAllRows<Movie>((from, to) =>
        supabase
          .from("movies")
          .select(
            sel("id, media_type, slug, title, release_year, runtime_minutes, synopsis, poster_url, accent"),
          )
          .order("title")
          .range(from, to)
          .returns<Movie[]>(),
      ),
      fetchAllRows<MovieGenre>((from, to) =>
        supabase
          .from("movie_genres")
          .select(sel("movie_id, genre_id"))
          .order("movie_id")
          .range(from, to)
          .returns<MovieGenre[]>(),
      ),
      fetchAllRows<MovieAvailability>((from, to) =>
        supabase
          .from("movie_availability")
          .select(sel("id, movie_id, service_id, offer_type, deep_link"))
          .order("id")
          .range(from, to)
          .returns<MovieAvailability[]>(),
      ),
      fetchAllRows<Podcast>((from, to) =>
        supabase
          .from("podcasts")
          .select(
            sel(
              "id, slug, name, description, artwork_url, accent, episode_count, latest_episode_at, activity_status, website_url",
            ),
          )
          .order("name")
          .range(from, to)
          .returns<Podcast[]>(),
      ),
      fetchAllRows<PodcastMetric>((from, to) =>
        supabase
          .from("podcast_external_metrics")
          .select(sel("podcast_id, platform, rating, rating_count, external_url"))
          .order("podcast_id")
          .range(from, to)
          .returns<PodcastMetric[]>(),
      ),
      fetchAllRows<Episode>((from, to) =>
        supabase
          .from("podcast_episodes")
          .select(sel("id, podcast_id, slug, title, description, released_at, duration_seconds"))
          .order("released_at", { ascending: false })
          .order("id")
          .range(from, to)
          .returns<Episode[]>(),
      ),
      fetchAllRows<EpisodeSource>((from, to) =>
        supabase
          .from("episode_sources")
          .select(sel("id, episode_id, platform, url, is_primary, embeddable"))
          .order("id")
          .range(from, to)
          .returns<EpisodeSource[]>(),
      ),
      fetchAllRows<EpisodeMovie>((from, to) =>
        supabase
          .from("episode_movies")
          .select(sel("episode_id, movie_id, is_primary_subject, match_confidence"))
          .order("episode_id")
          .range(from, to)
          .returns<EpisodeMovie[]>(),
      ),
    ]);

  return {
    genres,
    services,
    movies,
    movieGenres,
    availability,
    podcasts,
    metrics,
    episodes,
    episodeSources: sources,
    episodeMovies: links,
  };
}


export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
  });
}

interface PreferenceRow {
  podcast_id: string;
  preference: PodcastPreference;
}
interface RatingRow {
  episode_id: string;
  rating: EpisodeRating;
}
interface ListeningRow {
  episode_id: string;
  status: ListeningStatus;
}
interface QualityRow {
  episode_id: string;
  quality: ProductionQuality;
}

async function fetchUserData(userId: string): Promise<UserData> {
  const [services, prefs, ratings, listening, quality, watchlists, watchlistMovies, watches] =
    await Promise.all([
      supabase
        .from("user_streaming_services")
        .select(sel("service_id"))
        .returns<{ service_id: string }[]>(),
      supabase
        .from("user_podcast_preferences")
        .select(sel("podcast_id, preference"))
        .returns<PreferenceRow[]>(),
      supabase.from("user_episode_ratings").select(sel("episode_id, rating")).returns<RatingRow[]>(),
      supabase
        .from("user_episode_listening")
        .select(sel("episode_id, status"))
        .returns<ListeningRow[]>(),
      supabase
        .from("user_production_quality")
        .select(sel("episode_id, quality"))
        .returns<QualityRow[]>(),
      supabase
        .from("watchlists")
        .select(sel("id, user_id, name, description, accent, created_at"))
        .order("created_at")
        .returns<Watchlist[]>(),
      supabase.from("watchlist_movies").select(sel("watchlist_id, movie_id")).returns<WatchlistMovie[]>(),
      supabase
        .from("user_movie_watches")
        .select(sel("id, movie_id, watched_on"))
        .order("watched_on", { ascending: false })
        .returns<MovieWatch[]>(),
    ]);

  void userId;

  const toMap = <T extends string>(rows: { key: string; value: T }[]) => {
    const out: Record<string, T> = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  };

  return {
    serviceIds: (services.data ?? []).map((r) => r.service_id),
    preferences: toMap((prefs.data ?? []).map((r) => ({ key: r.podcast_id, value: r.preference }))),
    ratings: toMap((ratings.data ?? []).map((r) => ({ key: r.episode_id, value: r.rating }))),
    listening: toMap((listening.data ?? []).map((r) => ({ key: r.episode_id, value: r.status }))),
    quality: toMap((quality.data ?? []).map((r) => ({ key: r.episode_id, value: r.quality }))),
    watchlists: watchlists.data ?? [],
    watchlistMovies: watchlistMovies.data ?? [],
    watches: watches.data ?? [],
  };
}

export function useUserData() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["user-data", userId],
    queryFn: () => fetchUserData(userId!),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });
  return { ...query, data: query.data ?? EMPTY_USER_DATA, hasUser: Boolean(userId) };
}

function useInvalidateUser() {
  const client = useQueryClient();
  const { userId } = useAuth();
  return () => client.invalidateQueries({ queryKey: ["user-data", userId] });
}

export function useToggleService() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({ serviceId, on }: { serviceId: string; on: boolean }) => {
      if (!userId) throw new Error("Sign in to pick your streaming services.");
      if (on) {
        const { error } = await supabase
          .from("user_streaming_services")
          .upsert({ user_id: userId, service_id: serviceId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("user_streaming_services")
          .delete()
          .eq("user_id", userId)
          .eq("service_id", serviceId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: invalidate,
  });
}

export function useSetPodcastPreference() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({
      podcastId,
      preference,
    }: {
      podcastId: string;
      preference: PodcastPreference;
    }) => {
      if (!userId) throw new Error("Sign in to save podcast preferences.");
      const { error } = await supabase
        .from("user_podcast_preferences")
        .upsert({ user_id: userId, podcast_id: podcastId, preference, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useRateEpisode() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({ episodeId, rating }: { episodeId: string; rating: EpisodeRating | null }) => {
      if (!userId) throw new Error("Sign in to rate episodes.");
      if (rating === null) {
        const { error } = await supabase
          .from("user_episode_ratings")
          .delete()
          .eq("user_id", userId)
          .eq("episode_id", episodeId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("user_episode_ratings")
        .upsert({ user_id: userId, episode_id: episodeId, rating, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useSetListeningStatus() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({ episodeId, status }: { episodeId: string; status: ListeningStatus }) => {
      if (!userId) throw new Error("Sign in to track listening.");
      const { error } = await supabase.from("user_episode_listening").upsert({
        user_id: userId,
        episode_id: episodeId,
        status,
        completed_at: status === "finished" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useSetProductionQuality() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({
      episodeId,
      quality,
    }: {
      episodeId: string;
      quality: ProductionQuality | null;
    }) => {
      if (!userId) throw new Error("Sign in to note audio quality.");
      if (quality === null) {
        const { error } = await supabase
          .from("user_production_quality")
          .delete()
          .eq("user_id", userId)
          .eq("episode_id", episodeId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("user_production_quality")
        .upsert({ user_id: userId, episode_id: episodeId, quality, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useToggleWatched() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({ movieId, watched }: { movieId: string; watched: boolean }) => {
      if (!userId) throw new Error("Sign in to track what you've watched.");
      if (watched) {
        const { error } = await supabase
          .from("user_movie_watches")
          .upsert({ user_id: userId, movie_id: movieId, watched_on: new Date().toISOString().slice(0, 10) });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("user_movie_watches")
          .delete()
          .eq("user_id", userId)
          .eq("movie_id", movieId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: invalidate,
  });
}

export function useCreateWatchlist() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({ name, accent }: { name: string; accent: string }) => {
      if (!userId) throw new Error("Sign in to make watchlists.");
      const { error } = await supabase.from("watchlists").insert({ user_id: userId, name, accent });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteWatchlist() {
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async (watchlistId: string) => {
      const { error } = await supabase.from("watchlists").delete().eq("id", watchlistId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useToggleWatchlistMovie() {
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async ({
      watchlistId,
      movieId,
      on,
    }: {
      watchlistId: string;
      movieId: string;
      on: boolean;
    }) => {
      if (on) {
        const { error } = await supabase
          .from("watchlist_movies")
          .upsert({ watchlist_id: watchlistId, movie_id: movieId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("watchlist_movies")
          .delete()
          .eq("watchlist_id", watchlistId)
          .eq("movie_id", movieId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: invalidate,
  });
}

const DEFAULT_SERVICES = ["netflix", "max", "hulu", "prime-video"];
const DEFAULT_LISTS: { name: string; accent: string }[] = [
  { name: "Date Night", accent: "coral" },
  { name: "Bad Movies That Are Actually Good", accent: "gold" },
  { name: "Halloween", accent: "purple" },
];

/** First sign-in convenience: give a new account services and starter lists. */
export function useEnsureDefaults() {
  const { userId } = useAuth();
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: async (catalog: Catalog) => {
      if (!userId) return;
      const ids = catalog.services.filter((s) => DEFAULT_SERVICES.includes(s.slug)).map((s) => s.id);
      if (ids.length > 0) {
        await supabase
          .from("user_streaming_services")
          .upsert(ids.map((service_id) => ({ user_id: userId, service_id })));
      }
      await supabase
        .from("watchlists")
        .insert(DEFAULT_LISTS.map((l) => ({ user_id: userId, name: l.name, accent: l.accent })));
    },
    onSuccess: invalidate,
  });
}
