import { useMemo } from "react";
import { useDiscovery } from "./discovery";
import { buildPodcastEntries, type PodcastEntry } from "./podcast-entries";

export type {
  PodcastEntry,
  PodcastEpisodeRow,
  PodcastMovie,
  PodcastSummary,
} from "./podcast-entries";

/**
 * Podcast-first view of the same catalog the movie feed uses. Kept for surfaces
 * that already hold the full catalogue; the Shows list and show detail read
 * server-side pages instead (Pass L2b).
 */
export function usePodcasts() {
  const discovery = useDiscovery();
  const { catalog, entries } = discovery;

  const podcastEntries = useMemo<PodcastEntry[]>(
    () => (catalog ? buildPodcastEntries(catalog, entries) : []),
    [catalog, entries],
  );

  return { ...discovery, podcastEntries };
}
