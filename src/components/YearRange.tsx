interface Props {
  min: number;
  max: number;
  from: number;
  to: number;
  onChange: (next: { from: number; to: number }) => void;
}

const THUMB =
  "pointer-events-none absolute inset-0 h-9 w-full appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-coral " +
  "[&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-card " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-coral [&::-moz-range-thumb]:bg-card";

/** Single compact track with two generous handles for a year range. */
export function YearRange({ min, max, from, to, onChange }: Props) {
  const span = Math.max(1, max - min);
  const left = ((from - min) / span) * 100;
  const right = ((to - min) / span) * 100;

  return (
    <div className="relative h-9 touch-none">
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-coral"
        style={{ left: `${left}%`, right: `${100 - right}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={from}
        aria-label="Earliest year"
        onChange={(e) => onChange({ from: Math.min(Number(e.target.value), to), to })}
        className={THUMB}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={to}
        aria-label="Latest year"
        onChange={(e) => onChange({ from, to: Math.max(Number(e.target.value), from) })}
        className={THUMB}
      />
    </div>
  );
}
