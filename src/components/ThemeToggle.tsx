import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { prefsActions, usePrefs, type ThemeMode } from "@/lib/prefs";

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Applies the stored theme to <html>. Mounted once from the app shell. */
export function useThemeClass() {
  const { theme } = usePrefs();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme } = usePrefs();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => prefsActions.setTheme(value)}
          className={`rounded-full p-1.5 transition-colors ${
            theme === value ? "bg-coral-soft text-coral" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
