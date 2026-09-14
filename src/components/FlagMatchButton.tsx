import { Flag } from "lucide-react";
import { flagKey, useMyFlags, useToggleFlag } from "@/lib/flags";

interface Props {
  episodeId: string;
  movieId: string;
  /** Shown in the confirmation snackbar so it names what was flagged. */
  movieTitle?: string;
  episodeTitle?: string;
}

/**
 * "Wrong movie?" — one tap records that this episode/movie pairing looks wrong,
 * with an undo snackbar. Fixing it happens later in admin Match review.
 * Pass K1: one circular shape everywhere this control appears.
 */
export function FlagMatchButton({ episodeId, movieId, movieTitle, episodeTitle }: Props) {
  const { flagged, hasUser } = useMyFlags();
  const toggle = useToggleFlag();
  const isFlagged = flagged.has(flagKey(episodeId, movieId));

  if (!hasUser) return null;

  const title = isFlagged ? "Flagged as wrong — tap to undo" : "Wrong movie?";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ episodeId, movieId, on: !isFlagged });
      }}
      disabled={toggle.isPending}
      aria-pressed={isFlagged}
      aria-label={title}
      title={title}
      className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 ${
        isFlagged
          ? "border-transparent bg-coral-soft text-coral"
          : "border-border text-muted-foreground hover:text-coral"
      }`}
    >
      <Flag className="size-4" aria-hidden />
    </button>
  );
}
