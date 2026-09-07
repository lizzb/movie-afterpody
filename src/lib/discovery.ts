import { useMemo } from "react";
import { useCatalog } from "./data";
import { usePrefs, toUserData, type Prefs } from "./prefs";
import { buildEntries, type MovieEntry } from "./entries";
import type { Catalog, UserData } from "./types";

export { applyFilters, buildEntries } from "./entries";
export type { EpisodeEntry, MovieEntry } from "./entries";

const entriesCache = new WeakMap<Catalog, WeakMap<Prefs, MovieEntry[]>>();

function getCachedEntries(catalog: Catalog, user: UserData, prefs: Prefs): MovieEntry[] {
  let byPrefs = entriesCache.get(catalog);
  if (!byPrefs) {
    byPrefs = new WeakMap<Prefs, MovieEntry[]>();
    entriesCache.set(catalog, byPrefs);
  }
  const cached = byPrefs.get(prefs);
  if (cached) return cached;
  const entries = buildEntries(catalog, user, prefs);
  byPrefs.set(prefs, entries);
  return entries;
}

/**
 * Everything the detail screens need, derived from the full catalogue in the
 * browser. Pass L2b moved the list surfaces (Tonight, Movies, Shows, show
 * detail) onto server-side pages; this hook now serves the detail/lists/settings
 * surfaces that still need lookups across the whole catalogue.
 */
export function useDiscovery() {
  const { data: catalog, isLoading, error } = useCatalog();
  const prefs = usePrefs();
  const user = useMemo(() => toUserData(catalog, prefs), [catalog, prefs]);

  const entries = useMemo<MovieEntry[]>(() => {
    if (!catalog) return [];
    return getCachedEntries(catalog, user, prefs);
  }, [catalog, user, prefs]);

  return { catalog, entries, prefs, user, isLoading, error };
}
