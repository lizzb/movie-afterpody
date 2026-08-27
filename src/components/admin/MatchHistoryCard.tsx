import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { listMatchActions, undoMatchAction } from "@/lib/ingestion.functions";

const ACTION_LABEL: Record<string, string> = {
  approve: "Approved",
  reject: "Rejected",
  unlink: "Unlinked",
  relink: "Relinked",
  confirm: "Confirmed correct",
  not_about_a_movie: "Marked not about a movie",
};

/** Recent decisions with a one-click undo, so a misclick is recoverable. */
export function MatchHistoryCard({ onSuccess }: { onSuccess: () => void }) {
  const client = useQueryClient();
  const listFn = useServerFn(listMatchActions);
  const undoFn = useServerFn(undoMatchAction);
  const [error, setError] = useState<string | null>(null);

  const actions = useQuery({
    queryKey: ["match-actions"],
    queryFn: () => listFn({ data: { limit: 40 } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const undo = useMutation({
    mutationFn: (actionId: string) => undoFn({ data: { actionId } }),
    onSuccess: async () => {
      setError(null);
      await client.invalidateQueries({ queryKey: ["match-actions"] });
      await client.invalidateQueries({ queryKey: ["match-suggestions"] });
      await client.invalidateQueries({ queryKey: ["episode-links"] });
      onSuccess();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {actions.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />
      ) : actions.isError ? (
        <p className="mt-4 text-sm text-destructive">{(actions.error as Error).message}</p>
      ) : (actions.data?.actions.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No decisions recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {(actions.data?.actions ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {ACTION_LABEL[a.action] ?? a.action}
                  {a.undone ? " · undone" : ""}
                </p>
                <p className="mt-1 break-anywhere text-sm font-semibold leading-snug">{a.episodeTitle}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.podcastName}
                  {a.movieTitle ? ` → ${a.movieTitle}${a.movieYear ? ` (${a.movieYear})` : ""}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={a.undone || undo.isPending}
                onClick={() => undo.mutate(a.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-40"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {a.undone ? "Undone" : "Undo"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
