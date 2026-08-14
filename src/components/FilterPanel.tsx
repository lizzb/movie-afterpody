import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { prefsActions, RUNTIME_CEILING, YEAR_CEILING, YEAR_FLOOR, type Filters } from "@/lib/prefs";
import type { Genre, StreamingService } from "@/lib/types";

interface Props {
  filters: Filters;
  genres: Genre[];
  services: StreamingService[];
  mySlugs: string[];
  resultCount: number;
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
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-transparent bg-navy text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterPanel({ filters, genres, services, mySlugs, resultCount }: Props) {
  const visibleServices = services.filter((s) => mySlugs.includes(s.slug));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <SlidersHorizontal className="size-4" aria-hidden />
          Tonight&rsquo;s parameters
        </h2>
        <button
          type="button"
          onClick={() => prefsActions.resetFilters()}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" aria-hidden />
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Max runtime
            <span className="text-sm font-bold normal-case tracking-normal text-foreground">
              {filters.maxRuntime >= RUNTIME_CEILING ? "Any" : `${filters.maxRuntime} min`}
            </span>
          </span>
          <input
            type="range"
            min={70}
            max={RUNTIME_CEILING}
            step={5}
            value={filters.maxRuntime}
            onChange={(e) => prefsActions.setFilters({ maxRuntime: Number(e.target.value) })}
            className="mt-2 w-full accent-coral"
          />
        </label>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Era
          </span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={YEAR_FLOOR}
              max={YEAR_CEILING}
              value={filters.yearMin}
              onChange={(e) => prefsActions.setFilters({ yearMin: Number(e.target.value) })}
              aria-label="Earliest year"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="number"
              min={YEAR_FLOOR}
              max={YEAR_CEILING}
              value={filters.yearMax}
              onChange={(e) => prefsActions.setFilters({ yearMax: Number(e.target.value) })}
              aria-label="Latest year"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Genres &amp; vibes
        </span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genres.map((genre) => (
            <Chip
              key={genre.id}
              active={filters.genreSlugs.includes(genre.slug)}
              onClick={() =>
                prefsActions.setFilters({
                  genreSlugs: filters.genreSlugs.includes(genre.slug)
                    ? filters.genreSlugs.filter((s) => s !== genre.slug)
                    : [...filters.genreSlugs, genre.slug],
                })
              }
            >
              {genre.name}
            </Chip>
          ))}
        </div>
      </div>

      {visibleServices.length > 0 ? (
        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Streaming on
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleServices.map((service) => (
              <Chip
                key={service.id}
                active={filters.serviceSlugs.includes(service.slug)}
                onClick={() =>
                  prefsActions.setFilters({
                    serviceSlugs: filters.serviceSlugs.includes(service.slug)
                      ? filters.serviceSlugs.filter((s) => s !== service.slug)
                      : [...filters.serviceSlugs, service.slug],
                  })
                }
              >
                {service.short_name}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing selected means all of your services. Change your services in Setup.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip
          active={filters.onlyMyServices}
          onClick={() => prefsActions.setFilters({ onlyMyServices: !filters.onlyMyServices })}
        >
          Only what I can stream
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
          My podcasts only
        </Chip>
        <Chip
          active={filters.hideWatched}
          onClick={() => prefsActions.setFilters({ hideWatched: !filters.hideWatched })}
        >
          Unwatched only
        </Chip>
      </div>

      <p className="mt-4 text-sm font-semibold text-muted-foreground">
        {resultCount} movie{resultCount === 1 ? "" : "s"} match.
      </p>
    </section>
  );
}
