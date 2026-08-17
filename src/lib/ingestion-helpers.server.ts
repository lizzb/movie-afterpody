import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export interface UnlinkedEpisode {
  id: string;
  slug: string;
  title: string;
  podcast_id: string;
  podcastName: string;
  releasedAt: string | null;
}

/** Episodes with zero rows in episode_movies — nothing surfaces them in the app. */
export async function fetchUnlinkedEpisodes(
  admin: Admin,
  opts: { podcastId?: string | undefined; limit?: number | undefined } = {},
): Promise<UnlinkedEpisode[]> {
  let query = admin
    .from("podcast_episodes")
    .select("id, slug, title, podcast_id, released_at, podcasts!inner(name)")
    .order("released_at", { ascending: false });

  if (opts.podcastId) query = query.eq("podcast_id", opts.podcastId);

  const { data: episodes, error } = await query.returns<
    {
      id: string;
      slug: string;
      title: string;
      podcast_id: string;
      released_at: string | null;
      podcasts: { name: string };
    }[]
  >();
  if (error) throw error;

  const { data: links, error: linkError } = await admin.from("episode_movies").select("episode_id");
  if (linkError) throw linkError;
  const linked = new Set((links ?? []).map((l) => l.episode_id));

  const unlinked = (episodes ?? [])
    .filter((ep) => !linked.has(ep.id))
    .map((ep) => ({
      id: ep.id,
      slug: ep.slug,
      title: ep.title,
      podcast_id: ep.podcast_id,
      podcastName: ep.podcasts.name,
      releasedAt: ep.released_at,
    }));

  return opts.limit ? unlinked.slice(0, opts.limit) : unlinked;
}

export async function fetchRejectedPairs(admin: Admin): Promise<Set<string>> {
  const { data } = await admin.from("episode_match_rejections").select("episode_id, movie_id");
  return new Set((data ?? []).map((r) => `${r.episode_id}:${r.movie_id}`));
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface TmdbMatchLike {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  releaseDate: string | null;
  runtime: number | null;
  overview: string | null;
  tagline: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  imdbId: string | null;
  confidence: number;
}

/** Creates (or refreshes) a movie row from a TMDB match and returns its id. */
export async function upsertMovieFromTmdb(
  admin: Admin,
  match: TmdbMatchLike,
  accent: string,
): Promise<{ id: string; title: string; created: boolean }> {
  const fields = {
    title: match.title,
    release_year: match.releaseYear,
    release_date: match.releaseDate && match.releaseDate.length ? match.releaseDate : null,
    runtime_minutes: match.runtime,
    synopsis: match.overview,
    tagline: match.tagline,
    poster_url: match.posterUrl,
    backdrop_url: match.backdropUrl,
    imdb_id: match.imdbId,
    tmdb_id: match.tmdbId,
  };

  const { data: byTmdb } = await admin
    .from("movies")
    .select("id, title")
    .eq("tmdb_id", match.tmdbId)
    .maybeSingle();
  if (byTmdb) {
    await admin.from("movies").update(fields).eq("id", byTmdb.id);
    return { id: byTmdb.id, title: byTmdb.title, created: false };
  }

  const slug = slugifyTitle(match.title) || `tmdb-${match.tmdbId}`;
  const { data: inserted, error } = await admin
    .from("movies")
    .upsert({ slug, accent, ...fields }, { onConflict: "slug" })
    .select("id, title")
    .single();
  if (error || !inserted) throw error || new Error("Failed to create movie");
  return { id: inserted.id, title: inserted.title, created: true };
}
