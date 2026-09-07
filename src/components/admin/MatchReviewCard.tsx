import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminQueue } from "@/components/admin/AdminActionQueue";

const MATCH_ACTION_LABEL: Record<"approve" | "reject" | "confirm" | "unlink" | "retire", string> = {
  approve: "Approve match",
  reject: "Reject match",
  confirm: "Confirm match",
  unlink: "Unlink match",
  retire: "Not about a movie",
};
import { useServerFn } from "@tanstack/react-start";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flag,
  Loader2,
  RotateCcw,
  Search,
  Unlink,
  X,
} from "lucide-react";
import {
  approveEpisodeMatch,
  bulkMatchDecision,
  confirmEpisodeMatch,
  enrichMovie,
  getEpisodeDescription,
  listEpisodeLinks,
  listEpisodeReviewStates,
  listFlaggedLinks,
  markEpisodeNotAboutMovie,
  rejectEpisodeMatch,
  relinkEpisodeMovie,
  resolveEpisodeFlags,
  searchMoviesByTitle,
  setEpisodeReviewed,
  suggestEpisodeMatches,
} from "@/lib/ingestion.functions";


type Tab = "flagged" | "proposed" | "existing";

type RowAction = "approve" | "reject" | "confirm" | "unlink" | "retire";

/**
 * Row action styling. Inactive = coloured text on a quiet grey fill; hover or
 * "this is the action I just pressed" = white text on the colour, so intent is
 * never ambiguous while a row is saving.
 */
const ACTION_TONES = {
  positive: {
    idle: "bg-muted text-teal hover:bg-teal hover:text-primary-foreground",
    active: "bg-teal text-primary-foreground",
  },
  negative: {
    idle: "bg-muted text-destructive hover:bg-destructive hover:text-destructive-foreground",
    active: "bg-destructive text-destructive-foreground",
  },
  retire: {
    idle: "bg-muted text-gold hover:bg-gold hover:text-accent-foreground",
    active: "bg-gold text-accent-foreground",
  },
} as const;

function actionClass(tone: keyof typeof ACTION_TONES, active: boolean) {
  const t = ACTION_TONES[tone];
  return `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
    active ? t.active : t.idle
  }`;
}

/**
 * Pass U33 — bulk buttons read as the same control family as the row actions:
 * coloured text on grey when idle, and only the button that was actually pressed
 * fills with its colour (carrying the spinner) until the operation resolves.
 * Unpressed siblings stay text-on-grey and simply go quiet while disabled.
 */
function bulkClass(
  tone: keyof typeof ACTION_TONES | "neutral",
  active: boolean,
  disabled: boolean,
) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors";
  if (tone === "neutral") {
    return `${base} border border-border ${disabled ? "text-muted-foreground opacity-60" : "hover:bg-secondary"}`;
  }
  const t = ACTION_TONES[tone];
  if (active) return `${base} ${t.active}`;
  if (disabled) return `${base} bg-muted text-muted-foreground opacity-60`;
  return `${base} ${t.idle}`;
}


const BANDS = [
  { label: "Weakest first (≤ 80%)", value: 0.8 },
  { label: "Stronger too (≤ 95%)", value: 0.95 },
  { label: "All unconfirmed links", value: 1 },
] as const;

/** Plain-language names for the explicit review state stored on each link. */
export function reviewStateLabel(state: string): string {
  switch (state) {
    case "confirmed":
      return "Confirmed";
    case "auto_linked":
      return "Auto-linked";
    default:
      return "Proposed";
  }
}

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

type ReviewStateFilter = "unconfirmed" | "proposed" | "auto_linked" | "confirmed" | "all";

const REVIEW_STATES: { value: ReviewStateFilter; label: string }[] = [
  { value: "unconfirmed", label: "Unconfirmed" },
  { value: "proposed", label: "Proposed only" },
  { value: "auto_linked", label: "Auto-linked only" },
  { value: "confirmed", label: "Confirmed only" },
  { value: "all", label: "All states" },
];

/**
 * Pass U13 — the review surface remembers where you were. Tab, search term,
 * confidence band, review state and batch size survive a reload instead of
 * snapping back to Flagged / ≤ 80% / 50 every time the page re-renders.
 * Restored in an effect (never in a state initialiser) so SSR and hydration
 * agree on the first paint.
 */
const VIEW_STORE_KEY = "ma.matchReview.view.v1";

type PersistedView = {
  tab: Tab;
  search: string;
  maxConfidence: number;
  reviewState: ReviewStateFilter;
  pageSize: number;
};

function readPersistedView(): Partial<PersistedView> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VIEW_STORE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedView>) : null;
  } catch {
    return null;
  }
}

