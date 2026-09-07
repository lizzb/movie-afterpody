/**
 * The slug-keyed personal signals server-side ranking needs (Pass L2b).
 * Small by construction, so it travels with each list request.
 */
import type { EpisodeRating, ListeningStatus, ProductionQuality } from "./types";
import type { Prefs } from "./prefs";

export interface Taste {
  serviceSlugs: string[];
  preferredPodcastSlugs: string[];
  ratings: Record<string, EpisodeRating>;
  listening: Record<string, ListeningStatus>;
  quality: Record<string, ProductionQuality>;
  watchedMovieSlugs: string[];
  notInterestedSlugs: string[];
}

export const EMPTY_TASTE: Taste = {
  serviceSlugs: [],
  preferredPodcastSlugs: [],
  ratings: {},
  listening: {},
  quality: {},
  watchedMovieSlugs: [],
  notInterestedSlugs: [],
};

export function tasteFromPrefs(prefs: Prefs): Taste {
  return {
    serviceSlugs: prefs.serviceSlugs,
    preferredPodcastSlugs: prefs.preferredPodcastSlugs,
    ratings: prefs.ratings,
    listening: prefs.listening,
    quality: prefs.quality,
    watchedMovieSlugs: prefs.watchedMovieSlugs,
    notInterestedSlugs: prefs.notInterestedSlugs,
  };
}
