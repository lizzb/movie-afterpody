import { useMemo, useState } from "react";
import { Check, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { BrandBadge } from "@/components/BrandBadge";
import { YearRange } from "@/components/YearRange";
import {
  prefsActions,
  RUNTIME_CEILING,
  YEAR_CEILING,
  YEAR_FLOOR,
  type Filters,
  type SortKey,
} from "@/lib/prefs";
import { RATING_LADDER, RATING_MAX } from "@/lib/ratings";
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

function RuntimeSlider({ value }: { value: number }) {
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
        onChange={(e) => prefsActions.setFilters({ maxRuntime: Number(e.target.value) })}
        className="absolute inset-0 h-12 w-full appearance-none bg-transparent [&::-moz-range-thumb]:size-8 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-coral [&::-moz-range-thumb]:bg-card [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-2.5 [&::-webkit-slider-thumb]:size-8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-coral [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-card"
      />
    </div>
  );
}

export function FilterBar({
  filters,
  genres,
  services,
  mySlugs,
  resultCount,
  variant = "tonight",
  showNotInterested = false,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [term, setTerm] = useState("");

  const selected = genres.filter((g) => filters.genreSlugs.includes(g.slug));
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
    prefsActions.setFilters({
      genreSlugs: filters.genreSlugs.includes(slug)
        ? filters.genreSlugs.filter((s) => s !== slug)
        : [...filters.genreSlugs, slug],
    });

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="flex min-w-0 items-center gap-1.5 truncate text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          {isMovies ? "Movie filters" : "Tonight’s parameters"}
        </h2>
        <button
          type="button"
          onClick={() => prefsActions.resetFilters()}
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
                {filters.maxRuntime >= RUNTIME_CEILING ? "Any" : `${filters.maxRuntime}m`}
              </span>
            </span>
            <RuntimeSlider value={filters.maxRuntime} />
          </label>

          <div>
            <span className="flex items-baseline justify-between text-[11px] font-semibold text-muted-foreground">
              Era
              <span className="font-bold text-foreground">
                {filters.yearMin}&ndash;{filters.yearMax}
              </span>
            </span>
            <YearRange
              min={YEAR_FLOOR}
              max={YEAR_CEILING}
              from={filters.yearMin}
              to={filters.yearMax}
              onChange={({ from, to }) => prefsActions.setFilters({ yearMin: from, yearMax: to })}
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
            Sort: {sortLabel(filters.sortBy)}
          </button>
        ) : null}
        <Chip
          active={filters.onlyMyServices}
          onClick={() => prefsActions.setFilters({ onlyMyServices: !filters.onlyMyServices })}
        >
          On my services
        </Chip>
        <Chip
          active={filters.commentaryOnly}
          onClick={() => prefsActions.setFilters({ commentaryOnly: !filters.commentaryOnly })}
        >
          Has commentary
        </Chip>
        <Chip
          active={filters.preferredOnly}
          onClick={() => prefsActions.setFilters({ preferredOnly: !filters.preferredOnly })}
        >
          My podcasts
        </Chip>
        <Chip
          active={filters.hideWatched}
          onClick={() => prefsActions.setFilters({ hideWatched: !filters.hideWatched })}
        >
          Unwatched
        </Chip>
        {showNotInterested ? (
          <Chip
            active={filters.hideNotInterested}
            onClick={() =>
              prefsActions.setFilters({ hideNotInterested: !filters.hideNotInterested })
            }
          >
            Hide not interested
          </Chip>
        ) : null}
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
          {resultCount} match{resultCount === 1 ? "" : "es"}
        </span>
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
                      {filters.maxRuntime >= RUNTIME_CEILING ? "Any" : `${filters.maxRuntime}m`}
                    </span>
                  </span>
                  <RuntimeSlider value={filters.maxRuntime} />
                </label>

                <div>
                  <span className="flex items-baseline justify-between text-[11px] font-semibold text-muted-foreground">
                    Era
                    <span className="font-bold text-foreground">
                      {filters.yearMin}&ndash;{filters.yearMax}
                    </span>
                  </span>
                  <YearRange
                    min={YEAR_FLOOR}
                    max={YEAR_CEILING}
                    from={filters.yearMin}
                    to={filters.yearMax}
                    onChange={({ from, to }) =>
                      prefsActions.setFilters({ yearMin: from, yearMax: to })
                    }
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
                        active={filters.genreSlugs.includes(g.slug)}
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
                    active={filters.sortBy === sort.key}
                    onClick={() => prefsActions.setFilters({ sortBy: sort.key })}
                  >
                    {sort.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Highest rating allowed
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RATING_LADDER.map((step) => (
                  <Chip
                    key={step.label}
                    active={filters.maxRating === step.rank}
                    onClick={() => prefsActions.setFilters({ maxRating: step.rank })}
                  >
                    {step.label}
                  </Chip>
                ))}
                <Chip
                  active={filters.maxRating >= RATING_MAX}
                  onClick={() => prefsActions.setFilters({ maxRating: RATING_MAX })}
                >
                  Any
                </Chip>
              </div>
              <div className="mt-2">
                <Chip
                  active={filters.allowUnrated}
                  onClick={() => prefsActions.setFilters({ allowUnrated: !filters.allowUnrated })}
                >
                  Include unrated (NR)
                </Chip>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Movie and TV ratings share one ladder. Unrated titles are only included when this is
                on.
              </p>
            </div>

            {visibleServices.length > 0 ? (
              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Streaming on
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {visibleServices.map((s) => {
                    const active = filters.serviceSlugs.includes(s.slug);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          prefsActions.setFilters({
                            serviceSlugs: active
                              ? filters.serviceSlugs.filter((v) => v !== s.slug)
                              : [...filters.serviceSlugs, s.slug],
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

            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground neon"
            >
              <Check className="size-4" aria-hidden />
              Show {resultCount} match{resultCount === 1 ? "" : "es"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
