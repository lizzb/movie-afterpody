import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Gauge } from "lucide-react";
import { scoreMatcher } from "@/lib/ingestion.functions";

type Report = Awaited<ReturnType<typeof scoreMatcher>>;

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

/**
 * Pass R3 — replays the live scoring rules over every approve/reject decision
 * you've made and reports where the matcher is wrong. No TMDB calls, no AI.
 */
export function MatcherScoreCard() {
  const run = useServerFn(scoreMatcher);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await run({ data: undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Replays the current matching rules over every approve, confirm and reject you&rsquo;ve
        recorded, so a rule change can be measured instead of guessed.
      </p>
      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Gauge className="size-4" aria-hidden />}
        {busy ? "Scoring…" : "Score the matcher"}
      </button>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {report ? (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Labelled pairs" value={String(report.labelledPairs)} />
            <Stat label="Approved" value={String(report.positives)} />
            <Stat label="Rejected" value={String(report.negatives)} />
            <Stat label={`Precision @${report.threshold}`} value={pct(report.precisionAtThreshold)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={`Recall @${report.threshold}`} value={pct(report.recallAtThreshold)} />
            <Stat
              label="Mean score, approved"
              value={report.meanConfidencePositive === null ? "—" : Math.round(report.meanConfidencePositive).toString()}
            />
            <Stat
              label="Mean score, rejected"
              value={report.meanConfidenceNegative === null ? "—" : Math.round(report.meanConfidenceNegative).toString()}
            />
            <Stat label="Worst band" value={report.worstBand ?? "—"} />
          </div>

          <div>
            <h3 className="font-display text-base font-bold">Precision by confidence band</h3>
            <ul className="mt-2 space-y-1">
              {report.bands.map((b) => (
                <li key={b.band} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold">{b.band}</span>
                  <span className="text-muted-foreground">
                    {b.positives} right · {b.negatives} wrong · precision {pct(b.precision)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-base font-bold">Signals ranked by lift</h3>
            <p className="text-xs text-muted-foreground">
              Lift is how much more often a signal appears on approved matches than rejected ones.
              Positive lift earns weight; negative lift should cost it.
            </p>
            <ul className="mt-2 space-y-1">
              {report.signals.map((s) => (
                <li key={s.signal} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold">{s.signal}</span>
                  <span className={s.lift >= 0 ? "text-teal" : "text-destructive"}>
                    {s.lift >= 0 ? "+" : ""}
                    {Math.round(s.lift * 100)} pts · {s.positives} right / {s.negatives} wrong
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {report.unscored > 0 ? (
            <p className="text-xs text-muted-foreground">
              {report.unscored} labelled pair{report.unscored === 1 ? "" : "s"} skipped — the episode
              or movie has since been deleted.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-bold leading-tight">{value}</p>
    </div>
  );
}
