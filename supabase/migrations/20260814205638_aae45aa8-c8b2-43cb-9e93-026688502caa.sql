-- More podcasts (the ones the user follows)
INSERT INTO public.podcasts (slug, name, description, accent, episode_count, latest_episode_at, activity_status, provider_source) VALUES
('that-aged-well','That Aged Well','Revisiting the movies of the 80s, 90s and 00s to see what holds up.','coral',210,'2026-08-04','active','seed'),
('ps-i-hate-this-movie','PS I Hate This Movie','One host loves it, the other very much does not.','berry',168,'2026-08-06','active','seed'),
('your-inner-child-is-an-idiot','Your Inner Child Is An Idiot','Childhood favourites put on trial by adults.','gold',142,'2026-07-28','active','seed'),
('the-villain-was-right','The Villain Was Right','Arguing the case for the movie bad guy.','purple',96,'2026-08-01','active','seed'),
('swimfans','Swimfans','Two friends swim through teen thrillers and 90s trash.','teal',188,'2026-08-08','active','seed'),
('mom-cant-cook','Mom Can''t Cook','A deep dive into Disney Channel and family movie nostalgia.','coral',320,'2026-07-22','active','seed'),
('romancing-the-pod','Romancing the Pod','Rom-coms taken seriously, lovingly, exhaustively.','berry',204,'2026-08-05','active','seed'),
('i-hate-it-but-i-love-it','I Hate It But I Love It','Guilty pleasures defended out loud.','gold',176,'2026-07-30','active','seed'),
('ruined','Ruined with Alison Leiby and Halle Kieffer','One host recaps a horror movie so the other never has to watch it.','purple',258,'2026-08-07','active','seed'),
('dorking-out','Dorking Out','Enthusiastic, chatty commentary on pop movies old and new.','teal',412,'2026-08-03','active','seed'),
('the-bechdel-cast','The Bechdel Cast','Examining the portrayal of women in movies, with jokes.','berry',368,'2026-08-06','active','seed'),
('too-scary-didnt-watch','Too Scary Didn''t Watch','Horror recapped for the faint of heart.','purple',224,'2026-08-02','active','seed'),
('podstruck','Podstruck','Long-form conversations about the movies that stuck.','navy',134,'2026-07-19','slow','seed'),
('what-went-wrong','What Went Wrong','Production disaster stories behind famous flops.','coral',188,'2026-08-04','active','seed'),
('all-80s-movies','All ''80s Movies','Every week, another movie from the decade of neon.','gold',252,'2026-07-31','active','seed');

INSERT INTO public.podcast_external_metrics (podcast_id, platform, rating, rating_count, external_url)
SELECT p.id, 'apple', v.rating, v.rating_count, NULL
FROM (VALUES
('that-aged-well',4.7,1840),('ps-i-hate-this-movie',4.6,920),('your-inner-child-is-an-idiot',4.5,610),
('the-villain-was-right',4.4,380),('swimfans',4.8,1450),('mom-cant-cook',4.7,2600),
('romancing-the-pod',4.8,2100),('i-hate-it-but-i-love-it',4.6,1180),('ruined',4.8,9400),
('dorking-out',4.6,1520),('the-bechdel-cast',4.7,7300),('too-scary-didnt-watch',4.7,2400),
('podstruck',4.3,240),('what-went-wrong',4.5,1660),('all-80s-movies',4.4,780)
) AS v(slug, rating, rating_count)
JOIN public.podcasts p ON p.slug = v.slug;

-- More movies
INSERT INTO public.movies (slug, title, release_year, runtime_minutes, synopsis, tagline, accent) VALUES
('clue','Clue',1985,94,'Six dinner guests, one blackmailing butler, three different endings.','It''s not just a game anymore.','gold'),
('heathers','Heathers',1988,103,'A high-school clique gets picked apart by a boyfriend with a body count.','Best friends. Bitter enemies.','berry'),
('mystic-pizza','Mystic Pizza',1988,104,'Three young women work a Connecticut pizza parlour through one formative summer.','','coral'),
('sleeping-with-the-enemy','Sleeping with the Enemy',1991,99,'A woman fakes her own death to escape a controlling husband.','','purple'),
('death-becomes-her','Death Becomes Her',1992,104,'Two rivals drink an immortality potion and fall apart, literally.','','teal'),
('empire-records','Empire Records',1995,90,'One chaotic day at an independent record store.','','gold'),
('the-craft','The Craft',1996,101,'Four teenage outcasts discover real witchcraft, then discover each other.','Welcome to the witching hour.','purple'),
('the-wedding-singer','The Wedding Singer',1998,95,'A jilted wedding singer falls for a waitress who''s engaged to a jerk.','','coral'),
('wild-things','Wild Things',1998,108,'A Florida scandal with more twists than it can carry.','','teal'),
('jawbreaker','Jawbreaker',1999,87,'A birthday prank kills the most popular girl in school.','','berry'),
('ten-things-i-hate-about-you','10 Things I Hate About You',1999,97,'A Shakespeare-shaped high-school romance in Seattle.','How do I loathe thee?','coral'),
('drop-dead-gorgeous','Drop Dead Gorgeous',1999,97,'A small-town beauty pageant turns lethal, on camera.','','gold'),
('bring-it-on','Bring It On',2000,98,'A cheer squad reckons with the routines it stole.','','berry'),
('legally-blonde','Legally Blonde',2001,96,'Elle Woods follows a breakup to Harvard Law and outworks everybody.','','coral');

