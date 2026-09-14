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

/**
 * Every unresolved "wrong movie?" flag this signed-in person has raised.
 *
 * Scoped to `flagged_by = userId` and ordered/bounded on purpose: the read
 * policy lets admins see everyone's flags, so an unscoped read grew past the
 * backend's 1,000-row response cap and silently dropped this person's own
 * flags — the button then never rendered as flagged. Never read this list
 * unbounded.
 */
const MY_FLAGS_LIMIT = 1000;

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
        .eq("flagged_by", userId!)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(MY_FLAGS_LIMIT)
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
    /** Only used for the snackbar copy. */
    movieTitle?: string;
    episodeTitle?: string;
  }) => {
    if (!userId) throw new Error("Sign in to flag a wrong match.");
    if (on) {
      const { error } = await supabase
        .from("episode_link_flags")
        .insert({ episode_id: episodeId, movie_id: movieId, flagged_by: userId });
      // A partial unique index guards duplicates; an existing open flag is fine.
      if (error && error.code !== "23505") throw new Error(error.message);
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
        // Naming the pairing makes the snackbar readable at phone width; the
        // release year is skipped because it roughly doubles the line length.
        const named = [vars.movieTitle, vars.episodeTitle].filter(Boolean).join(" · ");
        toast(named ? `Flagged as wrong: ${named}` : "Flagged as a wrong match", {
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
