import { CalendarCheck } from "lucide-react";
import { formatWatchedOn } from "@/lib/lists";

/**
 * Shared "consumed on" treatment — checked calendar + Month DD, YYYY — used by
 * watched history (movies) and listened history (episodes).
 */
export function ConsumedDate({ date }: { date: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
      <CalendarCheck className="size-3" aria-hidden />
      {formatWatchedOn(date)}
    </span>
  );
}
