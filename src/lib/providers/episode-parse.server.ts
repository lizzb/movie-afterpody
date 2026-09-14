/**
 * Pass U55 — deterministic episode-title parsing stage.
 *
 * Splits a podcast episode title into role-labelled segments *before* any
 * scoring happens, so guest credits ("… with Colby Day", "w/ Billy Ray
 * Brewton") stop being treated as movie-title evidence.
 *
 * Deliberately conservative: a split only happens when the separator is
 * surrounded by spaces (or bracketed) and the trailing text looks like a list
 * of person names. Callers that know the catalogue can still test the whole
 * original string for an exact title match, so genuine titles containing
 * "With" are never broken by this stage.
 */

export type SegmentRole = "prefix" | "title" | "guest";

export interface TitleSegment {
  role: SegmentRole;
  text: string;
}

export interface ParsedEpisodeTitle {
  /** Episode-number / format prefix that was removed, if any. */
  prefixText: string;
  /** The title-bearing remainder — the only segment that carries title evidence. */
  titleText: string;
  /** Guest credit text, or "" when none was detected. */
  guestText: string;
  segments: TitleSegment[];
}

/** Episode-number / bonus prefixes that dilute a title comparison. */
const PREFIXES = [
  /^ep(isode)?\.?\s*#?\d+\s*[:\-–—|]?\s*/i,
  /^#\d+\s*[:\-–—|]?\s*/,
  /^\d{1,4}\s*[:\-–—|]\s*/,
  /^s\d+\s*e\d+\s*[:\-–—|]?\s*/i,
  /^(bonus|mini(sode)?|patreon|preview|encore|classic|rewatch|revisit|live)\s*[:\-–—|]\s*/i,
  // Pass U75 — observed show-format prefixes. General patterns only: a short
  // format label ending in a separator ("BRUNCH:", "Last Looks:", "Redux:",
  // "DTH Classic:", "Micro Queers:", "Matinee Monday:", "Feed Drop -"),
  // and abbreviated numbered formats ("FH Mini 117 –", "Ep. #441 -").
  /^[a-z]{0,4}\s*mini(sode)?\s*#?\d*\s*[:\-–—|]\s*/i,
  /^(brunch|redux|re-?issue|re-?release|matinee\s+monday|last\s+looks|micro\s+queers|dth\s+classic|interview|interviews|feed\s+drop|mailbag|listener\s+mail|q\s*&?\s*a)\s*[:\-–—|]\s*/i,
];

/**
 * Format suffixes that describe the episode, not the film: "LIVE!",
 * "(Patreon Clip)", "(Classic)", "(Re-Release)", "[Jason Edition]",
 * "(LIVE from Brooklyn)", "(Hallmark+ - 2026)".
 */
const FORMAT_SUFFIXES = [
  /\s*[-–—|]?\s*live\s*!+\s*$/i,
  /\s*\(\s*(?:live\s+(?:from|at)\s+[^)]*)\)\s*$/i,
  /\s*\(\s*(?:patreon(?:\s+clip| preview)?|clip|classic|re-?release|re-?issue|rerun|encore|redux|bonus|live|uncut|extended)\s*\)\s*$/i,
  /\s*\[[^\]]{2,30}(edition|version|cut)\]\s*$/i,
  // Channel/date tags left after the year is removed: "(Hallmark+ - 2026)".
  /\s*[([][A-Za-z+&.\s]{2,20}\s*[-–—]\s*(?:(?:19|20)\d{2})?\s*[)\]]\s*$/,
];

const GUEST_MARKER = String.raw`(?:with|w\/|w\.|feat\.?|featuring|ft\.?)`;

/** "( with Amy Smart )" / "[w/ Blake Howard]" at the very end. */
const BRACKETED_GUEST = new RegExp(String.raw`[([]\s*${GUEST_MARKER}\s+([^)\]]{2,80})[)\]]\s*$`, "i");

/** "… with Colby Day" / "… - w/ Danette Chavez & Amy Smart" at the very end. */
const TRAILING_GUEST = new RegExp(String.raw`\s+(?:[-–—|,:]\s*)?${GUEST_MARKER}\s+(.{2,80})$`, "i");

/** "Interview: Niall Matter on Much About Love" — the title follows " on ". */
const GUEST_ON_TITLE = /^(.{2,60}?)\s+on\s+(.{2,80})$/i;

const NAME_PARTICLES = new Set([
  "de",
  "del",
  "della",
  "di",
  "da",
  "van",
  "von",
  "der",
  "la",
  "le",
  "mc",
  "mac",
  "st",
  "jr",
  "sr",
  "ii",
  "iii",
  "and",
  "the",
]);