function writePersistedView(view: PersistedView) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_STORE_KEY, JSON.stringify(view));
  } catch {
    /* private mode / quota — the view just won't persist. */
  }
}




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
  const [maxConfidence, setMaxConfidence] = useState<number>(1);
  // Confirmed work is inspectable, not invisible: this filter drives the
  // Existing links tab's review-state scope.
  const [reviewState, setReviewState] = useState<ReviewStateFilter>("unconfirmed");
  // One knob instead of endless refresh cycles: review 50, 100 or 200 at a time.
  const [pageSize, setPageSize] = useState(50);
  // Pass U10: each tab keeps its own page cursor so a decided page can advance
  // to the next batch instead of pretending the queue is empty.
  const [offsets, setOffsets] = useState<Record<Tab, number>>({
    flagged: 0,
    proposed: 0,
    existing: 0,
  });
  const offset = offsets[tab];
  const setOffsetFor = (t: Tab, value: number) =>
    setOffsets((prev) => (prev[t] === value ? prev : { ...prev, [t]: value }));
  const resetOffsets = () => setOffsets({ flagged: 0, proposed: 0, existing: 0 });


  const [selected, setSelected] = useState<Record<string, true>>({});
  const [done, setDone] = useState<Record<string, true>>({});
  // Pass U11 — per-row pending. A row that has been acted on stays visible and
  // dimmed while its request is in flight, instead of vanishing into a global
  // spinner, and its own buttons are the only ones disabled.
  const [pending, setPending] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Pass U11 — busy state is scoped to fetches the user asked for (search
  // submit, filter change, explicit Refresh, page advance). Background
  // refetches and unrelated invalidations no longer spin the UI.
  const [intent, setIntent] = useState<null | "search" | "page">(null);

  // Pass U13 — restore the saved view once, after hydration, then keep it in
  // sync. `restored` stops the writer from overwriting the saved view with
  // defaults before the read has happened.
  const restored = useRef(false);
  useEffect(() => {
    const saved = readPersistedView();
    restored.current = true;
    if (!saved) return;
    if (saved.tab === "flagged" || saved.tab === "proposed" || saved.tab === "existing")
      setTab(saved.tab);
    if (typeof saved.search === "string") {
      setSearch(saved.search);
      setSubmitted(saved.search);
    }
    if (BANDS.some((b) => b.value === saved.maxConfidence)) setMaxConfidence(saved.maxConfidence!);
    if (REVIEW_STATES.some((s) => s.value === saved.reviewState))
      setReviewState(saved.reviewState!);
    if (saved.pageSize === 50 || saved.pageSize === 100 || saved.pageSize === 200)
      setPageSize(saved.pageSize);
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    writePersistedView({ tab, search: submitted, maxConfidence, reviewState, pageSize });
  }, [tab, submitted, maxConfidence, reviewState, pageSize]);



  const suggestFn = useServerFn(suggestEpisodeMatches);
  const linksFn = useServerFn(listEpisodeLinks);
  const flagsFn = useServerFn(listFlaggedLinks);
  const approveFn = useServerFn(approveEpisodeMatch);
  const rejectFn = useServerFn(rejectEpisodeMatch);
  const confirmFn = useServerFn(confirmEpisodeMatch);
  const relinkFn = useServerFn(relinkEpisodeMovie);
  const bulkFn = useServerFn(bulkMatchDecision);
  // Pass U14 — review decisions share the page-wide FIFO queue, so rapid taps
  // execute in press order instead of racing each other.
  const queue = useAdminQueue();
  const retireFn = useServerFn(markEpisodeNotAboutMovie);
  const resolveFlagsFn = useServerFn(resolveEpisodeFlags);

  // All three run so every tab can show its queue size, and previous data is
  // kept while a new search loads so the badges never flicker to zero.
  const flags = useQuery({
    queryKey: ["flagged-links", submitted, pageSize, offsets.flagged],
    queryFn: () =>
      flagsFn({
        data: { search: submitted || undefined, limit: pageSize, offset: offsets.flagged },
      }),
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const proposals = useQuery({
    queryKey: [
      "match-suggestions",
      submitted,
      Math.round(maxConfidence * 100),
      pageSize,
      offsets.proposed,
    ],
    queryFn: () =>
      suggestFn({
        data: {
          search: submitted || undefined,
          maxConfidence: Math.round(maxConfidence * 100),
          limit: pageSize,
          offset: offsets.proposed,
        },
      }),
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const links = useQuery({
    queryKey: ["episode-links", submitted, maxConfidence, pageSize, reviewState, offsets.existing],
    queryFn: () =>
      linksFn({
        data: {
          search: submitted || undefined,
          maxConfidence,
          limit: pageSize,
          reviewState,
          offset: offsets.existing,
        },
      }),
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });




  const rows = useMemo(() => {
    let out: {
      key: string;
      episodeId: string;
      movieId: string;
      episodeTitle: string;
      podcastName: string;
      releasedAt: string | null;
      durationSeconds: number | null;
      movieTitle: string;
      movieYear: number | null;
      detail: string;
      rejectedBefore: number;
      flagged: boolean;
    }[];

    if (tab === "flagged") {
      out = (flags.data?.flags ?? []).map((f) => ({
          key: `${f.episodeId}:${f.movieId}`,
          episodeId: f.episodeId,
          movieId: f.movieId,
          episodeTitle: f.episodeTitle,
          podcastName: f.podcastName,
          releasedAt: f.releasedAt,
          durationSeconds: f.durationSeconds,
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
        releasedAt: s.releasedAt,
        durationSeconds: s.durationSeconds,
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
        releasedAt: l.releasedAt,
        durationSeconds: l.durationSeconds,
        movieTitle: l.movieTitle,
        movieYear: l.movieYear,
        detail: `${reviewStateLabel(l.reviewState)} · ${methodLabel(l.method)} · ${Math.round(l.confidence * 100)}%`,
        rejectedBefore: 0,
        flagged: false,
      }));
    }

    // Rows mid-request stay listed (dimmed) so the action has a visible home.
    return out.filter((r) => !done[r.key] || pending[r.key]);
  }, [tab, flags.data, proposals.data, links.data, done, pending]);

  /**
   * Pass U8 — episode-level "review complete". Completeness lives on the episode,
   * not the link: an episode with no links can be marked reviewed, and a
   * confirmed link is not "reviewed" until someone says so. The record is server
   * truth, so the state survives a reload.
   */
  const reviewStatesFn = useServerFn(listEpisodeReviewStates);
  const setReviewedFn = useServerFn(setEpisodeReviewed);
  const [hideReviewed, setHideReviewed] = useState(false);
  const [reviewPending, setReviewPending] = useState<Record<string, true>>({});
  const episodeIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.episodeId))).sort(),
    [rows],
  );
  const reviewStates = useQuery({
    queryKey: ["episode-review-states", episodeIds.join(",")],
    queryFn: () => reviewStatesFn({ data: { episodeIds } }),
    enabled: episodeIds.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
  const reviewMap = reviewStates.data?.reviews ?? {};
  const visibleRows = useMemo(
    () => (hideReviewed ? rows.filter((r) => !reviewMap[r.episodeId]?.reviewed) : rows),
    // reviewMap identity changes with the query result, which is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, hideReviewed, reviewStates.data],
  );

  const markReviewed = useCallback(
    async (ids: string[], reviewed: boolean) => {
      const unique = Array.from(new Set(ids));
      if (unique.length === 0) return;
      setReviewPending((prev) => {
        const next = { ...prev };
        for (const id of unique) next[id] = true;
        return next;
      });
      try {
        const result = await setReviewedFn({ data: { episodeIds: unique, reviewed } });
        setError(
          result.succeeded === result.attempted
            ? null
            : `${result.attempted - result.succeeded} episode(s) could not be updated: ${result.failed[0] ?? "unknown error"}`,
        );
        setNote(
          `${result.succeeded} episode(s) ${reviewed ? "marked reviewed" : "reopened"}${
            result.succeeded === result.attempted ? "" : ` · ${result.attempted - result.succeeded} failed`
          }.`,
        );
        await client.invalidateQueries({ queryKey: ["episode-review-states"] });
        void client.invalidateQueries({ queryKey: ["podcast-coverage"] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update review state.");
      } finally {
        setReviewPending((prev) => {
          const next = { ...prev };
          for (const id of unique) delete next[id];
          return next;
        });
      }
    },
    [client, setReviewedFn],
  );



  const rawTotal =
    tab === "flagged"
      ? (flags.data?.total ?? 0)
      : tab === "proposed"
        ? (proposals.data?.total ?? 0)
        : (links.data?.total ?? 0);
  // Pass U13 — honest counts. `rawTotal` is the server's count for the current
  // filter; rows you decided in this session are reported separately instead of
  // being subtracted into a guess (which used to print "Showing 41 of 0").
  const total = rawTotal;
  const decidedHere = Object.keys(done).filter((k) => !pending[k]).length;

  const active = tab === "flagged" ? flags : tab === "proposed" ? proposals : links;
  const loading = active.isLoading;
  const fetching = active.isFetching;
  // Pass U11 — only a fetch the user asked for counts as "busy".
  const busy = intent !== null;
  const queryError = active.error;
  const noun = tab === "flagged" ? "flags" : tab === "proposed" ? "proposals" : "links";

  // Clear the intent once its fetch has actually completed. The short fallback
  // covers a cache hit where no network fetch ever starts.
  const sawFetch = useRef(false);
  useEffect(() => {
    if (!intent) return;
    if (fetching) {
      sawFetch.current = true;
      return;
    }
    if (sawFetch.current) {
      sawFetch.current = false;
      setIntent(null);
      return;
    }
    const t = setTimeout(() => setIntent(null), 400);
    return () => clearTimeout(t);
  }, [intent, fetching]);

  // Pass U10 — pagination honesty. `rawTotal` is the whole filtered queue, so a
  // page that has been fully decided is not an empty queue: there are more rows
  // sitting past this offset. Advance instead of claiming "nothing here".
  const hasMorePages = rawTotal > offset + pageSize;
  const pageExhausted = rows.length === 0 && offset > 0 && !hasMorePages;

  useEffect(() => {
    if (loading || fetching || queryError) return;
    if (rows.length > 0 || !hasMorePages) return;
    setIntent("page");
    setOffsetFor(tab, offset + pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, hasMorePages, loading, fetching, queryError, tab, offset, pageSize]);

  // Pass U12 — stale optimistic state. `done` keys belong to one query scope;
  // keeping them across a tab/filter/page change hid unrelated rows and skewed
  // the "Showing X of Y" arithmetic. Drop them whenever the scope changes.
  const scopeKey = `${tab}|${submitted}|${maxConfidence}|${reviewState}|${pageSize}|${offset}`;
  const lastScope = useRef(scopeKey);
  useEffect(() => {
    if (lastScope.current === scopeKey) return;
    lastScope.current = scopeKey;
    setDone({});
    setSelected({});
    setPending({});
  }, [scopeKey]);


  /**
   * Background catch-up: the UI has already moved on, so this must not put the
   * card into a busy state. Only the explicit Refresh button passes `true`.
   *
   * Pass U13 — invalidation fan-out. Refetching all five queues after every row
   * action made a 200-row page crawl. The queue you are working refetches at
   * once; the other queues, unmatched episodes and the stats/history tiles are
   * coalesced into one deferred pass, so a burst of decisions costs one refresh.
   */
  const activeQueryKey =
    tab === "flagged" ? "flagged-links" : tab === "proposed" ? "match-suggestions" : "episode-links";
  const deferredRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (deferredRefresh.current) clearTimeout(deferredRefresh.current);
    },
    [],
  );

  const refresh = (userInitiated = false) => {
    if (userInitiated) setIntent("search");
    void client.invalidateQueries({ queryKey: [activeQueryKey] });
    if (deferredRefresh.current) clearTimeout(deferredRefresh.current);
    deferredRefresh.current = setTimeout(() => {
      deferredRefresh.current = null;
      for (const key of [
        "flagged-links",
        "match-suggestions",
        "episode-links",
        "unmatched-episodes",
        "match-actions",
      ]) {
        if (key === activeQueryKey) continue;
        void client.invalidateQueries({ queryKey: [key] });
      }
      onSuccess();
    }, 900);
  };


  /**
   * Pass U11 — per-row pending flags, so only the acted-on row shows work.
   * Pass U13 — these are stable callbacks: rows are memoised, and a new function
   * identity every render would defeat the memo on a 200-row page.
   */
  const startPending = useCallback(
    (keys: string[]) =>
      setPending((prev) => {
        const next = { ...prev };
        for (const k of keys) next[k] = true;
        return next;
      }),
    [],
  );

  const endPending = useCallback(
    (keys: string[]) =>
      setPending((prev) => {
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      }),
    [],
  );

  const markDone = useCallback((keys: string[]) => {
    setDone((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      return next;
    });
    setSelected((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  /** Pass U12: a row the server could not change must come back into view. */
  const unmarkDone = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setDone((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);


  const single = useMutation({
    mutationFn: (vars: {
      action: "approve" | "reject" | "confirm" | "unlink" | "retire";
      key: string;
      episodeId: string;
      movieId: string;
      wasFlagged: boolean;
    }) =>
      queue.run(`match:${vars.key}`, MATCH_ACTION_LABEL[vars.action], async () => {
      if (vars.action === "approve")
        await approveFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      else if (vars.action === "reject")
        await rejectFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      else if (vars.action === "confirm")
        await confirmFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      else if (vars.action === "retire") await retireFn({ data: { episodeId: vars.episodeId } });
      else {
        // Pass U32 — the server verifies the delete really landed; an
        // unverified unlink must leave the row listed with an explicit error.
        const res = await relinkFn({ data: { episodeId: vars.episodeId, fromMovieId: vars.movieId } });
        if (!res.ok) throw new Error(res.error ?? "The link could not be removed.");
      }


      if (vars.wasFlagged) {
        await resolveFlagsFn({
          data: {
            episodeId: vars.episodeId,
            movieId: vars.movieId,
            resolution: vars.action === "confirm" ? "dismissed" : "fixed",
          },
        });
      }
      }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e: Error, vars) => {
      setError(e.message);
      unmarkDone([vars.key]);
    },
    onSettled: (_d, _e, vars) => endPending([vars.key]),
  });

  // Pending is read through a ref so `act` can stay a stable callback.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const singleMutate = single.mutate;

  const act = useCallback(
    (
      action: "approve" | "reject" | "confirm" | "unlink" | "retire",
      row: { key: string; episodeId: string; movieId: string; flagged: boolean },
    ) => {
      if (pendingRef.current[row.key]) return;
      markDone([row.key]);
      startPending([row.key]);
      singleMutate({
        action,
        key: row.key,
        episodeId: row.episodeId,
        movieId: row.movieId,
        wasFlagged: row.flagged,
      });
    },
    [markDone, startPending, singleMutate],
  );

  // `refresh` closes over the current tab, so the row callback reads it through
  // a ref and stays stable for the memoised rows.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const relinkRow = useCallback(
    async (
      row: { key: string; episodeId: string; movieId: string; flagged: boolean },
      movieId: string,
      forProposal: boolean,
    ) => {
      markDone([row.key]);
      startPending([row.key]);
      try {
        await queue.run(`match:${row.key}`, "Relink episode", async () => {
          if (forProposal) {
            await approveFn({ data: { episodeId: row.episodeId, movieId } });
          } else {
            const res = await relinkFn({
              data: { episodeId: row.episodeId, fromMovieId: row.movieId, toMovieId: movieId },
            });
            if (!res.ok) throw new Error(res.error ?? "The old link could not be removed.");
          }

          if (row.flagged) {
            await resolveFlagsFn({
              data: { episodeId: row.episodeId, movieId: row.movieId, resolution: "fixed" },
            });
          }
        });
        setError(null);
        refreshRef.current();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not relink.");
        unmarkDone([row.key]);
      } finally {
        endPending([row.key]);
      }
    },
    [approveFn, relinkFn, resolveFlagsFn, markDone, startPending, endPending, unmarkDone, queue],
  );




  /**
   * Pairs travel as mutation variables, never read from state inside the
   * handler: clearing the selection optimistically would otherwise leave the
   * request with an empty array (server rejects it as "too_small").
   *
   * Pass U12: `keyByPair` maps each pair back to its row key so only pairs the
   * server actually changed stay hidden — failures reappear with a message
   * instead of silently returning on the next refresh.
   */
  const bulk = useMutation({
    mutationFn: async (vars: {
      action: "approve" | "reject" | "confirm" | "unlink" | "retire";
      pairs: { episodeId: string; movieId: string }[];
      flagged: { episodeId: string; movieId: string }[];
      keyByPair: Record<string, string>;
    }) =>
      queue.run(
        "match-bulk",
        `${MATCH_ACTION_LABEL[vars.action]} · ${vars.pairs.length} selected`,
        async () => {
          const result = await bulkFn({ data: { action: vars.action, pairs: vars.pairs } });
          const okPairs = new Set(
            result.results.filter((r) => r.ok).map((r) => `${r.episodeId}:${r.movieId}`),
          );
          // Only clear flags for pairs whose decision actually landed.
          for (const pair of vars.flagged) {
            if (!okPairs.has(`${pair.episodeId}:${pair.movieId}`)) continue;
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
      ),
    onSuccess: (result, vars) => {
      const failedKeys = result.results
        .filter((r) => !r.ok)
        .map((r) => vars.keyByPair[`${r.episodeId}:${r.movieId}`])
        .filter((k): k is string => Boolean(k));
      unmarkDone(failedKeys);
      setError(
        failedKeys.length
          ? `${failedKeys.length} row(s) could not be changed and are still listed: ${result.failed[0] ?? "unknown error"}`
          : null,
      );
      setNote(
        `${result.succeeded} of ${result.attempted} applied${failedKeys.length ? ` · ${failedKeys.length} failed` : ""}.`,
      );
      refresh();
    },
    onError: (e: Error, vars) => {
      // The whole request failed — nothing changed, so put every row back.
      unmarkDone(Object.values(vars.keyByPair));
      setError(e.message);
    },
    onSettled: (_d, _e, vars) => endPending(Object.values(vars.keyByPair)),
  });

  const selectedCount = Object.keys(selected).length;
  // Pass U33 — exactly one bulk action can be in flight, and it is the only one
  // allowed to show a filled colour while it runs.
  const bulkBusy = bulk.isPending;
  const runningBulk = bulk.isPending ? (bulk.variables?.action ?? null) : null;

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selected[r.key]);

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, true> = {};
    for (const r of visibleRows) next[r.key] = true;
    setSelected(next);
  };

  const toggleRow = useCallback(
    (key: string) =>
      setSelected((prev) => {
        const next = { ...prev };
        if (next[key]) delete next[key];
        else next[key] = true;
        return next;
      }),
    [],
  );


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

    const chosen = visibleRows.filter((r) => selected[r.key]);
    if (chosen.length === 0) return;
    const pairs = chosen.map((r) => ({ episodeId: r.episodeId, movieId: r.movieId }));
    const flagged = chosen
      .filter((r) => r.flagged)
      .map((r) => ({ episodeId: r.episodeId, movieId: r.movieId }));
    // Pair -> row key, so per-pair server outcomes can be applied to the list.
    const keyByPair: Record<string, string> = {};
    for (const r of chosen) keyByPair[`${r.episodeId}:${r.movieId}`] = r.key;
    markDone(chosen.map((r) => r.key));
    startPending(chosen.map((r) => r.key));
    bulk.mutate({ action, pairs, flagged, keyByPair });
  };

  return (
    <section id="match-review" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Match review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>Flagged</strong> are pairings someone marked wrong while browsing the app — fix these
        first. <strong>Proposed</strong> are links the matcher suggests but has not written.{" "}
        <strong>Existing links</strong> are already saved; the review-state filter decides which of
        them you see, and confirmed ones are hidden unless you ask for them. Every queue skips
        parked shows and episodes marked “not about a movie”. Rejected pairs are never suggested
        again. Your tab, search, band and batch size are remembered between visits.
      </p>


      <div className="mt-4 inline-flex flex-wrap rounded-full border border-border p-1">
        {(
          [
            ["flagged", "Flagged", flags.data?.unfilteredTotal ?? flags.data?.total ?? 0],
            ["proposed", "Proposed", proposals.data?.unfilteredTotal ?? proposals.data?.total ?? 0],
            ["existing", "Existing links", links.data?.unfilteredTotal ?? links.data?.total ?? 0],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setSelected({});
              setNote(null);
            }}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
            {count > 0 ? (
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
                  tab === value
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>


      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setIntent("search");
          setSubmitted(search.trim());
          setSelected({});
          setDone({});
          resetOffsets();
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
            onChange={(e) => {
              setIntent("search");
              setMaxConfidence(Number(e.target.value));
              resetOffsets();
            }}
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
        {tab === "existing" ? (
          <select
            value={reviewState}
            onChange={(e) => {
              setIntent("search");
              setReviewState(e.target.value as ReviewStateFilter);
              setSelected({});
              setDone({});
              resetOffsets();
            }}
            aria-label="Review state"
            className="rounded-full border border-border bg-background px-3 py-2 text-sm"
          >
            {REVIEW_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={pageSize}
          onChange={(e) => {
            setIntent("search");
            setPageSize(Number(e.target.value));
            resetOffsets();
          }}
          aria-label="Rows per batch"
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          {[50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} at a time
            </option>
          ))}
        </select>

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
      ) : visibleRows.length === 0 ? (
        <div className="mt-4 space-y-2">
          {/* Several different reasons a page can be blank — say which one it is. */}
          <p className="text-sm text-muted-foreground">
            {hideReviewed && rows.length > 0
              ? `Every ${noun} on this page belongs to an episode you have marked reviewed. Untick “Hide reviewed episodes” to see them.`
              : hasMorePages
                ? `Page decided — loading the next ${pageSize} ${noun}…`
                : pageExhausted
                  ? `End of the queue — you have worked through all ${rawTotal} ${noun}${submitted ? ` matching “${submitted}”` : ""}.`
                  : submitted
                    ? `No ${noun} match “${submitted}”. Clear the search to see the rest of the queue.`
                    : tab === "flagged"
                      ? "Nothing flagged as wrong. Flags raised in the app land here."
                      : tab === "proposed"
                        ? `Queue clear — no unconfirmed links at or below ${Math.round(maxConfidence * 100)}% confidence.`
                        : reviewState === "unconfirmed"
                          ? "Queue clear — every saved link in this band has been reviewed."
                          : `No links in this band with review state “${REVIEW_STATES.find((s) => s.value === reviewState)?.label}”.`}
          </p>
          {hideReviewed && rows.length > 0 ? (
            <button
              type="button"
              onClick={() => setHideReviewed(false)}
              className="rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Show reviewed episodes
            </button>
          ) : null}

          {offset > 0 && !hasMorePages ? (
            <button
              type="button"
              onClick={() => {
                setDone({});
                setSelected({});
                setOffsetFor(tab, 0);
              }}
              className="rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Back to the start of the queue
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Showing {visibleRows.length} of {total} {noun}
              {offset > 0 ? (
                <span className="ml-2 normal-case tracking-normal text-muted-foreground">
                  (from #{offset + 1})
                </span>
              ) : null}
              {decidedHere > 0 ? (
                <span className="ml-2 normal-case tracking-normal text-muted-foreground">
                  · {decidedHere} decided here
                </span>
              ) : null}
              {busy ? (
                <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-teal">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  Updating results…
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              {/* Pass U8 — work only the episodes you have not signed off yet. */}
              <label className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={hideReviewed}
                  onChange={(e) => setHideReviewed(e.target.checked)}
                  className="size-3.5 accent-[currentColor]"
                />
                Hide reviewed episodes
              </label>
              <button
                type="button"
                onClick={() => refresh(true)}
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
                    disabled={bulkBusy}
                    onClick={() => runBulk("approve")}
                    className={bulkClass("positive", runningBulk === "approve", bulkBusy)}
                  >
                    {runningBulk === "approve" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3.5" aria-hidden />
                    )}
                    Approve selected
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => runBulk("reject")}
                    className={bulkClass("negative", runningBulk === "reject", bulkBusy)}
                  >
                    {runningBulk === "reject" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <X className="size-3.5" aria-hidden />
                    )}
                    Reject selected
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => runBulk("confirm")}
                    className={bulkClass("positive", runningBulk === "confirm", bulkBusy)}
                  >
                    {runningBulk === "confirm" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3.5" aria-hidden />
                    )}
                    Confirm selected
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => runBulk("unlink")}
                    className={bulkClass("negative", runningBulk === "unlink", bulkBusy)}
                  >
                    {runningBulk === "unlink" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Unlink className="size-3.5" aria-hidden />
                    )}
                    Unlink selected
                  </button>
                </>
              )}
              {/* Retiring an episode is the fastest way to clear ad reads and
                  interview episodes out of every queue at once. */}
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => runBulk("retire")}
                className={bulkClass("retire", runningBulk === "retire", bulkBusy)}
              >
                {runningBulk === "retire" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Ban className="size-3.5" aria-hidden />
                )}
                Not about a movie
              </button>
              {/* Pass U8 — episode-level sign-off, per-episode verified server side. */}
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  void markReviewed(
                    visibleRows.filter((r) => selected[r.key]).map((r) => r.episodeId),
                    true,
                  )
                }
                className={bulkClass("neutral", false, bulkBusy)}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark reviewed
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  void markReviewed(
                    visibleRows.filter((r) => selected[r.key]).map((r) => r.episodeId),
                    false,
                  )
                }
                className={bulkClass("neutral", false, bulkBusy)}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reopen
              </button>
            </div>
          ) : null}



          <ul className="mt-3 space-y-2">
            {visibleRows.map((row) => (
              <ReviewRow
                key={row.key}
                row={row}
                tab={tab}
                selected={Boolean(selected[row.key])}
                pending={Boolean(pending[row.key])}
                reviewed={Boolean(reviewMap[row.episodeId]?.reviewed)}
                reviewPending={Boolean(reviewPending[row.episodeId])}
                onReview={markReviewed}
                onToggle={toggleRow}
                onAct={act}
                onRelink={relinkRow}
              />

            ))}
          </ul>

        </>
      )}
    </section>
  );
}

