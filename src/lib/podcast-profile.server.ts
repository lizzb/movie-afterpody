/**
 * Pass U72 — reads each show's confirmed catalogue and builds its profile.
 *
 * Only human-settled links count: `review_state = 'confirmed'` or
 * `match_method = 'manual'`. Auto-links are deliberately excluded so the prior
 * cannot reinforce the matcher's own mistakes.
 */
import { pageAll } from "./ingestion-helpers.server";
import {
  buildPodcastProfile,
  type PodcastProfile,
  type ProfileMovie,
} from "./podcast-profile";
import type { supabaseAdmin as Admin } from "@/integrations/supabase/client.server";

type AdminClient = typeof Admin;

/** Catalogue metadata each candidate film needs for the prior to apply. */
export interface ProfileMovieMeta {
  genre_ids: string[];
  certification: string | null;
}

export interface PodcastProfileData {
  /** podcast id → profile, present only for shows with a large enough sample. */
  profiles: Map<string, PodcastProfile>;
  /** movie id → the genre/certification metadata the matcher scores against. */
  movieMeta: Map<string, ProfileMovieMeta>;
}

export async function fetchPodcastProfiles(admin: AdminClient): Promise<PodcastProfileData> {
  const [links, episodes, movies, movieGenres] = await Promise.all([
    pageAll<{ episode_id: string; movie_id: string; review_state: string; match_method: string }>(
      (from, to) =>
        admin
          .from("episode_movies")
          .select("episode_id, movie_id, review_state, match_method")
          .range(from, to),
    ),
    pageAll<{ id: string; podcast_id: string }>((from, to) =>
      admin.from("podcast_episodes").select("id, podcast_id").range(from, to),
    ),
    pageAll<{ id: string; release_year: number | null; certification: string | null }>((from, to) =>
      admin.from("movies").select("id, release_year, certification").range(from, to),
    ),
    pageAll<{ movie_id: string; genre_id: string }>((from, to) =>
      admin.from("movie_genres").select("movie_id, genre_id").range(from, to),
    ),
  ]);

  const genresByMovie = new Map<string, string[]>();
  for (const row of movieGenres) {
    const list = genresByMovie.get(row.movie_id) ?? [];
    list.push(row.genre_id);
    genresByMovie.set(row.movie_id, list);
  }

  const movieMeta = new Map<string, ProfileMovieMeta>();
  const movieById = new Map<string, { release_year: number | null; certification: string | null }>();
  for (const m of movies) {
    movieById.set(m.id, m);
    movieMeta.set(m.id, {
      genre_ids: genresByMovie.get(m.id) ?? [],
      certification: m.certification,
    });
  }

  const podcastByEpisode = new Map(episodes.map((e) => [e.id, e.podcast_id]));

  // One film counts once per show, however many of its episodes cover it.
  const filmsByPodcast = new Map<string, Set<string>>();
  for (const link of links) {
    const settled = link.review_state === "confirmed" || link.match_method === "manual";
    if (!settled) continue;
    const podcastId = podcastByEpisode.get(link.episode_id);
    if (!podcastId) continue;
    const set = filmsByPodcast.get(podcastId) ?? new Set<string>();
    set.add(link.movie_id);
    filmsByPodcast.set(podcastId, set);
  }

  const profiles = new Map<string, PodcastProfile>();
  for (const [podcastId, filmIds] of filmsByPodcast) {
    const rows: ProfileMovie[] = [];
    for (const id of filmIds) {
      const movie = movieById.get(id);
      if (!movie) continue;
      rows.push({
        genreIds: genresByMovie.get(id) ?? [],
        certification: movie.certification,
        releaseYear: movie.release_year,
      });
    }
    const profile = buildPodcastProfile(rows);
    if (profile) profiles.set(podcastId, profile);
  }

  return { profiles, movieMeta };
}
