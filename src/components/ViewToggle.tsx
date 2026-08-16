import { LayoutGrid, Rows3 } from "lucide-react";
import { prefsActions, type ViewMode } from "@/lib/prefs";

/** Rows / tiles switch. The choice is persisted per surface in prefs. */
export function ViewToggle({ surface, value }: { surface: string; value: ViewMode }) {
  const options: { value: ViewMode; label: string; Icon: typeof Rows3 }[] = [
    { value: "rows", label: "List view", Icon: Rows3 },
    { value: "tiles", label: "Tile view", Icon: LayoutGrid },
  ];

  return (
    <div
      role="group"
      aria-label="Result layout"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
    >
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === v}
          onClick={() => prefsActions.setViewMode(surface, v)}
          className={`rounded-full p-1.5 transition-colors ${
            value === v
              ? "bg-coral-soft text-coral"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
