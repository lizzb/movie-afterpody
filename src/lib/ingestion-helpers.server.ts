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

const PAGE = 1000;

/**
 * The Data API caps one response at 1000 rows, so every full-table read here
 * has to page or it silently truncates (7k+ episodes, 1.3k+ links).
 */
export async function pageAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export interface EpisodeRow {
  id: string;
  slug: string;
  title: string;
  podcast_id: string;
  released_at: string | null;
  disposition: "needs_review" | "movie_matched" | "not_about_a_movie";
  podcasts: { id: string; name: string; curation_status: "active" | "parked" };
}

/**
 * Every episode, paged, newest first.
 * `activeOnly` (default true) drops episodes belonging to parked shows so every
 * review queue is scoped to the shows you are actually working on. Nothing is
 * deleted — flipping a show back to active brings its episodes straight back.
 */
export async function fetchAllEpisodes(
  admin: Admin,
  opts: { podcastId?: string | undefined; activeOnly?: boolean } = {},
): Promise<EpisodeRow[]> {
  const activeOnly = opts.activeOnly ?? true;
  return pageAll<EpisodeRow>((from, to) => {
    let q = admin
      .from("podcast_episodes")
      .select(
        "id, slug, title, podcast_id, released_at, disposition, podcasts!inner(id, name, curation_status)",
      )
      .order("released_at", { ascending: false })
      .range(from, to);
    if (opts.podcastId) q = q.eq("podcast_id", opts.podcastId);
    if (activeOnly) q = q.eq("podcasts.curation_status", "active");
    return q.returns<EpisodeRow[]>();
  });
}

/** Episodes with zero rows in episode_movies — nothing surfaces them in the app. */
export async function fetchUnlinkedEpisodes(
  admin: Admin,
  opts: {
    podcastId?: string | undefined;
    limit?: number | undefined;
    includeRetired?: boolean;
    activeOnly?: boolean;
  } = {},
): Promise<UnlinkedEpisode[]> {
  const episodes = await fetchAllEpisodes(admin, {
    podcastId: opts.podcastId,
    activeOnly: opts.activeOnly ?? true,
  });
  const linkRows = await pageAll<{ episode_id: string }>((from, to) =>
    admin.from("episode_movies").select("episode_id").range(from, to),
  );
  const linked = new Set(linkRows.map((l) => l.episode_id));

  const unlinked = episodes
    .filter((ep) => !linked.has(ep.id))
    .filter((ep) => (opts.includeRetired ? true : ep.disposition !== "not_about_a_movie"))
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
  const rows = await pageAll<{ episode_id: string; movie_id: string }>((from, to) =>
    admin.from("episode_match_rejections").select("episode_id, movie_id").range(from, to),
  );
  return new Set(rows.map((r) => `${r.episode_id}:${r.movie_id}`));
}

/** Learned negative evidence: how often each movie has been rejected as a match. */
export async function fetchRejectionCountsByMovie(admin: Admin): Promise<Record<string, number>> {
  const rows = await pageAll<{ movie_id: string }>((from, to) =>
    admin.from("episode_match_rejections").select("movie_id").range(from, to),
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.movie_id] = (counts[r.movie_id] ?? 0) + 1;
  return counts;
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
