/**
 * Client hooks for the Pass L2b server-side list pages. Each hook sends the
 * filters + a compact taste profile and receives one bounded page plus honest
 * full-scope totals.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrefs, type Filters } from "./prefs";
import { tasteFromPrefs, type Taste } from "./taste";
import {
  getCatalogFacets,
  getShowDetail,
  listMoviePage,
  listShowPage,
} from "./catalog-lists.functions";

const STALE = 60 * 1000;

export function useTaste(): Taste {
  const prefs = usePrefs();
  return useMemo(() => tasteFromPrefs(prefs), [prefs]);
}

/** Genres + services for the filter bar (tiny, cached). */
export function useFacets() {
  const query = useQuery({
    queryKey: ["facets"],
    queryFn: () => getCatalogFacets(),
    staleTime: 10 * 60 * 1000,
  });
  return {
    genres: query.data?.genres ?? [],
    services: query.data?.services ?? [],
    podcasts: query.data?.podcasts ?? [],
    availabilityCount: query.data?.availabilityCount ?? 0,
    movieCount: query.data?.movieCount ?? 0,
    isLoading: query.isLoading,
  };
}

export function useMoviePage(args: {
  filters: Filters;
  limit: number;
  term?: string;
  tonight?: boolean;
}) {
  const taste = useTaste();
  const { filters, limit, term = "", tonight = false } = args;
  const query = useQuery({
    queryKey: ["movie-page", { filters, limit, term, tonight, taste }],
    queryFn: () => listMoviePage({ data: { taste, filters, term, limit, tonight } }),
    staleTime: STALE,
    placeholderData: (prev) => prev,
  });
  return {
    rows: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    catalogTotal: query.data?.catalogTotal ?? 0,
    showMatches: query.data?.showMatches ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

export function useShowPage(args: {
  limit: number;
  term?: string;
  mode?: "all" | "streamable" | "preferred";
}) {
  // Always rank against the live taste profile: a frozen first-render snapshot
  // is DEFAULT_PREFS during hydration, which wiped services and preferred shows.
  const taste = useTaste();
  const { limit, term = "", mode = "all" } = args;
  const query = useQuery({
    queryKey: ["show-page", { limit, term, mode, taste }],
    queryFn: () => listShowPage({ data: { taste, term, mode, limit } }),
    staleTime: STALE,
    placeholderData: (prev) => prev,
  });
  return {
    rows: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useShowDetail(slug: string) {
  const taste = useTaste();
  const query = useQuery({
    queryKey: ["show-detail", slug, taste],
    queryFn: () => getShowDetail({ data: { taste, slug } }),
    staleTime: STALE,
    placeholderData: (prev) => prev,
  });
  return { detail: query.data ?? null, isLoading: query.isLoading, error: query.error };
}
