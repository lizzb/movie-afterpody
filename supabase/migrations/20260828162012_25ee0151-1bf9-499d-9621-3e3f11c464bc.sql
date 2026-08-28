create type public.link_review_state as enum ('proposed','auto_linked','confirmed');

alter table public.episode_movies
  add column review_state public.link_review_state not null default 'proposed',
  add column reviewed_at timestamptz,
  add column reviewed_by uuid;

update public.episode_movies
  set review_state = 'confirmed', reviewed_at = now()
  where match_method in ('manual','seed') or match_confidence >= 0.95;

update public.episode_movies
  set review_state = 'auto_linked'
  where review_state = 'proposed' and match_confidence >= 0.8;

create index if not exists episode_movies_review_state_idx on public.episode_movies (review_state);