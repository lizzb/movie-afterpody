import { useMemo } from "react";
import { useDiscovery, type MovieEntry } from "./discovery";
import type { LocalList } from "./prefs";
import type {
  Episode,
  EpisodeRating,
  ListeningStatus,
  Podcast,
  ProductionQuality,
} from "./types";

export interface ListView {
  list: LocalList;
  entries: MovieEntry[];
  watchableCount: number;
}

export interface HistoryEntry {
  entry: MovieEntry;
  watchedOn: string | null;
}

/** Lists + watch history, joined from the catalog and local prefs. */
export function useLists() {
  const { entries, prefs, isLoading, error } = useDiscovery();

  const bySlug = useMemo(
    () => new Map(entries.map((e) => [e.movie.slug, e])),
    [entries],
  );

  const lists = useMemo<ListView[]>(
    () =>
      prefs.lists.map((list) => {
        const items = list.movieSlugs
          .map((slug) => bySlug.get(slug))
          .filter((e): e is MovieEntry => Boolean(e));
        return {
          list,
          entries: items,
          watchableCount: items.filter((e) => e.onMyServices).length,
        };
      }),
    [prefs.lists, bySlug],
  );

  const history = useMemo<HistoryEntry[]>(
    () =>
      prefs.watchedMovieSlugs
        .map((slug) => {
          const entry = bySlug.get(slug);
          return entry ? { entry, watchedOn: prefs.watchedDates[slug] ?? null } : null;
        })
        .filter((h): h is HistoryEntry => Boolean(h))
        .sort((a, b) => (b.watchedOn ?? "").localeCompare(a.watchedOn ?? "")),
    [prefs.watchedMovieSlugs, prefs.watchedDates, bySlug],
  );

  return { lists, history, isLoading, error };
}

export function formatWatchedOn(date: string | null): string {
  if (!date) return "Date not recorded";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface ListenedEntry {
  episode: Episode;
  podcast: Podcast;
  status: ListeningStatus;
  rating: EpisodeRating | null;
  quality: ProductionQuality | null;
  /** Movies this episode is linked to, for context in the list. */
  movieTitles: string[];
}

/**
 * Pass I — listening history. Every episode you rated, graded or moved off
 * "not started", newest first. The data was already captured; nothing surfaced it.
 */
export function useListened(): { listened: ListenedEntry[]; isLoading: boolean } {
  const { catalog, prefs, isLoading } = useDiscovery();

  const listened = useMemo<ListenedEntry[]>(() => {
    if (!catalog) return [];
    const podcastById = new Map(catalog.podcasts.map((p) => [p.id, p]));
    const movieById = new Map(catalog.movies.map((m) => [m.id, m]));
    const titlesByEpisode = new Map<string, string[]>();
    for (const link of catalog.episodeMovies) {
      const title = movieById.get(link.movie_id)?.title;
      if (!title) continue;
      titlesByEpisode.set(link.episode_id, [
        ...(titlesByEpisode.get(link.episode_id) ?? []),
        title,
      ]);
    }

    return catalog.episodes
      .map((episode) => {
        const status = prefs.listening[episode.slug] ?? "not_started";
        const rating = prefs.ratings[episode.slug] ?? null;
        const quality = prefs.quality[episode.slug] ?? null;
        if (status === "not_started" && !rating && !quality) return null;
        const podcast = podcastById.get(episode.podcast_id);
        if (!podcast) return null;
        return {
          episode,
          podcast,
          status,
          rating,
          quality,
          movieTitles: titlesByEpisode.get(episode.id) ?? [],
        };
      })
      .filter((e): e is ListenedEntry => Boolean(e))
      .sort((a, b) => (b.episode.released_at ?? "").localeCompare(a.episode.released_at ?? ""));
  }, [catalog, prefs.listening, prefs.ratings, prefs.quality]);

  return { listened, isLoading };
}

export function formatEpisodeDate(date: string | null): string {
  if (!date) return "Date unknown";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Date unknown";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export const LISTENING_LABEL: Record<ListeningStatus, string> = {
  not_started: "Not started",
  started: "Started",
  finished: "Finished",
};

export const RATING_LABEL: Record<EpisodeRating, string> = {
  loved: "Loved it",
  meh: "Meh",
  disliked: "Didn’t like it",
};
