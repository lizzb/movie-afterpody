/**
 * Pass U4 — named, selectable per-podcast matcher strategies.
 *
 * A strategy is NOT a new algorithm. It is a named configuration of the rules
 * the deterministic matcher already runs (title coverage, year agreement,
 * description evidence, special-word suppression, thresholds). The default
 * strategy's config is exactly today's hard-coded behaviour, so enabling U4
 * changes nothing until a show is deliberately reassigned.
 *
 * Adding a future strategy = adding one entry to STRATEGY_CONFIG. No existing
 * strategy's scoring code has to change.
 *
 * This file is client-safe (labels are needed by the admin UI).
 */

export const MATCHER_STRATEGIES = [
  "clean_title",
  "year_aware",
  "noisy_description",
  "actor_corroboration",
  "special_word_suppression",
  "stricter_threshold",
] as const;

export type MatcherStrategy = (typeof MATCHER_STRATEGIES)[number];

export const DEFAULT_MATCHER_STRATEGY: MatcherStrategy = "clean_title";

export const STRATEGY_LABEL: Record<MatcherStrategy, string> = {
  clean_title: "Clean-title (default)",
  year_aware: "Year-aware",
  noisy_description: "Noisy-title + description",
  actor_corroboration: "Actor/name corroboration",
  special_word_suppression: "Special-word suppression",
  stricter_threshold: "Stricter threshold",
};

export const STRATEGY_BLURB: Record<MatcherStrategy, string> = {
  clean_title: "Today's behaviour: the episode title is the main evidence.",
  year_aware: "Leans harder on release-year agreement and punishes year mismatches.",
  noisy_description: "For joke/chatter titles: show notes carry more of the decision.",
  actor_corroboration:
    "Non-exact title hits must also be named in the show notes before they count.",
  special_word_suppression: "Common, short and format words never carry a match on their own.",
  stricter_threshold: "Same scores, higher bar before anything is suggested or auto-linked.",
};

export function isMatcherStrategy(value: unknown): value is MatcherStrategy {
  return typeof value === "string" && (MATCHER_STRATEGIES as readonly string[]).includes(value);
}

export function asMatcherStrategy(value: unknown): MatcherStrategy {
  return isMatcherStrategy(value) ? value : DEFAULT_MATCHER_STRATEGY;
}

/**
 * The knobs a strategy may turn. Every default here equals the value the
 * matcher used before U4 — that is what keeps `clean_title` a no-op.
 */
export interface StrategyConfig {
  /** Confidence floor below which a candidate is not returned at all. */
  suggestionFloor: number;
  /** Points added when the episode title's year equals the movie's year. */
  yearBonus: number;
  /** Points added when the years are within one. */
  yearNearBonus: number;
  /** Points removed on a year mismatch (only below the mismatch ceiling). */
  yearMismatchPenalty: number;
  /** A mismatch above this confidence is ignored (today: 80). */
  yearMismatchCeiling: number;
  /** Points added when the movie title is named verbatim in the description. */
  descriptionBonus: number;
  /** Floor a description-only hit is lifted to (normal / generic-title case). */
  descriptionOnlyFloor: number;
  descriptionOnlyGenericFloor: number;
  /**
   * When true, a non-exact title match must also be corroborated (named in the
   * description, or an agreeing year) before it can score above the cap.
   */
  requireCorroboration: boolean;
  /** Cap applied to an uncorroborated match when requireCorroboration is on. */
  uncorroboratedCap: number;
  /**
   * When true, single generic one-word titles get the same "needs
   * corroboration" treatment the common-word rule already applies.
   */
  suppressGenericWithoutCorroboration: boolean;
  /**
   * Extra points required on top of the usual auto-link / accept thresholds by
   * the callers that write links (sync, recheck, build).
   */
  writeThresholdBoost: number;
}

const BASE: StrategyConfig = {
  suggestionFloor: 25,
  yearBonus: 10,
  yearNearBonus: 3,
  yearMismatchPenalty: 15,
  yearMismatchCeiling: 80,
  descriptionBonus: 10,
  descriptionOnlyFloor: 48,
  descriptionOnlyGenericFloor: 40,
  requireCorroboration: false,
  uncorroboratedCap: 45,
  suppressGenericWithoutCorroboration: false,
  writeThresholdBoost: 0,
};

export const STRATEGY_CONFIG: Record<MatcherStrategy, StrategyConfig> = {
  // Exactly the pre-U4 matcher.
  clean_title: { ...BASE },

  // Year agreement is already a signal; this strategy simply trusts it more.
  year_aware: {
    ...BASE,
    yearBonus: 15,
    yearNearBonus: 5,
    yearMismatchPenalty: 25,
    yearMismatchCeiling: 90,
  },

  // Feeds whose titles are puns/chatter: the description does the work.
  noisy_description: {
    ...BASE,
    descriptionBonus: 16,
    descriptionOnlyFloor: 56,
    descriptionOnlyGenericFloor: 44,
  },

  // Reuses the existing description-corroboration rule as a hard requirement.
  actor_corroboration: {
    ...BASE,
    requireCorroboration: true,
    uncorroboratedCap: 45,
  },

  // Turns the existing common-word / short-title suppression up.
  special_word_suppression: {
    ...BASE,
    suppressGenericWithoutCorroboration: true,
  },

  // Same scores, higher bar.
  stricter_threshold: {
    ...BASE,
    suggestionFloor: 45,
    writeThresholdBoost: 10,
  },
};

export function strategyConfig(strategy: MatcherStrategy | null | undefined): StrategyConfig {
  return STRATEGY_CONFIG[asMatcherStrategy(strategy)];
}
