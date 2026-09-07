/**
 * Pass L2b — server-side list pages.
 *
 * Each function ranks over the FULL candidate set on the server and returns
 * only the rows the surface renders plus honest totals.
 */
import { createServerFn } from "@tanstack/react-start";
import type { Filters } from "./prefs";
import type { Taste } from "./taste";
import type { MovieEntry } from "./entries";
import type { PodcastEntry, PodcastMovie, PodcastEpisodeRow, PodcastSummary } from "./podcast-entries";
import type { Genre, Podcast, PodcastMetric, StreamingService } from "./types";

export interface MoviePage {
  rows: MovieEntry[];
  total: number;
  catalogTotal: number;
  showMatches: { id: string; slug: string; name: string }[];
}

export interface Facets {
  genres: Genre[];
  services: StreamingService[];
  availabilityCount: number;
  movieCount: number;
}

export interface ShowPage {
  rows: PodcastSummary[];
  total: number;
}

export interface ShowDetail {
  podcast: Podcast;
  preferred: boolean;
  metric: PodcastMetric | null;
  links: PodcastMetric[];
  episodeCount: number;
  movieCount: number;
  matchScore: number;
  reasons: string[];
  streamableTotal: number;
  restTotal: number;
  streamable: PodcastMovie[];
  rest: PodcastMovie[];
  allEpisodes: PodcastEpisodeRow[];
}

const COVERED_CAP = 60;

export const getCatalogFacets = createServerFn({ method: "GET" }).handler(async (): Promise<Facets> => {
  const { loadCatalog } = await import("./catalog.server");
  const catalog = await loadCatalog();
  return {
    genres: catalog.genres,
    services: catalog.services,
    availabilityCount: catalog.availability.length,
    movieCount: catalog.movies.length,
  };
});

export const listMoviePage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      taste: Taste;
      filters: Filters;
      term?: string;
      limit: number;
      tonight?: boolean;
    }) => data,
  )
  .handler(async ({ data }): Promise<MoviePage> => {
    const { rankMovies } = await import("./catalog.server");
    const { catalog, matches } = await rankMovies(data.taste, data.filters, {
      ...(data.term ? { term: data.term } : {}),
      alwaysHideNotInterested: data.tonight === true,
    });
    const needle = (data.term ?? "").trim().toLowerCase();
    return {
      rows: matches.slice(0, Math.max(1, data.limit)),
      total: matches.length,
      catalogTotal: catalog.movies.length,
      showMatches: needle
        ? catalog.podcasts
            .filter((p) => p.name.toLowerCase().includes(needle))
            .slice(0, 6)
            .map((p) => ({ id: p.id, slug: p.slug, name: p.name }))
        : [],
    };
  });

export const listShowPage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      taste: Taste;
      term?: string;
      mode?: "all" | "streamable" | "preferred";
      limit: number;
    }) => data,
  )
  .handler(async ({ data }): Promise<ShowPage> => {
    const { rankShows } = await import("./catalog.server");
    const { toPodcastSummary } = await import("./podcast-entries");
    const { shows } = await rankShows(data.taste);
    const needle = (data.term ?? "").trim().toLowerCase();
    const mode = data.mode ?? "all";
    const matches = shows.filter((e) => {
      if (needle && !e.podcast.name.toLowerCase().includes(needle)) return false;
      if (mode === "streamable" && e.streamableUnwatched.length === 0) return false;
      if (mode === "preferred" && !e.preferred) return false;
      return true;
    });
    return {
      rows: matches.slice(0, Math.max(1, data.limit)).map(toPodcastSummary),
      total: matches.length,
    };
  });

export const getShowDetail = createServerFn({ method: "POST" })
  .inputValidator((data: { taste: Taste; slug: string }) => data)
  .handler(async ({ data }): Promise<ShowDetail | null> => {
    const { rankShows } = await import("./catalog.server");
    const { shows } = await rankShows(data.taste);
    const entry: PodcastEntry | undefined = shows.find((s) => s.podcast.slug === data.slug);
    if (!entry) return null;
    const streamableSet = new Set(entry.streamableUnwatched.map((m) => m.entry.movie.id));
    const rest = entry.movies.filter((m) => !streamableSet.has(m.entry.movie.id));
    return {
      podcast: entry.podcast,
      preferred: entry.preferred,
      metric: entry.metric,
      links: entry.links,
      episodeCount: entry.episodeCount,
      movieCount: entry.movies.length,
      matchScore: entry.matchScore,
      reasons: entry.reasons,
      streamableTotal: entry.streamableUnwatched.length,
      restTotal: rest.length,
      streamable: entry.streamableUnwatched.slice(0, COVERED_CAP),
      rest: rest.slice(0, COVERED_CAP),
      allEpisodes: entry.allEpisodes,
    };
  });
