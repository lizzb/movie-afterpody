import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Gauge } from "lucide-react";
import { scoreMatcher, listPodcastCoverage } from "@/lib/ingestion.functions";
import {
  MATCHER_STRATEGIES,
  STRATEGY_LABEL,
  type MatcherStrategy,
} from "@/lib/matcher-strategies";

type Report = Awaited<ReturnType<typeof scoreMatcher>>;

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

/**
 * Pass R3 — replays the live scoring rules over every approve/reject decision
 * you've made and reports where the matcher is wrong. No TMDB calls, no AI.
 * Pass U4 — can be scoped to one strategy and/or one show.
 */
export function MatcherScoreCard() {
  const run = useServerFn(scoreMatcher);
  const fetchCoverage = useServerFn(listPodcastCoverage);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "" = each show's own assigned strategy / every show.
  const [strategy, setStrategy] = useState<MatcherStrategy | "">("");
  const [podcastId, setPodcastId] = useState("");

  const coverage = useQuery({
    queryKey: ["podcast-coverage"],
    queryFn: () => fetchCoverage(),
    staleTime: 60_000,
  });
  const shows = coverage.data?.podcasts ?? [];

  const onRun = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(
        await run({
          data: { strategy: strategy || null, podcastId: podcastId || null },
        }),
      );
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

      {/* Pass U4 — per-strategy and per-show scoring. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Strategy
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as MatcherStrategy | "")}
            className="max-w-[14rem] rounded-full border border-border bg-card px-2 py-1 font-semibold text-foreground"
          >
            <option value="">As assigned per show</option>
            {MATCHER_STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {STRATEGY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Show
          <select
            value={podcastId}
            onChange={(e) => setPodcastId(e.target.value)}
            className="max-w-[14rem] rounded-full border border-border bg-card px-2 py-1 font-semibold text-foreground"
          >
            <option value="">Every show</option>
            {shows.map((s) => (
              <option key={s.podcastId} value={s.podcastId}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          <p className="text-xs text-muted-foreground">
            Scored with{" "}
            <span className="font-semibold text-foreground">
              {report.strategy ? STRATEGY_LABEL[report.strategy] : "each show's assigned strategy"}
            </span>
            {report.podcastId
              ? ` · ${shows.find((s) => s.podcastId === report.podcastId)?.name ?? "one show"}`
              : " · every show"}
          </p>
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
            <p className="text-xs text-muted-foreground">
              Higher bands should be mostly right; a low-precision high band means the rules are too trusting.
              A low band with many approved pairs means the rules are too cautious.
            </p>
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
              Positive lift earns weight; negative lift should cost it. For example, if “common-word title”
              is negative, one-word movies like Girls/Big/After need stronger corroboration before being suggested.
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
