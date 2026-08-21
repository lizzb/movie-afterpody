import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const flagKey = (episodeId: string, movieId: string) => `${episodeId}:${movieId}`;

interface FlagRow {
  id: string;
  episode_id: string;
  movie_id: string;
  resolved_at: string | null;
}

/** Every unresolved "wrong movie?" flag this signed-in person has raised. */
export function useMyFlags() {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["episode-flags", userId],
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("episode_link_flags")
        .select("id, episode_id, movie_id, resolved_at")
        .is("resolved_at", null)
        .returns<FlagRow[]>();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const keys = new Set((query.data ?? []).map((f) => flagKey(f.episode_id, f.movie_id)));
  return { flagged: keys, hasUser: Boolean(userId), isLoading: query.isLoading };
}

/**
 * Lightweight flag toggle: recording that a pairing looks wrong is enough for
 * now — an admin fixes it later from Match review. Inline correction comes later.
 */
export function useToggleFlag() {
  const { userId } = useAuth();
  const client = useQueryClient();

  const write = async ({
    episodeId,
    movieId,
    on,
  }: {
    episodeId: string;
    movieId: string;
    on: boolean;
  }) => {
    if (!userId) throw new Error("Sign in to flag a wrong match.");
    if (on) {
      const { error } = await supabase
        .from("episode_link_flags")
        .upsert(
          { episode_id: episodeId, movie_id: movieId, flagged_by: userId },
          { onConflict: "episode_id,movie_id,flagged_by" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("episode_link_flags")
        .delete()
        .eq("episode_id", episodeId)
        .eq("movie_id", movieId)
        .eq("flagged_by", userId)
        .is("resolved_at", null);
      if (error) throw new Error(error.message);
    }
  };

  const mutation = useMutation({
    mutationFn: write,
    onSuccess: (_res, vars) => {
      void client.invalidateQueries({ queryKey: ["episode-flags", userId] });
      if (vars.on) {
        toast("Flagged as a wrong match", {
          description: "It moves to the top of the admin review queue.",
          action: {
            label: "Undo",
            onClick: () => {
              void write({ ...vars, on: false }).then(() =>
                client.invalidateQueries({ queryKey: ["episode-flags", userId] }),
              );
            },
          },
        });
      } else {
        toast("Flag removed");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return mutation;
}
