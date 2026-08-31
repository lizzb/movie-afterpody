import { useSyncExternalStore } from "react";
import type {
  Catalog,
  EpisodeRating,
  ListeningStatus,
  PodcastPreference,
  ProductionQuality,
  UserData,
} from "./types";
import { EMPTY_USER_DATA } from "./types";

/**
 * Local-first user state.
 *
 * The app is usable with no sign-in: preferences, ratings and watch state live
 * in localStorage, keyed by catalog *slug* so they survive reseeds. The shape
 * mirrors the `UserData` the Cloud tables return, so moving this to the signed
 * in tables later is a swap of this module only.
 *
 * The values below are *seed defaults for this device* — not application rules.
 */

export type SortKey = "commentary" | "episodes" | "runtime" | "year" | "title" | "availability";

export interface Filters {
  onlyMyServices: boolean;
  serviceSlugs: string[];
  genreSlugs: string[];
  yearMin: number;
  yearMax: number;
  maxRuntime: number;
  hideWatched: boolean;
  commentaryOnly: boolean;
  preferredOnly: boolean;
  /** Ladder rank floor (see lib/ratings). RATING_MIN allows everything. */
  minRating: number;
  /** Ladder rank ceiling (see lib/ratings). RATING_MAX allows everything. */
  maxRating: number;

  /** Unrated titles are opt-in, never silently in or out. */
  allowUnrated: boolean;
  /** Hide anything marked "Not interested" (always excluded from Tonight). */
  hideNotInterested: boolean;
  /** Pass H8 — exclude standalone Santa/Christmas titles (keyword rule). */
  excludeHoliday: boolean;
  sortBy: SortKey;
}

export interface LocalList {
  id: string;
  name: string;
  accent: string;
  movieSlugs: string[];
  createdAt: string;
}

export type ThemeMode = "system" | "light" | "dark";
export type ViewMode = "rows" | "tiles";

export interface Prefs {
  theme: ThemeMode;
  /** surface key -> layout, e.g. { tonight: "tiles" } */
  viewModes: Record<string, ViewMode>;
  serviceSlugs: string[];
  preferredPodcastSlugs: string[];
  ratings: Record<string, EpisodeRating>;
  listening: Record<string, ListeningStatus>;
  quality: Record<string, ProductionQuality>;
  watchedMovieSlugs: string[];
  /** slug -> ISO date (yyyy-mm-dd) the movie was marked watched. */
  watchedDates: Record<string, string>;
  lists: LocalList[];
  /** Tonight's recommendation parameters. */
  filters: Filters;
  /** Pass H5 — the All Movies browse surface keeps its own, unfiltered state. */
  movieFilters: Filters;

  /** Movies you never want suggested. Excluded from Tonight unconditionally. */
  notInterestedSlugs: string[];
  /** Pass G app settings. */
  viewportLock: boolean;
  dimWatched: boolean;
}

export const YEAR_FLOOR = 1970;
export const YEAR_CEILING = 2026;
export const RUNTIME_CEILING = 180;

/**
 * Pass H8 — crude seasonal default for `excludeHoliday`. On from Jan 8 –
 * Nov 2, off from Nov 3 – Jan 7, so Christmas titles drop out during the
 * year but surface around the holidays. Computed once for the default; once
 * the user toggles it, their choice sticks.
 */
