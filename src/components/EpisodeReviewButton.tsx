import { CheckCheck, Loader2, RotateCcw } from "lucide-react";
import { useSetEpisodeReviewed } from "@/lib/episode-reviews";

interface Props {
  episodeId: string;
  reviewed: boolean;
  /** "inline" for compact rows, "block" for detail cards. */
  variant?: "inline" | "block";
}

/**
 * Admin-only "Mark episode reviewed" control for episode rows. Render only when
 * the viewer is an admin (see `useEpisodeReviewStates().isAdmin`).
 */
export function EpisodeReviewButton({ episodeId, reviewed, variant = "inline" }: Props) {
  const mutation = useSetEpisodeReviewed();
  const pending = mutation.isPending;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    mutation.mutate({ episodeId, reviewed: !reviewed });
  };

  const title = reviewed
    ? "Reopen this episode — it returns to the unreviewed queue"
    : "Mark this episode reviewed — its links look right and none are missing";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={reviewed}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        reviewed
          ? "bg-teal text-primary-foreground"
          : "border border-border text-muted-foreground hover:text-foreground"
      } ${variant === "block" ? "px-3.5 py-2 text-xs" : ""}`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : reviewed ? (
        <RotateCcw className="size-4" aria-hidden />
      ) : (
        <CheckCheck className="size-4" aria-hidden />
      )}
      {reviewed ? "Reopen" : "Mark episode reviewed"}
    </button>
  );
}
