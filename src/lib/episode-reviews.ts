import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listEpisodeReviewStates,
  markEpisodeNotAboutMovie,
  setEpisodeReviewed,
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
  const ids = [...new Set(episodeIds)].sort().slice(0, 400);

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

export function useSetEpisodeReviewed() {
  const queryClient = useQueryClient();
  const run = useServerFn(setEpisodeReviewed);
  return useMutation({
    mutationFn: async (vars: { episodeId: string; reviewed: boolean }) =>
      run({ data: { episodeIds: [vars.episodeId], reviewed: vars.reviewed } }),
    onSuccess: (result, vars) => {
      if (result.succeeded === 0) {
        toast.error(result.failed[0] ?? "Could not update this episode");
        return;
      }
      toast.success(vars.reviewed ? "Episode marked reviewed" : "Episode reopened");
      void queryClient.invalidateQueries({ queryKey: ["episode-review-states"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update this episode"),
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
      void queryClient.invalidateQueries();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not retire this episode"),
  });
}
