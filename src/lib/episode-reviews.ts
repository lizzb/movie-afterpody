import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listEpisodeReviewStates,
  markEpisodeNotAboutMovie,
  setEpisodeReviewed,
  undoEpisodeRetirement,
  type EpisodeReviewState,
} from "@/lib/ingestion.functions";


import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Admin-only episode sign-off used on consumer episode rows: the same
 * `episode_reviews` state Match review writes, so a "reviewed" episode stays
 * reviewed everywhere. Non-admins never trigger the query.
 */
export function useEpisodeReviewStates(episodeIds: string[]) {
  const isAdmin = useIsAdmin();
  const fetchStates = useServerFn(listEpisodeReviewStates);
  // Keep every episode on the page. The server batches database `.in()` reads
  // into short requests, so truncating here only makes valid review records
  // look unreviewed on shows with more than 400 episodes.
  const ids = [...new Set(episodeIds)].sort();

  const query = useQuery({
    queryKey: ["episode-review-states", ids],
    enabled: isAdmin && ids.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => (await fetchStates({ data: { episodeIds: ids } })).reviews,
  });

  return {
    isAdmin,
    reviews: query.data ?? {},
    isLoading: query.isLoading,
  };
}

/**
 * Pass L2a — retirement changes links and review queues, so refresh those keys
 * only. A keyless invalidation used to reload the whole catalogue per click.
 */
const RETIREMENT_KEYS = [
  ["catalog"],
  // Server-ranked list reads (L2b): without these, a retired episode kept
  // showing its movie links on movie detail, the show page and show detail.
  ["movie-page"],
  ["show-page"],
  ["show-detail"],
  ["episode-details"],
  ["facets"],
  ["episode-review-states"],
  ["episode-links"],
  ["episode-flags"],
  ["podcast-coverage"],
  ["ingestion-stats"],
  ["unmatched-episodes"],
  ["match-suggestions"],
  ["match-actions"],
];

/**
 * Writes one episode's reviewed state straight into every cached
 * `episode-review-states` result. Without this the button kept reading the old
 * value until a full page-wide refetch returned (seconds on mobile), so the
 * action looked like it had not registered and a second tap reopened the
 * episode that had just been marked reviewed.
 */
function patchReviewCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  episodeId: string,
  reviewed: boolean,
) {
  queryClient.setQueriesData<Record<string, EpisodeReviewState>>(
    { queryKey: ["episode-review-states"] },
    (prev) => {
      if (!prev || !(episodeId in prev)) return prev;
      const existing = prev[episodeId]!;
      return {
        ...prev,
        [episodeId]: {
          ...existing,
          reviewed,
          reviewedAt: reviewed ? new Date().toISOString() : existing.reviewedAt,
          hasStaleRecord: reviewed ? false : Boolean(existing.reviewedAt),
        },
      };
    },
  );
}

export function useSetEpisodeReviewed() {
  const queryClient = useQueryClient();
  const run = useServerFn(setEpisodeReviewed);
  return useMutation({
    mutationFn: async (vars: { episodeId: string; reviewed: boolean }) =>
      run({ data: { episodeIds: [vars.episodeId], reviewed: vars.reviewed } }),
    onMutate: (vars) => {
      patchReviewCaches(queryClient, vars.episodeId, vars.reviewed);
    },
    onSuccess: (result, vars) => {
      if (result.succeeded === 0) {
        patchReviewCaches(queryClient, vars.episodeId, !vars.reviewed);
        toast.error(result.failed[0] ?? "Could not update this episode");
        return;
      }
      toast.success(vars.reviewed ? "Episode marked reviewed" : "Episode reopened");
      void queryClient.invalidateQueries({ queryKey: ["episode-review-states"] });
    },
    onError: (error: unknown, vars) => {
      patchReviewCaches(queryClient, vars.episodeId, !vars.reviewed);
      toast.error(error instanceof Error ? error.message : "Could not update this episode");
    },
  });
}

/** Admin-only "not about a movie" retirement from consumer episode rows. */
export function useMarkEpisodeNotAboutMovie() {
  const queryClient = useQueryClient();
  const run = useServerFn(markEpisodeNotAboutMovie);
  return useMutation({
    mutationFn: async (vars: { episodeId: string }) => run({ data: { episodeId: vars.episodeId } }),
    onSuccess: (result) => {
      toast.success(
        result.linksRemoved > 0
          ? `Episode retired — ${result.linksRemoved} link${result.linksRemoved === 1 ? "" : "s"} removed`
          : "Episode marked as not about a movie",
      );
      for (const queryKey of RETIREMENT_KEYS) void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not retire this episode"),
  });
}

/**
 * Reverses the retirement from the same episode row: the episode returns to the
 * review queues and the links that retirement removed come back.
 */
export function useUndoEpisodeRetirement() {
  const queryClient = useQueryClient();
  const run = useServerFn(undoEpisodeRetirement);
  return useMutation({
    mutationFn: async (vars: { episodeId: string }) => run({ data: { episodeId: vars.episodeId } }),
    onSuccess: (result) => {
      toast.success(
        result.linksRestored > 0
          ? `Undone — episode back in review, ${result.linksRestored} link${result.linksRestored === 1 ? "" : "s"} restored`
          : "Undone — episode is back in review",
      );
      for (const queryKey of RETIREMENT_KEYS) void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not undo this decision"),
  });
}
