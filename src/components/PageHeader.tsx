import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InfoSheet } from "@/components/InfoSheet";

/**
 * Pass D — one header template for every page: icon + small-caps eyebrow, then
 * the title. Identical sizes and spacing so all pages read as one family.
 */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  /** Optional one-line context under the title, e.g. catalogue size. */
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-coral">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <InfoSheet />
      </div>
    </header>
  );
}
