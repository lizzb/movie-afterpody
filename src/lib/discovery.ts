import { useMemo } from "react";
import { useCatalog } from "./data";
import { usePrefs, toUserData, type Filters, type Prefs } from "./prefs";
import { ratingRank } from "./ratings";
import { scoreMovie, type CommentaryScore } from "./scoring";
import type {
  Catalog,
  Episode,
  Genre,
  Podcast,
  StreamingService,
  UserData,
} from "./types";

export interface EpisodeEntry {
  episode: Episode;
  podcast: Podcast;
  preferred: boolean;
  listenUrl: string | null;
  alsoCovers: string[];
}

export interface MovieEntry {
  movie: Catalog["movies"][number];
  score: CommentaryScore;
  genres: Genre[];
  services: StreamingService[];
  /** Storefront-only offers (rent/buy) — never counted as streaming. */
  rentBuyServices: StreamingService[];
  episodes: EpisodeEntry[];
  watched: boolean;
  onMyServices: boolean;
  /** Marked "Not interested" locally (Pass H). */
  notInterested: boolean;
}

/** Everything the screens need, derived once from the catalog + local prefs. */
export function useDiscovery() {
  const { data: catalog, isLoading, error } = useCatalog();
  const prefs = usePrefs();
  const user = useMemo(() => toUserData(catalog, prefs), [catalog, prefs]);

  const entries = useMemo<MovieEntry[]>(() => {
    if (!catalog) return [];
    return buildEntries(catalog, user, prefs);
  }, [catalog, user, prefs]);

  return { catalog, entries, prefs, user, isLoading, error };
}

function buildEntries(catalog: Catalog, user: UserData, prefs: Prefs): MovieEntry[] {
  const genreById = new Map(catalog.genres.map((g) => [g.id, g]));
  const serviceById = new Map(catalog.services.map((s) => [s.id, s]));
  const podcastById = new Map(catalog.podcasts.map((p) => [p.id, p]));
  const episodeById = new Map(catalog.episodes.map((e) => [e.id, e]));
  const movieById = new Map(catalog.movies.map((m) => [m.id, m]));
  const preferredIds = new Set(
    Object.entries(user.preferences)
      .filter(([, v]) => v === "preferred")
      .map(([k]) => k),
  );
  const watchedIds = new Set(user.watches.map((w) => w.movie_id));
  const mySlugs = new Set(prefs.serviceSlugs);
  const notInterested = new Set(prefs.notInterestedSlugs);

  const sourceByEpisode = new Map<string, string>();
  for (const s of catalog.episodeSources) {
    if (!sourceByEpisode.has(s.episode_id) || s.is_primary) sourceByEpisode.set(s.episode_id, s.url);
  }

  const moviesByEpisode = new Map<string, string[]>();
  for (const link of catalog.episodeMovies) {
    const list = moviesByEpisode.get(link.episode_id) ?? [];
    list.push(link.movie_id);
    moviesByEpisode.set(link.episode_id, list);
  }

  return catalog.movies.map((movie) => {
    const genres = catalog.movieGenres
      .filter((mg) => mg.movie_id === movie.id)
      .map((mg) => genreById.get(mg.genre_id))
      .filter((g): g is Genre => Boolean(g));

    // Only offers you can actually watch on a subscription (or free with ads)
    // count as "available" — rent/buy storefront offers are not streaming.
    const services = catalog.availability
      .filter((a) => a.movie_id === movie.id)
      .filter((a) => a.offer_type === "subscription" || a.offer_type === "free_ads")
      .map((a) => serviceById.get(a.service_id))
      .filter((s): s is StreamingService => Boolean(s))
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
      .sort((a, b) => a.sort_order - b.sort_order);

    const streamingIds = new Set(services.map((s) => s.id));
    const rentBuyServices = catalog.availability
      .filter((a) => a.movie_id === movie.id)
      .filter((a) => a.offer_type === "rent" || a.offer_type === "buy")
      .map((a) => serviceById.get(a.service_id))
      .filter((s): s is StreamingService => Boolean(s))
      .filter((s) => !streamingIds.has(s.id))
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
      .sort((a, b) => a.sort_order - b.sort_order);

    const episodes: EpisodeEntry[] = catalog.episodeMovies
      .filter((l) => l.movie_id === movie.id)
      .map((l) => episodeById.get(l.episode_id))
      .filter((e): e is Episode => Boolean(e))
      .map((episode) => {
        const podcast = podcastById.get(episode.podcast_id);
        return podcast
          ? {
              episode,
              podcast,
              preferred: preferredIds.has(podcast.id),
              listenUrl: sourceByEpisode.get(episode.id) ?? podcast.website_url ?? null,
              alsoCovers: (moviesByEpisode.get(episode.id) ?? [])
                .filter((id) => id !== movie.id)
                .map((id) => movieById.get(id)?.title)
                .filter((t): t is string => Boolean(t)),
            }
          : null;
      })
      .filter((e): e is EpisodeEntry => Boolean(e))
      .sort(
        (a, b) =>
          Number(b.preferred) - Number(a.preferred) ||
          (b.episode.released_at ?? "").localeCompare(a.episode.released_at ?? ""),
      );

    return {
      movie,
      score: scoreMovie(movie.id, catalog, user),
      genres,
      services,
      rentBuyServices,
      episodes,
      watched: watchedIds.has(movie.id),
      notInterested: notInterested.has(movie.slug),
      onMyServices: services.some((s) => mySlugs.has(s.slug)),
    };
  });
}

