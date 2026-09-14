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

const CONFIRMED_KEY = ["episode-links", "confirmed"] as const;

async function fetchConfirmedKeys(): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("episode_movies")
      .select("episode_id, movie_id")
      .eq("review_state", "confirmed")
      // Both columns: an episode can hold several confirmed links, so ordering
      // by episode_id alone leaves ties. Offset paging over a tie can skip or
      // repeat rows, which made individual confirmations vanish from the UI
      // even though the database had them.
      .order("episode_id")
      .order("movie_id")
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
    queryKey: CONFIRMED_KEY,
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
  // Until the confirmed set has loaded, an already-confirmed link would draw as
  // unconfirmed — which invited confirming it a second time.
  return { confirmed, isAdmin, isLoading: links.isPending && isAdmin };
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
      const key = flagKey(episodeId, movieId);
      client.setQueryData<LocalState>(LOCAL_KEY, (prev) => ({
        ...(prev ?? {}),
        [key]: on,
      }));
      // Also write the change into the fetched set, so the control keeps its
      // state if the session overrides are dropped before the next read.
      client.setQueryData<string[]>(CONFIRMED_KEY, (prev) =>
        prev ? (on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key)) : prev,
      );
      void client.invalidateQueries({ queryKey: ["episode-flags"] });
      void client.invalidateQueries({ queryKey: CONFIRMED_KEY });
      toast.success(on ? "Link confirmed" : "Confirmation undone");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
