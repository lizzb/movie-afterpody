import { useMemo } from "react";
import { useDiscovery, type MovieEntry } from "./discovery";
import type { Episode, Podcast, PodcastMetric } from "./types";

export interface PodcastMovie {
  entry: MovieEntry;
  episodes: Episode[];
}

/** One episode in the full chronological feed, linked or not. */
export interface PodcastEpisodeRow {
  episode: Episode;
  movies: {
    id: string;
    slug: string;
    title: string;
    release_year: number | null;
    poster_url: string | null;
    accent: string;
  }[];
  /** Best external destination for this episode, if we know one. */
  /** Every platform listing for this episode — used for footer badges. */
  sources: { platform: string; url: string }[];
}

export interface PodcastEntry {
  podcast: Podcast;
  preferred: boolean;
  metric: PodcastMetric | null;
  /** Every platform listing with a URL — used for "Listen on" badges. */
  links: PodcastMetric[];
  episodeCount: number;
  movies: PodcastMovie[];
  /** Every episode we store for this show, newest first, matched or not. */
  allEpisodes: PodcastEpisodeRow[];
  /** Covered movies that are on the services you picked and you haven't watched. */
  streamableUnwatched: PodcastMovie[];
  /** Deterministic 0-100: how much use this show is to you right now. */
  matchScore: number;
  reasons: string[];
}

/**
 * Podcast-first view of the same catalog the movie feed uses. Deterministic:
 * ranked by how many covered movies you can actually stream tonight.
 */
export function usePodcasts() {
  const discovery = useDiscovery();
  const { catalog, entries } = discovery;

  const podcastEntries = useMemo<PodcastEntry[]>(() => {
    if (!catalog) return [];

    const metricByPodcast = new Map<string, PodcastMetric>();
    for (const m of catalog.metrics) {
      const prev = metricByPodcast.get(m.podcast_id);
      if (!prev || (m.rating_count ?? 0) > (prev.rating_count ?? 0)) metricByPodcast.set(m.podcast_id, m);
    }

    // Full episode feed: every stored episode for the show, with whatever
    // movies it links to (often none) so nothing is hidden from the listener.
    const movieById = new Map(catalog.movies.map((m) => [m.id, m]));
    const linkedMoviesByEpisode = new Map<string, PodcastEpisodeRow["movies"]>();
    for (const link of catalog.episodeMovies) {
      const movie = movieById.get(link.movie_id);
      if (!movie) continue;
      const list = linkedMoviesByEpisode.get(link.episode_id) ?? [];
      list.push({
        id: movie.id,
        slug: movie.slug,
        title: movie.title,
        release_year: movie.release_year,
        poster_url: movie.poster_url,
        accent: movie.accent,
      });
      linkedMoviesByEpisode.set(link.episode_id, list);
    }

    const episodesByPodcast = new Map<string, PodcastEpisodeRow[]>();
    for (const episode of catalog.episodes) {
      const list = episodesByPodcast.get(episode.podcast_id) ?? [];
      list.push({
        episode,
        movies: linkedMoviesByEpisode.get(episode.id) ?? [],
      });
      episodesByPodcast.set(episode.podcast_id, list);
    }
    for (const list of episodesByPodcast.values()) {
      list.sort((a, b) => (b.episode.released_at ?? "").localeCompare(a.episode.released_at ?? ""));
    }

    const byPodcast = new Map<string, Map<string, PodcastMovie>>();
    let preferredIds = new Set<string>();

    for (const entry of entries) {
      for (const ep of entry.episodes) {
        if (ep.preferred) preferredIds.add(ep.podcast.id);
        let movies = byPodcast.get(ep.podcast.id);
        if (!movies) {
          movies = new Map();
          byPodcast.set(ep.podcast.id, movies);
        }
        const existing = movies.get(entry.movie.id);
        if (existing) existing.episodes.push(ep.episode);
        else movies.set(entry.movie.id, { entry, episodes: [ep.episode] });
      }
    }
    preferredIds = new Set(preferredIds);

    const result = catalog.podcasts.map((podcast) => {
      const movies = [...(byPodcast.get(podcast.id)?.values() ?? [])].sort(
        (a, b) =>
          b.entry.score.score - a.entry.score.score ||
          a.entry.movie.title.localeCompare(b.entry.movie.title),
      );
      const streamableUnwatched = movies.filter((m) => m.entry.onMyServices && !m.entry.watched);
      const metric = metricByPodcast.get(podcast.id) ?? null;
      const preferred = preferredIds.has(podcast.id);

      const reasons: string[] = [];
      let score = 0;

      const streamPoints = Math.min(streamableUnwatched.length * 9, 45);
      if (streamPoints > 0) {
        score += streamPoints;
        reasons.push(
          `${streamableUnwatched.length} covered movie${streamableUnwatched.length === 1 ? "" : "s"} you can stream now`,
        );
      }

      const coverPoints = Math.min(movies.length * 3, 18);
      if (coverPoints > 0) {
        score += coverPoints;
        reasons.push(`${movies.length} movie${movies.length === 1 ? "" : "s"} in your catalogue`);
      }

      if (preferred) {
        score += 18;
        reasons.push("One of your preferred shows");
      }

      if (metric?.rating != null) {
        score += Math.min(Math.max((metric.rating - 3.5) * 8, 0), 12);
        reasons.push(`Rated ${metric.rating.toFixed(1)} on ${metric.platform}`);
      }

      const activity = { active: 7, slow: 3, dormant: 0, ended: 0 }[podcast.activity_status] ?? 0;
      score += activity;
      if (podcast.activity_status === "active") reasons.push("Still releasing episodes");
      if (podcast.activity_status === "ended") reasons.push("Finished run — backlog only");

      return {
        podcast,
        preferred,
        metric,
        links: catalog.metrics.filter((m) => m.podcast_id === podcast.id && m.external_url),
        episodeCount: episodesByPodcast.get(podcast.id)?.length ?? 0,
        allEpisodes: episodesByPodcast.get(podcast.id) ?? [],
        movies,
        streamableUnwatched,
        matchScore: Math.round(Math.min(score, 100)),
        reasons,
      } satisfies PodcastEntry;
    });

    return result.sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.streamableUnwatched.length - a.streamableUnwatched.length ||
        a.podcast.name.localeCompare(b.podcast.name),
    );
  }, [catalog, entries]);

  return { ...discovery, podcastEntries };
}
