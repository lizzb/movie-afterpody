import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { prefsActions } from "@/lib/prefs";

/**
 * Pass U44 — saves an episode to the implicit "Listen Later" listenlist.
 * Separate from listening state (not started / started / finished), which the
 * card footer still owns.
 */
export function ListenLaterButton({
  episodeSlug,
  episodeTitle,
  saved,
}: {
  episodeSlug: string;
  episodeTitle: string;
  saved: boolean;
}) {
  const title = saved ? "Saved to Listen Later — tap to remove" : "Save to Listen Later";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.toggleListenLater(episodeSlug, !saved);
        toast(saved ? `Removed from Listen Later: ${episodeTitle}` : `Listen Later: ${episodeTitle}`, {
          action: {
            label: "Undo",
            onClick: () => prefsActions.toggleListenLater(episodeSlug, saved),
          },
        });
      }}
      aria-pressed={saved}
      aria-label={title}
      title={title}
      className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors ${
        saved
          ? "border-transparent bg-teal text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} aria-hidden />
    </button>
  );
}
