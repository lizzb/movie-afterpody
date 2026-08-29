import { RATING_LADDER, RATING_MAX, RATING_MIN, labelForRank } from "@/lib/ratings";

interface Props {
  min: number;
  max: number;
  onChange: (next: { min: number; max: number }) => void;
}

const THUMB =
  "pointer-events-none absolute inset-0 h-12 w-full appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-8 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-coral " +
  "[&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-card " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-8 " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-coral [&::-moz-range-thumb]:bg-card";

/**
 * Pass Y2 — one dual-handle slider over the normalised rating ladder, so the
 * allowed band has both a minimum and a maximum (never two separate sliders).
 */
export function RatingRange({ min, max, onChange }: Props) {
  const span = RATING_MAX - RATING_MIN;
  const left = ((min - RATING_MIN) / span) * 100;
  const right = ((max - RATING_MIN) / span) * 100;

  return (
    <div>
      <div className="relative h-12 touch-none">
        <div className="absolute top-1/2 h-3 w-full -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-coral"
          style={{ left: `${left}%`, right: `${100 - right}%` }}
        />
        <input
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={1}
          value={min}
          aria-label="Lowest rating allowed"
          onChange={(e) => onChange({ min: Math.min(Number(e.target.value), max), max })}
          className={THUMB}
        />
        <input
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={1}
          value={max}
          aria-label="Highest rating allowed"
          onChange={(e) => onChange({ min, max: Math.max(Number(e.target.value), min) })}
          className={THUMB}
        />
      </div>
      <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
        {RATING_LADDER.map((step) => (
          <span
            key={step.label}
            className={step.rank >= min && step.rank <= max ? "text-foreground" : undefined}
          >
            {step.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold text-foreground">
        {labelForRank(min)} – {labelForRank(max)}
      </p>
    </div>
  );
}
