/**
 * Pass L2b — server-side catalogue + ranking.
 *
 * The whole catalogue is read here, on the server, once per short cache window,
 * and every list surface receives only the page it renders. Filtering, sorting,
 * Commentary Score and counts are still evaluated over the *full* candidate set,
 * so results stay identical to the previous browser-side path.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildEntries, applyFilters, type MovieEntry } from "./entries";
import { buildPodcastEntries, type PodcastEntry } from "./podcast-entries";
import { DEFAULT_PREFS, toUserData, type Filters, type Prefs } from "./prefs";
import type { Taste } from "./taste";
import type {
  Catalog,
  Episode,
  EpisodeMovie,
  Genre,
  Movie,
  MovieAvailability,
  MovieGenre,
  Podcast,
  PodcastMetric,
  StreamingService,
} from "./types";

function client() {
  return createClient<Database>(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_PUBLISHABLE_KEY']!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const PAGE = 1000;
const WAVE = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One range read with retries. A transient statement timeout or dropped
 * connection used to abort the whole catalogue read (and therefore every list
 * surface); retrying the single window, then the window in smaller slices,
 * keeps a blip from emptying the catalogue. A window that still fails throws,
 * so a truncated catalogue is never presented as complete.
 */
async function readWindow<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  from: number,
  to: number,
): Promise<T[]> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await page(from, to);
    if (!error) return data ?? [];
    last = error.message;
    console.error(`[catalog] range ${from}-${to} failed (attempt ${attempt + 1}): ${error.message}`);
    await sleep(200 * (attempt + 1));
  }
  // Last resort: the same window in smaller slices, which is cheaper per query.
  const rows: T[] = [];
  const SLICE = 250;
  for (let start = from; start <= to; start += SLICE) {
    const end = Math.min(to, start + SLICE - 1);
    const { data, error } = await page(start, end);
    if (error) throw new Error(`${last || error.message} (slice ${start}-${end}: ${error.message})`);
    const got = data ?? [];
    rows.push(...got);
    if (got.length < end - start + 1) break;
  }
  return rows;
}

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let start = 0; ; start += PAGE * WAVE) {
    const wave = await Promise.all(
      Array.from({ length: WAVE }, (_, i) => {
        const from = start + i * PAGE;
        return readWindow(page, from, from + PAGE - 1);
      }),
    );
    let done = false;
    for (const rows of wave) {
      out.push(...rows);
      if (rows.length < PAGE) done = true;
    }
    if (done) return out;
  }
}

/**
 * Episodes, read per active show with bounded concurrency.
 *
 * A single id-ordered keyset walk over the whole table was the dominant cost of
 * a cold catalogue read (~12s of ~14s) and also transferred parked-show episodes
 * that are filtered out again in memory (Pass U80). Reading each active show's
 * episodes separately restores the source-side active-show filter, is fully
 * parallelisable, and completes in ~3s.
 */
async function fetchEpisodesByPodcast(
  db: ReturnType<typeof client>,
  podcastIds: string[],
): Promise<Episode[]> {
  const CONCURRENCY = 8;
  const out: Episode[] = [];
  for (let i = 0; i < podcastIds.length; i += CONCURRENCY) {
    const chunk = podcastIds.slice(i, i + CONCURRENCY);
    const waves = await Promise.all(
      chunk.map((podcastId) =>
        fetchAllRows<Episode>((from, to) =>
          db
            .from("podcast_episodes")
            .select("id, podcast_id, slug, title, released_at, duration_seconds, episode_number")
            .eq("podcast_id", podcastId)
            .order("id")
            .range(from, to)
            .returns<Episode[]>(),
        ),
      ),
    );
    for (const rows of waves) out.push(...rows);
  }
  return out;
}



