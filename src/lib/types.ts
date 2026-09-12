export type MediaType = "movie" | "tv";
export type OfferType = "subscription" | "free_ads" | "rent" | "buy";
export type PodcastActivity = "active" | "slow" | "dormant" | "ended";
export type PodcastPreference = "preferred" | "neutral" | "blocked";
export type EpisodeRating = "disliked" | "meh" | "loved";
export type ListeningStatus = "not_started" | "started" | "finished";
export type ProductionQuality = "poor" | "okay" | "good";

export interface Genre {
  id: string;
  slug: string;
  name: string;
}

export interface StreamingService {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  accent: string;
  sort_order: number;
}

export interface Movie {
  id: string;
  media_type: MediaType;
  slug: string;
  title: string;
  release_year: number | null;
  runtime_minutes: number | null;
  /** Only loaded on the movie detail page (Pass L2a keeps it out of list reads). */
  synopsis?: string | null;
  poster_url: string | null;
  accent: string;
  /** When TMDB watch providers were last checked for this movie. */
  availability_checked_at?: string | null;
  /** US content rating, e.g. "PG-13" or "TV-MA". Null when unrated/unknown. */
  certification?: string | null;
  certification_system?: string | null;
}

export interface MovieGenre {
  movie_id: string;
  genre_id: string;
}

export interface MovieAvailability {
  id: string;
  movie_id: string;
  service_id: string;
  offer_type: OfferType;
  deep_link: string | null;
}

export type PodcastCuration = "active" | "parked";

export interface Podcast {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  artwork_url: string | null;
  accent: string;
  episode_count: number;
  latest_episode_at: string | null;
  activity_status: PodcastActivity;
  website_url: string | null;
  curation_status: PodcastCuration;
}

export interface PodcastMetric {
  podcast_id: string;
  platform: string;
  rating: number | null;
  rating_count: number | null;
  external_url: string | null;
}

export interface Episode {
  id: string;
  podcast_id: string;
  slug: string;
  title: string;
  /** Only loaded for episodes actually on screen (Pass L2a). */
  description?: string | null;
  released_at: string | null;
  duration_seconds: number | null;
  episode_number: number | null;
}

export interface EpisodeSource {
  id: string;
  episode_id: string;
  platform: string;
  url: string;
  is_primary: boolean;
  embeddable: boolean;
}

export interface EpisodeMovie {
  episode_id: string;
  movie_id: string;
  is_primary_subject: boolean;
  match_confidence: number;
  review_state: "proposed" | "auto_linked" | "confirmed";
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  accent: string;
  created_at: string;
}

export interface WatchlistMovie {
  watchlist_id: string;
  movie_id: string;
}

export interface MovieWatch {
  id: string;
  movie_id: string;
  watched_on: string;
}

export interface Catalog {
  genres: Genre[];
  services: StreamingService[];
  movies: Movie[];
  movieGenres: MovieGenre[];
  availability: MovieAvailability[];
  podcasts: Podcast[];
  metrics: PodcastMetric[];
  episodes: Episode[];
  episodeMovies: EpisodeMovie[];
  /** Movie ids whose title or synopsis names a holiday, matched server-side. */
  holidayMovieIds: string[];
  /**
   * Pass U79 — true when at least one page of the read failed even after a
   * smaller-page retry, so surfaces can warn instead of showing a blank page.
   */
  partial?: boolean;
}


export interface UserData {
  serviceIds: string[];
  preferences: Record<string, PodcastPreference>;
  ratings: Record<string, EpisodeRating>;
  listening: Record<string, ListeningStatus>;
  quality: Record<string, ProductionQuality>;
  watchlists: Watchlist[];
  watchlistMovies: WatchlistMovie[];
  watches: MovieWatch[];
}

export const EMPTY_USER_DATA: UserData = {
  serviceIds: [],
  preferences: {},
  ratings: {},
  listening: {},
  quality: {},
  watchlists: [],
  watchlistMovies: [],
  watches: [],
};
