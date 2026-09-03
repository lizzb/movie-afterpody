import { Flag } from "lucide-react";
import { flagKey, useMyFlags, useToggleFlag } from "@/lib/flags";

interface Props {
  episodeId: string;
  movieId: string;
  /** "icon" for tight episode rows, "inline" for text lists. */
  variant?: "icon" | "inline";
  label?: string;
}

/**
 * "Wrong movie?" — one tap records that this episode/movie pairing looks wrong,
 * with an undo snackbar. Fixing it happens later in admin Match review.
 */
export function FlagMatchButton({ episodeId, movieId, variant = "icon", label }: Props) {
  const { flagged, hasUser } = useMyFlags();
  const toggle = useToggleFlag();
  const isFlagged = flagged.has(flagKey(episodeId, movieId));

  if (!hasUser) return null;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle.mutate({ episodeId, movieId, on: !isFlagged });
  };

  const title = isFlagged ? "Flagged as wrong — tap to undo" : "Wrong movie?";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={toggle.isPending}
        aria-pressed={isFlagged}
        title={title}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
          isFlagged ? "bg-coral-soft text-coral" : "text-muted-foreground hover:text-coral"
        }`}
      >
        <Flag className="size-[1.125rem]" aria-hidden />

        {label ?? (isFlagged ? "Flagged" : "Wrong movie?")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={isFlagged}
      aria-label={title}
      title={title}
      className={`rounded-full border p-1.5 transition-colors disabled:opacity-50 ${
        isFlagged
          ? "border-transparent bg-coral-soft text-coral"
          : "border-border text-muted-foreground hover:text-coral"
      }`}
    >
      <Flag className="size-3.5" aria-hidden />
    </button>
  );
}