-- Genres
INSERT INTO public.movie_genres (movie_id, genre_id)
SELECT m.id, g.id FROM (VALUES
('clue','comedy'),('clue','mystery'),
('heathers','comedy'),('heathers','drama'),
('mystic-pizza','romance'),('mystic-pizza','comedy'),
('sleeping-with-the-enemy','thriller'),('sleeping-with-the-enemy','drama'),
('death-becomes-her','comedy'),('death-becomes-her','fantasy'),
('empire-records','comedy'),('empire-records','drama'),
('the-craft','horror'),('the-craft','thriller'),
('the-wedding-singer','romance'),('the-wedding-singer','comedy'),
('wild-things','thriller'),('wild-things','mystery'),
('jawbreaker','comedy'),('jawbreaker','thriller'),
('ten-things-i-hate-about-you','romance'),('ten-things-i-hate-about-you','comedy'),
('drop-dead-gorgeous','comedy'),('drop-dead-gorgeous','mystery'),
('bring-it-on','comedy'),
('legally-blonde','comedy'),('legally-blonde','romance')
) v(movie, genre)
JOIN public.movies m ON m.slug = v.movie
JOIN public.genres g ON g.slug = v.genre
ON CONFLICT DO NOTHING;

-- Availability
INSERT INTO public.movie_availability (movie_id, service_id, offer_type, region, provider_source)
SELECT m.id, s.id, v.offer::offer_type, 'US', 'seed' FROM (VALUES
('clue','prime-video','subscription'),('clue','tubi','free_ads'),
('heathers','netflix','subscription'),
('mystic-pizza','prime-video','subscription'),
('sleeping-with-the-enemy','hulu','subscription'),
('death-becomes-her','netflix','subscription'),('death-becomes-her','max','subscription'),
('empire-records','tubi','free_ads'),
('the-craft','netflix','subscription'),('the-craft','max','subscription'),
('the-wedding-singer','prime-video','subscription'),
('wild-things','netflix','subscription'),
('jawbreaker','tubi','free_ads'),
('ten-things-i-hate-about-you','disney-plus','subscription'),
('drop-dead-gorgeous','hulu','subscription'),
('bring-it-on','netflix','subscription'),('bring-it-on','prime-video','subscription'),
('legally-blonde','netflix','subscription'),('legally-blonde','prime-video','subscription')
) v(movie, svc, offer)
JOIN public.movies m ON m.slug = v.movie
JOIN public.streaming_services s ON s.slug = v.svc;

