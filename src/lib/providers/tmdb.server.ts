import { TMDB_IMAGE_BASE, normalizeTitle, slugify, tmdbFetch } from "./shared.server";

export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  release_date?: string;
  runtime?: number;
  overview?: string;
  tagline?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  imdb_id?: string | null;
}

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface TmdbWatchProvidersResponse {
  results?: Record<string, { link?: string; flatrate?: TmdbWatchProvider[]; rent?: TmdbWatchProvider[]; buy?: TmdbWatchProvider[]; ads?: TmdbWatchProvider[] }>;
}

export interface TmdbSearchResponse {
  results?: TmdbMovieResult[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbGenreListResponse {
  genres?: TmdbGenre[];
}

export function tmdbPosterUrl(path: string | null | undefined, size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w342"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function searchTmdbMovies(apiKey: string, query: string, year?: number): Promise<TmdbMovieResult[]> {
  const params = new URLSearchParams({ query });
  if (year) params.set("year", String(year));
  const data = (await tmdbFetch(`/search/movie?${params.toString()}`, apiKey)) as TmdbSearchResponse;
  return data.results ?? [];
}

export async function getTmdbMovieDetails(apiKey: string, tmdbId: number): Promise<TmdbMovieDetails | null> {
  const data = (await tmdbFetch(`/movie/${tmdbId}?append_to_response=external_ids`, apiKey)) as TmdbMovieDetails;
  return data ?? null;
}

export async function getTmdbWatchProviders(apiKey: string, tmdbId: number): Promise<TmdbWatchProvidersResponse> {
  return (await tmdbFetch(`/movie/${tmdbId}/watch/providers`, apiKey)) as TmdbWatchProvidersResponse;
}

export async function getTmdbGenreList(apiKey: string): Promise<TmdbGenre[]> {
  const data = (await tmdbFetch("/genre/movie/list", apiKey)) as TmdbGenreListResponse;
  return data.genres ?? [];
}

export interface MatchedTmdbMovie {
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

export async function findBestTmdbMatch(
  apiKey: string,
  title: string,
  year?: number,
): Promise<MatchedTmdbMovie | null> {
  const results = await searchTmdbMovies(apiKey, title, year);
  if (!results.length) return null;

  const normalizedQuery = normalizeTitle(title);
  const scored = results.map((r) => {
    const normalizedResult = normalizeTitle(r.title);
    let confidence = 0;
    if (normalizedResult === normalizedQuery) confidence = 100;
    else if (normalizedResult.includes(normalizedQuery) || normalizedQuery.includes(normalizedResult)) confidence = 90;
    else if (normalizedQuery.split(" ").every((w) => normalizedResult.includes(w))) confidence = 75;
    else confidence = Math.max(10, Math.round((r.popularity ?? 0) * 2));

    const resultYear = r.release_date ? Number(r.release_date.slice(0, 4)) : null;
    if (year && resultYear) {
      if (resultYear === year) confidence += 10;
      else if (Math.abs(resultYear - year) <= 1) confidence += 3;
      else confidence -= 20;
    }

    return { result: r, confidence: Math.min(100, confidence) };
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  const best = scored[0];
  if (!best || best.confidence < 60) return null;

  const details = await getTmdbMovieDetails(apiKey, best.result.id);
  if (!details) return null;

  return {
    tmdbId: details.id,
    title: details.title,
    releaseYear: details.release_date ? Number(details.release_date.slice(0, 4)) : null,
    releaseDate: details.release_date ?? null,
    runtime: details.runtime ?? null,
    overview: details.overview ?? null,
    tagline: details.tagline ?? null,
    posterUrl: tmdbPosterUrl(details.poster_path),
    backdropUrl: tmdbPosterUrl(details.backdrop_path, "w780"),
    imdbId: details.imdb_id ?? null,
    confidence: best.confidence,
  };
}

export function slugFromTmdbMovie(title: string): string {
  return slugify(title);
}