async function readCatalog(): Promise<Catalog> {
  const db = client();

  const podcasts = await fetchAllRows<Podcast>((from, to) =>
    db
      .from("podcasts")
      .select(
        "id, slug, name, description, artwork_url, accent, episode_count, latest_episode_at, activity_status, website_url, curation_status",
      )
      .neq("curation_status", "parked")
      .order("name")
      .range(from, to)
      .returns<Podcast[]>(),
  );
  const activePodcastIds = podcasts.map((p) => p.id);

  const [genres, services, movies, movieGenres, availability, metrics, episodes, links, holiday] =
    await Promise.all([
      fetchAllRows<Genre>((from, to) =>
        db.from("genres").select("id, slug, name").order("name").range(from, to).returns<Genre[]>(),
      ),
      fetchAllRows<StreamingService>((from, to) =>
        db
          .from("streaming_services")
          .select("id, slug, name, short_name, accent, sort_order")
          .order("sort_order")
          .range(from, to)
          .returns<StreamingService[]>(),
      ),
      fetchAllRows<Movie>((from, to) =>
        db
          .from("movies")
          .select(
            "id, media_type, slug, title, release_year, runtime_minutes, poster_url, accent, availability_checked_at, certification, certification_system",
          )
          .order("title")
          .range(from, to)
          .returns<Movie[]>(),
      ),
      fetchAllRows<MovieGenre>((from, to) =>
        db
          .from("movie_genres")
          .select("movie_id, genre_id")
          .order("movie_id")
          .range(from, to)
          .returns<MovieGenre[]>(),
      ),
      fetchAllRows<MovieAvailability>((from, to) =>
        db
          .from("movie_availability")
          .select("id, movie_id, service_id, offer_type, deep_link")
          .order("id")
          .range(from, to)
          .returns<MovieAvailability[]>(),
      ),
      activePodcastIds.length === 0
        ? Promise.resolve([] as PodcastMetric[])
        : fetchAllRows<PodcastMetric>((from, to) =>
            db
              .from("podcast_external_metrics")
              .select("podcast_id, platform, rating, rating_count, external_url")
              .in("podcast_id", activePodcastIds)
              .order("podcast_id")
              .range(from, to)
              .returns<PodcastMetric[]>(),
          ),
      activePodcastIds.length === 0
        ? Promise.resolve([] as Episode[])
        : fetchByKeyset<Episode>((afterId, limit) =>
            db
              .from("podcast_episodes")
              .select("id, podcast_id, slug, title, released_at, duration_seconds, episode_number")
              .gt("id", afterId)
              .order("id")
              .limit(limit)
              .returns<Episode[]>(),
          ),
      activePodcastIds.length === 0
        ? Promise.resolve([] as EpisodeMovie[])
        : fetchAllRows<EpisodeMovie>((from, to) =>
            db
              .from("episode_movies")
              .select(
                "episode_id, movie_id, is_primary_subject, match_confidence, review_state, podcast_episodes!inner(podcast_id)",
              )
              .in("podcast_episodes.podcast_id", activePodcastIds)
              .order("episode_id")
              .range(from, to)
              .returns<EpisodeMovie[]>(),
          ),
      fetchAllRows<{ id: string }>((from, to) =>
        db
          .from("movies")
          .select("id")
          .eq("is_holiday", true)
          .order("id")
          .range(from, to)
          .returns<{ id: string }[]>(),
      ),
    ]);

  // Episodes are read by primary key, so scope to active shows and restore the
  // newest-first ordering the list surfaces expect here.
  const activeIds = new Set(activePodcastIds);
  const activeEpisodes = episodes
    .filter((e) => activeIds.has(e.podcast_id))
    .sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? "") || a.id.localeCompare(b.id));

  return {
    genres,
    services,
    movies,
    movieGenres,
    availability,
    podcasts,
    metrics,
    episodes: activeEpisodes,
    episodeMovies: links.map((l) => ({
      episode_id: l.episode_id,
      movie_id: l.movie_id,
      is_primary_subject: l.is_primary_subject,
      match_confidence: l.match_confidence,
      review_state: l.review_state,
    })),
    holidayMovieIds: holiday.map((h) => h.id),
  };
}

const TTL_MS = 60_000;
/**
 * Stale-while-revalidate. Previously every request arriving after the 60s TTL
 * expired had to wait on the whole catalogue read (measured ~16s), so list
 * surfaces intermittently rendered with no rows at all. Now the last good
 * catalogue is served immediately while the refresh runs behind it, and a
 * failed refresh falls back to that same data instead of emptying the lists.
 */
const MAX_STALE_MS = 15 * 60_000;
let cached: { at: number; value: Catalog } | null = null;
let inFlight: Promise<Catalog> | null = null;

export async function loadCatalog(): Promise<Catalog> {
  const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;
  if (cached && age < TTL_MS) return cached.value;
  if (!inFlight) {
    inFlight = readCatalog()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .catch((err: unknown) => {
        console.error("[catalog] read failed", err);
        throw err;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  const refresh = inFlight;
  if (cached && age < MAX_STALE_MS) {
    void refresh.catch(() => undefined);
    return cached.value;
  }
  return refresh;
}

function prefsFrom(taste: Taste): Prefs {
  return {
    ...DEFAULT_PREFS,
    serviceSlugs: taste.serviceSlugs,
    preferredPodcastSlugs: taste.preferredPodcastSlugs,
    ratings: taste.ratings,
    listening: taste.listening,
    quality: taste.quality,
    watchedMovieSlugs: taste.watchedMovieSlugs,
    notInterestedSlugs: taste.notInterestedSlugs,
  };
}

/** Full-scope derived entries for one taste profile, cached per catalogue read. */
const entriesCache = new WeakMap<Catalog, Map<string, MovieEntry[]>>();

export async function deriveEntries(taste: Taste): Promise<{ catalog: Catalog; entries: MovieEntry[] }> {
  const catalog = await loadCatalog();
  const key = JSON.stringify(taste);
  let byTaste = entriesCache.get(catalog);
  if (!byTaste) {
    byTaste = new Map();
    entriesCache.set(catalog, byTaste);
  }
  const hit = byTaste.get(key);
  if (hit) return { catalog, entries: hit };
  const prefs = prefsFrom(taste);
  const entries = buildEntries(catalog, toUserData(catalog, prefs), prefs);
  if (byTaste.size > 4) byTaste.clear();
  byTaste.set(key, entries);
  return { catalog, entries };
}

export async function rankMovies(
  taste: Taste,
  filters: Filters,
  options: { term?: string; alwaysHideNotInterested?: boolean } = {},
): Promise<{ catalog: Catalog; matches: MovieEntry[] }> {
  const { catalog, entries } = await deriveEntries(taste);
  const needle = (options.term ?? "").trim().toLowerCase();
  const matches = applyFilters(entries, filters, {
    alwaysHideNotInterested: options.alwaysHideNotInterested ?? false,
  }).filter((e) => !needle || e.movie.title.toLowerCase().includes(needle));
  return { catalog, matches };
}

const showCache = new WeakMap<Catalog, Map<string, PodcastEntry[]>>();

export async function rankShows(taste: Taste): Promise<{ catalog: Catalog; shows: PodcastEntry[] }> {
  const { catalog, entries } = await deriveEntries(taste);
  const key = JSON.stringify(taste);
  let byTaste = showCache.get(catalog);
  if (!byTaste) {
    byTaste = new Map();
    showCache.set(catalog, byTaste);
  }
  const hit = byTaste.get(key);
  if (hit) return { catalog, shows: hit };
  const shows = buildPodcastEntries(catalog, entries);
  if (byTaste.size > 4) byTaste.clear();
  byTaste.set(key, shows);
  return { catalog, shows };
}