/**
 * True when the trailing text reads like one to four person names, e.g.
 * "Colby Day", "Danette Chavez & Amy Smart", "Billy Ray Brewton and Amanda Smith".
 */
export function looksLikeGuestNames(input: string): boolean {
  const text = input.trim().replace(/[.,;:!?\s]+$/g, "");
  if (!text || text.length > 70) return false;
  if (/\d/.test(text)) return false;
  if (/["“”:;/]/.test(text)) return false;

  const parts = text
    .split(/\s*(?:,|&|\band\b|\+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 4) return false;

  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return false;
    let capitalised = 0;
    for (const word of words) {
      const bare = word.replace(/[^A-Za-z'’-]/g, "");
      if (!bare) return false;
      const lower = bare.toLowerCase().replace(/[.'’-]/g, "");
      if (/^[A-Z]/.test(bare)) capitalised += 1;
      else if (!NAME_PARTICLES.has(lower)) return false;
    }
    // At least one capitalised word per name, and names are mostly capitalised.
    if (capitalised === 0) return false;
  }
  return true;
}

function stripPrefixes(input: string): { prefix: string; rest: string } {
  let rest = input.trim();
  let prefix = "";
  for (let i = 0; i < 3; i += 1) {
    let changed = false;
    for (const re of PREFIXES) {
      const next = rest.replace(re, "");
      if (next !== rest) {
        prefix += rest.slice(0, rest.length - next.length);
        rest = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { prefix: prefix.trim(), rest };
}

/** Removes trailing format tags ("LIVE!", "(Patreon Clip)", "[Jason Edition]"). */
function stripFormatSuffixes(input: string): string {
  let out = input.trim();
  for (let i = 0; i < 3; i += 1) {
    let changed = false;
    for (const re of FORMAT_SUFFIXES) {
      const next = out.replace(re, "");
      if (next.trim() !== out.trim() && next.replace(/[^A-Za-z0-9]/g, "").length >= 2) {
        out = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Empty brackets left behind once a year or tag was removed.
  return out
    .replace(/[([]\s*[-–—]?\s*[)\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits an episode title into prefix / title / guest segments. */
export function parseEpisodeTitle(episodeTitle: string): ParsedEpisodeTitle {
  const { prefix, rest } = stripPrefixes(episodeTitle ?? "");
  let titleText = stripFormatSuffixes(rest);
  let guestText = "";

  const bracketed = titleText.match(BRACKETED_GUEST);
  if (bracketed?.[1] && looksLikeGuestNames(bracketed[1])) {
    guestText = bracketed[1].trim();
    titleText = titleText.slice(0, bracketed.index ?? titleText.length).trim();
  } else {
    const trailing = titleText.match(TRAILING_GUEST);
    if (trailing?.[1] && looksLikeGuestNames(trailing[1])) {
      const head = titleText.slice(0, trailing.index ?? titleText.length).trim();
      const headWords = head.split(/\s+/).filter(Boolean).length;
      const spelledOut = /^\s*[-–—|,:]?\s*with\b/i.test(
        titleText.slice(trailing.index ?? 0),
      );
      // Never leave an empty or one-word title behind: "Sleeping with Other
      // People" must not become "Sleeping". Abbreviated markers (w/, feat.) are
      // never part of a film title, so a one-word head is fine for those.
      const headOk = head.replace(/[^A-Za-z0-9]/g, "").length >= 2 && (headWords >= 2 || !spelledOut);
      if (headOk) {
        guestText = trailing[1].trim();
        titleText = head;
      }
    }
  }

  // Pass U75 — "Interview: <guest> on <movie title>". Only after an interview
  // format prefix, so ordinary titles containing " on " stay intact.
  if (!guestText && /interview/i.test(prefix)) {
    const onSplit = titleText.match(GUEST_ON_TITLE);
    if (onSplit?.[1] && onSplit[2] && looksLikeGuestNames(onSplit[1])) {
      guestText = onSplit[1].trim();
      titleText = onSplit[2].trim();
    }
  }

  titleText = titleText.replace(/[\s\-–—|:,]+$/g, "").trim();

  const segments: TitleSegment[] = [];
  if (prefix) segments.push({ role: "prefix", text: prefix });
  if (titleText) segments.push({ role: "title", text: titleText });
  if (guestText) segments.push({ role: "guest", text: guestText });

  return { prefixText: prefix, titleText: titleText || rest, guestText, segments };
}
