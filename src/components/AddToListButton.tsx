import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, BookmarkCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { prefsActions, usePrefs } from "@/lib/prefs";
import { accentFor } from "@/lib/accents";

const PANEL_WIDTH = 240;
const PANEL_MAX_HEIGHT = 320;
/** Clearance for the fixed mobile bottom nav. */
const BOTTOM_NAV = 88;

/**
 * Pass O — portalled, edge-aware popover so it can never sit under or across a
 * neighbouring card, plus optimistic toggles with an undo snackbar.
 */
export function AddToListButton({
  movieSlug,
  movieTitle,
  variant = "icon",
}: {
  movieSlug: string;
  movieTitle?: string;
  variant?: "icon" | "button";
}) {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const saved = prefs.lists.filter((l) => l.movieSlugs.includes(movieSlug));

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(
      Math.max(8, rect.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - 8,
    );
    const spaceBelow = window.innerHeight - rect.bottom - BOTTOM_NAV;
    // Flip upward when there is not enough room beneath the trigger.
    const top =
      spaceBelow < 200 && rect.top > 220
        ? Math.max(8, rect.top - Math.min(PANEL_MAX_HEIGHT, rect.top - 16) - 8)
        : rect.bottom + 8;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const toggle = (listId: string, listName: string, on: boolean) => {
    prefsActions.toggleListMovie(listId, movieSlug, on);
    toast(
      movieTitle
        ? on
          ? `Added to ${listName}: ${movieTitle}`
          : `Removed from ${listName}: ${movieTitle}`
        : on
          ? `Added to ${listName}`
          : `Removed from ${listName}`,
      {
      action: {
        label: "Undo",
        onClick: () => prefsActions.toggleListMovie(listId, movieSlug, !on),
      },
      },
    );
  };

  const Icon = saved.length > 0 ? BookmarkCheck : Bookmark;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={saved.length > 0 ? `In ${saved.length} list(s)` : "Add to a list"}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          variant === "button"
            ? "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-card"
            : "inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-colors hover:text-foreground"
        }
      >
        <Icon className={saved.length > 0 ? "size-4 text-coral" : "size-4"} aria-hidden />
        {variant === "button" ? (saved.length > 0 ? "In your lists" : "Add to list") : null}
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panel}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: PANEL_WIDTH,
                maxHeight: PANEL_MAX_HEIGHT,
              }}
              className="z-[60] overflow-auto rounded-2xl border border-border bg-popover p-3 text-left shadow-poster"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your lists
              </p>
              <ul className="space-y-1">
                {prefs.lists.length === 0 ? (
                  <li className="px-1 py-2 text-sm text-muted-foreground">No lists yet.</li>
                ) : null}
                {prefs.lists.map((list) => {
                  const on = list.movieSlugs.includes(movieSlug);
                  return (
                    <li key={list.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm hover:bg-secondary">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(event) => toggle(list.id, list.name, event.target.checked)}
                          className="size-4 accent-coral"
                        />
                        <span className="truncate">{list.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <form
                className="mt-2 flex items-center gap-1.5 border-t border-border pt-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newName.trim();
                  if (!name) return;
                  const id = prefsActions.createList(name, accentFor(name));
                  prefsActions.toggleListMovie(id, movieSlug, true);
                  setNewName("");
                  toast(movieTitle ? `Created ${name} and added: ${movieTitle}` : `Created ${name}`, {
                    action: { label: "Undo", onClick: () => prefsActions.deleteList(id) },
                  });
                }}
              >
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="New list"
                  aria-label="New list name"
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-base sm:text-sm"
                />
                <button
                  type="submit"
                  aria-label="Create list and add movie"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
