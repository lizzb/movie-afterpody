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
  /** Franchise the film belongs to, used to disambiguate sequels when matching. */
  belongs_to_collection?: { id: number; name: string } | null;
  /** Appended to the detail call so certification costs no extra request. */
  release_dates?: {
    results?: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[];
  };
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
  const data = (await tmdbFetch(
    `/movie/${tmdbId}?append_to_response=external_ids,release_dates`,
    apiKey,
  )) as TmdbMovieDetails;
  return data ?? null;
}

/** US certification out of an already-fetched detail payload. */
export function certificationFromDetails(details: TmdbMovieDetails): TmdbCertification {
  const us = (details.release_dates?.results ?? []).find((r) => r.iso_3166_1 === "US");
  const cert = (us?.release_dates ?? [])
    .map((r) => (r.certification ?? "").trim())
    .find((value) => value.length > 0);
  return { certification: cert ?? null, system: cert ? "MPA" : null };
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
  collectionId: number | null;
  confidence: number;
  /** From the same detail request — no separate certification call needed. */
  certification: TmdbCertification;
}

export async function findBestTmdbMatch(
  apiKey: string,
  title: string,
  year?: number,
): Promise<MatchedTmdbMovie | null> {
  // A year filter on TMDB search is a hard filter: one wrong year returns zero
  // rows even for an exact title. So we widen the search progressively instead
  // of reporting "no match" for a film that plainly exists.
  const cleaned = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*[:\-–—]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  const attempts: { query: string; year?: number | undefined }[] = [
    { query: title, year },
    ...(year ? [{ query: title, year: undefined }] : []),
    ...(cleaned && cleaned.toLowerCase() !== title.trim().toLowerCase()
      ? [{ query: cleaned, year: undefined }]
      : []),
  ];

  let results: TmdbMovieResult[] = [];
  for (const attempt of attempts) {
    results = await searchTmdbMovies(apiKey, attempt.query, attempt.year);
    if (results.length) break;
  }
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
    collectionId: details.belongs_to_collection?.id ?? null,
    confidence: best.confidence,
    certification: certificationFromDetails(details),
  };
}

/** Resolve an IMDb id (tt0110989) straight to a TMDB movie. */
export async function findTmdbByImdbId(apiKey: string, imdbId: string): Promise<MatchedTmdbMovie | null> {
  const found = (await tmdbFetch(
    `/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`,
    apiKey,
  )) as { movie_results?: { id: number }[] };
  const first = found.movie_results?.[0];
  if (!first) return null;

  const details = await getTmdbMovieDetails(apiKey, first.id);
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
    imdbId: details.imdb_id ?? imdbId,
    collectionId: details.belongs_to_collection?.id ?? null,
    confidence: 100,
    certification: certificationFromDetails(details),
  };
}

export function isImdbId(value: string): boolean {
  return /^tt\d{6,10}$/i.test(value.trim());
}

export function slugFromTmdbMovie(title: string): string {
  return slugify(title);
}

/* ---------------------------------------------------------------------------
 * Content ratings (MPA for movies, TV parental guidelines for series).
 * Both live behind existing TMDB detail endpoints, so no new provider.
 * ------------------------------------------------------------------------ */

interface TmdbReleaseDatesResponse {
  results?: {
    iso_3166_1?: string;
    release_dates?: { certification?: string; type?: number }[];
  }[];
}

interface TmdbContentRatingsResponse {
  results?: { iso_3166_1?: string; rating?: string }[];
}

export interface TmdbCertification {
  certification: string | null;
  system: string | null;
}

/** US certification for a movie, e.g. "PG-13". Null when TMDB has none. */
export async function getTmdbMovieCertification(
  apiKey: string,
  tmdbId: number,
): Promise<TmdbCertification> {
  const data = (await tmdbFetch(
    `/movie/${tmdbId}/release_dates`,
    apiKey,
  )) as TmdbReleaseDatesResponse;
  const us = (data.results ?? []).find((r) => r.iso_3166_1 === "US");
  // Theatrical/digital entries can be blank; take the first non-empty value.
  const cert = (us?.release_dates ?? [])
    .map((r) => (r.certification ?? "").trim())
    .find((value) => value.length > 0);
  return { certification: cert ?? null, system: cert ? "MPA" : null };
}

/** US TV parental rating for a series, e.g. "TV-MA". */
export async function getTmdbTvCertification(
  apiKey: string,
  tmdbId: number,
): Promise<TmdbCertification> {
  const data = (await tmdbFetch(`/tv/${tmdbId}/content_ratings`, apiKey)) as TmdbContentRatingsResponse;
  const us = (data.results ?? []).find((r) => r.iso_3166_1 === "US");
  const cert = (us?.rating ?? "").trim();
  return { certification: cert || null, system: cert ? "US-TV" : null };
}
