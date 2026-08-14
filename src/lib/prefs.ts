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
}

export interface Prefs {
  serviceSlugs: string[];
  preferredPodcastSlugs: string[];
  ratings: Record<string, EpisodeRating>;
  listening: Record<string, ListeningStatus>;
  quality: Record<string, ProductionQuality>;
  watchedMovieSlugs: string[];
  filters: Filters;
}

export const YEAR_FLOOR = 1970;
export const YEAR_CEILING = 2026;
export const RUNTIME_CEILING = 180;

export const DEFAULT_PREFS: Prefs = {
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
  filters: {
    onlyMyServices: true,
    serviceSlugs: [],
    genreSlugs: ["thriller", "romance", "comedy"],
    yearMin: 1985,
    yearMax: 2009,
    maxRuntime: 100,
    hideWatched: false,
    commentaryOnly: true,
    preferredOnly: false,
  },
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
    write({ ...current, watchedMovieSlugs: toggle(current.watchedMovieSlugs, slug, on) });
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
