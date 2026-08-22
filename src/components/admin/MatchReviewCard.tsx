import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Ban, Check, Flag, Loader2, Search, Unlink, X } from "lucide-react";
import {
  approveEpisodeMatch,
  bulkMatchDecision,
  confirmEpisodeMatch,
  enrichMovie,
  listEpisodeLinks,
  listFlaggedLinks,
  markEpisodeNotAboutMovie,
  rejectEpisodeMatch,
  relinkEpisodeMovie,
  resolveEpisodeFlags,
  searchMoviesByTitle,
  suggestEpisodeMatches,
} from "@/lib/ingestion.functions";

type Tab = "flagged" | "proposed" | "existing";

const BANDS = [
  { label: "Weakest first (≤ 80%)", value: 0.8 },
  { label: "Unreviewed (≤ 95%)", value: 0.95 },
  { label: "All links", value: 1 },
] as const;

/** Plain-language names for the match_method values stored on each link. */
export function methodLabel(method: string): string {
  switch (method) {
    case "deterministic":
      return "Strong title match";
    case "heuristic":
      return "Weak title match";
    case "manual":
      return "Confirmed by you";
    case "ai":
      return "AI match";
    default:
      return "Legacy seed";
  }
}

const IMDB_RE = /^tt\d{6,10}$/i;

/**
 * One place for the whole review job: pairs a human flagged as wrong, proposals
 * the matcher computed, and links that already exist. Rows disappear the instant
 * you act on them; the queries catch up in the background.
 */
