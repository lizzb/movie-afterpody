import { useMemo } from "react";
import { useDiscovery, type MovieEntry } from "./discovery";
import type { LocalList } from "./prefs";

export interface ListView {
  list: LocalList;
  entries: MovieEntry[];
  watchableCount: number;
}

export interface HistoryEntry {
  entry: MovieEntry;
  watchedOn: string | null;
}

/** Lists + watch history, joined from the catalog and local prefs. */
export function useLists() {
  const { entries, prefs, isLoading, error } = useDiscovery();

  const bySlug = useMemo(
    () => new Map(entries.map((e) => [e.movie.slug, e])),
    [entries],
  );

  const lists = useMemo<ListView[]>(
    () =>
      prefs.lists.map((list) => {
        const items = list.movieSlugs
          .map((slug) => bySlug.get(slug))
          .filter((e): e is MovieEntry => Boolean(e));
        return {
          list,
          entries: items,
          watchableCount: items.filter((e) => e.onMyServices).length,
        };
      }),
    [prefs.lists, bySlug],
  );

  const history = useMemo<HistoryEntry[]>(
    () =>
      prefs.watchedMovieSlugs
        .map((slug) => {
          const entry = bySlug.get(slug);
          return entry ? { entry, watchedOn: prefs.watchedDates[slug] ?? null } : null;
        })
        .filter((h): h is HistoryEntry => Boolean(h))
        .sort((a, b) => (b.watchedOn ?? "").localeCompare(a.watchedOn ?? "")),
    [prefs.watchedMovieSlugs, prefs.watchedDates, bySlug],
  );

  return { lists, history, isLoading, error };
}

export function formatWatchedOn(date: string | null): string {
  if (!date) return "Date not recorded";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
