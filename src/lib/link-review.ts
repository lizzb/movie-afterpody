import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirmEpisodeMatch } from "@/lib/ingestion.functions";
import { useDiscovery } from "@/lib/discovery";
import { flagKey } from "@/lib/flags";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/** Links confirmed in this session, held on their own key so Confirm never reloads the catalogue. */
const LOCAL_KEY = ["link-confirmations"] as const;

/**
 * Pass K4 — link review state on consumer episode rows. Confirmed links come
 * straight from the catalogue read, so no extra request per row; L2a follow-up
 * layers this session's confirmations on top instead of refetching everything.
 */
export function useConfirmedLinks() {
  const { catalog } = useDiscovery();
  const isAdmin = useIsAdmin();
  const local = useQuery<string[]>({
    queryKey: LOCAL_KEY,
    queryFn: () => [],
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const confirmed = new Set<string>(local.data ?? []);
  for (const link of catalog?.episodeMovies ?? []) {
    if (link.review_state === "confirmed") confirmed.add(flagKey(link.episode_id, link.movie_id));
  }
  return { confirmed, isAdmin };
}

/** Marks an episode/movie pairing correct; also resolves any open flag on it. */
export function useConfirmMatch() {
  const confirmMatch = useServerFn(confirmEpisodeMatch);
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ episodeId, movieId }: { episodeId: string; movieId: string }) =>
      confirmMatch({ data: { episodeId, movieId } }),
    onSuccess: (_result, { episodeId, movieId }) => {
      client.setQueryData<string[]>(LOCAL_KEY, (prev) => {
        const key = flagKey(episodeId, movieId);
        const next = prev ?? [];
        return next.includes(key) ? next : [...next, key];
      });
      void client.invalidateQueries({ queryKey: ["episode-flags"] });
      void client.invalidateQueries({ queryKey: ["episode-links"] });
      toast.success("Link confirmed");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