function compare(a: MovieEntry, b: MovieEntry, key: Filters["sortBy"]): number {
  switch (key) {
    case "episodes":
      return b.episodes.length - a.episodes.length;
    case "runtime":
      return (a.movie.runtime_minutes ?? 9999) - (b.movie.runtime_minutes ?? 9999);
    case "year":
      return (b.movie.release_year ?? 0) - (a.movie.release_year ?? 0);
    case "title":
      return a.movie.title.localeCompare(b.movie.title);
    case "availability":
      return (
        Number(b.onMyServices) - Number(a.onMyServices) || b.services.length - a.services.length
      );
    default:
      return b.score.score - a.score.score;
  }
}

const HOLIDAY_RE = /\b(santa|christmas)\b/i;

export function applyFilters(
  entries: MovieEntry[],
  filters: Filters,
  options: { alwaysHideNotInterested?: boolean } = {},
): MovieEntry[] {
  const genreWanted = new Set(filters.genreSlugs);
  const serviceWanted = new Set(filters.serviceSlugs);
  const hideNotInterested = options.alwaysHideNotInterested || filters.hideNotInterested;

  return entries
    .filter((e) => {
      if (filters.onlyMyServices && !e.onMyServices) return false;
      if (serviceWanted.size > 0 && !e.services.some((s) => serviceWanted.has(s.slug))) return false;
      if (genreWanted.size > 0 && !e.genres.some((g) => genreWanted.has(g.slug))) return false;
      const year = e.movie.release_year;
      if (year !== null && (year < filters.yearMin || year > filters.yearMax)) return false;
      const runtime = e.movie.runtime_minutes;
      if (runtime !== null && runtime > filters.maxRuntime) return false;
      if (filters.hideWatched && e.watched) return false;
      if (filters.commentaryOnly && e.episodes.length === 0) return false;
      if (filters.preferredOnly && !e.episodes.some((ep) => ep.preferred)) return false;
      if (hideNotInterested && e.notInterested) return false;
      // Pass H8 — crude holiday exclusion: standalone "Santa" / "Christmas" in title or synopsis.
      if (filters.excludeHoliday) {
        const title = e.movie.title;
        const synopsis = e.movie.synopsis ?? "";
        if (HOLIDAY_RE.test(title) || HOLIDAY_RE.test(synopsis)) return false;
      }
      const rank = ratingRank(e.movie.certification);
      if (rank === null) {
        if (!filters.allowUnrated) return false;
      } else if (rank > filters.maxRating) return false;
      return true;
    })
    .sort(
      (a, b) =>
        compare(a, b, filters.sortBy) ||
        b.score.score - a.score.score ||
        b.episodes.length - a.episodes.length ||
        a.movie.title.localeCompare(b.movie.title),
    );
}
