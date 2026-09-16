import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, CalendarCheck, ExternalLink, Headphones, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PartialDataNotice } from "@/components/PartialDataNotice";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { accentFor, accentSoft, toAccent } from "@/lib/accents";
import {
  formatEpisodeDate,
  formatWatchedOn,
  LISTENING_LABEL,
  RATING_LABEL,
  useListenLater,
  useListened,
  useLists,
} from "@/lib/lists";
import { useEpisodeDetails, EMPTY_EPISODE_DETAIL } from "@/lib/details";
import { prefsActions, usePrefs } from "@/lib/prefs";


export const Route = createFileRoute("/lists/")({
  head: () => ({
    meta: [
      { title: "Your lists & watch history — Movie Afterparty" },
      {
        name: "description",
        content:
          "Keep watchlists for date night, good-bad movies and spooky season, and look back at everything you have already watched.",
      },
      { property: "og:title", content: "Your lists & watch history — Movie Afterparty" },
      {
        property: "og:description",
        content: "Watchlists and viewing history for your movie-plus-commentary nights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListsPage,
});

type Tab = "lists" | "later" | "history" | "listened";

function ListsPage() {
  const { lists, history, isLoading, partial } = useLists();
  const { listened } = useListened();
  const { episodes: listenLater } = useListenLater();
  const { details } = useEpisodeDetails(listenLater.map((e) => e.episode.id));
  const prefs = usePrefs();
  const [tab, setTab] = useState<Tab>("lists");
  const [name, setName] = useState("");

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <PageHeader icon={Bookmark} eyebrow="Lists" title="Watchlists & History" />
        <PartialDataNotice show={partial} />

        <div className="mt-5 flex gap-1.5">
          {(
            [
              { value: "lists", label: `Lists (${lists.length})` },
              { value: "later", label: `Listen Later (${listenLater.length})` },
              { value: "history", label: `Watched (${history.length})` },
              { value: "listened", label: `Listened (${listened.length})` },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTab(option.value)}
              aria-pressed={tab === option.value}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === option.value
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
        ) : tab === "lists" ? (
          <>
            <form
              className="mt-5 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = name.trim();
                if (!trimmed) return;
                prefsActions.createList(trimmed, accentFor(trimmed));
                setName("");
              }}
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="New list name"
                aria-label="New list name"
                className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm shadow-card"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
              >
                <Plus className="size-4" aria-hidden />
                Create
              </button>
            </form>

            <ul className="mt-6 space-y-4">
              {lists.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No lists yet — create one above, then add movies from any card.
                </li>
              ) : null}
              {lists.map(({ list, entries, watchableCount }) => {
                const accent = toAccent(list.accent);
                return (
                  <li key={list.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-xl">{list.name}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entries.length} movie{entries.length === 1 ? "" : "s"} ·{" "}
                          {watchableCount} on your services
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${list.name}`}
                        onClick={() => prefsActions.deleteList(list.id)}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-coral"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>

                    {entries.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Nothing here yet. Use the bookmark button on any movie.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {entries.map((entry) => (
                          <MovieCard
                            key={entry.movie.id}
                            entry={entry}
                            variant="compact"
                          />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : tab === "later" ? (
          <ul className="mt-6 space-y-2.5">
            {listenLater.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing saved yet. Tap the bookmark on any episode card to keep it for later.
              </li>
            ) : null}
            {listenLater.map((item) => (
              <EpisodeCard
                key={item.episode.id}
                episode={item.episode}
                podcast={item.podcast}
                preferred={prefs.preferredPodcastSlugs.includes(item.podcast.slug)}
                variant="compact"
                detail={details[item.episode.id] ?? EMPTY_EPISODE_DETAIL}
                movieTitles={item.movieTitles}
              />
            ))}
          </ul>
        ) : tab === "history" ? (
          <ul className="mt-6 space-y-2.5">
            {history.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing watched yet. Mark a movie watched on its page and it shows up here.
              </li>
            ) : null}
            {history.map(({ entry, watchedOn }) => (
              <MovieCard
                key={entry.movie.id}
                entry={entry}
                variant="compact"
                consumedDate={watchedOn}
              />
            ))}
          </ul>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {listened.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing here yet. Rate an episode or mark it started/finished on a movie page and
                it shows up here.
              </li>
            ) : null}
            {listened.map((item) => (
              <EpisodeCard
                key={item.episode.id}
                episode={item.episode}
                podcast={item.podcast}
                preferred={prefs.preferredPodcastSlugs.includes(item.podcast.slug)}
                variant="compact"
                movieTitles={item.movieTitles}
              />
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