-- Episodes
INSERT INTO public.podcast_episodes (podcast_id, slug, title, description, released_at, duration_seconds, episode_number)
SELECT p.id, v.slug, v.title, NULL, v.released::date, v.dur, NULL
FROM (VALUES
('the-bechdel-cast','bc-legally-blonde','Legally Blonde with Jamie Loftus','2025-03-11',5400),
('romancing-the-pod','rtp-legally-blonde','Elle Woods, Method Actor','2025-06-02',4020),
('that-aged-well','taw-legally-blonde','Does Legally Blonde Still Slap?','2026-02-17',3600),
('i-hate-it-but-i-love-it','ihibili-legally-blonde','The Bend and Snap Defence','2024-11-05',3300),
('the-bechdel-cast','bc-the-craft','The Craft with Caitlin Durante','2024-10-24',5100),
('ruined','ruined-the-craft','The Craft, Ruined','2025-10-09',3900),
('too-scary-didnt-watch','tsdw-the-craft','The Craft: Light As A Feather','2025-10-16',3450),
('swimfans','swim-the-craft','Nancy Downs Was Right','2026-01-22',4200),
('the-villain-was-right','tvwr-the-craft','In Defence of Nancy','2026-03-05',2880),
('swimfans','swim-wild-things','Wild Things: Everyone Is Lying','2025-08-14',4500),
('ps-i-hate-this-movie','psi-wild-things','PS I Hate Wild Things','2026-04-02',3600),
('swimfans','swim-jawbreaker','Jawbreaker Forever','2025-09-18',4080),
('ps-i-hate-this-movie','psi-jawbreaker','Jawbreaker: Fine, It''s Fun','2026-05-14',3240),
('romancing-the-pod','rtp-ten-things','10 Things I Hate About You','2025-02-13',4260),
('that-aged-well','taw-ten-things','Ten Things, Twenty-Five Years On','2026-06-09',3720),
('the-bechdel-cast','bc-ten-things','10 Things I Hate About You','2024-04-18',5220),
('romancing-the-pod','rtp-wedding-singer','The Wedding Singer','2025-05-08',3960),
('all-80s-movies','a80-clue','Clue (1985)','2026-01-09',3180),
('dorking-out','do-clue','Dorking Out About Clue','2025-12-04',4620),
('what-went-wrong','www-clue','Clue: Three Endings, One Flop','2026-02-26',3540),
('all-80s-movies','a80-heathers','Heathers','2026-03-19',3300),
('that-aged-well','taw-heathers','How Very: Heathers Revisited','2025-11-13',3840),
('the-bechdel-cast','bc-heathers','Heathers with Erin Gibson','2024-08-15',5040),
('all-80s-movies','a80-mystic-pizza','Mystic Pizza','2026-04-23',3060),
('your-inner-child-is-an-idiot','yici-death-becomes-her','Death Becomes Her Broke Me','2025-07-24',3480),
('what-went-wrong','www-death-becomes-her','Death Becomes Her: The Effects Nightmare','2025-09-11',3660),
('i-hate-it-but-i-love-it','ihibili-drop-dead-gorgeous','Drop Dead Gorgeous','2025-04-10',3540),
('the-flop-house','fh-drop-dead-gorgeous','Drop Dead Gorgeous','2024-12-12',4680),
('mom-cant-cook','mcc-bring-it-on','Bring It On','2025-06-19',3900),
('that-aged-well','taw-bring-it-on','Bring It On, Twenty-Five Years Later','2026-05-28',3600),
('podstruck','ps-empire-records','Empire Records: Damn The Man','2025-10-30',5400),
('ps-i-hate-this-movie','psi-sleeping-with-the-enemy','Sleeping With The Enemy','2026-06-25',3420),
('swimfans','swim-teen-thriller-double','Double Feature: Jawbreaker & Wild Things','2026-07-16',5700)
) AS v(pod, slug, title, released, dur)
JOIN public.podcasts p ON p.slug = v.pod;

-- Episode -> movie links
INSERT INTO public.episode_movies (episode_id, movie_id, match_method, match_confidence, is_primary_subject)
SELECT e.id, m.id, 'seed'::match_method, 1.00, v.primary_subject
FROM (VALUES
('bc-legally-blonde','legally-blonde',true),('rtp-legally-blonde','legally-blonde',true),
('taw-legally-blonde','legally-blonde',true),('ihibili-legally-blonde','legally-blonde',true),
('bc-the-craft','the-craft',true),('ruined-the-craft','the-craft',true),
('tsdw-the-craft','the-craft',true),('swim-the-craft','the-craft',true),
('tvwr-the-craft','the-craft',true),
('swim-wild-things','wild-things',true),('psi-wild-things','wild-things',true),
('swim-jawbreaker','jawbreaker',true),('psi-jawbreaker','jawbreaker',true),
('rtp-ten-things','ten-things-i-hate-about-you',true),('taw-ten-things','ten-things-i-hate-about-you',true),
('bc-ten-things','ten-things-i-hate-about-you',true),
('rtp-wedding-singer','the-wedding-singer',true),
('a80-clue','clue',true),('do-clue','clue',true),('www-clue','clue',true),
('a80-heathers','heathers',true),('taw-heathers','heathers',true),('bc-heathers','heathers',true),
('a80-mystic-pizza','mystic-pizza',true),
('yici-death-becomes-her','death-becomes-her',true),('www-death-becomes-her','death-becomes-her',true),
('ihibili-drop-dead-gorgeous','drop-dead-gorgeous',true),('fh-drop-dead-gorgeous','drop-dead-gorgeous',true),
('mcc-bring-it-on','bring-it-on',true),('taw-bring-it-on','bring-it-on',true),
('ps-empire-records','empire-records',true),
('psi-sleeping-with-the-enemy','sleeping-with-the-enemy',true),
('swim-teen-thriller-double','jawbreaker',true),('swim-teen-thriller-double','wild-things',true)
) AS v(ep, movie, primary_subject)
JOIN public.podcast_episodes e ON e.slug = v.ep
JOIN public.movies m ON m.slug = v.movie
ON CONFLICT DO NOTHING;

-- Listen sources
INSERT INTO public.episode_sources (episode_id, platform, url, access_tier, is_primary, embeddable)
SELECT e.id, 'apple', 'https://podcasts.apple.com/search?term=' || replace(e.slug, '-', '%20'), 'public'::source_access_tier, true, false
FROM public.podcast_episodes e
WHERE NOT EXISTS (SELECT 1 FROM public.episode_sources s WHERE s.episode_id = e.id);