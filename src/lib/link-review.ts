import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirmEpisodeMatch, unconfirmEpisodeMatch } from "@/lib/ingestion.functions";
import { useDiscovery } from "@/lib/discovery";
import { flagKey } from "@/lib/flags";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/** Confirmations changed in this session, held on their own key so Confirm never reloads the catalogue. */
const LOCAL_KEY = ["link-confirmations"] as const;
type LocalState = Record<string, boolean>;

/**
 * Pass K4 — link review state on consumer episode rows. Confirmed links come
 * straight from the catalogue read, so no extra request per row; L2a follow-up
 * layers this session's confirmations on top instead of refetching everything.
 */
export function useConfirmedLinks() {
  const { catalog } = useDiscovery();
  const isAdmin = useIsAdmin();
  const local = useQuery<LocalState>({
    queryKey: LOCAL_KEY,
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const overrides = local.data ?? {};

  const confirmed = new Set<string>();
  for (const link of catalog?.episodeMovies ?? []) {
    if (link.review_state === "confirmed") confirmed.add(flagKey(link.episode_id, link.movie_id));
  }
  for (const [key, on] of Object.entries(overrides)) {
    if (on) confirmed.add(key);
    else confirmed.delete(key);
  }
  return { confirmed, isAdmin };
}

/**
 * Pass U38 — Confirm is a reversible toggle: `on` confirms the pairing (and
 * resolves any open flag), `off` returns it to unreviewed.
 */
export function useConfirmMatch() {
  const confirmMatch = useServerFn(confirmEpisodeMatch);
  const unconfirmMatch = useServerFn(unconfirmEpisodeMatch);
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({
      episodeId,
      movieId,
      on = true,
    }: {
      episodeId: string;
      movieId: string;
      on?: boolean;
    }) =>
      on
        ? confirmMatch({ data: { episodeId, movieId } })
        : unconfirmMatch({ data: { episodeId, movieId } }),
    onSuccess: (_result, { episodeId, movieId, on = true }) => {
      client.setQueryData<LocalState>(LOCAL_KEY, (prev) => ({
        ...(prev ?? {}),
        [flagKey(episodeId, movieId)]: on,
      }));
      void client.invalidateQueries({ queryKey: ["episode-flags"] });
      void client.invalidateQueries({ queryKey: ["episode-links"] });
      toast.success(on ? "Link confirmed" : "Confirmation undone");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
