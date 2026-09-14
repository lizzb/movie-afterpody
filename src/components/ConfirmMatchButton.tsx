import { Check, Loader2 } from "lucide-react";
import { flagKey } from "@/lib/flags";
import { useConfirmedLinks, useConfirmMatch } from "@/lib/link-review";

/**
 * Pass K4 — admin-only "this link is correct" control, paired with the flag
 * button: nothing selected = unreviewed, flag = flagged, check = confirmed.
 */
export function ConfirmMatchButton({
  episodeId,
  movieId,
}: {
  episodeId: string;
  movieId: string;
}) {
  const { confirmed, isAdmin, isLoading } = useConfirmedLinks();
  const confirm = useConfirmMatch();
  if (!isAdmin) return null;

  const isConfirmed = confirmed.has(flagKey(episodeId, movieId));
  const title = isLoading
    ? "Checking whether this link is already confirmed…"
    : isConfirmed
      ? "Confirmed correct — tap to undo"
      : "Confirm this link is correct";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        confirm.mutate({ episodeId, movieId, on: !isConfirmed });
      }}
      disabled={confirm.isPending || isLoading}
      aria-pressed={isConfirmed}
      aria-label={title}
      title={title}
      className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 ${
        isConfirmed
          ? "border-transparent bg-teal-soft text-teal"
          : "border-border text-muted-foreground hover:text-teal"
      }`}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Check className="size-4" aria-hidden />
      )}
    </button>
  );
}
