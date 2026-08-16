import { Popcorn } from "lucide-react";

/**
 * The app's own Commentary Score. Deliberately distinct from third-party
 * ratings: accent-filled and always labelled as ours.
 */
export function ScorePill({
  value,
  compact = false,
  large = false,
}: {
  value: number;
  compact?: boolean;
  large?: boolean;
}) {
  if (large) {
    return (
      <span className="inline-flex flex-col items-center rounded-xl bg-primary px-3 py-1.5 text-primary-foreground neon">
        <span className="font-display text-xl font-bold leading-none">{value}</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em]">Commentary</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
      title={`Commentary Score ${value}`}
    >
      <Popcorn className="size-3" aria-hidden />
      {compact ? value : `Commentary ${value}`}
    </span>
  );
}
