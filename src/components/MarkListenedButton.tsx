import { Headphones } from "lucide-react";
import { prefsActions } from "@/lib/prefs";
import type { ListeningStatus } from "@/lib/types";

/**
 * One-tap "I've listened to this" control in an episode card's upper right.
 * Finer-grained states still live in the card's rating footer.
 */
export function MarkListenedButton({
  episodeSlug,
  listening,
}: {
  episodeSlug: string;
  listening: ListeningStatus;
}) {
  const finished = listening === "finished";
  const started = listening === "started";
  const title = finished
    ? "Listened — tap to clear"
    : started
      ? "Started — tap to mark listened"
      : "Mark as listened";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.setListening(episodeSlug, finished ? "not_started" : "finished");
      }}
      aria-pressed={finished}
      aria-label={title}
      title={title}
      className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors ${
        finished
          ? "border-transparent bg-teal text-primary-foreground"
          : started
            ? "border-teal text-teal"
            : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Headphones className="size-4" aria-hidden />
    </button>
  );
}
