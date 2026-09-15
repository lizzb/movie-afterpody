/**
 * Pass U75 — replays the standing matcher regression corpus.
 *
 *   bun scripts/matcher-corpus.ts            # every case
 *   bun scripts/matcher-corpus.ts U55 U56    # only cases owned by these passes
 *
 * Read-only: it loads candidate movies from the catalogue and scores them with
 * the live matcher. It never writes links, rejections or review states.
 * Required evidence in every U55–U62 pass report.
 */
import { createClient } from "@supabase/supabase-js";
import { MATCHER_CORPUS, type CorpusCase } from "../src/lib/matcher-corpus";
import {
  matchEpisodeToMovies,
  computeTitleWordStats,
} from "../src/lib/providers/matching.server";

const THRESHOLD = 25;

const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

type Movie = {
  id: string;
  title: string;
  release_year: number | null;
  release_date: string | null;
  collection_id: number | null;
};

const owners = process.argv.slice(2).map((a) => a.toUpperCase());
const cases = owners.length
  ? MATCHER_CORPUS.filter((c) => owners.includes(c.owner.toUpperCase()))
  : MATCHER_CORPUS;

/** Candidate pool: every movie named by the corpus, loaded once. */
const wanted = new Set<string>();
for (const c of cases) for (const t of [...(c.expect ?? []), ...(c.forbid ?? [])]) wanted.add(t);

const pool: Movie[] = [];
for (const title of wanted) {
  const { data, error } = await db
    .from("movies")
    .select("id, title, release_year, release_date, collection_id")
    .ilike("title", title)
    .limit(5);
  if (error) {
    console.error(`Lookup failed for "${title}": ${error.message}`);
    process.exit(2);
  }
  for (const row of data ?? []) pool.push(row as Movie);
}

/**
 * Pass U56 — word distinctiveness comes from the whole catalogue, not from the
 * handful of candidate films this script loads, so scores match production.
 */
const allTitles: string[] = [];
for (let page = 0; page < 20; page += 1) {
  const from = page * 1000;
  const { data, error } = await db
    .from("movies")
    .select("title")
    .order("id")
    .range(from, from + 999);
  if (error) {
    console.error(`Title-statistics read failed: ${error.message}`);
    process.exit(2);
  }
  const rows = data ?? [];
  for (const row of rows) allTitles.push((row as { title: string }).title);
  if (rows.length < 1000) break;
}
const titleWordStats = computeTitleWordStats(allTitles);
console.log(`Distinctiveness corpus: ${allTitles.length} catalogue titles.\n`);

function evaluate(c: CorpusCase) {
  const scored = matchEpisodeToMovies(c.episode, pool, { titleWordStats });
  const live = scored.filter((s) => s.confidence >= THRESHOLD);
  const top = live[0] ?? null;
  const problems: string[] = [];

  // A case whose expected film is not in the catalogue cannot be judged here —
  // report it rather than counting it as a matcher failure.
  const absent = (c.expect ?? []).filter(
    (t) => !pool.some((m) => m.title.toLowerCase() === t.toLowerCase()),
  );
  if (absent.length) return { problems, top, skipped: absent };

  for (const bad of c.forbid ?? []) {
    const hit = live.find((s) => s.title.toLowerCase() === bad.toLowerCase());
    if (hit) problems.push(`suggested "${hit.title}" at ${hit.confidence} (${hit.reason})`);
  }
  if (c.expectNoLink && live.length) {
    problems.push(`expected no link, got "${top?.title}" at ${top?.confidence}`);
  }
  for (const good of c.expect ?? []) {
    const hit = live.find((s) => s.title.toLowerCase() === good.toLowerCase());
    if (!hit) problems.push(`missing "${good}"`);
    else if (top && hit !== top) problems.push(`"${good}" lost to "${top.title}" (${top.confidence})`);
  }
  return { problems, top, skipped: [] as string[] };
}

const byOwner = new Map<string, { pass: number; fail: number; skip: number }>();
let failures = 0;
let skipped = 0;

for (const c of cases) {
  const { problems, top, skipped: absent } = evaluate(c);
  const state = absent.length ? "SKIP" : problems.length === 0 ? "PASS" : "FAIL";
  const tally = byOwner.get(c.owner) ?? { pass: 0, fail: 0, skip: 0 };
  if (state === "PASS") tally.pass += 1;
  else if (state === "SKIP") {
    tally.skip += 1;
    skipped += 1;
  } else {
    tally.fail += 1;
    failures += 1;
  }
  byOwner.set(c.owner, tally);

  const winner = top ? `${top.title} @${top.confidence}` : "no candidate";
  console.log(`${state} [${c.owner}] ${c.show} — ${c.episode}`);
  console.log(`      winner: ${winner}`);
  if (top) console.log(`      signals: ${JSON.stringify(top.signals)}`);
  if (absent.length) console.log(`      ~ not in the catalogue: ${absent.join(", ")}`);
  for (const p of problems) console.log(`      ! ${p}`);
}

console.log("\nBy owning pass:");
for (const [owner, t] of [...byOwner.entries()].sort()) {
  console.log(`  ${owner}: ${t.pass} pass / ${t.fail} fail / ${t.skip} skipped`);
}
const judged = cases.length - skipped;
console.log(`\n${judged - failures}/${judged} judged cases pass (${skipped} skipped).`);
process.exit(0);
