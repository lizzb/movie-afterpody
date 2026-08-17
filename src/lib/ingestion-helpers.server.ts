import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export interface UnlinkedEpisode {
  id: string;
  slug: string;
  title: string;
  podcast_id: string;
  podcastName: string;
  releasedAt: string | null;
}

/** Episodes with zero rows in episode_movies — nothing surfaces them in the app. */
export async function fetchUnlinkedEpisodes(
  admin: Admin,
  opts: { podcastId?: string | undefined; limit?: number | undefined } = {},
): Promise<UnlinkedEpisode[]> {
  let query = admin
    .from("podcast_episodes")
    .select("id, slug, title, podcast_id, released_at, podcasts!inner(name)")
    .order("released_at", { ascending: false });

  if (opts.podcastId) query = query.eq("podcast_id", opts.podcastId);

  const { data: episodes, error } = await query.returns<
    {
      id: string;
      slug: string;
      title: string;
      podcast_id: string;
      released_at: string | null;
      podcasts: { name: string };
    }[]
  >();
  if (error) throw error;

  const { data: links, error: linkError } = await admin.from("episode_movies").select("episode_id");
  if (linkError) throw linkError;
  const linked = new Set((links ?? []).map((l) => l.episode_id));

  const unlinked = (episodes ?? [])
    .filter((ep) => !linked.has(ep.id))
    .map((ep) => ({
      id: ep.id,
      slug: ep.slug,
      title: ep.title,
      podcast_id: ep.podcast_id,
      podcastName: ep.podcasts.name,
      releasedAt: ep.released_at,
    }));

  return opts.limit ? unlinked.slice(0, opts.limit) : unlinked;
}

export async function fetchRejectedPairs(admin: Admin): Promise<Set<string>> {
  const { data } = await admin.from("episode_match_rejections").select("episode_id, movie_id");
  return new Set((data ?? []).map((r) => `${r.episode_id}:${r.movie_id}`));
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
