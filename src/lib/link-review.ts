import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirmEpisodeMatch } from "@/lib/ingestion.functions";
import { useDiscovery } from "@/lib/discovery";
import { flagKey } from "@/lib/flags";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Pass K4 — link review state on consumer episode rows. Confirmed links come
 * straight from the catalogue read, so no extra request per row.
 */
export function useConfirmedLinks() {
  const { catalog } = useDiscovery();
  const isAdmin = useIsAdmin();
  const confirmed = new Set<string>();
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
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["catalog"] });
      void client.invalidateQueries({ queryKey: ["episode-flags"] });
      toast.success("Link confirmed");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