export function MatchReviewCard({ onSuccess }: { onSuccess: () => void }) {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("flagged");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [maxConfidence, setMaxConfidence] = useState<number>(0.8);
  // One knob instead of endless refresh cycles: review 50, 100 or 200 at a time.
  const [pageSize, setPageSize] = useState(50);

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const suggestFn = useServerFn(suggestEpisodeMatches);
  const linksFn = useServerFn(listEpisodeLinks);
  const flagsFn = useServerFn(listFlaggedLinks);
  const approveFn = useServerFn(approveEpisodeMatch);
  const rejectFn = useServerFn(rejectEpisodeMatch);
  const confirmFn = useServerFn(confirmEpisodeMatch);
  const relinkFn = useServerFn(relinkEpisodeMovie);
  const bulkFn = useServerFn(bulkMatchDecision);
  const retireFn = useServerFn(markEpisodeNotAboutMovie);
  const resolveFlagsFn = useServerFn(resolveEpisodeFlags);

  const flags = useQuery({
    queryKey: ["flagged-links"],
    queryFn: () => flagsFn({ data: { limit: 50 } }),
    enabled: tab === "flagged",
    retry: false,
    refetchOnWindowFocus: false,
  });

  const proposals = useQuery({
    queryKey: ["match-suggestions", submitted, Math.round(maxConfidence * 100), pageSize],
    queryFn: () =>
      suggestFn({
        data: {
          search: submitted || undefined,
          maxConfidence: Math.round(maxConfidence * 100),
          limit: pageSize,
        },
      }),

    enabled: tab === "proposed",
    retry: false,
    refetchOnWindowFocus: false,
  });

  const links = useQuery({
    queryKey: ["episode-links", submitted, maxConfidence, pageSize],
    queryFn: () =>
      linksFn({ data: { search: submitted || undefined, maxConfidence, limit: pageSize } }),
    enabled: tab === "existing",
    retry: false,
    refetchOnWindowFocus: false,
  });


  const term = submitted.toLowerCase();

  const rows = useMemo(() => {
    let out: {
      key: string;
      episodeId: string;
      movieId: string;
      episodeTitle: string;
      podcastName: string;
      movieTitle: string;
      movieYear: number | null;
      detail: string;
      rejectedBefore: number;
      flagged: boolean;
    }[];

    if (tab === "flagged") {
      out = (flags.data?.flags ?? [])
        .filter(
          (f) =>
            !term ||
            f.episodeTitle.toLowerCase().includes(term) ||
            f.podcastName.toLowerCase().includes(term) ||
            f.movieTitle.toLowerCase().includes(term),
        )
        .map((f) => ({
          key: `${f.episodeId}:${f.movieId}`,
          episodeId: f.episodeId,
          movieId: f.movieId,
          episodeTitle: f.episodeTitle,
          podcastName: f.podcastName,
          movieTitle: f.movieTitle,
          movieYear: f.movieYear,
          detail: `Flagged ${new Date(f.createdAt).toLocaleDateString()}`,
          rejectedBefore: 0,
          flagged: true,
        }));
    } else if (tab === "proposed") {
      out = (proposals.data?.suggestions ?? []).map((s) => ({
        key: s.episodeId,
        episodeId: s.episodeId,
        movieId: s.topCandidate!.movieId,
        episodeTitle: s.episodeTitle,
        podcastName: s.podcastName,
        movieTitle: s.topCandidate!.title,
        movieYear: s.topCandidate!.releaseYear,
        detail: `${s.topCandidate!.confidence}% — ${s.topCandidate!.reason}`,
        rejectedBefore: s.topCandidate!.rejectedBefore,
        flagged: false,
      }));
    } else {
      out = (links.data?.links ?? []).map((l) => ({
        key: `${l.episodeId}:${l.movieId}`,
        episodeId: l.episodeId,
        movieId: l.movieId,
        episodeTitle: l.episodeTitle,
        podcastName: l.podcastName,
        movieTitle: l.movieTitle,
        movieYear: l.movieYear,
        detail: `${methodLabel(l.method)} · ${Math.round(l.confidence * 100)}%`,
        rejectedBefore: 0,
        flagged: false,
      }));
    }

    return out.filter((r) => !done[r.key]);
  }, [tab, term, flags.data, proposals.data, links.data, done]);

  const rawTotal =
    tab === "flagged"
      ? (flags.data?.total ?? 0)
      : tab === "proposed"
        ? (proposals.data?.total ?? 0)
        : (links.data?.total ?? 0);
  // `done` keys can belong to an older query, so subtracting them blindly used
  // to print "Showing 41 of 0". The visible rows are always a lower bound.
  const total = Math.max(rows.length, rawTotal - Object.keys(done).length);

  const active = tab === "flagged" ? flags : tab === "proposed" ? proposals : links;
  const loading = active.isLoading;
  const busy = active.isFetching;
  const queryError = active.error;
  const noun = tab === "flagged" ? "flags" : tab === "proposed" ? "proposals" : "links";

  /** Background catch-up: the UI has already moved on. */
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["flagged-links"] });
    void client.invalidateQueries({ queryKey: ["match-suggestions"] });
    void client.invalidateQueries({ queryKey: ["episode-links"] });
    void client.invalidateQueries({ queryKey: ["unmatched-episodes"] });
    void client.invalidateQueries({ queryKey: ["match-actions"] });
    onSuccess();
  };

  const markDone = (keys: string[]) => {
    setDone((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      return next;
    });
    setSelected((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k.split(":")[0]!];
      return next;
    });
  };

  const single = useMutation({
    mutationFn: async (vars: {
      action: "approve" | "reject" | "confirm" | "unlink" | "retire";
      episodeId: string;
      movieId: string;
      wasFlagged: boolean;
    }) => {
      if (vars.action === "approve")
        await approveFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      else if (vars.action === "reject")
        await rejectFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      else if (vars.action === "confirm")
        await confirmFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      else if (vars.action === "retire") await retireFn({ data: { episodeId: vars.episodeId } });
      else await relinkFn({ data: { episodeId: vars.episodeId, fromMovieId: vars.movieId } });

      if (vars.wasFlagged) {
        await resolveFlagsFn({
          data: {
            episodeId: vars.episodeId,
            movieId: vars.movieId,
            resolution: vars.action === "confirm" ? "dismissed" : "fixed",
          },
        });
      }
    },
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const act = (
    action: "approve" | "reject" | "confirm" | "unlink" | "retire",
    row: { key: string; episodeId: string; movieId: string; flagged: boolean },
  ) => {
    markDone([row.key]);
    single.mutate({ action, episodeId: row.episodeId, movieId: row.movieId, wasFlagged: row.flagged });
  };

  /**
   * Pairs travel as mutation variables, never read from state inside the
   * handler: clearing the selection optimistically would otherwise leave the
   * request with an empty array (server rejects it as "too_small").
   */
  const bulk = useMutation({
    mutationFn: async (vars: {
      action: "approve" | "reject" | "confirm" | "unlink" | "retire";
      pairs: { episodeId: string; movieId: string }[];
      flagged: { episodeId: string; movieId: string }[];
    }) => {

      const result = await bulkFn({ data: { action: vars.action, pairs: vars.pairs } });
      for (const pair of vars.flagged) {
        await resolveFlagsFn({
          data: {
            episodeId: pair.episodeId,
            movieId: pair.movieId,
            resolution: vars.action === "confirm" ? "dismissed" : "fixed",
          },
        });
      }
      return result;
    },
    onSuccess: (result) => {
      setError(null);
      setNote(
        `${result.succeeded} of ${result.attempted} applied${result.failed.length ? ` · ${result.failed.length} failed` : ""}.`,
      );
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const selectedCount = Object.keys(selected).length;
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected[r.episodeId] === r.movieId);

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, string> = {};
    for (const r of rows) next[r.episodeId] = r.movieId;
    setSelected(next);
  };

  const toggleRow = (episodeId: string, movieId: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[episodeId] === movieId) delete next[episodeId];
      else next[episodeId] = movieId;
      return next;
    });

  const runBulk = (action: "approve" | "reject" | "confirm" | "unlink" | "retire") => {
    const confirmText =
      action === "reject"
        ? `Reject ${selectedCount} selected match(es)?`
        : action === "unlink"
          ? `Unlink ${selectedCount} selected match(es)?`
          : action === "retire"
            ? `Mark ${selectedCount} selected episode(s) as not about a movie? Their links are removed.`
            : null;
    if (confirmText && !window.confirm(confirmText)) return;

    const chosen = rows.filter((r) => selected[r.episodeId] === r.movieId);
    if (chosen.length === 0) return;
    const pairs = chosen.map((r) => ({ episodeId: r.episodeId, movieId: r.movieId }));
    const flagged = chosen
      .filter((r) => r.flagged)
      .map((r) => ({ episodeId: r.episodeId, movieId: r.movieId }));
    markDone(chosen.map((r) => r.key));
    bulk.mutate({ action, pairs, flagged });
  };

  return (
    <section id="match-review" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Match review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>Flagged</strong> are pairings someone marked wrong while browsing the app — fix these
        first. <strong>Proposed</strong> are links the matcher suggests but has not written.{" "}
        <strong>Existing links</strong> are already saved. Rejected pairs are never suggested again.
      </p>

      <div className="mt-4 inline-flex flex-wrap rounded-full border border-border p-1">
        {(
          [
            ["flagged", "Flagged"],
            ["proposed", "Proposed"],
            ["existing", "Existing links"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setSelected({});
              setNote(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
            {value === "flagged" && (flags.data?.total ?? 0) > 0 ? ` (${flags.data?.total})` : ""}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(search.trim());
          setSelected({});
          setDone({});
        }}
      >
        <label className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Episode, show or movie title"
            aria-label="Search matches"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
        {tab !== "flagged" ? (
          <select
            value={maxConfidence}
            onChange={(e) => setMaxConfidence(Number(e.target.value))}
            aria-label="Confidence band"
            className="rounded-full border border-border bg-background px-3 py-2 text-sm"
          >
            {BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground neon disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {busy ? "Searching…" : "Search"}
        </button>
        {busy ? (
          <span role="status" className="text-xs text-muted-foreground">
            Working…
          </span>
        ) : null}
      </form>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {note ? <p className="mt-3 text-sm text-teal">{note}</p> : null}

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" />
      ) : queryError ? (
        <p className="mt-4 text-sm text-destructive">{(queryError as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {tab === "flagged"
            ? "Nothing flagged as wrong. Flags raised in the app land here."
            : tab === "proposed"
              ? "No proposals in this band."
              : "No saved links match that filter."}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Showing {rows.length} of {total} {noun}
              {busy ? (
                <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-teal">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  Updating results…
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={busy}
                className="rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={toggleAll}
                className="rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                {allVisibleSelected ? "Clear selection" : "Select all shown"}
              </button>
            </div>
          </div>

          {selectedCount > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
              <span className="text-xs font-semibold">{selectedCount} selected</span>
              {tab === "proposed" ? (
                <>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("approve")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="size-3.5" aria-hidden />
                    Approve selected
                  </button>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("reject")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <X className="size-3.5" aria-hidden />
                    Reject selected
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("confirm")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="size-3.5" aria-hidden />
                    Confirm selected
                  </button>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("unlink")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <Unlink className="size-3.5" aria-hidden />
                    Unlink selected
                  </button>
                </>
              )}
              {/* Retiring an episode is the fastest way to clear ad reads and
                  interview episodes out of every queue at once. */}
              <button
                type="button"
                disabled={bulk.isPending}
                onClick={() => runBulk("retire")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <Ban className="size-3.5" aria-hidden />
                Not about a movie
              </button>

              {bulk.isPending ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Applying…
                </span>
              ) : null}
            </div>
          ) : null}

          <ul className="mt-3 space-y-2">
            {rows.map((row) => {
              const isSelected = selected[row.episodeId] === row.movieId;
              return (
                <li
                  key={row.key}
                  className={`rounded-xl border bg-background ${
                    isSelected ? "border-primary" : "border-border"
                  }`}
                >
                  {/* Header is the selection target (comfortable on a phone), but text
                      stays selectable: a click that ends a text selection is ignored. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const text = typeof window !== "undefined" ? window.getSelection()?.toString() ?? "" : "";
                      if (text.trim().length > 0) return;
                      toggleRow(row.episodeId, row.movieId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleRow(row.episodeId, row.movieId);
                      }
                    }}
                    aria-pressed={isSelected}
                    className="flex w-full cursor-pointer select-text items-start gap-3 p-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {isSelected ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug">{row.episodeTitle}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{row.podcastName}</span>
                      <span className="mt-2 block text-xs">
                        {tab === "proposed" ? "Suggested: " : "Linked to "}
                        <span className="font-semibold text-foreground">
                          {row.movieTitle}
                          {row.movieYear ? ` (${row.movieYear})` : ""}
                        </span>{" "}
                        · {row.detail}
                      </span>
                      {row.flagged ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-coral">
                          <Flag className="size-3" aria-hidden />
                          Flagged as wrong in the app
                        </span>
                      ) : null}
                      {row.rejectedBefore >= 2 ? (
                        <span className="mt-1 block text-xs text-coral">
                          This movie has been rejected {row.rejectedBefore}× elsewhere.
                        </span>
                      ) : null}
                    </span>
                  </div>


                  <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                    {tab === "proposed" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => act("approve", row)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <Check className="size-3.5" aria-hidden />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => act("reject", row)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold"
                        >
                          <X className="size-3.5" aria-hidden />
                          Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => act("confirm", row)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <Check className="size-3.5" aria-hidden />
                          {row.flagged ? "Actually correct" : "Correct"}
                        </button>
                        <button
                          type="button"
                          onClick={() => act("unlink", row)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold"
                        >
                          <Unlink className="size-3.5" aria-hidden />
                          Unlink
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => act("retire", row)}
                      title="Stop suggesting matches for this episode"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold"
                    >
                      <Ban className="size-3.5" aria-hidden />
                      Not about a movie
                    </button>
                    <RelinkPicker
                      onPick={async (movieId) => {
                        markDone([row.key]);
                        try {
                          if (tab === "proposed") {
                            await approveFn({ data: { episodeId: row.episodeId, movieId } });
                          } else {
                            await relinkFn({
                              data: { episodeId: row.episodeId, fromMovieId: row.movieId, toMovieId: movieId },
                            });
                          }
                          if (row.flagged) {
                            await resolveFlagsFn({
                              data: { episodeId: row.episodeId, movieId: row.movieId, resolution: "fixed" },
                            });
                          }
                          setError(null);
                          refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not relink.");
                        }
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Catalogue search that also accepts an IMDb id, pulling the movie in via TMDB. */
export function RelinkPicker({
  onPick,
  disabled,
}: {
  onPick: (movieId: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const searchFn = useServerFn(searchMoviesByTitle);
  const enrichFn = useServerFn(enrichMovie);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [imdbBusy, setImdbBusy] = useState(false);
  const [imdbError, setImdbError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["movie-search", submitted],
    queryFn: () => searchFn({ data: { term: submitted } }),
    enabled: submitted.length > 1 && !IMDB_RE.test(submitted),
    retry: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    setImdbError(null);
    if (!IMDB_RE.test(value)) {
      setSubmitted(value);
      return;
    }
    setImdbBusy(true);
    try {
      const created = (await enrichFn({ data: { imdbId: value } })) as {
        movie?: { id: string };
        movieId?: string;
      };
      const id = created.movie?.id ?? created.movieId;
      if (!id) throw new Error("TMDB had no movie for that IMDb id.");
      await onPick(id);
      setOpen(false);
    } catch (err) {
      setImdbError(err instanceof Error ? err.message : "IMDb lookup failed.");
    } finally {
      setImdbBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
      >
        Pick another movie
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card p-2">
      <form className="flex gap-2" onSubmit={submit}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Movie title or IMDb id (tt0110989)"
          aria-label="Search movies or paste an IMDb id"
          className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={imdbBusy}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {imdbBusy ? "Fetching…" : "Find"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </form>

      {imdbError ? <p className="mt-2 text-xs text-destructive">{imdbError}</p> : null}
      {results.isLoading && submitted ? (
        <p className="mt-2 text-xs text-muted-foreground">Searching…</p>
      ) : null}
      {results.data ? (
        results.data.movies.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No catalogue movie matches. Paste its IMDb id (tt…) to pull it in from TMDB.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {results.data.movies.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    void onPick(m.id);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-secondary"
                >
                  {m.title}
                  {m.release_year ? ` (${m.release_year})` : ""}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