/**
 * Pass I companion — episode release date + duration on every review row.
 * A 90-second "episode" is an ad or trailer; the date often settles which
 * year's film an ambiguous title refers to.
 */
export function formatEpisodeMeta(releasedAt: string | null, durationSeconds: number | null): string {
  const parts: string[] = [];
  if (releasedAt) {
    const parsed = new Date(`${releasedAt}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      parts.push(
        parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      );
    }
  }
  if (durationSeconds && durationSeconds > 0) {
    const mins = Math.round(durationSeconds / 60);
    parts.push(mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
  }
  return parts.join(" · ");
}

/**
 * Pass U24 — episode description, collapsed by default. Stored descriptions are
 * feed HTML, so tags are stripped to text (never injected as markup) and the
 * candidate movie title is highlighted where it appears.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive exact-title highlight; anything fuzzier is out of U24 scope. */
function highlightTitle(text: string, title: string) {
  const needle = title.trim();
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} className="rounded bg-teal/25 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function EpisodeDescription({ episodeId, movieTitle }: { episodeId: string; movieTitle: string }) {
  const [open, setOpen] = useState(false);
  const fetchDescription = useServerFn(getEpisodeDescription);
  const detail = useQuery({
    queryKey: ["episode-description", episodeId],
    queryFn: () => fetchDescription({ data: { episodeId } }),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const text = detail.data?.description ? stripHtml(detail.data.description) : "";

  return (
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
        Episode description
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
          {detail.isPending ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading description…
            </p>
          ) : detail.isError ? (
            <p className="text-xs text-coral">Couldn’t load the description.</p>
          ) : (
            <>
              {text ? (
                <p className="whitespace-pre-line break-anywhere text-xs leading-relaxed text-muted-foreground">
                  {highlightTitle(text, movieTitle)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No description stored for this episode.
                </p>
              )}
              {detail.data?.sourceUrl ? (
                <a
                  href={detail.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open episode{detail.data.sourcePlatform ? ` on ${detail.data.sourcePlatform}` : ""}
                </a>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}


type ReviewRowData = {
  key: string;
  episodeId: string;
  movieId: string;
  episodeTitle: string;
  podcastName: string;
  releasedAt: string | null;
  durationSeconds: number | null;
  movieTitle: string;
  movieYear: number | null;
  detail: string;
  rejectedBefore: number;
  flagged: boolean;
};

/**
 * Pass U13 — one memoised row. Selecting or acting on a single row used to
 * re-render every other row; on a 200-row batch that was the whole cost of the
 * page. Props are primitives plus stable callbacks, so only the rows that
 * actually changed re-render.
 */
const ReviewRow = memo(function ReviewRow({
  row,
  tab,
  selected,
  pending,
  reviewed,
  reviewPending,
  onReview,
  onToggle,
  onAct,
  onRelink,
}: {
  row: ReviewRowData;
  tab: Tab;
  selected: boolean;
  pending: boolean;
  /** Pass U8 — the episode carries a current review record. */
  reviewed: boolean;
  reviewPending: boolean;
  onReview: (episodeIds: string[], reviewed: boolean) => void | Promise<void>;
  onToggle: (key: string) => void;
  onAct: (
    action: "approve" | "reject" | "confirm" | "unlink" | "retire",
    row: { key: string; episodeId: string; movieId: string; flagged: boolean },
  ) => void;
  onRelink: (
    row: { key: string; episodeId: string; movieId: string; flagged: boolean },
    movieId: string,
    forProposal: boolean,
  ) => void | Promise<void>;
}) {
  // Which button the user actually pressed — the pressed one takes the filled
  // treatment while the request is in flight, so a greyed-out row still shows
  // the chosen action rather than emphasising "Correct" by default.
  const [chosen, setChosen] = useState<RowAction | null>(null);
  useEffect(() => {
    if (!pending) setChosen(null);
  }, [pending]);

  return (
    <li
      aria-busy={pending}
      className={`rounded-xl border bg-background transition-opacity ${
        selected ? "border-primary" : "border-border"
      } ${pending ? "pointer-events-none opacity-60" : ""}`}
    >
      {/* Header is the selection target (comfortable on a phone), but text
          stays selectable: a click that ends a text selection is ignored. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          const text = typeof window !== "undefined" ? (window.getSelection()?.toString() ?? "") : "";
          if (text.trim().length > 0) return;
          onToggle(row.key);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(row.key);
          }
        }}
        aria-pressed={selected}
        className="flex w-full cursor-pointer select-text items-start gap-3 p-3 text-left"
      >
        <span
          aria-hidden
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
          }`}
        >
          {selected ? <Check className="size-3.5" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-anywhere text-sm font-semibold leading-snug">
            {row.episodeTitle}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {row.podcastName}
            {formatEpisodeMeta(row.releasedAt, row.durationSeconds)
              ? ` · ${formatEpisodeMeta(row.releasedAt, row.durationSeconds)}`
              : ""}
          </span>
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

      <EpisodeDescription episodeId={row.episodeId} movieTitle={row.movieTitle} />

      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">

        {pending ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Saving…
          </span>
        ) : null}
        {tab === "proposed" ? (
          <>
            <button
              type="button"
              onClick={() => {
                setChosen("approve");
                onAct("approve", row);
              }}
              className={actionClass("positive", chosen === "approve")}
            >
              <Check className="size-3.5" aria-hidden />
              Approve
            </button>
            <button
              type="button"
              onClick={() => {
                setChosen("reject");
                onAct("reject", row);
              }}
              className={actionClass("negative", chosen === "reject")}
            >
              <X className="size-3.5" aria-hidden />
              Reject
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setChosen("confirm");
                onAct("confirm", row);
              }}
              className={actionClass("positive", chosen === "confirm")}
            >
              <Check className="size-3.5" aria-hidden />
              {row.flagged ? "Actually correct" : "Correct"}
            </button>
            <button
              type="button"
              onClick={() => {
                setChosen("unlink");
                onAct("unlink", row);
              }}
              className={actionClass("negative", chosen === "unlink")}
            >
              <Unlink className="size-3.5" aria-hidden />
              Unlink
            </button>
          </>
        )}
        {/* A reviewed episode is settled — only "Reopen" is offered on it. */}
        {reviewed ? null : (
          <button
            type="button"
            onClick={() => {
              setChosen("retire");
              onAct("retire", row);
            }}
            title="Stop suggesting matches for this episode"
            className={actionClass("retire", chosen === "retire")}
          >
            <Ban className="size-3.5" aria-hidden />
            Not about a movie
          </button>
        )}
        <RelinkPicker
          disabled={pending}
          onPick={(movieId) => onRelink(row, movieId, tab === "proposed")}
        />
        {/* Pass U8 — episode-level sign-off: independent of the link's review
            state, reversible, and written straight to the server. */}
        <button
          type="button"
          disabled={reviewPending}
          onClick={() => void onReview([row.episodeId], !reviewed)}
          title={
            reviewed
              ? "Reopen this episode — it returns to the unreviewed queue"
              : "Mark this episode reviewed — its links look right and none are missing"
          }
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
            reviewed ? "bg-teal text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          {reviewPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : reviewed ? (
            <RotateCcw className="size-3.5" aria-hidden />
          ) : (
            <CheckCheck className="size-3.5" aria-hidden />
          )}
          {reviewed ? "Reopen" : "Mark episode reviewed"}
        </button>
      </div>
    </li>
  );
});



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
  const [year, setYear] = useState("");
  const [submittedYear, setSubmittedYear] = useState<number | undefined>(undefined);
  const [imdbBusy, setImdbBusy] = useState(false);
  const [imdbError, setImdbError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["movie-search", submitted, submittedYear],
    queryFn: () => searchFn({ data: { term: submitted, year: submittedYear } }),
    enabled: submitted.length > 1 && !IMDB_RE.test(submitted),
    retry: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    const parsedYear = year.trim() ? Number(year.trim()) : undefined;
    setImdbError(null);
    if (!IMDB_RE.test(value)) {
      if (parsedYear !== undefined && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2030)) {
        setImdbError("Enter a four-digit release year, or leave it blank.");
        return;
      }
      setSubmitted(value);
      setSubmittedYear(parsedYear);
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
      <form className="flex flex-wrap gap-2" onSubmit={submit}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Movie title or IMDb id (tt0110989)"
          aria-label="Search movies or paste an IMDb id"
          className="min-w-48 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Year"
          inputMode="numeric"
          aria-label="Release year"
          className="w-20 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
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
