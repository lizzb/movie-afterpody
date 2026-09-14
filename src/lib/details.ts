import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pass L2a/L2b — on-screen detail loading.
 *
 * Episode descriptions and platform source rows were the two heaviest parts of
 * the catalogue read (~7 MB combined) and are only ever shown for the handful of
 * episodes actually rendered. These hooks fetch them for the visible rows only.
 */
export interface EpisodeDetail {
  description: string | null;
  listenUrl: string | null;
  sources: { platform: string; url: string }[];
}

export const EMPTY_EPISODE_DETAIL: EpisodeDetail = {
  description: null,
  listenUrl: null,
  sources: [],
};

const BATCH = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchEpisodeDetails(ids: string[]): Promise<Record<string, EpisodeDetail>> {
  const details: Record<string, EpisodeDetail> = {};
  for (const id of ids) details[id] = { description: null, listenUrl: null, sources: [] };

  for (const batch of chunk(ids, BATCH)) {
    const [episodes, sources] = await Promise.all([
      supabase
        .from("podcast_episodes")
        .select("id, description")
        .in("id", batch)
        .returns<{ id: string; description: string | null }[]>(),
      supabase
        .from("episode_sources")
        .select("episode_id, platform, url, is_primary")
        .in("episode_id", batch)
        .returns<{ episode_id: string; platform: string; url: string; is_primary: boolean }[]>(),
    ]);
    if (episodes.error) throw new Error(episodes.error.message);
    if (sources.error) throw new Error(sources.error.message);

    for (const row of episodes.data ?? []) {
      const detail = details[row.id];
      if (detail) detail.description = row.description;
    }
    for (const src of sources.data ?? []) {
      const detail = details[src.episode_id];
      if (!detail) continue;
      if (detail.listenUrl === null || src.is_primary) detail.listenUrl = src.url;
      if (!detail.sources.some((s) => s.platform === src.platform))
        detail.sources.push({ platform: src.platform, url: src.url });
    }
  }

  return details;
}

/** Descriptions + listen links for the episode rows currently on screen. */
export function useEpisodeDetails(episodeIds: string[]) {
  const ids = [...new Set(episodeIds)].sort();
  const query = useQuery({
    queryKey: ["episode-details", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: () => fetchEpisodeDetails(ids),
  });

  return {
    details: query.data ?? {},
    isLoading: query.isLoading,
  };
}

/**
 * The movie synopsis plus its stored IMDb id, loaded only on the movie detail
 * page. The IMDb id already exists on the row (written during ingestion), so
 * the header link rides along on this one request (Pass U42D).
 */
export function useMovieSynopsis(movieId: string | undefined) {
  const query = useQuery({
    queryKey: ["movie-synopsis", movieId],
    enabled: Boolean(movieId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movies")
        .select("synopsis, imdb_id")
        .eq("id", movieId!)
        .maybeSingle<{ synopsis: string | null; imdb_id: string | null }>();
      if (error) throw new Error(error.message);
      return { synopsis: data?.synopsis ?? null, imdbId: data?.imdb_id ?? null };
    },
  });
  return query.data ?? { synopsis: null, imdbId: null };
}
