update public.episode_movies
  set review_state = case when match_confidence >= 0.8 then 'auto_linked'::public.link_review_state else 'proposed'::public.link_review_state end,
      reviewed_at = null
  where match_method not in ('manual','seed') and review_state = 'confirmed';