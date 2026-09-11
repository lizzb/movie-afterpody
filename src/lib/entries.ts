/**
 * Pure catalogue derivation — no React, no Supabase client, no browser APIs.
 *
 * Pass L2b: this module is imported by both the browser (detail surfaces) and
 * the server list functions, so ranking is defined exactly once and the server
 * page and any client fallback can never disagree.
 */
import { RUNTIME_CEILING, type Filters, type Prefs } from "./prefs";
import { ratingRank } from "./ratings";
import { scoreAllMovies, type CommentaryScore } from "./scoring";
import type { Catalog, Episode, Genre, Podcast, StreamingService, UserData } from "./types";

export interface EpisodeEntry {
  episode: Episode;
  podcast: Podcast;
  preferred: boolean;
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
  /** Title or synopsis names a holiday — matched server-side (Pass L2a). */
  isHoliday: boolean;
}

export function buildEntries(catalog: Catalog, user: UserData, prefs: Prefs): MovieEntry[] {
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

  const genresByMovie = new Map<string, Genre[]>();
  for (const row of catalog.movieGenres) {
    const genre = genreById.get(row.genre_id);
    if (!genre) continue;
    const list = genresByMovie.get(row.movie_id) ?? [];
    list.push(genre);
    genresByMovie.set(row.movie_id, list);
  }

  const availabilityByMovie = new Map<string, typeof catalog.availability>();
  for (const offer of catalog.availability) {
    const list = availabilityByMovie.get(offer.movie_id) ?? [];
    list.push(offer);
    availabilityByMovie.set(offer.movie_id, list);
  }

  const holidayIds = new Set(catalog.holidayMovieIds);

  const moviesByEpisode = new Map<string, string[]>();
  const linksByMovie = new Map<string, typeof catalog.episodeMovies>();
  for (const link of catalog.episodeMovies) {
    const list = moviesByEpisode.get(link.episode_id) ?? [];
    list.push(link.movie_id);
    moviesByEpisode.set(link.episode_id, list);
    const movieLinks = linksByMovie.get(link.movie_id) ?? [];
    movieLinks.push(link);
    linksByMovie.set(link.movie_id, movieLinks);
  }

  const scoresByMovie = scoreAllMovies(catalog, user);

  return catalog.movies.map((movie) => {
    const genres = genresByMovie.get(movie.id) ?? [];
    const movieOffers = availabilityByMovie.get(movie.id) ?? [];

    // Only offers you can actually watch on a subscription (or free with ads)
    // count as "available" — rent/buy storefront offers are not streaming.
    const services = movieOffers
      .filter((a) => a.offer_type === "subscription" || a.offer_type === "free_ads")
      .map((a) => serviceById.get(a.service_id))
      .filter((s): s is StreamingService => Boolean(s))
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
      .sort((a, b) => a.sort_order - b.sort_order);

    const streamingIds = new Set(services.map((s) => s.id));
    const rentBuyServices = movieOffers
      .filter((a) => a.offer_type === "rent" || a.offer_type === "buy")
      .map((a) => serviceById.get(a.service_id))
      .filter((s): s is StreamingService => Boolean(s))
      .filter((s) => !streamingIds.has(s.id))
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
      .sort((a, b) => a.sort_order - b.sort_order);

    const episodes: EpisodeEntry[] = (linksByMovie.get(movie.id) ?? [])
      .map((l) => episodeById.get(l.episode_id))
      .filter((e): e is Episode => Boolean(e))
      .map((episode) => {
        const podcast = podcastById.get(episode.podcast_id);
        return podcast
          ? {
              episode,
              podcast,
              preferred: preferredIds.has(podcast.id),
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
      score: scoresByMovie.get(movie.id) ?? {
        score: 0,
        explanation: "No commentary episodes catalogued for this one yet.",
        reasons: [],
        episodeCount: 0,
        podcastCount: 0,
        preferredCount: 0,
      },
      genres,
      services,
      rentBuyServices,
      episodes,
      watched: watchedIds.has(movie.id),
      notInterested: notInterested.has(movie.slug),
      isHoliday: holidayIds.has(movie.id),
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
      // The slider's top stop is labelled "Any", so treat it as no runtime cap.
      if (
        filters.maxRuntime < RUNTIME_CEILING &&
        runtime !== null &&
        runtime > filters.maxRuntime
      )
        return false;

      if (filters.hideWatched && e.watched) return false;
      if (filters.commentaryOnly && e.episodes.length === 0) return false;
      if (filters.preferredOnly && !e.episodes.some((ep) => ep.preferred)) return false;
      // Pass U45 — podcast coverage. Derived from the episodes already on the
      // entry, so there is no extra query and no new full-table read.
      if (coverageWanted.size > 0) {
        const shows = new Set(e.episodes.map((ep) => ep.podcast.slug));
        const hit =
          filters.coverageMode === "all"
            ? [...coverageWanted].every((slug) => shows.has(slug))
            : [...coverageWanted].some((slug) => shows.has(slug));
        if (!hit) return false;
        if (filters.plusOtherPodcast && ![...shows].some((slug) => !coverageWanted.has(slug)))
          return false;
      }
      if (hideNotInterested && e.notInterested) return false;
      // Pass H8 — holiday exclusion; the match now happens in the query (Pass L2a).
      if (filters.excludeHoliday && e.isHoliday) return false;
      const rank = ratingRank(e.movie.certification);
      if (rank === null) {
        if (!filters.allowUnrated) return false;
      } else if (rank > filters.maxRating || rank < filters.minRating) return false;

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
