import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Plus } from "lucide-react";
import { prefsActions, usePrefs } from "@/lib/prefs";
import { accentFor } from "@/lib/accents";

/** Small popover that adds/removes one movie from any local list. */
export function AddToListButton({
  movieSlug,
  variant = "icon",
}: {
  movieSlug: string;
  variant?: "icon" | "button";
}) {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);

  const saved = prefs.lists.filter((l) => l.movieSlugs.includes(movieSlug));

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const Icon = saved.length > 0 ? BookmarkCheck : Bookmark;

  return (
    <div ref={wrapper} className="relative">
      <button
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

      {open ? (
        <div
          className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-border bg-card p-3 text-left shadow-lg"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your lists
          </p>
          <ul className="max-h-52 space-y-1 overflow-auto">
            {prefs.lists.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">No lists yet.</li>
            ) : null}
            {prefs.lists.map((list) => {
              const on = list.movieSlugs.includes(movieSlug);
              return (
                <li key={list.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(event) =>
                        prefsActions.toggleListMovie(list.id, movieSlug, event.target.checked)
                      }
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
            }}
          >
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New list"
              aria-label="New list name"
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              aria-label="Create list and add movie"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
