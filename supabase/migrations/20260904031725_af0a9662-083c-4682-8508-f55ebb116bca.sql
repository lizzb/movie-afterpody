-- 1. Remove automated links that recreate a pair the admin already rejected.
DELETE FROM public.episode_movies em
USING public.episode_match_rejections r
WHERE em.episode_id = r.episode_id
  AND em.movie_id = r.movie_id
  AND em.match_method <> 'manual'
  AND em.review_state <> 'confirmed';

-- 2. Restore episode sign-offs that were reopened only because an automated
--    link reappeared, where the episode now has no outstanding unconfirmed link.
UPDATE public.episode_reviews er
   SET reopened_at = NULL, reopen_reason = NULL
 WHERE er.reopen_reason = 'new_link'
   AND er.reopened_at IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.episode_movies em
      WHERE em.episode_id = er.episode_id
        AND em.review_state <> 'confirmed'
   );