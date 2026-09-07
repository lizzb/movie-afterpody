import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmEpisodeMatch, unconfirmEpisodeMatch } from "@/lib/ingestion.functions";
import { flagKey } from "@/lib/flags";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/** Confirmations changed in this session, held on their own key so Confirm never reloads the catalogue. */
const LOCAL_KEY = ["link-confirmations"] as const;
type LocalState = Record<string, boolean>;

async function fetchConfirmedKeys(): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("episode_movies")
      .select("episode_id, movie_id")
      .eq("review_state", "confirmed")
      .order("episode_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) out.push(flagKey(r.episode_id, r.movie_id));
    if (rows.length < 1000) return out;
  }
}

/**
 * Pass K4 — link review state on consumer episode rows. Pass L2b reads only the
 * confirmed pairs (admins only) instead of deriving them from a full catalogue
 * read, and layers this session's confirmations on top.
 */
export function useConfirmedLinks() {
  const isAdmin = useIsAdmin();
  const links = useQuery({
    queryKey: ["episode-links", "confirmed"],
    queryFn: fetchConfirmedKeys,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const local = useQuery<LocalState>({
    queryKey: LOCAL_KEY,
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const overrides = local.data ?? {};

  const confirmed = new Set<string>(links.data ?? []);
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
