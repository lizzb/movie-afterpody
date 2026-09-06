CREATE TYPE public.matcher_strategy AS ENUM (
  'clean_title',
  'year_aware',
  'noisy_description',
  'actor_corroboration',
  'special_word_suppression',
  'stricter_threshold'
);

ALTER TABLE public.podcasts
  ADD COLUMN matcher_strategy public.matcher_strategy NOT NULL DEFAULT 'clean_title';