export function defaultHolidayExclusion(date: Date = new Date()): boolean {
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate();
  if (m < 1 || m > 12) return true;
  if (m > 1 && m < 11) return true; // Feb - Oct
  if (m === 1) return d >= 8; // Jan 8+ on
  if (m === 11) return d <= 2; // Nov 1-2 on
  return false; // Nov 3 - Jan 7 off
}

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  viewModes: {},
  serviceSlugs: ["netflix", "prime-video", "disney-plus"],
  preferredPodcastSlugs: [
    "how-did-this-get-made",
    "that-aged-well",
    "ps-i-hate-this-movie",
    "your-inner-child-is-an-idiot",
    "the-villain-was-right",
    "swimfans",
    "mom-cant-cook",
    "romancing-the-pod",
    "the-rewatchables",
    "i-hate-it-but-i-love-it",
    "ruined",
    "dorking-out",
    "the-flop-house",
    "the-bechdel-cast",
    "blank-check",
    "too-scary-didnt-watch",
    "podstruck",
    "what-went-wrong",
    "all-80s-movies",
  ],
  ratings: {
    "swim-the-craft": "loved",
    "bc-legally-blonde": "loved",
    "www-clue": "meh",
    "psi-wild-things": "disliked",
  },
  listening: {
    "swim-the-craft": "finished",
    "bc-legally-blonde": "finished",
    "a80-heathers": "started",
  },
  quality: {
    "swim-the-craft": "good",
    "tvwr-the-craft": "poor",
    "ps-empire-records": "okay",
    "a80-clue": "good",
  },
  watchedMovieSlugs: ["clueless", "scream", "heathers", "the-princess-bride"],
  watchedDates: {
    clueless: "2026-08-09",
    scream: "2026-07-28",
    heathers: "2026-07-14",
    "the-princess-bride": "2026-06-30",
  },
  lists: [
    {
      id: "list-date-night",
      name: "Date Night",
      accent: "coral",
      movieSlugs: ["legally-blonde", "the-princess-bride"],
      createdAt: "2026-06-01",
    },
    {
      id: "list-good-bad",
      name: "Good-Bad Movies",
      accent: "gold",
      movieSlugs: ["the-craft", "wild-things"],
      createdAt: "2026-06-02",
    },
    {
      id: "list-spooky",
      name: "Spooky Season",
      accent: "purple",
      movieSlugs: [],
      createdAt: "2026-06-03",
    },
  ],
filters: {
    onlyMyServices: true,
    serviceSlugs: [],
    genreSlugs: ["thriller", "romance", "comedy"],
    yearMin: 1985,
    yearMax: 2009,
    maxRuntime: 100,
    hideWatched: true,
    commentaryOnly: true,
    preferredOnly: false,
    minRating: 1,
    maxRating: 7,

    allowUnrated: true,
    hideNotInterested: true,
    excludeHoliday: defaultHolidayExclusion(),
    sortBy: "commentary",
  },
  movieFilters: NO_FILTERS,

  notInterestedSlugs: [],
  viewportLock: true,
  dimWatched: false,
};

const KEY = "afterparty.prefs.v1";

let current: Prefs = DEFAULT_PREFS;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      current = {
        ...DEFAULT_PREFS,
        ...parsed,
        watchedDates: { ...(parsed.watchedDates ?? {}) },
        viewModes: { ...(parsed.viewModes ?? {}) },
        lists: parsed.lists ?? DEFAULT_PREFS.lists,
        notInterestedSlugs: parsed.notInterestedSlugs ?? [],
        filters: { ...DEFAULT_PREFS.filters, ...(parsed.filters ?? {}) },
      };
    }
  } catch {
    current = DEFAULT_PREFS;
  }
}

function emit() {
  for (const l of listeners) l();
}

function write(next: Prefs) {
  current = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked — keep the in-memory value */
    }
  }
  emit();
}

function subscribe(fn: () => void) {
  hydrate();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot(): Prefs {
  hydrate();
  return current;
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS);
}

const toggle = (list: string[], value: string, on?: boolean) => {
  const has = list.includes(value);
  const want = on ?? !has;
  if (want === has) return list;
  return want ? [...list, value] : list.filter((v) => v !== value);
};

