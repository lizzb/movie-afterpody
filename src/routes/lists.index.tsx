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
                        {entries.map(({ movie, score, episodes, services, watched }) => (
                          <li key={movie.id}>
                            <Link
                              to="/movies/$slug"
                              params={{ slug: movie.slug }}
                              className={`flex items-center gap-3 rounded-xl border border-border/70 p-2.5 transition-colors hover:bg-secondary ${prefs.dimWatched && watched ? "opacity-45 saturate-50" : ""}`}
                            >
                              <Artwork
                                src={movie.poster_url}
                                title={movie.title}
                                seed={movie.slug}
                                accent={movie.accent}
                                className="w-10 text-sm"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                  {movie.title}
                                  {watched ? " · watched" : ""}
                                </span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>
                                    {episodes.length} episode{episodes.length === 1 ? "" : "s"}
                                  </span>
                                  {services.length > 0 ? (
                                    services.map((s) => (
                                      <BrandBadge
                                        key={s.id}
                                        slug={s.slug}
                                        label={s.short_name}
                                        active
                                        showLabel={false}
                                      />
                                    ))
                                  ) : (
                                    <span>Not on your services</span>
                                  )}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${accentSoft(accent)}`}
                              >
                                {score.score}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : tab === "later" ? (
          <ul className="mt-6 space-y-2">
            {listenLater.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing saved yet. Tap the bookmark on any episode card to keep it for later.
              </li>
            ) : null}
            {listenLater.map((item) => {
              const detail = details[item.episode.id] ?? EMPTY_EPISODE_DETAIL;
              const listenUrl = detail.listenUrl ?? item.podcast.website_url ?? null;
              const duration = item.episode.duration_seconds
                ? `${Math.round(item.episode.duration_seconds / 60)} min`
                : null;
              return (
                <li
                  key={item.episode.id}
                  className="rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <Link to="/podcasts/$slug" params={{ slug: item.podcast.slug }} className="shrink-0">
                      <Artwork
                        src={item.podcast.artwork_url}
                        title={item.podcast.name}
                        seed={item.podcast.slug}
                        accent={item.podcast.accent}
                        shape="circle"
                        className="w-12 text-base"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="break-anywhere text-sm font-semibold leading-snug">
                        {item.episode.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.podcast.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {[formatEpisodeDate(item.episode.released_at), duration]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {item.movieTitles.length > 0 ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.movieTitles.join(", ")}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {listenUrl ? (
                          <a
                            href={listenUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground"
                          >
                            Listen
                            <ExternalLink className="size-3" aria-hidden />
                          </a>
                        ) : null}
                        {item.status !== "not_started" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 font-semibold text-muted-foreground">
                            <Headphones className="size-3" aria-hidden />
                            {LISTENING_LABEL[item.status]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.episode.title} from Listen Later`}
                      onClick={() => prefsActions.toggleListenLater(item.episode.slug, false)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-coral"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : tab === "history" ? (
          <ul className="mt-6 space-y-2">
            {history.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing watched yet. Mark a movie watched on its page and it shows up here.
              </li>
            ) : null}
            {history.map(({ entry, watchedOn }) => (
              <li key={entry.movie.id} className="rounded-2xl border border-border bg-card shadow-card">
                <Link
                  to="/movies/$slug"
                  params={{ slug: entry.movie.slug }}
                  className="flex items-center gap-3 p-3"
                >
                  <Artwork
                    src={entry.movie.poster_url}
                    title={entry.movie.title}
                    seed={entry.movie.slug}
                    accent={entry.movie.accent}
                    className="w-12 text-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg">
                      {entry.movie.title}
                      {entry.movie.release_year ? (
                        <span className="text-muted-foreground"> ({entry.movie.release_year})</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarCheck className="size-3.5" aria-hidden />
                      {formatWatchedOn(watchedOn)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {entry.episodes.length} ep
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-6 space-y-2">
            {listened.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nothing here yet. Rate an episode or mark it started/finished on a movie page and
                it shows up here.
              </li>
            ) : null}
            {listened.map((item) => (
              <li
                key={item.episode.id}
                className="rounded-2xl border border-border bg-card shadow-card"
              >
                <Link
                  to="/podcasts/$slug"
                  params={{ slug: item.podcast.slug }}
                  className="flex items-start gap-3 p-3"
                >
                  <Artwork
                    src={item.podcast.artwork_url}
                    title={item.podcast.name}
                    seed={item.podcast.slug}
                    accent={item.podcast.accent}
                    className="w-12 text-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-anywhere text-sm font-semibold leading-snug">
                      {item.episode.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.podcast.name} · {formatEpisodeDate(item.episode.released_at)}
                    </span>
                    {item.movieTitles.length > 0 ? (
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {item.movieTitles.join(", ")}
                      </span>
                    ) : null}
                    <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-semibold text-muted-foreground">
                        <Headphones className="size-3" aria-hidden />
                        {LISTENING_LABEL[item.status]}
                      </span>
                      {item.rating ? (
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${accentSoft(toAccent(item.podcast.accent))}`}
                        >
                          {RATING_LABEL[item.rating]}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
