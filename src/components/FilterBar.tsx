import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { BrandBadge } from "@/components/BrandBadge";
import { YearRange } from "@/components/YearRange";
import {
  DEFAULT_PREFS,
  prefsActions,
  RUNTIME_CEILING,
  YEAR_CEILING,
  YEAR_FLOOR,
  type Filters,
  type SortKey,
} from "@/lib/prefs";
import { RATING_MAX, RATING_MIN } from "@/lib/ratings";
import { RatingRange } from "@/components/RatingRange";

import type { Genre, StreamingService } from "@/lib/types";

interface Props {
  filters: Filters;
  genres: Genre[];
  services: StreamingService[];
  mySlugs: string[];
  resultCount: number;
  variant?: "tonight" | "movies";
  /** Tonight never shows "Not interested" titles, so hide that control there. */
  showNotInterested?: boolean;
  /** Where applied filters are written. Defaults to Tonight's filter object. */
  onApply?: (next: Filters) => void;
  /** What "Reset" restores, and the baseline for the "N filters active" count. */
  defaults?: Filters;
  /** Pass H5 — Movies keeps the whole panel collapsed until asked for. */
  collapsible?: boolean;
  /** Total catalogue size, shown while the panel is collapsed. */
  totalCount?: number;
}


function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active
          ? "border-transparent bg-coral-soft text-coral neon"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const ERA = /(^|-)((19|20)\d0s|[0-9]0s)$/;
const VIBE_HINTS = ["good-bad", "so-bad", "cult", "camp", "feel-good", "girls", "cozy", "vibe"];

function group(genre: Genre): "Eras" | "Vibes" | "Genres" {
  if (ERA.test(genre.slug)) return "Eras";
  if (VIBE_HINTS.some((h) => genre.slug.includes(h))) return "Vibes";
  return "Genres";
}

/**
 * Compact Tonight controls: two-up runtime/era row, a genre summary chip that
 * opens a sheet, and a single wrapped row of toggles. Keeps results above the
 * fold while letting the vibe vocabulary grow without bound.
 *
 * All controls edit a local DRAFT of the filters. Nothing reaches the shared
 * prefs (and therefore the result list) until "Apply filters" is pressed, so
 * dragging a slider never re-ranks hundreds of movies mid-drag.
 */
const SORTS: { key: SortKey; label: string }[] = [
  { key: "commentary", label: "Commentary score" },
  { key: "episodes", label: "Episode count" },
  { key: "runtime", label: "Shortest runtime" },
  { key: "year", label: "Newest" },
  { key: "title", label: "Title A-Z" },
  { key: "availability", label: "Availability" },
];

function sortLabel(key: SortKey) {
  return SORTS.find((sort) => sort.key === key)?.label ?? "Commentary score";
}

function RuntimeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const min = 70;
  const max = RUNTIME_CEILING;
  const percent = ((value - min) / Math.max(1, max - min)) * 100;

  return (
    <div className="relative h-12 touch-none">
      <div className="absolute top-1/2 h-3 w-full -translate-y-1/2 rounded-full bg-muted" />
      <div
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-coral"
        style={{ width: `${percent}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={value}
        aria-label="Max runtime"
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-12 w-full appearance-none bg-transparent [&::-moz-range-thumb]:size-8 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-coral [&::-moz-range-thumb]:bg-card [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-2.5 [&::-webkit-slider-thumb]:size-8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-coral [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-card"
      />
    </div>
  );
}

/** Count of individual filter properties whose draft value differs from applied. */
function countChanges(draft: Filters, applied: Filters): number {
  let changes = 0;
  for (const key of Object.keys(draft) as (keyof Filters)[]) {
    const a = draft[key];
    const b = applied[key];
    const same = Array.isArray(a) && Array.isArray(b)
      ? a.length === b.length && a.every((v) => (b as string[]).includes(v as string))
      : a === b;
    if (!same) changes += 1;
  }
  return changes;
}

export function FilterBar({
  filters,
  genres,
  services,
  mySlugs,
  resultCount,
  variant = "tonight",
  showNotInterested = false,
  onApply,
  defaults = DEFAULT_PREFS.filters,
  collapsible = false,
  totalCount,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<Filters>(filters);
  const [expanded, setExpanded] = useState(false);

  // Re-seed the draft whenever the applied filters change from elsewhere
  // (page load/hydration, Reset, another surface committing a change).
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const patch = (next: Partial<Filters>) => setDraft((prev) => ({ ...prev, ...next }));
  const pendingChanges = countChanges(draft, filters);
  const dirty = pendingChanges > 0;
  // Sort is an ordering, not a filter — it never counts as "active".
  const activeCount = countChanges({ ...filters, sortBy: defaults.sortBy }, defaults);

  const apply = () => {
    if (!dirty) return;
    if (onApply) onApply(draft);
    else prefsActions.setFilters(draft);
  };


  const selected = genres.filter((g) => draft.genreSlugs.includes(g.slug));
  const summary =
    selected.length === 0
      ? "Any genre or vibe"
      : selected.length <= 2
        ? selected.map((g) => g.name).join(", ")
        : `${selected
            .slice(0, 2)
            .map((g) => g.name)
            .join(", ")} +${selected.length - 2}`;

  const visibleServices = services.filter((s) => mySlugs.includes(s.slug));
  const isMovies = variant === "movies";

  const grouped = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const buckets: Record<string, Genre[]> = { Genres: [], Eras: [], Vibes: [] };
    for (const g of genres) {
      if (needle && !g.name.toLowerCase().includes(needle)) continue;
      buckets[group(g)]!.push(g);
    }
    return buckets;
  }, [genres, term]);

  const toggleGenre = (slug: string) =>
    patch({
      genreSlugs: draft.genreSlugs.includes(slug)
        ? draft.genreSlugs.filter((s) => s !== slug)
        : [...draft.genreSlugs, slug],
    });

  const trigger = collapsible ? (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-3.5 text-left transition-colors hover:bg-card"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors group-hover:text-primary">
          <SlidersHorizontal className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold text-foreground">
            Movie filters
          </span>
          <span className="block text-xs text-muted-foreground">
            {activeCount === 0
              ? "No filters — searching everything"
              : `${activeCount} filter${activeCount === 1 ? "" : "s"} active`}
            {typeof totalCount === "number"
              ? ` · ${resultCount} of ${totalCount} titles`
              : ` · ${resultCount} match${resultCount === 1 ? "" : "es"}`}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-coral">
        {expanded ? "Hide" : "Expand"}
        <ChevronDown
          className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </span>
    </button>
  ) : null;

  if (collapsible && !expanded) {
    return (
      <div className="space-y-2">
        {trigger}
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onApply?.(defaults)}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden />
            Clear all filters
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={collapsible ? "space-y-2" : undefined}>
      {trigger}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="flex min-w-0 items-center gap-1.5 truncate text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          {isMovies ? "Movie filters" : "Tonight’s parameters"}
          {dirty ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-coral"
              title="Unapplied changes"
            />
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => setDraft(defaults)}
          className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" aria-hidden />
          Reset
        </button>
      </div>


      {!isMovies ? (
        <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between text-[11px] font-semibold text-muted-foreground">
              Max runtime
              <span className="font-bold text-foreground">
                {draft.maxRuntime >= RUNTIME_CEILING ? "Any" : `${draft.maxRuntime}m`}
              </span>
            </span>
            <RuntimeSlider
              value={draft.maxRuntime}
              onChange={(maxRuntime) => patch({ maxRuntime })}
            />
          </label>

          <div>
            <span className="flex items-baseline justify-between text-[11px] font-semibold text-muted-foreground">
              Era
              <span className="font-bold text-foreground">
                {draft.yearMin}&ndash;{draft.yearMax}
              </span>
            </span>
            <YearRange
              min={YEAR_FLOOR}
              max={YEAR_CEILING}
              from={draft.yearMin}
              to={draft.yearMax}
              onChange={({ from, to }) => patch({ yearMin: from, yearMax: to })}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            selected.length > 0
              ? "border-transparent bg-coral-soft text-coral"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="size-3" aria-hidden />
          {summary}
        </button>
        {isMovies ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Sort: {sortLabel(draft.sortBy)}
          </button>
        ) : null}
        <Chip
          active={draft.onlyMyServices}
          onClick={() => patch({ onlyMyServices: !draft.onlyMyServices })}
        >
          On my services
        </Chip>
        <Chip
          active={draft.commentaryOnly}
          onClick={() => patch({ commentaryOnly: !draft.commentaryOnly })}
        >
          Has commentary
        </Chip>
        <Chip
          active={draft.preferredOnly}
          onClick={() => patch({ preferredOnly: !draft.preferredOnly })}
        >
          My podcasts
        </Chip>
        <Chip active={draft.hideWatched} onClick={() => patch({ hideWatched: !draft.hideWatched })}>
          Unwatched
        </Chip>
        {showNotInterested ? (
          <Chip
            active={draft.hideNotInterested}
            onClick={() => patch({ hideNotInterested: !draft.hideNotInterested })}
          >
            Hide not interested
          </Chip>
        ) : null}
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
          {resultCount} match{resultCount === 1 ? "" : "es"}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
            dirty
              ? "bg-primary text-primary-foreground neon"
              : "cursor-default border border-border bg-card text-muted-foreground"
          }`}
        >
          <Check className="size-4" aria-hidden />
          {dirty
            ? `Apply filters (${pendingChanges} change${pendingChanges === 1 ? "" : "s"})`
            : "Filters applied"}
        </button>
        {dirty ? (
          <button
            type="button"
            onClick={() => setDraft(filters)}
            className="shrink-0 rounded-full border border-border px-3 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div className="relative z-10 max-h-[80vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-popover p-5 shadow-poster sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold">Filters &amp; Sort</h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <label className="relative mt-3 block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search genres and vibes"
                aria-label="Search genres and vibes"
                className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-4 text-base sm:text-sm"
              />
            </label>

            {isMovies ? (
              <div className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                <label className="block">
                  <span className="flex items-baseline justify-between text-[11px] font-semibold text-muted-foreground">
                    Max runtime
                    <span className="font-bold text-foreground">
                      {draft.maxRuntime >= RUNTIME_CEILING ? "Any" : `${draft.maxRuntime}m`}
                    </span>
                  </span>
                  <RuntimeSlider
                    value={draft.maxRuntime}
                    onChange={(maxRuntime) => patch({ maxRuntime })}
                  />
                </label>

                <div>
                  <span className="flex items-baseline justify-between text-[11px] font-semibold text-muted-foreground">
                    Era
                    <span className="font-bold text-foreground">
                      {draft.yearMin}&ndash;{draft.yearMax}
                    </span>
                  </span>
                  <YearRange
                    min={YEAR_FLOOR}
                    max={YEAR_CEILING}
                    from={draft.yearMin}
                    to={draft.yearMax}
                    onChange={({ from, to }) => patch({ yearMin: from, yearMax: to })}
                  />
                </div>
              </div>
            ) : null}

            {(["Genres", "Eras", "Vibes"] as const).map((section) =>
              grouped[section]!.length > 0 ? (
                <div key={section} className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {section}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {grouped[section]!.map((g) => (
                      <Chip
                        key={g.id}
                        active={draft.genreSlugs.includes(g.slug)}
                        onClick={() => toggleGenre(g.slug)}
                      >
                        {g.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Sort by
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SORTS.map((sort) => (
                  <Chip
                    key={sort.key}
                    active={draft.sortBy === sort.key}
                    onClick={() => patch({ sortBy: sort.key })}
                  >
                    {sort.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Ratings allowed
              </p>
              <div className="mt-1">
                <RatingRange
                  min={draft.minRating}
                  max={draft.maxRating}
                  onChange={({ min, max }) => patch({ minRating: min, maxRating: max })}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip
                  active={draft.minRating <= RATING_MIN && draft.maxRating >= RATING_MAX}
                  onClick={() => patch({ minRating: RATING_MIN, maxRating: RATING_MAX })}
                >
                  Any rating
                </Chip>
                <Chip
                  active={draft.allowUnrated}
                  onClick={() => patch({ allowUnrated: !draft.allowUnrated })}
                >
                  Include unrated (NR)
                </Chip>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Movie and TV ratings share one ladder. Only titles inside the band are shown; unrated
                titles are included only when that chip is on.
              </p>
            </div>


            {visibleServices.length > 0 ? (
              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Streaming on
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {visibleServices.map((s) => {
                    const active = draft.serviceSlugs.includes(s.slug);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          patch({
                            serviceSlugs: active
                              ? draft.serviceSlugs.filter((v) => v !== s.slug)
                              : [...draft.serviceSlugs, s.slug],
                          })
                        }
                      >
                        <BrandBadge slug={s.slug} label={s.short_name} active={active} />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Nothing selected means all of your services.
                </p>
              </div>
) : null}

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Seasonal
              </p>
              <div className="mt-2">
                <Chip
                  active={draft.excludeHoliday}
                  onClick={() => patch({ excludeHoliday: !draft.excludeHoliday })}
                >
                  Exclude holiday movies
                </Chip>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                A keyword rule that drops titles with standalone “Santa” or “Christmas” in the title
                or synopsis.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                apply();
                setSheetOpen(false);
              }}
              className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground neon"
            >
              <Check className="size-4" aria-hidden />
              {dirty
                ? `Apply filters (${pendingChanges} change${pendingChanges === 1 ? "" : "s"})`
                : `Show ${resultCount} match${resultCount === 1 ? "" : "es"}`}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