export const prefsActions = {
  setTheme(theme: ThemeMode) {
    write({ ...current, theme });
  },
  setViewMode(surface: string, mode: ViewMode) {
    write({ ...current, viewModes: { ...current.viewModes, [surface]: mode } });
  },
  toggleService(slug: string, on?: boolean) {
    write({ ...current, serviceSlugs: toggle(current.serviceSlugs, slug, on) });
  },
  togglePreferredPodcast(slug: string, on?: boolean) {
    write({
      ...current,
      preferredPodcastSlugs: toggle(current.preferredPodcastSlugs, slug, on),
    });
  },
  rateEpisode(slug: string, rating: EpisodeRating | null) {
    const ratings = { ...current.ratings };
    if (rating === null) delete ratings[slug];
    else ratings[slug] = rating;
    write({ ...current, ratings });
  },
  setListening(slug: string, status: ListeningStatus | null) {
    const listening = { ...current.listening };
    if (status === null || status === "not_started") delete listening[slug];
    else listening[slug] = status;
    write({ ...current, listening });
  },
  setQuality(slug: string, quality: ProductionQuality | null) {
    const next = { ...current.quality };
    if (quality === null) delete next[slug];
    else next[slug] = quality;
    write({ ...current, quality: next });
  },
  toggleWatched(slug: string, on?: boolean) {
    const next = toggle(current.watchedMovieSlugs, slug, on);
    const watchedDates = { ...current.watchedDates };
    if (next.includes(slug)) watchedDates[slug] ??= new Date().toISOString().slice(0, 10);
    else delete watchedDates[slug];
    write({ ...current, watchedMovieSlugs: next, watchedDates });
  },
  createList(name: string, accent: string) {
    const list: LocalList = {
      id: `list-${Date.now().toString(36)}`,
      name,
      accent,
      movieSlugs: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    write({ ...current, lists: [...current.lists, list] });
    return list.id;
  },
  renameList(id: string, name: string) {
    write({ ...current, lists: current.lists.map((l) => (l.id === id ? { ...l, name } : l)) });
  },
  deleteList(id: string) {
    write({ ...current, lists: current.lists.filter((l) => l.id !== id) });
  },
  toggleListMovie(id: string, movieSlug: string, on?: boolean) {
    write({
      ...current,
      lists: current.lists.map((l) =>
        l.id === id ? { ...l, movieSlugs: toggle(l.movieSlugs, movieSlug, on) } : l,
      ),
    });
  },
  toggleNotInterested(slug: string, on?: boolean) {
    write({ ...current, notInterestedSlugs: toggle(current.notInterestedSlugs, slug, on) });
  },
  setViewportLock(on: boolean) {
    write({ ...current, viewportLock: on });
  },
  setDimWatched(on: boolean) {
    write({ ...current, dimWatched: on });
  },
  setFilters(patch: Partial<Filters>) {
    write({ ...current, filters: { ...current.filters, ...patch } });
  },
  resetFilters() {
    write({ ...current, filters: DEFAULT_PREFS.filters });
  },
};

/** Projects slug-keyed local prefs onto the catalog's UUIDs. */
export function toUserData(catalog: Catalog | undefined, prefs: Prefs): UserData {
  if (!catalog) return EMPTY_USER_DATA;

  const serviceIdBySlug = new Map(catalog.services.map((s) => [s.slug, s.id]));
  const podcastIdBySlug = new Map(catalog.podcasts.map((p) => [p.slug, p.id]));
  const episodeIdBySlug = new Map(catalog.episodes.map((e) => [e.slug, e.id]));
  const movieIdBySlug = new Map(catalog.movies.map((m) => [m.slug, m.id]));

  const preferences: Record<string, PodcastPreference> = {};
  for (const slug of prefs.preferredPodcastSlugs) {
    const id = podcastIdBySlug.get(slug);
    if (id) preferences[id] = "preferred";
  }

  const remap = <T extends string>(src: Record<string, T>) => {
    const out: Record<string, T> = {};
    for (const [slug, value] of Object.entries(src)) {
      const id = episodeIdBySlug.get(slug);
      if (id) out[id] = value;
    }
    return out;
  };

  return {
    serviceIds: prefs.serviceSlugs
      .map((slug) => serviceIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id)),
    preferences,
    ratings: remap(prefs.ratings),
    listening: remap(prefs.listening),
    quality: remap(prefs.quality),
    watchlists: [],
    watchlistMovies: [],
    watches: prefs.watchedMovieSlugs
      .map((slug) => movieIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((movie_id) => ({ id: movie_id, movie_id, watched_on: "" })),
  };
}
